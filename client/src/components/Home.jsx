import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
  const [roomName, setRoomName] = useState('');
  const [nick, setNick] = useState('');
  const navigate = useNavigate();

  const handleCreate = (e) => {
    e.preventDefault();
    if (roomName.trim() && nick.trim()) {
      navigate(`/room/${roomName.trim().toUpperCase()}`, { state: { nick: nick.trim() } });
    }
  };

  return (
    <div className="home-container">
      <h1>POLNOPOLY</h1>
      <h2>GRA EKONOMICZNA</h2>
      <div className="card">
        <p>Wpisz swój nick oraz nazwę pokoju:</p>
        <form onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Twój Nick"
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            maxLength={12}
            required
            style={{ marginBottom: '10px' }}
          />
          <input
            type="text"
            placeholder="Nazwa Pokoju (np. DOMOWKA)"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            maxLength={12}
            required
          />
          <button type="submit">GRAJ</button>
        </form>
      </div>
    </div>
  );
}

export default Home;
