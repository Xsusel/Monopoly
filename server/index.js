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

// In-memory state
// Structure: { roomId: { players: { uuid: { ... } }, board_ownership: {}, turn_order: [], current_turn_index: 0, logs: [] } }
const rooms = {};

const STARTING_CASH = 1500;
const PASS_START_BONUS = 200;

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
      // Assign a random color
      const color = '#' + Math.floor(Math.random()*16777215).toString(16);

      room.players[playerUuid] = {
        uuid: playerUuid,
        nick: nick || 'Anon',
        cash: STARTING_CASH,
        pos: 0,
        properties: [],
        color: color,
        socketId: socket.id
      };

      room.turn_order.push(playerUuid);

      // Log join
      room.logs.push({ text: `${nick || 'Anon'} dołączył do gry.`, type: 'info' });
    } else {
      // Reconnect
      room.players[playerUuid].socketId = socket.id;
      // Update nick if provided? No, stick to original.
      console.log(`Player ${room.players[playerUuid].nick} reconnected.`);
    }

    // Join socket room
    socket.join(roomId);

    // Send initial state back to user
    // We send the whole room state + their UUID confirmation
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
    if (currentPlayerUuid !== uuid) {
       // Not your turn
       return;
    }

    const player = room.players[uuid];

    // Roll dice (1-6) * 2 or just 1-12? Standard is 2d6.
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const move = die1 + die2;

    const oldPos = player.pos;
    let newPos = oldPos + move;

    // Handle loop (Pass Start)
    if (newPos >= 40) {
      newPos = newPos - 40;
      player.cash += PASS_START_BONUS;
      room.logs.push({ text: `MOPS wypłacił 500+ (${PASS_START_BONUS} CBL) dla gracza ${player.nick}.`, type: 'success' });
    }

    player.pos = newPos;

    // Log move
    const location = boardConfig.find(f => f.id === newPos);
    room.logs.push({ text: `${player.nick} wyrzucił ${move} i staje na polu: ${location.name}.`, type: 'info' });

    // Handle Field Logic (Rent, Tax, GoToJail)
    handleFieldArrival(room, player, location);

    // Move turn logic (unless double? Simplifying for now: no doubles extra turn yet)
    // Wait, if they can buy, we might need to wait for action?
    // Simplified: Turn ends when they click "End Turn" or automatically if nothing to do?
    // Prompt says: "Gracz klika 'Rzuć', frontend wysyła sygnał, serwer odsyła wynik i nową pozycję."
    // "Jeśli pole jest wolne -> guzik 'Biorę to'".
    // So the turn DOES NOT end immediately. The player has to perform action or pass.

    // We update state.
    io.to(roomId).emit('room_update', room);
  });

  socket.on('buy_property', ({ roomId, uuid }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players[uuid];
    const fieldId = player.pos;
    const field = boardConfig.find(f => f.id === fieldId);

    // Check validity
    if (field.type !== 'property' && field.type !== 'transport' && field.type !== 'utility') return;
    if (room.board_ownership[fieldId]) return; // Already owned
    if (player.cash < field.price) return; // Too poor

    // Execute buy
    player.cash -= field.price;
    room.board_ownership[fieldId] = uuid;
    player.properties.push(fieldId);

    room.logs.push({ text: `${player.nick} kupuje ${field.name} za ${field.price} CBL.`, type: 'success' });

    io.to(roomId).emit('room_update', room);
  });

  socket.on('end_turn', ({ roomId, uuid }) => {
    const room = rooms[roomId];
    if (!room) return;

    // Validate
    if (room.turn_order[room.current_turn_index] !== uuid) return;

    // Next turn
    room.current_turn_index = (room.current_turn_index + 1) % room.turn_order.length;

    io.to(roomId).emit('room_update', room);
  });
});

function handleFieldArrival(room, player, field) {
  // 1. Check Ownership / Rent
  if (['property', 'transport', 'utility'].includes(field.type)) {
    const ownerUuid = room.board_ownership[field.id];
    if (ownerUuid && ownerUuid !== player.uuid) {
      // Pay rent
      const owner = room.players[ownerUuid];
      // Calculate rent (simplified: base rent)
      // TODO: Transport/Utility multiplier logic
      let rent = field.rent || 0;

      if (player.cash >= rent) {
        player.cash -= rent;
        owner.cash += rent;
        room.logs.push({ text: `${player.nick} płaci ${rent} CBL złodziejowi ${owner.nick} za czynsz.`, type: 'danger' });
      } else {
        // Bankruptcy logic placeholder
        const amount = player.cash;
        player.cash = 0;
        owner.cash += amount;
        room.logs.push({ text: `${player.nick} nie ma kasy! Oddaje ostatnie ${amount} CBL dla ${owner.nick}.`, type: 'danger' });
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
    player.pos = 10; // Jail position
    // Logic for "in jail" state would go here (skip turns etc).
    room.logs.push({ text: `Bagiety po Ciebie jadą! ${player.nick} ląduje na Izbie Wytrzeźwień.`, type: 'warning' });
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
