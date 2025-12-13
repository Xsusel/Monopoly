import React from 'react';
import './Board.css';

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
  // We need to order fields correctly for CSS Grid 11x11
  // Standard Monopoly is 40 fields.
  // 0 is Bottom Right.
  // 1-9 Bottom (Right to Left)
  // 10 Bottom Left (Jail)
  // 11-19 Left (Bottom to Top)
  // 20 Top Left (Parking)
  // 21-29 Top (Left to Right)
  // 30 Top Right (GoToJail)
  // 31-39 Right (Top to Bottom)

  // This is tricky in CSS Grid.
  // Let's create an array of 11x11 = 121 cells.
  // Map field IDs to grid coordinates.

  // 11x11 Grid
  // Row 1 (Top): 20 -> 30
  // Row 11 (Bottom): 10 -> 0
  // Col 1 (Left): 20 -> 10
  // Col 11 (Right): 30 -> 0

  // We can just iterate 0..40 and place them via grid-area logic or raw styles.
  // Or easier: Just map them to a linear list and use specific grid-column/row props.

  // 0 (Start): Row 11, Col 11
  // 1-9: Row 11, Col 10..2
  // 10 (Jail): Row 11, Col 1
  // 11-19: Row 10..2, Col 1
  // 20 (Parking): Row 1, Col 1
  // 21-29: Row 1, Col 2..10
  // 30 (GoToJail): Row 1, Col 11
  // 31-39: Row 2..10, Col 11

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

  return (
    <div className="board-grid">
      <div className="center-logo">
        <h1>POLNOPOLY</h1>
        <p>GRA EKONOMICZNA</p>
      </div>
      {config.map(f => (
        <div
          key={f.id}
          className={`board-cell cell-${f.id}`}
          style={{ ...getGridStyle(f.id), backgroundColor: GROUP_COLORS[f.group] }}
        >
          {f.price > 0 && <div className="price-tag">{f.price}</div>}
          <div className="name">{f.name}</div>

          {ownership[f.id] && (
            <div className="owner-marker" style={{ backgroundColor: players.find(p => p.uuid === ownership[f.id].owner)?.color || 'black' }}>
               {ownership[f.id].houses > 0 && <span className="houses">{'🏠'.repeat(ownership[f.id].houses)}</span>}
               {ownership[f.id].mortgaged && <span className="mortgaged">ZASTAW</span>}
            </div>
          )}

          <div className="tokens">
            {players.filter(p => p.pos === f.id).map(p => (
              <div
                 key={p.uuid}
                 className="token"
                 style={{ backgroundColor: p.color }}
                 title={p.nick}
              >
                {p.nick.substring(0,2)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Board;
