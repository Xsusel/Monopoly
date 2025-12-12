import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
  const [roomName, setRoomName] = useState('');
  const navigate = useNavigate();

  const handleCreate = (e) => {
    e.preventDefault();
    if (roomName.trim()) {
      navigate(`/room/${roomName.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="home-container">
      <h1>POLNOPOLY</h1>
      <h2>EDYCJA CEBULA</h2>
      <div className="card">
        <p>Wpisz nazwę pokoju, żeby stworzyć grę lub dołączyć:</p>
        <form onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Np. DOMOWKA"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            maxLength={12}
          />
          <button type="submit">GRAJ</button>
        </form>
      </div>
    </div>
  );
}

export default Home;
