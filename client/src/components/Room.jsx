import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import confetti from 'canvas-confetti';
import Board from './Board';
import TradeModal from './TradeModal';
import Dice from './Dice';
import './Room.css';

const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/';

function Room() {
  const { roomId } = useParams();
  const location = useLocation();
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [boardConfig, setBoardConfig] = useState([]);
  const [myUuid, setMyUuid] = useState(localStorage.getItem('player_uuid'));
  const [needsNick, setNeedsNick] = useState(false);
  const [nickInput, setNickInput] = useState('');
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [rollingDice, setRollingDice] = useState(null); // { die1, die2 } or null
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false); // Default to logs, toggle to Chat
  const [turnDuration, setTurnDuration] = useState(60); // Default 60s
  const [timeLeft, setTimeLeft] = useState(null);

  const connectedRef = useRef(false);
  const logsEndRef = useRef(null);
  const chatEndRef = useRef(null);
  const lastActionIdRef = useRef(null);

  // Reuse AudioContext
  const audioCtxRef = useRef(null);

  const playBeep = (freq = 440, type = 'sine', duration = 0.1) => {
    try {
      if (!audioCtxRef.current) {
         audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio context might be blocked
    }
  };

  useEffect(() => {
    if (connectedRef.current) return;

    const storedUuid = localStorage.getItem('player_uuid');
    const passedNick = location.state?.nick;
    const passedAvatar = location.state?.avatar;

    if (passedNick) {
       const uuidToUse = storedUuid || uuidv4();
       initSocket(uuidToUse, passedNick, passedAvatar);
    } else {
       if (!storedUuid) {
         setNeedsNick(true);
         return;
       }
       initSocket(storedUuid);
    }

    connectedRef.current = true;

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current && !showChat) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState?.logs, showChat]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current && showChat) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  // Handle Animations & Sounds based on state updates
  useEffect(() => {
    if (!gameState) return;

    // Dice Animation & Sound
    if (gameState.last_action && gameState.last_action.type === 'roll') {
      if (gameState.last_action.id !== lastActionIdRef.current) {
         lastActionIdRef.current = gameState.last_action.id;
         setRollingDice({
            die1: gameState.last_action.dice[0],
            die2: gameState.last_action.dice[1]
         });
         playBeep(200, 'square', 0.1); // Roll sound
      }
    }

    // Turn Start Sound
    if (gameState.turn_order[gameState.current_turn_index] === myUuid) {
        // Only play if it just became my turn.
        // Simple check: we don't store previous turn index in state easily here without ref.
        // But this useEffect runs on every gameState update.
        // Let's rely on log updates or check strict equality with prev state if possible?
        // Actually, just checking if it is my turn now is "okay" but might spam if other state changes.
        // We can track prevTurnIndex in ref.
    }

    // Winner Confetti
    if (gameState.winner) {
      confetti({
         particleCount: 150,
         spread: 70,
         origin: { y: 0.6 }
      });
      playBeep(600, 'sine', 0.5); // Win sound
    }

  }, [gameState]);

  // Track turn changes for sound
  const prevTurnRef = useRef(null);
  useEffect(() => {
     if (!gameState) return;
     const currentTurnPlayer = gameState.turn_order[gameState.current_turn_index];

     if (prevTurnRef.current !== currentTurnPlayer) {
        if (currentTurnPlayer === myUuid) {
            playBeep(600, 'sine', 0.2); // My Turn!
            setTimeout(() => playBeep(800, 'sine', 0.4), 200);
        } else {
            // Other player turn
            playBeep(300, 'sine', 0.1);
        }
        prevTurnRef.current = currentTurnPlayer;
     }
  }, [gameState?.current_turn_index]);

  // Track Cash for sound
  const prevCashRef = useRef(null);
  useEffect(() => {
     if (!me) return;
     if (prevCashRef.current !== null && me.cash !== prevCashRef.current) {
         if (me.cash > prevCashRef.current) {
             // Money gained
             playBeep(1000, 'triangle', 0.1);
             setTimeout(() => playBeep(1200, 'triangle', 0.1), 100);
         } else {
             // Money spent
             playBeep(150, 'sawtooth', 0.1);
         }
     }
     prevCashRef.current = me.cash;
  }, [me?.cash]);

  // Timer Countdown Effect
  useEffect(() => {
    if (!gameState || gameState.status !== 'playing' || !gameState.turnDeadline) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.ceil((gameState.turnDeadline - Date.now()) / 1000);
      setTimeLeft(remaining > 0 ? remaining : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState?.turnDeadline, gameState?.status]);

  const initSocket = (uuid, nick = null, avatar = null) => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.emit('join_room', { roomId, uuid, nick, avatar });

    newSocket.on('joined_success', (data) => {
      localStorage.setItem('player_uuid', data.uuid);
      setMyUuid(data.uuid);
      setGameState(data.roomState);
      setBoardConfig(data.boardConfig);
      setChatMessages(data.roomState.chat_messages || []);
      setNeedsNick(false);
    });

    newSocket.on('room_update', (roomState) => {
      setGameState(roomState);
    });

    newSocket.on('room_chat_update', (msgs) => {
      setChatMessages(msgs);
    });
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!nickInput.trim()) return;

    const newUuid = uuidv4();
    initSocket(newUuid, nickInput.trim());
    connectedRef.current = true;
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit('chat_message', { roomId, uuid: myUuid, text: chatInput.trim() });
    setChatInput('');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    // Simple alert or toast
    alert('Link skopiowany do schowka!');
  };

  const kickPlayer = (targetUuid) => {
    if (window.confirm('Czy na pewno chcesz wyrzucić tego gracza?')) {
      socket.emit('kick_player', { roomId, uuid: myUuid, targetUuid });
    }
  };

  const forceSkip = () => {
    if (window.confirm('Wymusić koniec tury?')) {
      socket.emit('force_skip_turn', { roomId, uuid: myUuid });
    }
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

  if (gameState.status === 'waiting') {
    const isHost = gameState.turn_order[0] === myUuid;
    return (
      <div className="lobby-screen">
        <h1>POCZEKALNIA: {roomId}</h1>
        <div className="lobby-controls" style={{ marginBottom: '1rem' }}>
           <button onClick={copyLink} className="btn-tiny">🔗 Skopiuj Link</button>
        </div>
        <h3>Gracze:</h3>
        <ul>
          {gameState.turn_order.map(uid => {
             const p = gameState.players[uid];
             return (
               <li key={uid} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <span
                   className={`status-dot ${p.online ? 'online' : 'offline'}`}
                   title={p.online ? 'Online' : 'Offline'}
                   style={{
                     width: '10px', height: '10px', borderRadius: '50%',
                     backgroundColor: p.online ? '#4caf50' : '#f44336'
                   }}
                 ></span>
                 <span style={{ fontSize: '1.2rem' }}>{p.avatar || '👤'}</span> {p.nick}
                 {isHost && uid !== myUuid && (
                   <button className="btn-tiny danger" onClick={() => kickPlayer(uid)} style={{ marginLeft: 'auto' }}>X</button>
                 )}
               </li>
             );
          })}
        </ul>
        {isHost ? (
           <div className="host-controls">
             <div className="setting-row">
                <label>Czas na turę: </label>
                <select value={turnDuration} onChange={e => setTurnDuration(Number(e.target.value))}>
                  <option value={0}>Bez limitu</option>
                  <option value={30}>30 sek</option>
                  <option value={60}>60 sek</option>
                  <option value={90}>90 sek</option>
                  <option value={120}>2 min</option>
                  <option value={300}>5 min</option>
                </select>
             </div>
             <button className="btn-start" onClick={() => socket.emit('start_game', { roomId, uuid: myUuid, settings: { turnDuration } })}>
               START GRY
             </button>
           </div>
        ) : (
           <p>Czekamy na Hosta...</p>
        )}
      </div>
    );
  }

  if (gameState.winner) {
    return (
      <div className="winner-screen">
        <h1>KONIEC GRY!</h1>
        <h2>ZWYCIĘZCA: {gameState.winner.nick}</h2>
        <p>Gratulacje! Zniszczyłeś konkurencję.</p>
        <button onClick={() => window.location.reload()}>Nowa Gra</button>
      </div>
    );
  }

  if (!me) {
     return (
       <div className="game-over">
          <h1>BANKRUCTWO</h1>
          <p>Odpadasz z gry. Możesz oglądać.</p>
       </div>
     );
  }

  const isMyTurn = gameState.turn_order[gameState.current_turn_index] === myUuid;
  const isHost = gameState.turn_order[0] === myUuid;

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

  const sendTrade = (tradeData) => {
    socket.emit('propose_trade', {
       roomId,
       uuid: myUuid,
       ...tradeData
    });
  };

  const incomingTrade = gameState.trades.find(t => t.to === myUuid);

  const currentField = boardConfig.find(f => f.id === me?.pos);
  const canBuy = isMyTurn && currentField &&
    ['property', 'transport', 'utility'].includes(currentField.type) &&
    !gameState.board_ownership[currentField.id] &&
    me.cash >= currentField.price;

  return (
    <div className="room-container">
      {rollingDice && (
        <Dice
          die1={rollingDice.die1}
          die2={rollingDice.die2}
          onComplete={() => setRollingDice(null)}
        />
      )}

      <div className="sidebar">
        <div className="player-stats">
          <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             Twój portfel
             {isHost && <button className="btn-tiny warn" onClick={forceSkip} title="Wymuś koniec tury (AFK)" style={{ fontSize: '10px', padding: '2px 4px' }}>SKIP</button>}
          </h3>

          {timeLeft !== null && (
            <div className={`turn-timer ${timeLeft <= 10 ? 'danger' : ''}`} style={{ fontSize: '1.2rem', fontWeight: 'bold', color: timeLeft <= 10 ? 'red' : 'white', marginBottom: '10px' }}>
               ⏳ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          )}

          <div className="cash">{me?.cash || 0} PLN</div>
          <div className="nick" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
             <span className="status-dot online" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4caf50' }}></span>
             <span style={{ fontSize: '1.2rem' }}>{me?.avatar || '👤'}</span>
             {me?.nick}
             <button className="btn-tiny" onClick={copyLink} title="Kopiuj link" style={{ marginLeft: 'auto', fontSize: '12px' }}>🔗</button>
          </div>
          <button className="btn-tiny trade-btn" onClick={() => setShowTradeModal(true)}>Handel</button>
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

        <div className="sidebar-tabs" style={{ display: 'flex', borderBottom: '1px solid #444', marginBottom: '5px' }}>
          <button
             style={{ flex: 1, background: !showChat ? '#444' : 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '5px' }}
             onClick={() => setShowChat(false)}
          >
             Logi
          </button>
          <button
             style={{ flex: 1, background: showChat ? '#444' : 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '5px' }}
             onClick={() => setShowChat(true)}
          >
             Czat
          </button>
        </div>

        <div className="logs-container" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
           {!showChat ? (
             <div className="logs" style={{ flex: 1, overflowY: 'auto' }}>
               {gameState.logs.map((log, i) => (
                 <div key={i} className={`log-entry ${log.type}`}>{log.text}</div>
               ))}
               <div ref={logsEndRef} />
             </div>
           ) : (
             <div className="chat" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
               <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '5px' }}>
                 {chatMessages.map((msg, i) => (
                   <div key={i} className="chat-msg" style={{ marginBottom: '4px', fontSize: '0.9em' }}>
                     <strong style={{ color: '#aaa' }}>{msg.nick}:</strong> {msg.text}
                   </div>
                 ))}
                 <div ref={chatEndRef} />
               </div>
               <form onSubmit={sendChat} className="chat-input" style={{ display: 'flex', padding: '5px' }}>
                 <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="..."
                    style={{ flex: 1, padding: '4px' }}
                 />
                 <button type="submit" style={{ padding: '4px 8px' }}>&gt;</button>
               </form>
             </div>
           )}
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

      {showTradeModal && (
        <TradeModal
           me={me}
           players={Object.values(gameState.players)}
           boardConfig={boardConfig}
           onClose={() => setShowTradeModal(false)}
           onSend={sendTrade}
        />
      )}

      {incomingTrade && (
        <div className="modal-overlay">
           <div className="modal trade-offer">
              <h3>Otrzymałeś Ofertę Handlową</h3>
              <p>Od: {gameState.players[incomingTrade.from].nick}</p>
              <div className="offer-details">
                 <div className="side">
                   <strong>Dostajesz:</strong>
                   <div>Kasa: {incomingTrade.offer.cash}</div>
                   {incomingTrade.offer.properties.map(fid => <div key={fid}>{boardConfig.find(f => f.id === fid).name}</div>)}
                 </div>
                 <div className="side">
                   <strong>Oddajesz:</strong>
                   <div>Kasa: {incomingTrade.want.cash}</div>
                   {incomingTrade.want.properties.map(fid => <div key={fid}>{boardConfig.find(f => f.id === fid).name}</div>)}
                 </div>
              </div>
              <div className="trade-actions">
                 <button className="btn-tiny warn" onClick={() => socket.emit('reject_trade', { roomId, uuid: myUuid, tradeId: incomingTrade.id })}>Odrzuć</button>
                 <button className="btn-tiny success" onClick={() => socket.emit('accept_trade', { roomId, uuid: myUuid, tradeId: incomingTrade.id })}>Akceptuj</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

export default Room;
