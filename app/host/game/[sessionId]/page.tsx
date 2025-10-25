// app/host/game/[sessionId]/page.tsx
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { usePusherConnection } from '@/hooks/usePusherConnection';
import { useGameTimer } from '@/hooks/useGameTimer';
import { 
  GameSession,
  Player,
  NumberDrawnEventData,
  PlayerBingoEventData,
  GameStartedEventData,
  SessionUpdatedEventData,
  HostGameState
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
  AlertCircle,
  XCircle,
  Home
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
          <span className="text-red-700 font-bold w-6">{letter}:</span>
          <div className="flex flex-wrap gap-1">
            {nums.length > 0 ? (
              nums.map(num => (
                <span
                  key={num}
                  className="bg-red-600 text-yellow-300 text-xs px-2 py-1 rounded border border-yellow-400/50"
                >
                  {num}
                </span>
              ))
            ) : (
              <span className="text-gray-500 text-xs">-</span>
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
    <div className="bg-white/50 backdrop-blur-sm rounded-lg p-3 border border-white/40">
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
            <p className="font-semibold text-gray-800">{player.name}</p>
            <p className="text-xs text-gray-600">
              ビンゴ: {player.bingoCount || 0}回
            </p>
          </div>
        </div>
        {player.bingoCount > 0 && (
          <Trophy className="w-5 h-5 text-yellow-600" />
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

  // 状態管理
  const [state, setState] = useState<HostGameState>({
    session: null,
    drawnNumbers: [],
    currentNumber: null,
    remainingNumbers: [],
    isLoading: true,
    isDrawing: false,
    error: null,
    isConfirmingEnd: false
  });

  // Pusher接続
  const { isConnected, on, off } = usePusherConnection(sessionId);
  const { formattedTime } = useGameTimer(state.session?.status || 'waiting', 7200);

  // reconnectionDataをlocalStorageに保存
  useEffect(() => {
    if (sessionId && accessToken && hostId) {
      localStorage.setItem('reconnectionData', JSON.stringify({
        sessionId,
        accessToken,
        playerId: hostId,
        role: 'host'
      }));
    }
  }, [sessionId, accessToken, hostId]);

  // 初期データ読み込み
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const sessionData = await getSession(sessionId, accessToken);
        
        const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
        const drawnNumbers = sessionData.numbers || [];
        
        setState(prev => ({
          ...prev,
          session: sessionData,
          drawnNumbers,
          currentNumber: sessionData.currentNumber || (drawnNumbers.length > 0 ? drawnNumbers[drawnNumbers.length - 1] : null),
          remainingNumbers: allNumbers.filter(n => !drawnNumbers.includes(n)),
          isLoading: false
        }));
      } catch (err) {
        setState(prev => ({
          ...prev,
          error: normalizeErrorMessage(err),
          isLoading: false
        }));
      }
    };

    loadInitialData();
  }, [sessionId, accessToken]);
useEffect(() => {
  const handleNumberDrawn = (data: NumberDrawnEventData) => {
    setState(prev => ({
      ...prev,
      currentNumber: data.number,
      drawnNumbers: data.drawnNumbers || [],
      remainingNumbers: prev.remainingNumbers.filter(n => n !== data.number),
      isDrawing: false
    }));
  };

  const handlePlayerBingo = (data: PlayerBingoEventData) => {
    setState(prev => ({
      ...prev,
      session: prev.session ? {
        ...prev.session,
        players: prev.session.players.map(p => 
          p.id === data.player.id 
            ? { ...p, bingoCount: data.bingoCount }
            : p
        )
      } : null
    }));
  };

  const handleGameStarted = () => {
    setState(prev => ({
      ...prev,
      session: prev.session ? { ...prev.session, status: 'playing' } : null
    }));
  };

  const handleSessionUpdated = (data: SessionUpdatedEventData) => {
    const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
    const drawnNumbers = data.session.numbers || [];
    
    setState(prev => ({
      ...prev,
      session: data.session,
      drawnNumbers: drawnNumbers,
      currentNumber: data.session.currentNumber || prev.currentNumber,
      remainingNumbers: allNumbers.filter(n => !drawnNumbers.includes(n))
    }));
  };

  // ゲームリセットのイベントハンドラー（useEffect内で定義）
  const handleGameReset = (data: { sessionId: string; session: GameSession }) => {
    const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
    setState(prev => ({
      ...prev,
      session: data.session,
      drawnNumbers: [],
      currentNumber: null,
      remainingNumbers: allNumbers,
      isDrawing: false,
      error: null
    }));
  };

  // イベントリスナー登録
on<NumberDrawnEventData>('number-drawn', handleNumberDrawn);
on<PlayerBingoEventData>('player-bingo', handlePlayerBingo);
on<GameStartedEventData>('game-started', handleGameStarted);
on<SessionUpdatedEventData>('session-updated', handleSessionUpdated);
on<{ sessionId: string; session: GameSession }>('game-reset', handleGameReset);

return () => {
  off<NumberDrawnEventData>('number-drawn', handleNumberDrawn);
  off<PlayerBingoEventData>('player-bingo', handlePlayerBingo);
  off<GameStartedEventData>('game-started', handleGameStarted);
  off<SessionUpdatedEventData>('session-updated', handleSessionUpdated);
  off<{ sessionId: string; session: GameSession }>('game-reset', handleGameReset);
};
}, [on, off]);

const handleStartGame = useCallback(async () => {
  if (!isConnected || state.session?.status !== 'waiting') return;
  
  try {
    // APIルート経由でゲーム開始を通知
    const response = await fetch('/api/pusher/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        accessToken,
        playerId: hostId,
        eventName: 'start_game',
        data: { sessionId }
      })
    });

    if (!response.ok) {
      throw new Error('ゲーム開始に失敗しました');
    }

    // 楽観的更新
    setState(prev => ({
      ...prev,
      session: prev.session ? { ...prev.session, status: 'playing' } : null
    }));
  } catch (err) {
    setState(prev => ({
      ...prev,
      error: err instanceof Error ? err.message : 'ゲーム開始に失敗しました'
    }));
  }
}, [isConnected, state.session, sessionId, accessToken, hostId]);

