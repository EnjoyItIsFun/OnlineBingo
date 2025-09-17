'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSocketConnection } from '@/hooks/useSocketConnection';
import { useGameTimer } from '@/hooks/useGameTimer';

// 型定義
interface Player {
  id: string;
  name: string;
  bingoCount: number;
  isConnected: boolean;
  joinedAt: string;
}

interface GameSession {
  sessionId: string;
  gameName: string;
  hostId: string;
  players: Player[];
  numbers: number[];
  currentNumber: number | null;
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
}

interface HostGamePageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ token?: string }>;
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

// 番号をシャッフルする関数（Fisher-Yates）
const shuffleNumbers = (): number[] => {
  const numbers = Array.from({ length: 75 }, (_, i) => i + 1);
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return numbers;
};

export default function HostGamePage({ params, searchParams }: HostGamePageProps) {
  const router = useRouter();
  const [session, setSession] = useState<GameSession | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [remainingNumbers, setRemainingNumbers] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [winners, setWinners] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedParams, setResolvedParams] = useState<{ sessionId: string } | null>(null);
  const [resolvedSearchParams, setResolvedSearchParams] = useState<{ token?: string } | null>(null);

  const { socket, isConnected } = useSocketConnection();
  
  // useGameTimerの正しい使用方法（現在の実装に合わせる）
  const { 
    timeRemaining, 
    formattedTime
  } = useGameTimer(session?.status || 'waiting', 7200); // 2時間タイマー

  // PromiseのparamsとsearchParamsを解決
  useEffect(() => {
    Promise.all([params, searchParams]).then(([p, sp]) => {
      setResolvedParams(p);
      setResolvedSearchParams(sp);
    });
  }, [params, searchParams]);

  // セッション情報の取得
  useEffect(() => {
    if (!resolvedParams || !resolvedSearchParams) return;

    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/sessions/${resolvedParams.sessionId}`, {
          headers: {
            'Authorization': `Bearer ${resolvedSearchParams.token}`
          }
        });

        if (!res.ok) {
          throw new Error('セッション情報の取得に失敗しました');
        }

        const data = await res.json();
        setSession(data);
        setDrawnNumbers(data.numbers || []);
        setCurrentNumber(data.currentNumber);
        
        // 残りの番号を初期化
        const allNumbers = shuffleNumbers();
        const remaining = allNumbers.filter(n => !data.numbers?.includes(n));
        setRemainingNumbers(remaining);
        
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
        setLoading(false);
      }
    };

    fetchSession();
  }, [resolvedParams, resolvedSearchParams]);

  // Socket.ioイベントリスナー
  useEffect(() => {
    if (!socket || !session) return;

    // プレイヤー参加
    socket.on('playerJoined', (player: Player) => {
      setSession(prev => prev ? {
        ...prev,
        players: [...prev.players, player]
      } : null);
    });

    // プレイヤー退出
    socket.on('playerLeft', (playerId: string) => {
      setSession(prev => prev ? {
        ...prev,
        players: prev.players.filter(p => p.id !== playerId)
      } : null);
    });

    // ビンゴ達成通知
    socket.on('bingoAchieved', (data: { player: Player; bingoCount: number }) => {
      setWinners(prev => [...prev, data.player]);
      setSession(prev => prev ? {
        ...prev,
        players: prev.players.map(p => 
          p.id === data.player.id 
            ? { ...p, bingoCount: data.bingoCount }
            : p
        )
      } : null);
    });

    return () => {
      socket.off('playerJoined');
      socket.off('playerLeft');
      socket.off('bingoAchieved');
    };
  }, [socket, session]);

  // 番号を引く
  const drawNumber = useCallback(() => {
    if (!resolvedParams || remainingNumbers.length === 0 || isDrawing) return;

    setIsDrawing(true);
    
    // アニメーション用の仮の番号表示
    let animationCount = 0;
    const animationInterval = setInterval(() => {
      setCurrentNumber(Math.floor(Math.random() * 75) + 1);
      animationCount++;
      
      if (animationCount >= 10) {
        clearInterval(animationInterval);
        
        // 実際の番号を選択
        const newNumber = remainingNumbers[0];
        setCurrentNumber(newNumber);
        setDrawnNumbers(prev => [...prev, newNumber]);
        setRemainingNumbers(prev => prev.slice(1));
        setIsDrawing(false);

        // Socket.ioで番号を配信
        if (socket) {
          socket.emit('numberDrawn', {
            sessionId: resolvedParams.sessionId,
            number: newNumber,
            drawnNumbers: [...drawnNumbers, newNumber]
          });
        }
      }
    }, 100);
  }, [remainingNumbers, drawnNumbers, isDrawing, socket, resolvedParams]);

  // ゲーム開始
  const startGame = () => {
    if (!socket || !session || !resolvedParams || !resolvedSearchParams) return;

    socket.emit('startGame', {
      sessionId: resolvedParams.sessionId,
      accessToken: resolvedSearchParams.token
    });

    setSession(prev => prev ? { ...prev, status: 'playing' } : null);
  };

  // ゲーム終了
  const endGame = () => {
    if (!socket || !session || !resolvedParams) return;

    socket.emit('endGame', {
      sessionId: resolvedParams.sessionId,
      winners: winners.map(w => w.id)
    });

    setSession(prev => prev ? { ...prev, status: 'finished' } : null);
    router.push(`/host/result/${resolvedParams.sessionId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-2xl">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">エラー</h2>
          <p className="text-gray-700">{error}</p>
          <button
            onClick={() => router.push('/host')}
            className="mt-4 w-full bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700"
          >
            ホーム画面に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{session?.gameName}</h1>
              <p className="text-gray-600">セッションID: {resolvedParams?.sessionId}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">残り時間</p>
              <p className="text-2xl font-bold text-blue-600">
                {formattedTime}
              </p>
              {timeRemaining === 0 && (
                <p className="text-red-600 text-sm">時間切れです</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* メインコントロール */}
          <div className="lg:col-span-2">
            {/* 現在の番号 */}
            <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">現在の番号</h2>
              
              {currentNumber ? (
                <div className="text-center">
                  <div className="inline-block">
                    <div className="text-6xl font-bold text-purple-600 mb-2">
                      {getBingoLetter(currentNumber)}-{currentNumber}
                    </div>
                    <div className="text-gray-600">
                      {drawnNumbers.length}個目 / 全75個
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400 text-4xl">
                  番号を引いてください
                </div>
              )}

              {/* コントロールボタン */}
              <div className="mt-8 flex justify-center gap-4">
                {session?.status === 'waiting' ? (
                  <button
                    onClick={startGame}
                    disabled={!session || session.players.length < 2}
                    className="px-8 py-4 bg-green-600 text-white rounded-lg text-xl font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ゲーム開始
                  </button>
                ) : session?.status === 'playing' ? (
                  <>
                    <button
                      onClick={drawNumber}
                      disabled={remainingNumbers.length === 0 || isDrawing || !isConnected}
                      className="px-8 py-4 bg-blue-600 text-white rounded-lg text-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                    >
                      {isDrawing ? '抽選中...' : '次の番号を引く'}
                    </button>
                    <button
                      onClick={endGame}
                      className="px-8 py-4 bg-red-600 text-white rounded-lg text-xl font-bold hover:bg-red-700 transition-colors"
                    >
                      ゲーム終了
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {/* 既出番号一覧 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">既出番号</h3>
              <div className="grid grid-cols-15 gap-1">
                {Array.from({ length: 75 }, (_, i) => i + 1).map(num => (
                  <div
                    key={num}
                    className={`
                      aspect-square flex items-center justify-center text-xs font-bold rounded
                      ${drawnNumbers.includes(num) 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-200 text-gray-400'
                      }
                      ${currentNumber === num ? 'ring-2 ring-yellow-400 animate-pulse' : ''}
                    `}
                  >
                    {num}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* サイドバー */}
          <div className="lg:col-span-1">
            {/* 参加者一覧 */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                参加者 ({session?.players.length}/{session?.maxPlayers})
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {session?.players.map(player => (
                  <div
                    key={player.id}
                    className={`
                      p-3 rounded-lg border-2
                      ${player.bingoCount > 0 
                        ? 'border-yellow-400 bg-yellow-50' 
                        : 'border-gray-200'
                      }
                    `}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-gray-800">{player.name}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(player.joinedAt).toLocaleTimeString('ja-JP')}
                        </p>
                      </div>
                      <div className="text-right">
                        {player.bingoCount > 0 && (
                          <span className="inline-block bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-sm font-bold">
                            {player.bingoCount}列
                          </span>
                        )}
                        <div className={`w-2 h-2 rounded-full mt-1 ml-auto ${
                          player.isConnected ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ビンゴ達成者 */}
            {winners.length > 0 && (
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6">
                <h3 className="text-xl font-bold text-yellow-900 mb-4">
                  🎉 ビンゴ達成者
                </h3>
                <div className="space-y-2">
                  {winners.map((winner, index) => (
                    <div key={winner.id} className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-yellow-600">
                        {index + 1}位
                      </span>
                      <span className="text-gray-800 font-semibold">
                        {winner.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 接続状態 */}
        {!isConnected && (
          <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg">
            接続が切断されました。再接続中...
          </div>
        )}
      </div>
    </div>
  );
}