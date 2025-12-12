const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());

// Serve static files from React app
app.use(express.static(path.join(__dirname, '../client/dist')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all for dev
    methods: ["GET", "POST"]
  }
});

// Load board config
const boardConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'board.json'), 'utf8'));
// Load chance cards
let chanceCards = [];
try {
  chanceCards = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'chance_cards.json'), 'utf8'));
} catch (e) {
  console.log("No chance cards found or error loading.");
}

// In-memory state
// Structure: { roomId: { players: { uuid: { ... } }, board_ownership: {}, turn_order: [], current_turn_index: 0, logs: [] } }
const rooms = {};

const STARTING_CASH = 1500;
const PASS_START_BONUS = 200;
const JAIL_POSITION = 10;
const BAIL_PRICE = 50;

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', ({ roomId, nick, uuid }) => {
    // 1. Validate or create UUID
    const playerUuid = uuid || uuidv4();

    // 2. Initialize room if not exists
    if (!rooms[roomId]) {
      rooms[roomId] = {
        id: roomId,
        players: {},
        board_ownership: {}, // field_id -> player_uuid
        turn_order: [],
        current_turn_index: 0,
        logs: []
      };
      console.log(`Created room ${roomId}`);
    }

    const room = rooms[roomId];

    // 3. Register or Reconnect Player
    if (!room.players[playerUuid]) {
      // New player
      const color = '#' + Math.floor(Math.random()*16777215).toString(16);

      room.players[playerUuid] = {
        uuid: playerUuid,
        nick: nick || 'Anon',
        cash: STARTING_CASH,
        pos: 0,
        properties: [],
        color: color,
        socketId: socket.id,
        inJail: false,
        turnsInJail: 0
      };

      room.turn_order.push(playerUuid);
      room.logs.push({ text: `${nick || 'Anon'} dołączył do gry.`, type: 'info' });
    } else {
      // Reconnect
      room.players[playerUuid].socketId = socket.id;
      console.log(`Player ${room.players[playerUuid].nick} reconnected.`);
    }

    // Join socket room
    socket.join(roomId);

    // Send initial state back to user
    socket.emit('joined_success', {
      uuid: playerUuid,
      roomState: room,
      boardConfig: boardConfig
    });

    // Broadcast update to others
    io.to(roomId).emit('room_update', room);
  });

  socket.on('roll_dice', ({ roomId, uuid }) => {
    const room = rooms[roomId];
    if (!room) return;

    // Validate turn
    const currentPlayerUuid = room.turn_order[room.current_turn_index];
    if (currentPlayerUuid !== uuid) return;

    const player = room.players[uuid];

    // Jail Logic
    if (player.inJail) {
      // Simplified: Try to roll doubles (implied) or pay.
      // For now, let's say they try to roll doubles automatically.
      // If fails, they stay, unless it's 3rd turn then pay.
      // Or we can add a "pay bail" button later.
      // Let's implement: Roll dice. If double -> Free + Move. Else -> Stay.
      // Simplified Prompt Version: Just roll.

      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;

      if (die1 === die2) {
        player.inJail = false;
        player.turnsInJail = 0;
        room.logs.push({ text: `${player.nick} wyrzuca dublet (${die1}-${die2}) i wychodzi z Izby Wytrzeźwień!`, type: 'success' });
        movePlayer(room, player, die1 + die2);
      } else {
        player.turnsInJail++;
        if (player.turnsInJail >= 3) {
          player.cash -= BAIL_PRICE;
          player.inJail = false;
          player.turnsInJail = 0;
          room.logs.push({ text: `${player.nick} płaci kaucję ${BAIL_PRICE} i wychodzi (3 tury).`, type: 'warning' });
          movePlayer(room, player, die1 + die2);
        } else {
          room.logs.push({ text: `${player.nick} siedzi dalej (${die1}-${die2}).`, type: 'info' });
          // End turn happens via explicit call or auto? Prompt says "Gracz klika Rzuć".
          // Usually after failed roll in jail, turn ends immediately.
          // But our frontend expects "End Turn" click probably?
          // Let's leave it to user to click End Turn.
        }
      }

      io.to(roomId).emit('room_update', room);
      return;
    }

    // Standard Roll
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const move = die1 + die2;

    room.logs.push({ text: `${player.nick} wyrzucił ${move}.`, type: 'info' });
    movePlayer(room, player, move);

    io.to(roomId).emit('room_update', room);
  });

  socket.on('buy_property', ({ roomId, uuid }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players[uuid];
    const fieldId = player.pos;
    const field = boardConfig.find(f => f.id === fieldId);

    if (field.type !== 'property' && field.type !== 'transport' && field.type !== 'utility') return;
    if (room.board_ownership[fieldId]) return;
    if (player.cash < field.price) return;

    player.cash -= field.price;
    room.board_ownership[fieldId] = uuid;
    player.properties.push(fieldId);

    room.logs.push({ text: `${player.nick} kupuje ${field.name} za ${field.price} CBL.`, type: 'success' });

    io.to(roomId).emit('room_update', room);
  });

  socket.on('end_turn', ({ roomId, uuid }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.turn_order[room.current_turn_index] !== uuid) return;

    // Check bankruptcy at end of turn (or whenever cash changes, but here is safe)
    if (room.players[uuid].cash < 0) {
      handleBankruptcy(room, uuid);
    } else {
      room.current_turn_index = (room.current_turn_index + 1) % room.turn_order.length;
    }

    io.to(roomId).emit('room_update', room);
  });
});