// 番号抽選（APIルート使用）
const handleDrawNumber = useCallback(async () => {
  if (state.remainingNumbers.length === 0 || state.isDrawing) return;
  
  setState(prev => ({ ...prev, isDrawing: true, error: null }));
  
  try {
    const response = await fetch(`/api/sessions/${sessionId}/draw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken,
        hostId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '番号の抽選に失敗しました');
    }

    // DrawNumberResponse型を使わずに処理
    const data = await response.json();
    
    // Pusherイベントで自動的に更新されるため、ここでは成功のみ確認
    if (!data.success) {
      throw new Error(data.message || '番号の抽選に失敗しました');
    }
  } catch (err) {
    setState(prev => ({
      ...prev,
      isDrawing: false,
      error: err instanceof Error ? err.message : '番号の抽選に失敗しました'
    }));
  }
}, [state.remainingNumbers.length, state.isDrawing, sessionId, accessToken, hostId]);

// ゲームリセット（修正版）
const handleResetGame = useCallback(async () => {
  if (!isConnected) return;
  
  try {
    // APIルート経由でリセット処理を実行
    const response = await fetch(`/api/sessions/${sessionId}/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken,
        hostId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'ゲームリセットに失敗しました');
    }

    // 状態更新はPusherイベント（game-reset）経由で行われる
  } catch (err) {
    setState(prev => ({
      ...prev,
      error: err instanceof Error ? err.message : 'ゲームリセットに失敗しました'
    }));
  }
}, [isConnected, sessionId, accessToken, hostId]);

