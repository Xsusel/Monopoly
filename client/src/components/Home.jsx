import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const AVATARS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', 'dV', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', 'RAM', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿', '🦔', '🐾', '🐉', '🐲', '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🎍', '🎋', '🍃', '🍂', '🍁', '🍄', '🐚', '🪨', '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '🌎', '🌍', '🌏', '🪐', '💫', '⭐️', '🌟', '✨', '⚡️', '☄️', '💥', '🔥', '🌪', '🌈', '☀️', '🌤', '⛅️', '🌥', '☁️', '🌦', '🌧', '⛈', '🌩', '🌨', '❄️', '☃️', '⛄️', '🌬', '💨', '💧', '💦', '☔️', '☂️', '🌊', '🌫', '🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍', '🛵', '🦽', '🦼', '🛺', '🚲', '🛴', '🛹', '🛼', '🚨', 'dk', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '🚁', '🛩', '✈️', '🛫', '🛬', '🚀', '🛰', '💺', '🛶', '🚤', 'dk', '🛥', '🛳', '⛴', '🚢', '⚓️', '🪝', '⛽️', '🚧', '🚦', '🚥', '🚏', '🗺', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟', '🎡', '🎢', '🎠', '⛲️', '⛱', '🏖', '🏝', '🏜', '🌋', '⛰', '🏔', '🗻', '🏕', '⛺️', '🏠', '🏡', '🏘', '🏚', '🏗', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛', '⛪️', '🕌', '🕍', '🛕', '🕋', '⛩', '🛤', '🛣', '🗾', '🎑', '🏞', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇', '🌆', '🏙', '🌃', '🌌', '🌉', '🌁'];
const SHORT_AVATARS = ['🐶', '🐱', '🚗', '🎩', '🦖', '🦅', '⚽', '🎸', '👾', '🚀', '🧀', '🍔', '🍺', '👑', '💰', '💣'];

function Home() {
  const [roomName, setRoomName] = useState('');
  const [nick, setNick] = useState('');
  const [avatar, setAvatar] = useState(SHORT_AVATARS[0]);
  const navigate = useNavigate();

  const handleCreate = (e) => {
    e.preventDefault();
    if (roomName.trim() && nick.trim()) {
      navigate(`/room/${roomName.trim().toUpperCase()}`, {
        state: {
          nick: nick.trim(),
          avatar: avatar
        }
      });
    }
  };

  return (
    <div className="home-container">
      <h1>POLNOPOLY</h1>
      <h2>GRA EKONOMICZNA</h2>
      <div className="card">
        <p>Wpisz swój nick, wybierz avatar i nazwę pokoju:</p>
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

          <div className="avatar-selection">
             <p>Wybierz Avatar:</p>
             <div className="avatar-grid">
               {SHORT_AVATARS.map(a => (
                 <div
                   key={a}
                   className={`avatar-option ${avatar === a ? 'selected' : ''}`}
                   onClick={() => setAvatar(a)}
                 >
                   {a}
                 </div>
               ))}
             </div>
          </div>

          <input
            type="text"
            placeholder="Nazwa Pokoju (np. DOMOWKA)"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            maxLength={12}
            required
            style={{ marginTop: '10px' }}
          />
          <button type="submit">GRAJ</button>
        </form>
      </div>
    </div>
  );
}

export default Home;
