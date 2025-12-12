import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import Board from './Board';
import './Room.css';

const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/';

function Room() {
  const { roomId } = useParams();
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [boardConfig, setBoardConfig] = useState([]);
  const [myUuid, setMyUuid] = useState(localStorage.getItem('player_uuid'));
  const [needsNick, setNeedsNick] = useState(false);
  const [nickInput, setNickInput] = useState('');

  const connectedRef = useRef(false);
  const logsEndRef = useRef(null);

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

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState?.logs]);

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

  if (gameState.winner) {
    return (
      <div className="winner-screen">
        <h1>KONIEC GRY!</h1>
        <h2>KRÓL CEBULI: {gameState.winner.nick}</h2>
        <p>Gratulacje! Zniszczyłeś konkurencję.</p>
        <button onClick={() => window.location.reload()}>Nowa Gra</button>
      </div>
    );
  }

  const me = gameState.players[myUuid];
  // If me is undefined (e.g. kicked/bankrupt), show spectator mode or game over for me
  if (!me) {
     return (
       <div className="game-over">
          <h1>BANKRUCTWO</h1>
          <p>Odpadasz z gry. Możesz oglądać.</p>
       </div>
     );
  }

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

  const handleBuild = (fieldId) => {
     socket.emit('build_house', { roomId, uuid: myUuid, fieldId });
  };

  const handleMortgage = (fieldId) => {
     socket.emit('mortgage_property', { roomId, uuid: myUuid, fieldId });
  };

  const handleUnmortgage = (fieldId) => {
     socket.emit('unmortgage_property', { roomId, uuid: myUuid, fieldId });
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

        {/* Property Management List */}
        <div className="properties-list">
          <h4>Twoje Włości:</h4>
          {me.properties.length === 0 && <p className="empty">Brak nieruchomości</p>}
          {me.properties.map(fid => {
             const field = boardConfig.find(f => f.id === fid);
             const prop = gameState.board_ownership[fid];
             return (
               <div key={fid} className="prop-item" style={{ borderLeft: `5px solid ${field.group}` }}>
                 <div className="prop-name">{field.name}</div>
                 <div className="prop-status">
                   {prop.mortgaged ? 'ZASTAWIONE' : (prop.houses > 0 ? `Domki: ${prop.houses}` : '')}
                 </div>
                 <div className="prop-actions">
                   {!prop.mortgaged && field.type === 'property' && (
                     <button className="btn-tiny" onClick={() => handleBuild(fid)} title="Buduj">+</button>
                   )}
                   {!prop.mortgaged ? (
                     <button className="btn-tiny warn" onClick={() => handleMortgage(fid)} title="Zastaw">Z</button>
                   ) : (
                     <button className="btn-tiny success" onClick={() => handleUnmortgage(fid)} title="Wykup">W</button>
                   )}
                 </div>
               </div>
             );
          })}
        </div>

        <div className="logs">
           {gameState.logs.map((log, i) => (
             <div key={i} className={`log-entry ${log.type}`}>{log.text}</div>
           ))}
           <div ref={logsEndRef} />
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
