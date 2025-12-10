// app/host/game/[sessionId]/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

// 通知の型定義
interface Notification {
  id: string;
  type: 'bingo' | 'reach';
  playerNames: string[];
  timestamp: number;
}

// リーチイベントの型定義
interface PlayerReachEventData {
  playerId: string;
  playerName: string;
  reachCount: number;
  reachLines: string[];
}

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
          {rank && rank > 3 && (
            <div className="w-8 h-8 rounded-full mr-2 flex items-center justify-center font-bold bg-white/30 text-white">
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

// 通知コンポーネント
interface NotificationDisplayProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

const NotificationDisplay: React.FC<NotificationDisplayProps> = ({ notifications, onDismiss }) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 space-y-2 w-full max-w-md px-4">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`
            rounded-xl px-6 py-4 shadow-2xl border-2 animate-slide-down
            flex items-center justify-between gap-4
            ${notification.type === 'bingo' 
              ? 'bg-gradient-to-r from-yellow-400 to-orange-500 border-yellow-300' 
              : 'bg-gradient-to-r from-orange-400 to-pink-500 border-orange-300'}
          `}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {notification.type === 'bingo' ? '🎉' : '🎯'}
            </span>
            <div>
              <p className="font-bold text-white text-lg">
                {notification.playerNames.join('、')}さん
              </p>
              <p className="text-white/90 text-sm">
                {notification.type === 'bingo' ? 'ビンゴ達成！' : 'リーチ！'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onDismiss(notification.id)}
            className="text-white/70 hover:text-white transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      ))}
    </div>
  );
};

// 確認モーダルコンポーネント
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
  confirmColor: 'red' | 'orange';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  confirmColor
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* モーダル本体 */}
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 m-4 max-w-sm w-full">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <XCircle className="w-6 h-6" />
        </button>
        
        {/* タイトル */}
        <h3 className="text-xl font-bold text-gray-800 mb-2 pr-8">{title}</h3>
        
        {/* メッセージ */}
        <p className="text-gray-600 mb-6">{message}</p>
        
        {/* ボタン */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            キャンセル
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors font-medium ${
              confirmColor === 'red' 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {confirmText}
          </button>
        </div>
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

  // モーダル表示用の状態
  const [showResetModal, setShowResetModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);

  // 通知用の状態
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const pendingNotificationsRef = useRef<{ type: 'bingo' | 'reach'; playerName: string }[]>([]);
  const notificationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const notifiedBingoPlayersRef = useRef<Set<string>>(new Set());
  const notifiedReachPlayersRef = useRef<Set<string>>(new Set());

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

  // 通知を追加（バッファリング処理）
  const addNotification = useCallback((type: 'bingo' | 'reach', playerName: string) => {
    pendingNotificationsRef.current.push({ type, playerName });

    // 既存のタイマーをクリア
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }

    // 500ms後にまとめて通知を表示
    notificationTimerRef.current = setTimeout(() => {
      const pending = pendingNotificationsRef.current;
      pendingNotificationsRef.current = [];

      // 同じタイプの通知をまとめる
      const bingoPlayers = pending.filter(p => p.type === 'bingo').map(p => p.playerName);
      const reachPlayers = pending.filter(p => p.type === 'reach').map(p => p.playerName);

      const newNotifications: Notification[] = [];

      if (bingoPlayers.length > 0) {
        newNotifications.push({
          id: `bingo-${Date.now()}`,
          type: 'bingo',
          playerNames: bingoPlayers,
          timestamp: Date.now()
        });
      }

      if (reachPlayers.length > 0) {
        newNotifications.push({
          id: `reach-${Date.now()}`,
          type: 'reach',
          playerNames: reachPlayers,
          timestamp: Date.now()
        });
      }

      setNotifications(prev => [...prev, ...newNotifications]);
    }, 500);
  }, []);

  // 通知を削除
  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // 通知の自動削除（5秒後）
  useEffect(() => {
    if (notifications.length === 0) return;

    const timer = setTimeout(() => {
      const now = Date.now();
      setNotifications(prev => prev.filter(n => now - n.timestamp < 5000));
    }, 5000);

    return () => clearTimeout(timer);
  }, [notifications]);

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

        // 既にビンゴ達成しているプレイヤーを通知済みとしてマーク
        if (data.players) {
          data.players.forEach((player: Player) => {
            if (player.bingoCount > 0) {
              notifiedBingoPlayersRef.current.add(player.id);
            }
          });
        }
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
      const playerId = data.player?.id;
      const playerName = data.player?.name || '不明';

      // 初めてビンゴ通知するプレイヤーのみ通知
      if (playerId && !notifiedBingoPlayersRef.current.has(playerId)) {
        notifiedBingoPlayersRef.current.add(playerId);
        addNotification('bingo', playerName);
      }

      setState(prev => ({
        ...prev,
        session: prev.session ? {
          ...prev.session,
          players: prev.session.players.map(p =>
            p.id === data.player.id 
              ? { ...p, bingoCount: data.bingoCount, bingoAchievedAt: data.achievedAt || new Date().toISOString() } 
              : p
          )
        } : null
      }));
    };

    const handlePlayerReach = (data: PlayerReachEventData) => {
      const playerId = data.playerId;

      // 初めてリーチ通知するプレイヤーのみ通知
      if (playerId && !notifiedReachPlayersRef.current.has(playerId)) {
        notifiedReachPlayersRef.current.add(playerId);
        addNotification('reach', data.playerName);
      }
    };

    const handleSessionUpdated = (data: SessionUpdatedEventData) => {
      setState(prev => ({
        ...prev,
        session: data.session
      }));
    };

    on('number-drawn', handleNumberDrawn);
    on('player-bingo', handlePlayerBingo);
    on('player-reach', handlePlayerReach);
    on('session-updated', handleSessionUpdated);

    return () => {
      off('number-drawn', handleNumberDrawn);
      off('player-bingo', handlePlayerBingo);
      off('player-reach', handlePlayerReach);
      off('session-updated', handleSessionUpdated);
    };
  }, [isConnected, on, off, addNotification]);

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

      // 通知と通知済みプレイヤーをクリア
      setNotifications([]);
      notifiedBingoPlayersRef.current.clear();
      notifiedReachPlayersRef.current.clear();

      const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
      setState(prev => ({
        ...prev,
        drawnNumbers: [],
        currentNumber: null,
        remainingNumbers: allNumbers,
        session: prev.session ? {
          ...prev.session,
          status: 'playing',
          numbers: [],
          currentNumber: null,
          players: prev.session.players.map(p => ({ ...p, bingoCount: 0, bingoAchievedAt: undefined }))
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

  // ランキング: ビンゴ達成者を最初にビンゴした順にソート
  const rankedPlayers = [...(state.session?.players || [])]
    .filter(p => p.bingoCount > 0 && p.bingoAchievedAt)
    .sort((a, b) => 
      new Date(a.bingoAchievedAt!).getTime() - new Date(b.bingoAchievedAt!).getTime()
    );

  // 全参加者リスト
  const allPlayers = state.session?.players || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 p-4">
      {/* 通知表示 */}
      <NotificationDisplay 
        notifications={notifications} 
        onDismiss={dismissNotification} 
      />

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
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetModal(true)}
                className="px-3 py-2 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition-all flex items-center gap-1 border border-white/30"
              >
                <RefreshCw className="w-5 h-5" />
                <span className="hidden sm:inline text-sm">リセット</span>
              </button>
              <button
                onClick={() => setShowEndModal(true)}
                className="px-3 py-2 bg-red-500/80 backdrop-blur-sm text-white rounded-lg hover:bg-red-600/80 transition-all flex items-center gap-1"
              >
                <XCircle className="w-5 h-5" />
                <span className="hidden sm:inline text-sm">終了</span>
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
                      {state.currentNumber}
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

          {/* サイドバー（ランキング） */}
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-400" />
                ビンゴ達成者
              </h3>
              <div className="space-y-3">
                {rankedPlayers.length > 0 ? (
                  rankedPlayers.map((player, index) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      rank={index + 1}
                    />
                  ))
                ) : (
                  <p className="text-white/60 text-center py-4">まだビンゴ達成者はいません</p>
                )}
              </div>
            </div>

            {/* 参加者一覧 */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                参加者
              </h3>
              <div className="space-y-3">
                {allPlayers.length > 0 ? (
                  allPlayers.map(player => (
                    <PlayerCard
                      key={player.id}
                      player={player}
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

      {/* 確認モーダル */}
      <ConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleResetGame}
        title="ゲームをリセット"
        message="抽選済みの番号とビンゴカードがすべてリセットされます。この操作は取り消せません。"
        confirmText="リセットする"
        confirmColor="orange"
      />
      
      <ConfirmModal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        onConfirm={handleEndGame}
        title="ゲームを終了"
        message="ゲームを終了して結果画面に移動します。よろしいですか？"
        confirmText="終了する"
        confirmColor="red"
      />

      {/* アニメーション用のスタイル */}
      <style jsx>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translate(-50%, -100%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}