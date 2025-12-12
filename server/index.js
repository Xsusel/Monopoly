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
// Structure: { roomId: { players: { uuid: { ... } }, board_ownership: { fieldId: { owner: uuid, houses: 0, mortgaged: false } }, turn_order: [], current_turn_index: 0, logs: [] } }
const rooms = {};

const STARTING_CASH = 1500;
const PASS_START_BONUS = 200;
const JAIL_POSITION = 10;
const BAIL_PRICE = 50;
const HOUSE_PRICE = 100; // Simplified for now, or fetch from config if added
const MORTGAGE_INTEREST = 0.1;

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
        board_ownership: {}, // field_id -> { owner: uuid, houses: 0, mortgaged: false }
        turn_order: [],
        current_turn_index: 0,
        logs: [],
        winner: null
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

    if (room.winner) return;

    // Validate turn
    const currentPlayerUuid = room.turn_order[room.current_turn_index];
    if (currentPlayerUuid !== uuid) return;

    const player = room.players[uuid];

    // Jail Logic
    if (player.inJail) {
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
    if (room.board_ownership[fieldId]) return; // Already owned
    if (player.cash < field.price) return; // Too poor

    // Execute buy
    player.cash -= field.price;
    room.board_ownership[fieldId] = {
      owner: uuid,
      houses: 0,
      mortgaged: false
    };
    player.properties.push(fieldId);

    room.logs.push({ text: `${player.nick} kupuje ${field.name} za ${field.price} CBL.`, type: 'success' });

    io.to(roomId).emit('room_update', room);
  });

  socket.on('end_turn', ({ roomId, uuid }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.turn_order[room.current_turn_index] !== uuid) return;

    if (room.players[uuid].cash < 0) {
      handleBankruptcy(room, uuid);
    } else {
      room.current_turn_index = (room.current_turn_index + 1) % room.turn_order.length;
    }

    io.to(roomId).emit('room_update', room);
  });

  // --- NEW HANDLERS ---

  socket.on('build_house', ({ roomId, uuid, fieldId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players[uuid];
    const prop = room.board_ownership[fieldId];
    const field = boardConfig.find(f => f.id === fieldId);

    // Validations
    if (!prop || prop.owner !== uuid) return;
    if (field.type !== 'property') return;
    if (prop.mortgaged) return; // Cannot build on mortgaged
    if (prop.houses >= 5) return; // Max 5 (Hotel)
    if (player.cash < HOUSE_PRICE) return;

    // Check Group Ownership
    const groupFields = boardConfig.filter(f => f.group === field.group);
    const ownsAll = groupFields.every(f => {
      const p = room.board_ownership[f.id];
      return p && p.owner === uuid && !p.mortgaged; // Must own all and not be mortgaged? Standard rules say yes.
    });

    if (!ownsAll) return;

    // Build
    player.cash -= HOUSE_PRICE;
    prop.houses += 1;

    const typeName = prop.houses === 5 ? 'Hotel' : 'Domek';
    room.logs.push({ text: `${player.nick} stawia ${typeName} na ${field.name}.`, type: 'success' });

    io.to(roomId).emit('room_update', room);
  });

  socket.on('mortgage_property', ({ roomId, uuid, fieldId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players[uuid];
    const prop = room.board_ownership[fieldId];
    const field = boardConfig.find(f => f.id === fieldId);

    if (!prop || prop.owner !== uuid) return;
    if (prop.mortgaged) return;
    if (prop.houses > 0) return; // Must sell houses first (simplified: just block)

    const mortgageValue = Math.floor(field.price / 2);
    player.cash += mortgageValue;
    prop.mortgaged = true;

    room.logs.push({ text: `${player.nick} zastawia ${field.name} za ${mortgageValue} CBL.`, type: 'warning' });
    io.to(roomId).emit('room_update', room);
  });

  socket.on('unmortgage_property', ({ roomId, uuid, fieldId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players[uuid];
    const prop = room.board_ownership[fieldId];
    const field = boardConfig.find(f => f.id === fieldId);

    if (!prop || prop.owner !== uuid) return;
    if (!prop.mortgaged) return;

    const mortgageValue = Math.floor(field.price / 2);
    const cost = Math.floor(mortgageValue * (1 + MORTGAGE_INTEREST));

    if (player.cash < cost) return;

    player.cash -= cost;
    prop.mortgaged = false;

    room.logs.push({ text: `${player.nick} wykupuje ${field.name} z zastawu za ${cost} CBL.`, type: 'success' });
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
    const prop = room.board_ownership[field.id];
    if (prop && prop.owner && prop.owner !== player.uuid) {
      if (prop.mortgaged) {
         room.logs.push({ text: `${player.nick} staje na ${field.name}, ale jest zastawione. Uff!`, type: 'info' });
         return;
      }

      const owner = room.players[prop.owner];

      // Rent Calculation
      let rent = field.rent || 0;

      // House Multiplier (Simplified)
      // 1 house = 5x base rent? Or just +? Standard is massive jump.
      // Let's use simple logic: rent * (1 + houses) * houses?
      // Standard: Base, x5, x15, x45, x80, x100 (roughly).
      // Let's do: rent * (2 ^ houses) roughly.
      if (prop.houses > 0) {
        rent = rent * Math.pow(2, prop.houses);
      }

      // Transport logic? (Not implemented deep yet, stick to base rent for now)

      if (player.cash >= rent) {
        player.cash -= rent;
        owner.cash += rent;
        room.logs.push({ text: `${player.nick} płaci ${rent} CBL złodziejowi ${owner.nick}.`, type: 'danger' });
      } else {
        const amount = player.cash > 0 ? player.cash : 0;
        player.cash -= rent;
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
      break;
    case 'collect_all':
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

  player.properties.forEach(fieldId => {
    delete room.board_ownership[fieldId];
  });

  room.turn_order = room.turn_order.filter(uid => uid !== bankruptUuid);

  if (room.turn_order.length > 0) {
    room.current_turn_index = room.current_turn_index % room.turn_order.length;
  }

  // Check Winner
  if (room.turn_order.length === 1) {
    const winnerUuid = room.turn_order[0];
    const winner = room.players[winnerUuid];
    room.winner = winner;
    room.logs.push({ text: `MAMY ZWYCIĘZCĘ! KRÓL CEBULI: ${winner.nick}!`, type: 'success' });
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
