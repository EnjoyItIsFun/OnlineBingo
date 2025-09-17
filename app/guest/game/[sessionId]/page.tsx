'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSocketConnection } from '@/hooks/useSocketConnection';

// 型定義
interface BingoCell {
  number: number;
  marked: boolean;
}

interface Player {
  id: string;
  name: string;
  board: number[][];
  bingoCount: number;
}

interface GameSession {
  sessionId: string;
  gameName: string;
  status: 'waiting' | 'playing' | 'finished';
  currentNumber: number | null;
  numbers: number[];
  players: Player[];
}

interface GuestGamePageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ playerId?: string; token?: string }>;
}

// BINGO文字を取得する関数
const getBingoLetter = (number: number): string => {
  if (number >= 1 && number <= 15) return 'B';
  if (number >= 16 && number <= 30) return 'I';
  if (number >= 31 && number <= 45) return 'N';
  if (number >= 46 && number <= 60) return 'G';
  if (number >= 61 && number <= 75) return 'O';
  return '';
};

// ビンゴ判定関数
const checkBingo = (board: BingoCell[][]): { count: number; lines: string[] } => {
  const lines: string[] = [];
  let count = 0;

  // 横のチェック
  for (let row = 0; row < 5; row++) {
    if (board[row].every(cell => cell.marked || cell.number === 0)) {
      lines.push(`横${row + 1}列目`);
      count++;
    }
  }

  // 縦のチェック
  for (let col = 0; col < 5; col++) {
    if (board.every(row => row[col].marked || row[col].number === 0)) {
      lines.push(`縦${col + 1}列目`);
      count++;
    }
  }

  // 斜め（左上から右下）
  if (board.every((row, i) => row[i].marked || row[i].number === 0)) {
    lines.push('斜め（＼）');
    count++;
  }

  // 斜め（右上から左下）
  if (board.every((row, i) => row[4 - i].marked || row[4 - i].number === 0)) {
    lines.push('斜め（／）');
    count++;
  }

  return { count, lines };
};

