import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import Board from './Board';
import './Room.css';

const SOCKET_URL = 'http://localhost:3000'; // Or generic / if proxied

function Room() {
  const { roomId } = useParams();
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [boardConfig, setBoardConfig] = useState([]);
  const [myUuid, setMyUuid] = useState(localStorage.getItem('player_uuid'));
  const [needsNick, setNeedsNick] = useState(false);
  const [nickInput, setNickInput] = useState('');

  const connectedRef = useRef(false);

  useEffect(() => {
    if (connectedRef.current) return;

    // Check if we need a nick (new player)
    const storedUuid = localStorage.getItem('player_uuid');
    if (!storedUuid) {
      setNeedsNick(true);
      return;
    }

    // Connect
    initSocket(storedUuid);
    connectedRef.current = true;

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const initSocket = (uuid, nick = null) => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.emit('join_room', { roomId, uuid, nick });

    newSocket.on('joined_success', (data) => {
      localStorage.setItem('player_uuid', data.uuid);
      setMyUuid(data.uuid);
      setGameState(data.roomState);
      setBoardConfig(data.boardConfig);
      setNeedsNick(false);
    });

    newSocket.on('room_update', (roomState) => {
      setGameState(roomState);
    });
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!nickInput.trim()) return;

    const newUuid = uuidv4();
    initSocket(newUuid, nickInput.trim());
    connectedRef.current = true;
  };

  if (needsNick) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <h2>Podaj ksywę</h2>
          <form onSubmit={handleJoin}>
            <input
              value={nickInput}
              onChange={e => setNickInput(e.target.value)}
              placeholder="Twój Nick"
              maxLength={12}
            />
            <button type="submit">Wchodzę</button>
          </form>
        </div>
      </div>
    );
  }

  if (!gameState || !boardConfig.length) return <div>Ładowanie planszy... (Może serwer nie wstał?)</div>;

  const me = gameState.players[myUuid];
  const isMyTurn = gameState.turn_order[gameState.current_turn_index] === myUuid;

  const handleRoll = () => {
    socket.emit('roll_dice', { roomId, uuid: myUuid });
  };

  const handleBuy = () => {
    socket.emit('buy_property', { roomId, uuid: myUuid });
  };

  const handleEndTurn = () => {
    socket.emit('end_turn', { roomId, uuid: myUuid });
  };

  const currentField = boardConfig.find(f => f.id === me?.pos);
  const canBuy = isMyTurn && currentField &&
    ['property', 'transport', 'utility'].includes(currentField.type) &&
    !gameState.board_ownership[currentField.id] &&
    me.cash >= currentField.price;

  return (
    <div className="room-container">
      <div className="sidebar">
        <div className="player-stats">
          <h3>Twój portfel</h3>
          <div className="cash">{me?.cash || 0} CBL</div>
          <div className="nick">{me?.nick}</div>
        </div>

        <div className="logs">
           {gameState.logs.slice().reverse().map((log, i) => (
             <div key={i} className={`log-entry ${log.type}`}>{log.text}</div>
           ))}
        </div>

        <div className="controls">
          {isMyTurn ? (
            <>
              <button className="btn-roll" onClick={handleRoll}>RZUĆ KOSTKĄ</button>
              {canBuy && (
                <button className="btn-buy" onClick={handleBuy}>
                  KUP {currentField.name} ({currentField.price})
                </button>
              )}
              <button className="btn-end" onClick={handleEndTurn}>KONIEC TURY</button>
            </>
          ) : (
            <div className="waiting-msg">
              Czekaj na turę gracza {gameState.players[gameState.turn_order[gameState.current_turn_index]]?.nick}...
            </div>
          )}
        </div>
      </div>

      <div className="board-area">
        <Board
          config={boardConfig}
          players={Object.values(gameState.players)}
          ownership={gameState.board_ownership}
        />
      </div>
    </div>
  );
}

export default Room;
