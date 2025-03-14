'use client'
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ビンゴボードを生成する関数
const generateBingoBoard = () => {
  const board = Array(5).fill(null).map(() => Array(5).fill(0));
  const numbers = Array.from({ length: 75 }, (_, i) => i + 1);
  
  for (let col = 0; col < 5; col++) {
    const min = col * 15 + 1;
    const max = min + 14;
    const availableNumbers = numbers.filter(n => n >= min && n <= max);
    
    for (let row = 0; row < 5; row++) {
      if (col === 2 && row === 2) {
        board[row][col] = 0;
        continue;
      }
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      board[row][col] = availableNumbers.splice(randomIndex, 1)[0];
    }
  }
  
  return board;
};

// ビンゴをチェックする関数
const checkBingo = (board: number[][], calledNumbers: number[]) => {
  const markedBoard = board.map(row =>
    row.map(num => num <= 0 || calledNumbers.includes(num))
  );

  // 横のチェック
  const horizontalBingo = markedBoard.some(row =>
    row.every(marked => marked)
  );

  // 縦のチェック
  const verticalBingo = markedBoard[0].some((_, col) =>
    markedBoard.every(row => row[col])
  );

  // 斜めのチェック（左上から右下）
  const diagonal1Bingo = markedBoard.every((row, i) => row[i]);

  // 斜めのチェック（右上から左下）
  const diagonal2Bingo = markedBoard.every((row, i) => row[4 - i]);

  return horizontalBingo || verticalBingo || diagonal1Bingo || diagonal2Bingo;
};

const CreateGame = () => {
  const router = useRouter();

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-gradient-to-r from-pink-500/70 to-orange-400/70 p-4 rounded-t-lg backdrop-blur-sm border-t border-l border-r border-white/20">
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-md">
          みんなとビンゴをプレイ
        </h2>
      </div>
      
      <div className="grid gap-6 bg-white/20 backdrop-blur-md rounded-b-lg border-b border-l border-r border-white/20 p-6 shadow-xl">
        <div className="flex justify-center">
          <button 
            onClick={() => router.push('/host/')}
            className="w-full bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white font-bold py-3 rounded-lg shadow-lg transform transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ゲームを主催
          </button>
        </div>
        
        <div className="flex justify-center">
          <button 
            onClick={() => router.push('/guest/join')}
            className="w-full bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white font-bold py-3 rounded-lg shadow-lg transform transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ゲームに参加
          </button>
        </div>
      </div>
    </div>
  );
};


