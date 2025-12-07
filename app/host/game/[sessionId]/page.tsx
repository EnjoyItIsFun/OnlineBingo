// app/host/game/[sessionId]/page.tsx - 最終修正版（型エラー完全解消）
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePusherConnection } from '@/hooks/usePusherConnection';
import { 
  Player,
  NumberDrawnEventData,
  PlayerBingoEventData,
  SessionUpdatedEventData,
  DrawNumberResponse,
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
            <div className="flex items-center gap-1 text-xs text-white/80">
              <div className={`w-2 h-2 rounded-full ${player.isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              {player.isConnected ? 'オンライン' : 'オフライン'}
            </div>
          </div>
        </div>
        
        {player.bingoCount > 0 && (
          <div className="flex items-center gap-1 bg-yellow-400/90 px-2 py-1 rounded-full">
            <Trophy className="w-4 h-4 text-yellow-900" />
            <span className="text-yellow-900 font-bold">{player.bingoCount}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Next.js 15対応のためのパラメータ解決
interface HostGamePageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ token?: string; hostId?: string }>;
}

// 時間フォーマット関数（useGameTimerの代替）
const formatTime = (seconds: number | null): string => {
  if (seconds === null || seconds <= 0) return '00:00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return [hours, minutes, secs]
    .map(v => v < 10 ? `0${v}` : v.toString())
    .join(':');
};

export default function HostGamePage({ params, searchParams }: HostGamePageProps) {
  const router = useRouter();
  
  // パラメータとクエリパラメータを解決
  const [sessionId, setSessionId] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [hostId, setHostId] = useState<string>('');
  
  // 状態管理
  const [state, setState] = useState<HostGameState>({
    session: null,
    drawnNumbers: [],
    currentNumber: null,
    remainingNumbers: Array.from({ length: 75 }, (_, i) => i + 1),
    isDrawing: false,
    isLoading: true,
    error: null,
    isConfirmingEnd: false
  });

  // タイマー用の状態
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Promise形式のパラメータを解決
  useEffect(() => {
    Promise.all([params, searchParams]).then(([resolvedParams, resolvedSearchParams]) => {
      setSessionId(resolvedParams.sessionId);
      
      const token = resolvedSearchParams.token || localStorage.getItem('hostAccessToken') || '';
      const hid = resolvedSearchParams.hostId || localStorage.getItem('hostId') || '';
      
      setAccessToken(token);
      setHostId(hid);
    });
  }, [params, searchParams]);

  // タイマー更新（useGameTimerの代替実装）
  useEffect(() => {
    if (!state.session?.expiresAt) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const expires = new Date(state.session!.expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expires - now) / 1000));
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [state.session?.expiresAt]);

  // Pusher接続
  const { isConnected, on, off, emit } = usePusherConnection(sessionId || null);

  // 番号表示用のBINGO文字取得
  const getBingoLetter = (number: number): string => {
    if (number >= 1 && number <= 15) return 'B';
    if (number >= 16 && number <= 30) return 'I';
    if (number >= 31 && number <= 45) return 'N';
    if (number >= 46 && number <= 60) return 'G';
    if (number >= 61 && number <= 75) return 'O';
    return '';
  };

  // 初回ロード
  useEffect(() => {
    if (!sessionId || !accessToken) return;

    const loadSession = async () => {
      try {
        const data = await getSession(sessionId, accessToken);
        
        setState(prev => ({
          ...prev,
          session: data,
          drawnNumbers: data.numbers || [],
          currentNumber: data.currentNumber,
          remainingNumbers: Array.from({ length: 75 }, (_, i) => i + 1)
            .filter(n => !(data.numbers || []).includes(n)),
          isLoading: false
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: normalizeErrorMessage(error),
          isLoading: false
        }));
      }
    };

    loadSession();
  }, [sessionId, accessToken]);

  // Pusherイベントリスナー設定
  useEffect(() => {
    if (!isConnected) return;

    const handleNumberDrawn = (data: NumberDrawnEventData) => {
      setState(prev => ({
        ...prev,
        drawnNumbers: [...prev.drawnNumbers, data.number],
        currentNumber: data.number,
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
            p.id === data.player.id ? { ...p, bingoCount: data.bingoCount } : p
          )
        } : null
      }));
    };

    const handleSessionUpdated = (data: SessionUpdatedEventData) => {
      setState(prev => ({
        ...prev,
        session: data.session
      }));
    };

    on('number-drawn', handleNumberDrawn);
    on('player-bingo', handlePlayerBingo);
    on('session-updated', handleSessionUpdated);

    return () => {
      off('number-drawn', handleNumberDrawn);
      off('player-bingo', handlePlayerBingo);
      off('session-updated', handleSessionUpdated);
    };
  }, [isConnected, on, off]);

  // 番号を引く
  const handleDrawNumber = useCallback(async () => {
    if (state.remainingNumbers.length === 0 || state.isDrawing || !sessionId || !accessToken) return;
    
    setState(prev => ({ ...prev, isDrawing: true }));
    
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

      const data: DrawNumberResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || '番号の抽選に失敗しました');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isDrawing: false,
        error: error instanceof Error ? error.message : '番号の抽選に失敗しました'
      }));
    }
  }, [state.remainingNumbers.length, state.isDrawing, sessionId, accessToken, hostId]);

  // ゲームリセット
  const handleResetGame = useCallback(async () => {
    if (!isConnected || !sessionId) return;
    
    try {
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
        throw new Error('ゲームリセットに失敗しました');
      }

      const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
      setState(prev => ({
        ...prev,
        drawnNumbers: [],
        currentNumber: null,
        remainingNumbers: allNumbers,
        session: prev.session ? {
          ...prev.session,
          status: 'waiting',
          numbers: [],
          currentNumber: null,
          players: prev.session.players.map(p => ({ ...p, bingoCount: 0 }))
        } : null
      }));
    } catch {
      setState(prev => ({
        ...prev,
        error: 'ゲームリセットに失敗しました'
      }));
    }
  }, [isConnected, sessionId, accessToken, hostId]);

  // ゲーム終了
  const handleEndGame = useCallback(async () => {
    if (!isConnected || !sessionId) return;
    
    try {
      await emit('end_game', { sessionId });
      router.push(`/host/result/${sessionId}`);
    } catch {
      setState(prev => ({
        ...prev,
        error: 'ゲーム終了処理に失敗しました'
      }));
    }
  }, [isConnected, sessionId, emit, router]);

  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600">
        <div className="text-white text-2xl animate-pulse">ゲーム情報を読み込み中...</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600">
        <div className="bg-white rounded-xl shadow-2xl p-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 text-xl mb-4">{state.error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:opacity-90 transition-all"
          >
            ホーム画面へ戻る
          </button>
        </div>
      </div>
    );
  }

  const sortedPlayers = [...(state.session?.players || [])]
    .sort((a, b) => b.bingoCount - a.bingoCount);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 p-4">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-6 mb-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white drop-shadow-lg mb-2">
                {state.session?.gameName}
              </h1>
              <div className="flex items-center gap-4 text-white/90">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  <span>{state.session?.players.length || 0}名参加中</span>
                </div>
                <div className="flex items-center gap-2">
                  <Timer className="w-5 h-5" />
                  <span>{formatTime(timeRemaining)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleResetGame}
                className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition-all flex items-center gap-2 border border-white/30"
              >
                <RefreshCw className="w-5 h-5" />
                リセット
              </button>
              <button
                onClick={handleEndGame}
                className="px-4 py-2 bg-red-500/80 backdrop-blur-sm text-white rounded-lg hover:bg-red-600/80 transition-all flex items-center gap-2"
              >
                <XCircle className="w-5 h-5" />
                終了
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* メインエリア */}
          <div className="lg:col-span-2 space-y-6">
            {/* 現在の番号表示 */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20">
              <div className="text-center">
                {state.currentNumber ? (
                  <>
                    <p className="text-white/80 text-lg mb-2">現在の番号</p>
                    <div className="text-8xl font-bold text-white drop-shadow-lg">
                      <span className="text-yellow-300">{getBingoLetter(state.currentNumber)}</span>
                      <span className="mx-2">-</span>
                      <span>{state.currentNumber}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-white/60 text-xl">まだ番号が引かれていません</p>
                )}
              </div>
              
              <button
                onClick={handleDrawNumber}
                disabled={state.isDrawing || state.remainingNumbers.length === 0}
                className={`
                  w-full mt-8 py-4 px-8 rounded-xl font-bold text-lg transition-all transform hover:scale-105
                  ${state.isDrawing || state.remainingNumbers.length === 0
                    ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white hover:from-yellow-500 hover:to-orange-600 shadow-lg'
                  }
                `}
              >
                {state.isDrawing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    抽選中...
                  </span>
                ) : state.remainingNumbers.length === 0 ? (
                  'すべての番号を引きました'
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    番号を引く（残り {state.remainingNumbers.length} 個）
                  </span>
                )}
              </button>
            </div>

            {/* 番号履歴 */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Play className="w-5 h-5" />
                抽選済み番号 ({state.drawnNumbers.length}/75)
              </h3>
              <NumberHistory numbers={state.drawnNumbers} />
            </div>
          </div>

          {/* サイドバー（参加者リスト） */}
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-400" />
                ランキング
              </h3>
              <div className="space-y-3">
                {sortedPlayers.length > 0 ? (
                  sortedPlayers.map((player, index) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      rank={player.bingoCount > 0 ? index + 1 : undefined}
                    />
                  ))
                ) : (
                  <p className="text-white/60 text-center py-4">参加者がいません</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}