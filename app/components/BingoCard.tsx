import React from 'react';
import { BingoCell, BingoCardProps } from '@/types';

// BINGO文字を取得
const getBingoLetter = (colIndex: number): string => {
  const letters = ['B', 'I', 'N', 'G', 'O'];
  return letters[colIndex] || '';
};

// セルのスタイルを決定（デザインテーマに合わせて修正）
const getCellStyle = (cell: BingoCell, size: string): string => {
  const baseStyle = 'rounded-lg font-bold transition-all transform flex items-center justify-center';
  
  const sizeStyles = {
    small: 'text-sm',
    medium: 'text-lg',
    large: 'text-xl'
  };

  const stateStyle = cell.number === 0
    ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-red-700 border-2 border-red-600'
    : cell.marked
      ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-red-700 border-2 border-red-600'
      : 'bg-gradient-to-br from-red-600 to-red-800 text-yellow-300 border border-yellow-400/50';

  const latestStyle = cell.isLatest ? 'ring-4 ring-yellow-400 animate-pulse' : '';

  return `${baseStyle} ${sizeStyles[size as keyof typeof sizeStyles]} ${stateStyle} ${latestStyle}`;
};

export default function BingoCard({
  board,
  onCellClick,
  isInteractive = true,
  bingoLines = [],
  showNumbers = true,
  size = 'medium',
  className = ''
}: BingoCardProps) {
  // サイズに応じたコンテナスタイル
  const containerSizeStyles = {
    small: 'max-w-sm',
    medium: 'max-w-lg',
    large: 'max-w-2xl'
  };

  const headerSizeStyles = {
    small: 'w-12 h-12 text-lg',
    medium: 'w-14 h-14 text-xl',
    large: 'w-16 h-16 text-2xl'
  };

  return (
    <div className={`${containerSizeStyles[size]} ${className}`}>
      {/* BINGOヘッダー */}
      {showNumbers && (
        <div className="mb-4 flex justify-center gap-2">
          {['B', 'I', 'N', 'G', 'O'].map((letter) => (
            <div
              key={letter}
              className={`${headerSizeStyles[size]} bg-gradient-to-br from-red-600 to-red-800 text-yellow-300 rounded-lg flex items-center justify-center font-bold shadow-lg border border-yellow-400/50`}
            >
              {letter}
            </div>
          ))}
        </div>
      )}

      {/* ビンゴボード */}
      <div className="grid grid-cols-5 gap-2">
        {board.map((row, rowIdx) =>
          row.map((cell, colIdx) => (
            <button
              key={`${rowIdx}-${colIdx}`}
              onClick={() => isInteractive && onCellClick && onCellClick(rowIdx, colIdx)}
              disabled={!isInteractive || cell.number === 0}
              className={`aspect-square ${getCellStyle(cell, size)}`}
              aria-label={`${getBingoLetter(colIdx)}-${cell.number === 0 ? 'FREE' : cell.number}`}
            >
              {cell.number === 0 ? '★' : cell.number}
            </button>
          ))
        )}
      </div>

      {/* ビンゴライン表示 */}
      {bingoLines.length > 0 && (
        <div className="mt-4 p-3 bg-yellow-300/30 border-2 border-yellow-400 rounded-lg backdrop-blur-sm">
          <p className="text-sm font-semibold text-red-700">
            🎉 達成ライン: {bingoLines.join(', ')}
          </p>
        </div>
      )}

      {/* ビンゴカード統計 */}
      {showNumbers && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/30 backdrop-blur-sm rounded-lg p-2 border border-white/20">
            <p className="text-xs text-white/80">マーク済み</p>
            <p className="text-lg font-bold text-yellow-300 drop-shadow-md">
              {board.flat().filter(cell => cell.marked).length}
            </p>
          </div>
          <div className="bg-white/30 backdrop-blur-sm rounded-lg p-2 border border-white/20">
            <p className="text-xs text-white/80">残り</p>
            <p className="text-lg font-bold text-yellow-300 drop-shadow-md">
              {25 - board.flat().filter(cell => cell.marked || cell.number === 0).length}
            </p>
          </div>
          <div className="bg-yellow-300/30 backdrop-blur-sm rounded-lg p-2 border border-yellow-400">
            <p className="text-xs text-red-700">ビンゴ数</p>
            <p className="text-lg font-bold text-red-700">
              {bingoLines.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}