function movePlayer(room, player, steps) {
    const oldPos = player.pos;
    let newPos = oldPos + steps;

    // Handle loop
    if (newPos >= 40) {
      newPos = newPos - 40;
      player.cash += PASS_START_BONUS;
      room.logs.push({ text: `MOPS wypłacił 500+ (${PASS_START_BONUS} CBL) dla gracza ${player.nick}.`, type: 'success' });
    }

    player.pos = newPos;
    const location = boardConfig.find(f => f.id === newPos);
    room.logs.push({ text: `${player.nick} staje na polu: ${location.name}.`, type: 'info' });

    handleFieldArrival(room, player, location);
}

function handleFieldArrival(room, player, field) {
  // 1. Rent
  if (['property', 'transport', 'utility'].includes(field.type)) {
    const ownerUuid = room.board_ownership[field.id];
    if (ownerUuid && ownerUuid !== player.uuid) {
      const owner = room.players[ownerUuid];
      let rent = field.rent || 0;

      // Multipliers could be added here

      if (player.cash >= rent) {
        player.cash -= rent;
        owner.cash += rent;
        room.logs.push({ text: `${player.nick} płaci ${rent} CBL złodziejowi ${owner.nick}.`, type: 'danger' });
      } else {
        // Partial payment / Debt
        const amount = player.cash > 0 ? player.cash : 0;
        player.cash -= rent; // Go negative
        owner.cash += amount;
        room.logs.push({ text: `${player.nick} wisi kasę! Płaci co ma (${amount}) i jest na minusie.`, type: 'danger' });
      }
    }
  }

  // 2. Taxes
  if (field.type === 'tax') {
    player.cash -= field.amount;
    room.logs.push({ text: `Nowy Ład! ${player.nick} traci ${field.amount} CBL.`, type: 'danger' });
  }

  // 3. Go To Jail
  if (field.type === 'gotojail') {
    sendToJail(room, player);
  }

  // 4. Chance
  if (field.type === 'chance') {
    handleChanceCard(room, player);
  }
}

function sendToJail(room, player) {
  player.pos = JAIL_POSITION;
  player.inJail = true;
  player.turnsInJail = 0;
  room.logs.push({ text: `Bagiety po Ciebie jadą! ${player.nick} ląduje na Izbie Wytrzeźwień.`, type: 'warning' });
}

function handleChanceCard(room, player) {
  if (chanceCards.length === 0) return;
  const card = chanceCards[Math.floor(Math.random() * chanceCards.length)];

  room.logs.push({ text: `Karta Szansy: ${card.text}`, type: 'special' });

  switch(card.action) {
    case 'pay':
      player.cash -= card.amount;
      break;
    case 'gain':
      player.cash += card.amount;
      break;
    case 'goto_jail':
      sendToJail(room, player);
      break;
    case 'move_to':
      player.pos = card.target;
      // Handle arrival at new pos?
      // Usually yes, but recursive risk. Simple implementation: Just move.
      // Or call handleFieldArrival(room, player, boardConfig[card.target])
      break;
    case 'collect_all':
      // From all other players
      const amount = card.amount;
      Object.values(room.players).forEach(p => {
        if (p.uuid !== player.uuid) {
          p.cash -= amount;
          player.cash += amount;
        }
      });
      break;
  }
}

function handleBankruptcy(room, bankruptUuid) {
  const player = room.players[bankruptUuid];
  room.logs.push({ text: `KOMORNIK ZAJĄŁ MEBLOŚCIANKĘ! ${player.nick} BANKRUTUJE I ODPADA!`, type: 'danger' });

  // Return properties to bank (clear ownership)
  player.properties.forEach(fieldId => {
    delete room.board_ownership[fieldId];
  });

  // Remove player from turn order
  room.turn_order = room.turn_order.filter(uid => uid !== bankruptUuid);

  // Clean up player object? Or keep for history?
  // Keeping it might crash rendering if we assume they exist in turn order.
  // Better to just mark as bankrupt state if we want to show them.
  // For now, removing from turn order prevents them from playing.

  // Adjust current turn index
  if (room.turn_order.length > 0) {
    room.current_turn_index = room.current_turn_index % room.turn_order.length;
  }
}

// Handle React Routing, return all requests to React app
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