interface BingoBoardProps {
  board: number[][];
  calledNumbers: number[];
  onCellClick: (row: number, col: number) => void;
}
  const BingoBoard: React.FC<BingoBoardProps> = ({ board, calledNumbers, onCellClick }) => {
      return (
        <div className="bg-white/30 backdrop-blur-md p-6 shadow-xl border-b border-l border-r border-white/20">
          <div className="grid grid-cols-5 gap-3 mb-4">
            {['B', 'I', 'N', 'G', 'O'].map((letter) => (
              <div key={letter} className="text-center font-extrabold text-2xl p-2 text-transparent bg-clip-text bg-gradient-to-br from-red-600 to-orange-400 drop-shadow-sm">
                {letter}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-3">
            {board.map((row, rowIndex) => 
              row.map((number, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => onCellClick(rowIndex, colIndex)}
                  className={`
                    aspect-square flex items-center justify-center
                    rounded-lg shadow-md transition-all cursor-pointer
                    ${number === 0 
                      ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-red-700 border-2 border-red-600' 
                      : number < 0 || calledNumbers.includes(number)
                        ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-red-700 border-2 border-red-600' 
                        : 'bg-gradient-to-br from-red-600 to-red-800 text-yellow-300 border border-yellow-400/50 hover:brightness-110'}
                  `}
                >
                  <span className={`
                    font-bold drop-shadow-md
                    ${number === 0 ? 'text-2xl' : 'text-lg'}
                    ${number < 0 ? 'line-through opacity-80' : ''}
                  `}>
                    {number === 0 ? '★' : Math.abs(number)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      // </div>
      );
    };

export default function BingoTopPage() {
  // const router = useRouter();
  const [board, setBoard] = useState<number[][]>([]);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [latestNumber, setLatestNumber] = useState<number | null>(null);
  const [remainingNumbers, setRemainingNumbers] = useState<number[]>([]);
  const [isBingo, setIsBingo] = useState(false);

  // クライアントサイドでのみ初期化
  useEffect(() => {
    setBoard(generateBingoBoard());
    setRemainingNumbers(Array.from({ length: 75 }, (_, i) => i + 1));
  }, []);

  // ビンゴチェック
  useEffect(() => {
    if (calledNumbers.length > 4) {  // 最低5つ必要
      const bingo = checkBingo(board, calledNumbers);
      setIsBingo(bingo);
    }
  }, [board, calledNumbers]);

  // ゲームをリセット
  const resetGame = () => {
    setBoard(generateBingoBoard());
    setCalledNumbers([]);
    setLatestNumber(null);
    setRemainingNumbers(Array.from({ length: 75 }, (_, i) => i + 1));
    setIsBingo(false);
  };

  const drawNumber = () => {
    if (remainingNumbers.length === 0) return;
    
    const randomIndex = Math.floor(Math.random() * remainingNumbers.length);
    const newNumber = remainingNumbers[randomIndex];
    
    setLatestNumber(newNumber);
    setCalledNumbers(prev => [...prev, newNumber]);
    setRemainingNumbers(prev => prev.filter(n => n !== newNumber));
  };

  const handleCellClick = (row: number, col: number) => {
    const number = board[row][col];
    if (number === 0 || calledNumbers.includes(number)) {
      const newBoard = [...board];
      newBoard[row][col] = number === 0 ? 0 : -number;
      setBoard(newBoard);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8 flex flex-col items-center justify-center">
      <h1 className="text-5xl font-bold text-white mb-10 drop-shadow-lg">
        オンライン<span className="text-yellow-300">BINGO</span>
      </h1>

      <div className="w-full max-w-md mb-8">
          <CreateGame />
      </div>
      
      <div className="w-full max-w-2xl space-y-8">
        {board.length > 0 && (
          // <BingoBoard 
          //   board={board} 
          //   calledNumbers={calledNumbers}
          //   onCellClick={handleCellClick}
          // />
          <div className="w-full overflow-hidden rounded-xl">
            <div className="bg-gradient-to-r from-pink-500/70 to-orange-400/70 p-4 backdrop-blur-sm border-t border-l border-r border-white/20">
          {/* <div className="bg-gradient-to-r from-pink-500/70 to-orange-400/70 p-4 rounded-t-lg backdrop-blur-sm border-t border-l border-r border-white/20"> */}
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-md">
              一人でビンゴをプレイ
            </h2>
          </div>
          
          <BingoBoard 
            board={board} 
            calledNumbers={calledNumbers}
            onCellClick={handleCellClick}
          />
        </div>

        )}
        {isBingo && (
          <div className="mb-8 p-4 bg-yellow-300/80 backdrop-blur-md rounded-lg shadow-lg border-2 border-red-600 animate-pulse">
            <h2 className="text-3xl font-bold text-red-700 text-center">🎉 BINGO! 🎉</h2>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="bg-white/30 backdrop-blur-md rounded-xl p-4 shadow-lg border border-white/20 flex-1">
            <h2 className="text-xl font-bold text-white mb-3 text-center drop-shadow-md">最新の番号</h2>
            <div className="aspect-square w-20 h-20 mx-auto flex items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-4 border-red-600 shadow-lg">
              <span className="text-3xl font-bold text-red-700">{latestNumber || '-'}</span>
            </div>
            <p className="text-center mt-2 text-white">
              残り: {remainingNumbers.length}個
            </p>
          </div>
          
          <div className="flex flex-col gap-3 flex-1">
            <button
              onClick={drawNumber}
              disabled={remainingNumbers.length === 0}
              className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-red-800 font-bold py-4 px-6 rounded-lg shadow-lg transform transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              番号を引く
            </button>
            
            <button
              onClick={resetGame}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3 px-6 rounded-lg shadow-lg"
            >
              リセット
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { CreateGame, BingoBoard, BingoTopPage };