export default function GuestGamePage({ params, searchParams }: GuestGamePageProps) {
  const router = useRouter();
  const [session, setSession] = useState<GameSession | null>(null);
  const [board, setBoard] = useState<BingoCell[][]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [bingoLines, setBingoLines] = useState<string[]>([]);
  const [bingoCount, setBingoCount] = useState(0);
  const [showBingoAnimation, setShowBingoAnimation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [resolvedParams, setResolvedParams] = useState<{ sessionId: string } | null>(null);
  const [resolvedSearchParams, setResolvedSearchParams] = useState<{ playerId?: string; token?: string } | null>(null);

  const { socket, isConnected } = useSocketConnection();

  // PromiseのparamsとsearchParamsを解決
  useEffect(() => {
    Promise.all([params, searchParams]).then(([p, sp]) => {
      setResolvedParams(p);
      setResolvedSearchParams(sp);
    });
  }, [params, searchParams]);

  // セッション情報とプレイヤー情報の取得
  useEffect(() => {
    if (!resolvedParams || !resolvedSearchParams) return;

    const fetchData = async () => {
      try {
        // セッション情報取得
        const sessionRes = await fetch(`/api/sessions/${resolvedParams.sessionId}`, {
          headers: {
            'Authorization': `Bearer ${resolvedSearchParams.token}`
          }
        });

        if (!sessionRes.ok) {
          throw new Error('セッション情報の取得に失敗しました');
        }

        const sessionData = await sessionRes.json();
        setSession(sessionData);
        setDrawnNumbers(sessionData.numbers || []);
        setCurrentNumber(sessionData.currentNumber);

        // プレイヤー情報から自分のボードを取得
        const player = sessionData.players.find(
          (p: Player) => p.id === resolvedSearchParams.playerId
        );

        if (!player) {
          throw new Error('プレイヤー情報が見つかりません');
        }

        setPlayerName(player.name);

        // ボードを初期化（マーク状態を含む）
        const initialBoard: BingoCell[][] = player.board.map((row: number[]) =>
          row.map((num: number) => ({
            number: num,
            marked: num === 0 || (sessionData.numbers || []).includes(num)
          }))
        );

        setBoard(initialBoard);
        
        // 初期ビンゴチェック
        const { count, lines } = checkBingo(initialBoard);
        setBingoCount(count);
        setBingoLines(lines);

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
        setLoading(false);
      }
    };

    fetchData();
  }, [resolvedParams, resolvedSearchParams]);

  // Socket.ioイベントリスナー
  useEffect(() => {
    if (!socket || !resolvedParams || !resolvedSearchParams) return;

    // ゲーム開始
    socket.on('gameStarted', () => {
      setSession(prev => prev ? { ...prev, status: 'playing' } : null);
    });

    // 番号が引かれた
    socket.on('numberDrawn', (data: { number: number; drawnNumbers: number[] }) => {
      setCurrentNumber(data.number);
      setDrawnNumbers(data.drawnNumbers);

      // ボードを更新
      setBoard(prevBoard => {
        const newBoard = prevBoard.map(row =>
          row.map(cell => ({
            ...cell,
            marked: cell.marked || cell.number === data.number
          }))
        );

        // ビンゴチェック
        const { count, lines } = checkBingo(newBoard);
        
        // 新しいビンゴが達成された場合
        if (count > bingoCount) {
          setBingoCount(count);
          setBingoLines(lines);
          setShowBingoAnimation(true);
          
          // サーバーに通知
          socket.emit('bingoAchieved', {
            sessionId: resolvedParams.sessionId,
            playerId: resolvedSearchParams.playerId,
            bingoCount: count,
            lines
          });

          // アニメーションを3秒後に非表示
          setTimeout(() => setShowBingoAnimation(false), 3000);
        }

        return newBoard;
      });
    });

    // ゲーム終了
    socket.on('gameEnded', (data: { winners: string[] }) => {
      setSession(prev => prev ? { ...prev, status: 'finished' } : null);
      
      // 勝者情報を含めて結果画面へ遷移
      const winnersParam = encodeURIComponent(data.winners.join(','));
      router.push(`/guest/result/${resolvedParams.sessionId}?playerId=${resolvedSearchParams.playerId}&winners=${winnersParam}`);
    });

    return () => {
      socket.off('gameStarted');
      socket.off('numberDrawn');
      socket.off('gameEnded');
    };
  }, [socket, bingoCount, resolvedParams, resolvedSearchParams, router]);

  // セルをクリックしてマーク/解除（手動調整用）
  const toggleCell = useCallback((row: number, col: number) => {
    if (board[row][col].number === 0) return; // 中央のフリースペースは変更不可

    setBoard(prevBoard => {
      const newBoard = prevBoard.map((r, rIdx) =>
        r.map((cell, cIdx) => {
          if (rIdx === row && cIdx === col) {
            return { ...cell, marked: !cell.marked };
          }
          return cell;
        })
      );

      // ビンゴチェック
      const { count, lines } = checkBingo(newBoard);
      setBingoCount(count);
      setBingoLines(lines);

      return newBoard;
    });
  }, [board]);

  // ローディング画面
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-2xl">読み込み中...</div>
      </div>
    );
  }

  // エラー画面
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">エラー</h2>
          <p className="text-gray-700">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 w-full bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700"
          >
            トップページに戻る
          </button>
        </div>
      </div>
    );
  }

  // メインのゲーム画面
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{session?.gameName}</h1>
              <p className="text-gray-600">プレイヤー: {playerName}</p>
            </div>
            <div className="text-right">
              {bingoCount > 0 && (
                <div className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full font-bold">
                  ビンゴ {bingoCount}列達成！
                </div>
              )}
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* ビンゴカード */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="mb-4 flex justify-center gap-4">
                {['B', 'I', 'N', 'G', 'O'].map(letter => (
                  <div
                    key={letter}
                    className="w-16 h-16 bg-purple-600 text-white rounded-lg flex items-center justify-center text-2xl font-bold"
                  >
                    {letter}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-5 gap-2">
                {board.map((row, rowIdx) =>
                  row.map((cell, colIdx) => (
                    <button
                      key={`${rowIdx}-${colIdx}`}
                      onClick={() => toggleCell(rowIdx, colIdx)}
                      disabled={cell.number === 0}
                      className={`
                        aspect-square rounded-lg font-bold text-xl transition-all transform
                        ${cell.number === 0 
                          ? 'bg-yellow-400 text-yellow-900 cursor-default' 
                          : cell.marked
                            ? 'bg-purple-600 text-white scale-95 shadow-inner'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                        }
                        ${cell.number === currentNumber ? 'ring-4 ring-yellow-400 animate-pulse' : ''}
                      `}
                    >
                      {cell.number === 0 ? 'FREE' : cell.number}
                    </button>
                  ))
                )}
              </div>

              {/* ビンゴライン表示 */}
              {bingoLines.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                  <p className="text-sm font-semibold text-yellow-900">
                    達成ライン: {bingoLines.join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* サイドパネル */}
          <div className="lg:col-span-1">
            {/* 現在の番号 */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
              <h2 className="text-lg font-bold text-gray-800 mb-4">現在の番号</h2>
              {currentNumber ? (
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-600">
                    {getBingoLetter(currentNumber)}-{currentNumber}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    {drawnNumbers.length}個目
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  まだ番号が引かれていません
                </div>
              )}
            </div>

            {/* 最近の番号 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">既出番号（最新10個）</h2>
              <div className="space-y-2">
                {drawnNumbers.slice(-10).reverse().map((num, idx) => (
                  <div
                    key={num}
                    className={`
                      flex items-center justify-between p-2 rounded
                      ${idx === 0 && num === currentNumber ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-gray-50'}
                    `}
                  >
                    <span className="font-semibold">
                      {getBingoLetter(num)}-{num}
                    </span>
                    {idx === 0 && num === currentNumber && (
                      <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded">
                        最新
                      </span>
                    )}
                  </div>
                ))}
                {drawnNumbers.length === 0 && (
                  <p className="text-gray-400 text-center">
                    まだ番号が引かれていません
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ビンゴアニメーション */}
        {showBingoAnimation && (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="bg-yellow-400 text-yellow-900 px-12 py-8 rounded-2xl shadow-2xl animate-bounce">
              <h1 className="text-6xl font-bold">BINGO!</h1>
              <p className="text-2xl text-center mt-2">{bingoCount}列達成！</p>
            </div>
          </div>
        )}

        {/* 接続状態 */}
        {!isConnected && (
          <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg">
            接続が切断されました。再接続中...
          </div>
        )}

        {/* ゲーム状態表示 */}
        {session?.status === 'waiting' && (
          <div className="fixed bottom-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
            ゲーム開始を待っています...
          </div>
        )}

        {/* ゲーム終了モーダル */}
        {session?.status === 'finished' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
            <div className="bg-white rounded-lg p-8 max-w-md">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">ゲーム終了！</h2>
              <p className="text-lg text-gray-600 mb-6">
                お疲れ様でした！
                {bingoCount > 0 && ` ${bingoCount}列のビンゴを達成しました！`}
              </p>
              <button
                onClick={() => router.push('/')}
                className="w-full bg-purple-600 text-white rounded-lg py-3 text-lg font-bold hover:bg-purple-700"
              >
                トップページへ戻る
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}