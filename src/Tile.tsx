import React from 'react';

const NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

interface TileFace {
  top: string;
  bottom?: string;
  cls: string; // color class
}

export function tileFace(code: string): TileFace {
  const suit = code[0];
  const n = Number(code[1]);
  switch (suit) {
    case 'd': return { top: String(n), bottom: '筒', cls: 'dots' };
    case 'b': return { top: String(n), bottom: '索', cls: 'bamboo' };
    case 'c': return { top: NUMERALS[n], bottom: '萬', cls: 'chars' };
    case 'w':
      return { top: { E: '東', S: '南', W: '西', N: '北' }[code[1]]!, cls: 'wind' };
    case 'g':
      if (code === 'gR') return { top: '中', cls: 'dragon-r' };
      if (code === 'gG') return { top: '發', cls: 'dragon-g' };
      return { top: '白', cls: 'dragon-w' };
    case 'f':
      return { top: n <= 4 ? '🌸' : '🍂', bottom: String(((n - 1) % 4) + 1), cls: 'flower' };
    default:
      return { top: '?', cls: '' };
  }
}

export function windName(code: string): string {
  return { wE: '東 East', wS: '南 South', wW: '西 West', wN: '北 North' }[code] ?? code;
}

export const Tile: React.FC<{
  code: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  selected?: boolean;
  highlight?: boolean;
}> = ({ code, size = 'md', onClick, selected, highlight }) => {
  const f = tileFace(code);
  return (
    <div
      className={`tile ${size} ${f.cls} ${onClick ? 'clickable' : ''} ${selected ? 'selected' : ''} ${highlight ? 'highlight' : ''}`}
      onClick={onClick}
    >
      <span className="tile-top">{f.top}</span>
      {f.bottom && <span className="tile-bottom">{f.bottom}</span>}
    </div>
  );
};

export const TileBack: React.FC<{ size?: 'sm' | 'md'; vertical?: boolean }> = ({ size = 'sm', vertical }) => (
  <div className={`tile ${size} back ${vertical ? 'vertical' : ''}`} />
);