// ゲーム終了
const handleEndGame = useCallback(async () => {
  if (!state.isConfirmingEnd) {
    setState(prev => ({ ...prev, isConfirmingEnd: true }));
    setTimeout(() => setState(prev => ({ ...prev, isConfirmingEnd: false })), 3000);
    return;
  }

  try {
    // APIルート経由でセッション終了を通知
    const response = await fetch('/api/pusher/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        accessToken,
        playerId: hostId,
        eventName: 'cancel_session',
        data: { sessionId }
      })
    });

    if (!response.ok) {
      throw new Error('ゲーム終了に失敗しました');
    }

    router.push('/');
  } catch (err) {
    setState(prev => ({
      ...prev,
      error: err instanceof Error ? err.message : 'ゲーム終了に失敗しました'
    }));
  }
}, [state.isConfirmingEnd, sessionId, accessToken, hostId, router]);



  // ローディング画面
  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-lg font-medium drop-shadow-sm">ゲーム情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  // エラー画面
  if (state.error && !state.session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white/30 backdrop-blur-md rounded-xl shadow-2xl p-6 border border-white/20">
            <AlertCircle className="w-12 h-12 text-yellow-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white text-center mb-2 drop-shadow-md">
              エラーが発生しました
            </h2>
            <p className="text-white/90 text-center mb-4">{state.error}</p>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white font-bold py-3 rounded-lg shadow-lg transform transition hover:scale-105"
            >
              トップページに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!state.session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-yellow-300 mr-2" />
            {state.session.gameName}
            <Sparkles className="w-8 h-8 text-yellow-300 ml-2" />
          </h1>
          <p className="text-white/90 text-lg">
            セッションID: <span className="font-mono bg-white/20 px-3 py-1 rounded-lg">{sessionId}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側：ゲーム操作 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 現在の番号表示 */}
            <div className="w-full overflow-hidden rounded-xl shadow-2xl">
              <div className="bg-gradient-to-r from-pink-500/70 to-orange-400/70 p-4 backdrop-blur-sm border-t border-l border-r border-white/20">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-md">
                  現在の番号
                </h2>
              </div>
              
              <div className="bg-white/30 backdrop-blur-md p-6 border-b border-l border-r border-white/20">
                <div className="flex justify-center mb-6">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-4 border-red-600 flex items-center justify-center shadow-xl">
                    <span className="text-5xl font-bold text-red-700 drop-shadow-md">
                      {state.currentNumber || '-'}
                    </span>
                  </div>
                </div>

                {/* エラー表示 */}
                {state.error && (
                  <div className="mb-4 p-3 bg-red-500/30 border border-red-400 rounded-lg">
                    <p className="text-white text-sm text-center">{state.error}</p>
                  </div>
                )}

                {/* 既出番号 */}
                {state.drawnNumbers.length > 0 && (
                  <div className="mt-6 bg-white/40 rounded-lg p-4">
                    <h3 className="text-gray-800 font-bold text-center mb-3">
                      既出番号 ({state.drawnNumbers.length}/75)
                    </h3>
                    <NumberHistory numbers={state.drawnNumbers} />
                  </div>
                )}

                {/* ステータス */}
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="bg-white/40 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-800">{state.drawnNumbers.length}</p>
                    <p className="text-sm text-gray-600">抽選済み</p>
                  </div>
                  <div className="bg-white/40 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-800">{state.remainingNumbers.length}</p>
                    <p className="text-sm text-gray-600">残り</p>
                  </div>
                </div>

                {/* 操作ボタン */}
                <div className="mt-6 space-y-3">
                  {state.session.status === 'waiting' ? (
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
                        disabled={state.remainingNumbers.length === 0 || state.isDrawing}
                        className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-red-800 font-bold py-4 rounded-lg shadow-lg transform transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {state.isDrawing ? (
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
                      ${state.isConfirmingEnd 
                        ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white animate-pulse' 
                        : 'bg-white/40 backdrop-blur-sm text-gray-800 hover:bg-white/50 border border-white/60'}`}
                  >
                    <XCircle className="w-5 h-5 mr-2" />
                    {state.isConfirmingEnd 
                      ? '本当にゲームを終了しますか？' 
                      : 'ゲームを終了'}
                  </button>

                  {/* トップページへ戻るボタン */}
                  <button
                    onClick={() => router.push('/')}
                    className="w-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 font-medium py-3 rounded-lg transition border border-white/40 flex items-center justify-center"
                  >
                    <Home className="w-5 h-5 mr-2" />
                    トップページへ戻る
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 右側：参加者情報 */}
          <div className="space-y-6">
            {/* ゲーム情報 */}
            <div className="w-full overflow-hidden rounded-xl shadow-2xl">
              <div className="bg-gradient-to-r from-pink-500/70 to-orange-400/70 p-4 backdrop-blur-sm border-t border-l border-r border-white/20">
                <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-md">
                  ゲーム情報
                </h2>
              </div>
              
              <div className="bg-white/30 backdrop-blur-md p-4 border-b border-l border-r border-white/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Timer className="w-5 h-5 text-red-600 mr-2" />
                    <span className="text-gray-800 font-semibold">残り時間</span>
                  </div>
                  <span className="text-xl font-bold text-gray-800">{formattedTime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Users className="w-5 h-5 text-red-600 mr-2" />
                    <span className="text-gray-800 font-semibold">参加者</span>
                  </div>
                  <span className="text-xl font-bold text-gray-800">
                    {state.session.players.length}/{state.session.maxPlayers}
                  </span>
                </div>
              </div>
            </div>

            {/* 参加者リスト */}
            <div className="w-full overflow-hidden rounded-xl shadow-2xl">
              <div className="bg-gradient-to-r from-pink-500/70 to-orange-400/70 p-4 backdrop-blur-sm border-t border-l border-r border-white/20">
                <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-md flex items-center">
                  <Trophy className="w-5 h-5 mr-2" />
                  参加者ランキング
                </h3>
              </div>
              
              <div className="bg-white/30 backdrop-blur-md p-4 border-b border-l border-r border-white/20">
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {state.session.players
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

        {/* 接続状態表示 */}
        {!isConnected && (
          <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg">
            接続が切断されました。再接続中...
          </div>
        )}
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