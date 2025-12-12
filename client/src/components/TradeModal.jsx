import React, { useState } from 'react';
import './TradeModal.css';

function TradeModal({ me, players, boardConfig, onClose, onSend }) {
  const [targetUuid, setTargetUuid] = useState('');

  const [offerCash, setOfferCash] = useState(0);
  const [offerProps, setOfferProps] = useState([]);

  const [wantCash, setWantCash] = useState(0);
  const [wantProps, setWantProps] = useState([]);

  // Filter players excluding me
  const otherPlayers = players.filter(p => p.uuid !== me.uuid);

  const toggleProp = (list, setList, fid) => {
    if (list.includes(fid)) {
      setList(list.filter(id => id !== fid));
    } else {
      setList([...list, fid]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!targetUuid) return alert('Wybierz gracza!');

    onSend({
      targetUuid,
      offer: { cash: parseInt(offerCash), properties: offerProps },
      want: { cash: parseInt(wantCash), properties: wantProps }
    });
    onClose();
  };

  const getPropName = (fid) => {
    const f = boardConfig.find(x => x.id === fid);
    return f ? f.name : fid;
  };

  return (
    <div className="trade-overlay">
      <div className="trade-modal">
        <h2>Handel</h2>
        <div className="trade-header">
           <label>Z kim handlujesz?</label>
           <select value={targetUuid} onChange={e => setTargetUuid(e.target.value)}>
             <option value="">-- Wybierz Gracza --</option>
             {otherPlayers.map(p => (
               <option key={p.uuid} value={p.uuid}>{p.nick}</option>
             ))}
           </select>
        </div>

        <div className="trade-body">
           <div className="trade-side">
              <h3>Dajesz:</h3>
              <div className="cash-input">
                Kasa: <input type="number" value={offerCash} onChange={e => setOfferCash(e.target.value)} max={me.cash} />
              </div>
              <div className="props-select">
                {me.properties.map(fid => (
                  <div
                    key={fid}
                    className={`prop-item ${offerProps.includes(fid) ? 'selected' : ''}`}
                    onClick={() => toggleProp(offerProps, setOfferProps, fid)}
                  >
                    {getPropName(fid)}
                  </div>
                ))}
              </div>
           </div>

           <div className="trade-side">
              <h3>Chcesz:</h3>
              <div className="cash-input">
                Kasa: <input type="number" value={wantCash} onChange={e => setWantCash(e.target.value)} />
              </div>
              <div className="props-select">
                 {targetUuid && players.find(p => p.uuid === targetUuid)?.properties.map(fid => (
                    <div
                      key={fid}
                      className={`prop-item ${wantProps.includes(fid) ? 'selected' : ''}`}
                      onClick={() => toggleProp(wantProps, setWantProps, fid)}
                    >
                      {getPropName(fid)}
                    </div>
                 ))}
                 {!targetUuid && <p>Wybierz gracza, by widzieć jego włości</p>}
              </div>
           </div>
        </div>

        <div className="trade-footer">
           <button onClick={onClose} className="btn-cancel">Anuluj</button>
           <button onClick={handleSubmit} className="btn-confirm">Wyślij Ofertę</button>
        </div>
      </div>
    </div>
  );
}

export default TradeModal;
