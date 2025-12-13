import React, { useEffect, useState, useRef } from 'react';
import './Board.css';
import './Markers.css';

// Groups colors
const GROUP_COLORS = {
  brown: '#8d6e63',
  lightblue: '#81d4fa',
  pink: '#f48fb1',
  orange: '#ffcc80',
  red: '#ef5350',
  yellow: '#fff59d',
  green: '#a5d6a7',
  darkblue: '#90caf9',
  transport: '#bdbdbd',
  utility: '#eeeeee',
  special: '#ffffff',
  parking: '#ffffff',
  jail_visit: '#ffffff',
  gotojail: '#ffffff',
  start: '#ffffff',
  tax: '#ffffff',
  chance: '#ffffff'
};

function Board({ config, players, ownership }) {
  // State for animated positions
  const [renderedPositions, setRenderedPositions] = useState({});
  const animationRefs = useRef({});

  // Initialize or Sync
  useEffect(() => {
    // Check for changes
    players.forEach(p => {
      const target = p.pos;
      const current = renderedPositions[p.uuid] !== undefined ? renderedPositions[p.uuid] : target;

      if (current !== target) {
        // Needs animation
        if (animationRefs.current[p.uuid]) return; // Already animating

        // Simple step animation
        animationRefs.current[p.uuid] = setInterval(() => {
           setRenderedPositions(prev => {
              const curr = prev[p.uuid] !== undefined ? prev[p.uuid] : target;
              if (curr === target) {
                 clearInterval(animationRefs.current[p.uuid]);
                 delete animationRefs.current[p.uuid];
                 return prev;
              }

              let next = curr + 1;
              if (next >= 40) next = 0;

              // If we wrapped and target is behind, it's fine.
              // Logic: move 1 step.

              return { ...prev, [p.uuid]: next };
           });
        }, 200); // 200ms per step
      } else {
         // Sync instant (initial load)
         if (renderedPositions[p.uuid] === undefined) {
            setRenderedPositions(prev => ({ ...prev, [p.uuid]: target }));
         }
      }
    });
  }, [players]);

  const getGridStyle = (id) => {
    if (id === 0) return { gridRow: 11, gridColumn: 11 };
    if (id > 0 && id < 10) return { gridRow: 11, gridColumn: 11 - id };
    if (id === 10) return { gridRow: 11, gridColumn: 1 };
    if (id > 10 && id < 20) return { gridRow: 11 - (id - 10), gridColumn: 1 };
    if (id === 20) return { gridRow: 1, gridColumn: 1 };
    if (id > 20 && id < 30) return { gridRow: 1, gridColumn: (id - 20) + 1 };
    if (id === 30) return { gridRow: 1, gridColumn: 11 };
    if (id > 30 && id < 40) return { gridRow: (id - 30) + 1, gridColumn: 11 };
    return {};
  };

  const getRent = (field, houses) => {
      let rent = field.rent || 0;
      if (houses > 0) {
        rent = rent * Math.pow(2, houses);
      }
      return rent;
  };

  return (
    <div className="board-grid">
      <div className="center-logo">
        <h1>POLNOPOLY</h1>
        <p>GRA EKONOMICZNA</p>
      </div>
      {config.map(f => (
        <div
          key={f.id}
          className={`board-cell cell-${f.id} ${['property', 'transport', 'utility'].includes(f.type) ? 'interactive' : ''}`}
          style={{ ...getGridStyle(f.id), backgroundColor: GROUP_COLORS[f.group] }}
        >
          {/* Title Deed Tooltip */}
          {['property', 'transport', 'utility'].includes(f.type) && (
             <div className="deed-card">
                <div className="deed-header" style={{ backgroundColor: GROUP_COLORS[f.group] }}>
                  {f.name}
                </div>
                <div className="deed-body">
                   <div className="deed-row"><strong>Cena:</strong> {f.price} PLN</div>
                   {f.type === 'property' && (
                     <>
                       <div className="deed-row">Czynsz: {f.rent}</div>
                       <div className="deed-row">1 Dom: {getRent(f, 1)}</div>
                       <div className="deed-row">2 Domy: {getRent(f, 2)}</div>
                       <div className="deed-row">3 Domy: {getRent(f, 3)}</div>
                       <div className="deed-row">4 Domy: {getRent(f, 4)}</div>
                       <div className="deed-row">Hotel: {getRent(f, 5)}</div>
                       <div className="deed-row">Koszt Domu: 100 PLN</div>
                     </>
                   )}
                   {f.type === 'transport' && <div className="deed-info">Czynsz zależy od liczby posiadanych dworców.</div>}
                   {f.type === 'utility' && <div className="deed-info">Czynsz zależy od rzutu kostką.</div>}
                   <div className="deed-row" style={{ marginTop: '5px', borderTop: '1px solid #ccc' }}>
                      Zastaw: {Math.floor(f.price / 2)}
                   </div>
                </div>
             </div>
          )}

          {f.price > 0 && <div className="price-tag">{f.price}</div>}

          <div className="cell-icon">{f.icon}</div>

          <div className="name">{f.name}</div>

          {ownership[f.id] && (
            <>
              <div className="owner-marker" style={{ backgroundColor: players.find(p => p.uuid === ownership[f.id].owner)?.color || 'black' }}></div>
              {ownership[f.id].houses > 0 && !ownership[f.id].mortgaged && (
                 <div className="houses-container">
                    {ownership[f.id].houses === 5 ? (
                       <div className="hotel-marker" title="Hotel"></div>
                    ) : (
                       Array.from({ length: ownership[f.id].houses }).map((_, i) => <div key={i} className="house-marker"></div>)
                    )}
                 </div>
              )}
              {ownership[f.id].mortgaged && <span className="mortgaged">ZASTAW</span>}
              {/* Full border highlight for owner? */}
              <div className="owner-indicator" style={{ borderColor: players.find(p => p.uuid === ownership[f.id].owner)?.color || 'transparent', opacity: 0.5 }}></div>
            </>
          )}

          <div className="tokens">
            {players.filter(p => (renderedPositions[p.uuid] !== undefined ? renderedPositions[p.uuid] : p.pos) === f.id).map(p => (
              <div
                 key={p.uuid}
                 className="token"
                 style={{ backgroundColor: p.color, transition: 'all 0.2s ease' }}
                 title={p.nick}
              >
                {p.avatar || p.nick.substring(0,2)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Board;
