// app/host/game/[sessionId]/page.tsx
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useSocketConnection } from '@/hooks/useSocketConnection';
import { useGameTimer } from '@/hooks/useGameTimer';
import { 
  GameSession, 
  Player,
  AuthenticationData 
} from '@/types';
import { 
  getSession,
  normalizeErrorMessage 
} from '@/utils/api';
import { 
  Sparkles, 
  Users, 
  Trophy, 
  Timer,
  Play,
  RefreshCw,
  Crown,
  AlertCircle,
  XCircle
} from 'lucide-react';

// 番号履歴表示コンポーネント
interface NumberHistoryProps {
  numbers: number[];
}

const NumberHistory: React.FC<NumberHistoryProps> = ({ numbers }) => {
  const sortedNumbers = [...numbers].sort((a, b) => a - b);
  
  const categorizedNumbers = {
    B: sortedNumbers.filter(n => n >= 1 && n <= 15),
    I: sortedNumbers.filter(n => n >= 16 && n <= 30),
    N: sortedNumbers.filter(n => n >= 31 && n <= 45),
    G: sortedNumbers.filter(n => n >= 46 && n <= 60),
    O: sortedNumbers.filter(n => n >= 61 && n <= 75),
  };
  
  return (
    <div className="space-y-2">
      {Object.entries(categorizedNumbers).map(([letter, nums]) => (
        <div key={letter} className="flex items-center gap-2">
          <span className="text-yellow-300 font-bold w-6">{letter}:</span>
          <div className="flex flex-wrap gap-1">
            {nums.length > 0 ? (
              nums.map(num => (
                <span
                  key={num}
                  className="bg-white/30 text-white text-xs px-2 py-1 rounded border border-white/40"
                >
                  {num}
                </span>
              ))
            ) : (
              <span className="text-white/50 text-xs">-</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// プレイヤーカード
interface PlayerCardProps {
  player: Player;
  rank?: number;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, rank }) => {
  return (
    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {rank && rank <= 3 && (
            <div className={`
              w-8 h-8 rounded-full mr-2 flex items-center justify-center font-bold
              ${rank === 1 ? 'bg-yellow-400 text-yellow-900' : 
                rank === 2 ? 'bg-gray-300 text-gray-700' : 
                'bg-orange-400 text-orange-900'}
            `}>
              {rank}
            </div>
          )}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white font-bold">
            {player.name.charAt(0).toUpperCase()}
          </div>
          <div className="ml-3">
            <p className="font-semibold text-white drop-shadow-sm">{player.name}</p>
            <p className="text-xs text-white/70">
              ビンゴ: {player.bingoCount || 0}回
            </p>
          </div>
        </div>
        {player.bingoCount > 0 && (
          <Trophy className="w-5 h-5 text-yellow-300" />
        )}
      </div>
    </div>
  );
};

// メインコンポーネント
const GamePageContent: React.FC = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const sessionId = params.sessionId as string;
  const accessToken = searchParams.get('accessToken') || '';
  const hostId = searchParams.get('hostId') || '';

  const [session, setSession] = useState<GameSession | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [remainingNumbers, setRemainingNumbers] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingEnd, setIsConfirmingEnd] = useState(false);

  const { socket, connect, on, off, emit, disconnect } = useSocketConnection();
  const { formattedTime } = useGameTimer(session?.status || 'waiting', 7200);

  // 初期データ読み込み
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const sessionData = await getSession(sessionId, accessToken);
        setSession(sessionData);
        
        if (sessionData.numbers && sessionData.numbers.length > 0) {
          setDrawnNumbers(sessionData.numbers);
          setCurrentNumber(sessionData.currentNumber || sessionData.numbers[sessionData.numbers.length - 1]);
          
          const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
          setRemainingNumbers(allNumbers.filter(n => !sessionData.numbers.includes(n)));
        } else {
          const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
          setRemainingNumbers(allNumbers);
        }
        
        const authData: AuthenticationData = {
          sessionId,
          accessToken,
          userId: hostId,
          role: 'host'
        };
        connect(authData);
      } catch (err) {
        setError(normalizeErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [sessionId, accessToken, hostId, connect]);

  // Socket.ioイベントリスナー
  useEffect(() => {
    if (!socket) return;

    const handleNumberDrawn = (data: { number: number; drawnNumbers: number[] }) => {
      setCurrentNumber(data.number);
      setDrawnNumbers(data.drawnNumbers || []);
      setRemainingNumbers(prev => prev.filter(n => n !== data.number));
      setIsDrawing(false);
    };

    const handlePlayerBingo = (data: { player: Player; bingoCount: number }) => {
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map(p => 
            p.id === data.player.id 
              ? { ...p, bingoCount: data.bingoCount }
              : p
          )
        };
      });
    };

    const handleGameStarted = () => {
      setSession(prev => prev ? { ...prev, status: 'playing' } : prev);
    };

    const handleSessionUpdated = (updatedSession: GameSession) => {
      setSession(updatedSession);
      if (updatedSession.numbers) {
        setDrawnNumbers(updatedSession.numbers);
      }
    };

    const handleConnectionError = (errorMessage: string) => {
      setError(errorMessage);
      setIsDrawing(false);
    };

    const handleGameReset = () => {
      setDrawnNumbers([]);
      setCurrentNumber(null);
      setRemainingNumbers(Array.from({ length: 75 }, (_, i) => i + 1));
      setSession(prev => prev ? { 
        ...prev, 
        status: 'waiting',
        numbers: [],
        currentNumber: null,
        players: prev.players.map(p => ({ ...p, bingoCount: 0 }))
      } : prev);
    };

    // イベントリスナー登録
    on('number_drawn', handleNumberDrawn);
    on('player_bingo', handlePlayerBingo);
    on('game_started', handleGameStarted);
    on('session_updated', handleSessionUpdated);
    on('connection_error', handleConnectionError);
    
    // reset_gameイベントのリスナー（型定義にない場合は直接socketで登録）
    if (socket) {
      socket.on('game_reset', handleGameReset);
      socket.on('error', (data: { message: string }) => {
        setError(data.message);
        setIsDrawing(false);
      });
    }

    return () => {
      off('number_drawn', handleNumberDrawn);
      off('player_bingo', handlePlayerBingo);
      off('game_started', handleGameStarted);
      off('session_updated', handleSessionUpdated);
      off('connection_error', handleConnectionError);
      
      if (socket) {
        socket.off('game_reset', handleGameReset);
        socket.off('error');
      }
    };
  }, [socket, on, off]);

  // ゲーム開始
  const handleStartGame = useCallback(() => {
    if (!socket || session?.status !== 'waiting') return;
    
    emit('start_game', { sessionId });
    setSession(prev => prev ? { ...prev, status: 'playing' } : prev);
  }, [socket, session, sessionId, emit]);

  // 番号抽選
  const handleDrawNumber = useCallback(() => {
    if (!socket || remainingNumbers.length === 0 || isDrawing) return;
    
    setIsDrawing(true);
    setError(null);
    
    const randomIndex = Math.floor(Math.random() * remainingNumbers.length);
    const newNumber = remainingNumbers[randomIndex];
    
    emit('draw_number', { 
      sessionId, 
      number: newNumber
    });
    
    // タイムアウト処理（5秒経っても応答がない場合）
    setTimeout(() => {
      if (isDrawing) {
        setIsDrawing(false);
        setError('番号の抽選に失敗しました。再度お試しください。');
      }
    }, 5000);
  }, [socket, remainingNumbers, sessionId, isDrawing, emit]);

  // ゲームリセット
  const handleResetGame = useCallback(() => {
    if (!socket) return;
    
    emit('reset_game', { sessionId });
  }, [socket, sessionId, emit]);

  // ゲーム終了
  const handleEndGame = useCallback(async () => {
    if (!isConfirmingEnd) {
      setIsConfirmingEnd(true);
      setTimeout(() => setIsConfirmingEnd(false), 3000); // 3秒後に自動でリセット
      return;
    }

    try {
      // Socket.ioでセッション終了を通知（cancel_sessionイベントを使用）
      if (socket) {
        socket.emit('cancel_session', { sessionId });
      }
      
      disconnect();
      router.push('/host');
    } catch (err) {
      setError(normalizeErrorMessage(err));
    }
  }, [isConfirmingEnd, socket, sessionId, disconnect, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-lg font-medium drop-shadow-sm">ゲーム情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white/30 backdrop-blur-md rounded-xl shadow-2xl p-6 border border-white/20">
            <AlertCircle className="w-12 h-12 text-yellow-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white text-center mb-2 drop-shadow-md">
              エラーが発生しました
            </h2>
            <p className="text-white/90 text-center mb-4">{error}</p>
            <button
              onClick={() => router.push('/host')}
              className="w-full bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white font-bold py-3 rounded-lg shadow-lg transform transition hover:scale-105"
            >
              ホスト画面に戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Crown className="w-10 h-10 text-yellow-300 mr-3" />
            <h1 className="text-4xl font-bold text-white drop-shadow-lg">
              {session.gameName}
            </h1>
            <Sparkles className="w-10 h-10 text-yellow-300 ml-3" />
          </div>
          <p className="text-white/90 text-lg">
            セッションID: <span className="font-mono bg-white/20 px-3 py-1 rounded-lg">{sessionId}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側：ゲーム操作 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 現在の番号表示 */}
            <div className="bg-white/30 backdrop-blur-md rounded-xl shadow-2xl p-6 border border-white/20">
              <h2 className="text-2xl font-bold text-white text-center mb-4 drop-shadow-md">
                現在の番号
              </h2>
              <div className="flex justify-center mb-6">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-4 border-red-600 flex items-center justify-center shadow-xl">
                  <span className="text-5xl font-bold text-red-700 drop-shadow-md">
                    {currentNumber || '-'}
                  </span>
                </div>
              </div>

              {/* エラー表示 */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/30 border border-red-400 rounded-lg">
                  <p className="text-white text-sm text-center">{error}</p>
                </div>
              )}

              {/* 既出番号（全履歴） */}
              {drawnNumbers.length > 0 && (
                <div className="mt-6 bg-white/20 rounded-lg p-4">
                  <h3 className="text-white font-bold text-center mb-3 drop-shadow-sm">
                    既出番号 ({drawnNumbers.length}/75)
                  </h3>
                  <NumberHistory numbers={drawnNumbers} />
                </div>
              )}

              {/* ステータス */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="bg-white/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-white drop-shadow-sm">{drawnNumbers.length}</p>
                  <p className="text-sm text-white/80">抽選済み</p>
                </div>
                <div className="bg-white/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-white drop-shadow-sm">{remainingNumbers.length}</p>
                  <p className="text-sm text-white/80">残り</p>
                </div>
              </div>

              {/* 操作ボタン */}
              <div className="mt-6 space-y-3">
                {session.status === 'waiting' ? (
                  <button
                    onClick={handleStartGame}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 rounded-lg shadow-lg transform transition hover:scale-105 flex items-center justify-center"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    ゲーム開始
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleDrawNumber}
                      disabled={remainingNumbers.length === 0 || isDrawing}
                      className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-red-800 font-bold py-4 rounded-lg shadow-lg transform transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {isDrawing ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-800 mr-2" />
                          抽選中...
                        </>
                      ) : (
                        '番号を引く'
                      )}
                    </button>
                    <button
                      onClick={handleResetGame}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center"
                    >
                      <RefreshCw className="w-5 h-5 mr-2" />
                      ゲームリセット
                    </button>
                  </>
                )}
                
                {/* ゲーム終了ボタン */}
                <button
                  onClick={handleEndGame}
                  className={`w-full py-3 rounded-lg font-bold shadow-lg flex items-center justify-center transition-all
                    ${isConfirmingEnd 
                      ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white animate-pulse' 
                      : 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/30'}`}
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  {isConfirmingEnd 
                    ? '本当にゲームを終了しますか？' 
                    : 'ゲームを終了'}
                </button>
              </div>
            </div>
          </div>

          {/* 右側：参加者情報 */}
          <div className="space-y-6">
            {/* ゲーム情報 */}
            <div className="bg-white/30 backdrop-blur-md rounded-xl shadow-2xl p-4 border border-white/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <Timer className="w-5 h-5 text-yellow-300 mr-2" />
                  <span className="text-white font-semibold">残り時間</span>
                </div>
                <span className="text-xl font-bold text-white drop-shadow-sm">{formattedTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="w-5 h-5 text-yellow-300 mr-2" />
                  <span className="text-white font-semibold">参加者</span>
                </div>
                <span className="text-xl font-bold text-white drop-shadow-sm">
                  {session.players.length}/{session.maxPlayers}
                </span>
              </div>
            </div>

            {/* 参加者リスト */}
            <div className="bg-white/30 backdrop-blur-md rounded-xl shadow-2xl p-4 border border-white/20">
              <h3 className="text-lg font-bold text-white mb-3 drop-shadow-md flex items-center">
                <Trophy className="w-5 h-5 text-yellow-300 mr-2" />
                参加者ランキング
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {session.players
                  .sort((a, b) => (b.bingoCount || 0) - (a.bingoCount || 0))
                  .map((player, index) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      rank={player.bingoCount > 0 ? index + 1 : undefined}
                    />
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Suspenseでラップ
const GamePage: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-lg font-medium drop-shadow-sm">ゲーム画面を読み込み中...</p>
        </div>
      </div>
    }>
      <GamePageContent />
    </Suspense>
  );
};

export default GamePage;