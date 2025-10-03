// app/guest/waiting/[sessionId]/page.tsx
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useSocketConnection } from '@/hooks/useSocketConnection';
import { useNameAdjustment } from '@/hooks/useNameAdjustment';
import { useGameTimer } from '@/hooks/useGameTimer';
import { 
  GameSession, 
  Player, 
  AuthenticationData
} from '@/types';
import { 
  getSession, 
  leaveSession,
  normalizeErrorMessage 
} from '@/utils/api';
import { Clock, AlertCircle, LogOut, Wifi, WifiOff, Users, Sparkles, Crown, Timer } from 'lucide-react';

// プレイヤーカードコンポーネント
const PlayerCard: React.FC<{
  player: Player;
  isCurrentPlayer: boolean;
  isHost?: boolean;
}> = ({ player, isCurrentPlayer, isHost }) => {
  return (
    <div className={`
      p-4 rounded-lg border transition-all
      ${isCurrentPlayer 
        ? 'bg-gradient-to-br from-yellow-300/50 to-yellow-500/50 border-yellow-400 shadow-lg' 
        : 'bg-white/20 border-white/30 backdrop-blur-sm hover:bg-white/30'}
    `}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white font-bold">
            {player.name.charAt(0).toUpperCase()}
          </div>
          <div className="ml-3">
            <p className="font-semibold text-white drop-shadow-md flex items-center">
              {player.name}
              {isHost && (
                <Crown className="w-4 h-4 text-yellow-300 ml-1" />
              )}
              {isCurrentPlayer && (
                <span className="ml-2 text-xs bg-yellow-400 text-red-700 px-2 py-1 rounded-full font-bold">
                  あなた
                </span>
              )}
            </p>
            {player.nameAdjusted && (
              <p className="text-xs text-white/70">
                元の名前: {player.originalName}
              </p>
            )}
          </div>
        </div>
        <div className={`
          w-3 h-3 rounded-full
          ${player.isConnected ? 'bg-green-400' : 'bg-gray-400'}
        `} />
      </div>
    </div>
  );
};

// 待機ページのメインコンポーネント
const WaitingPageContent: React.FC = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const sessionId = params.sessionId as string;
  const playerId = searchParams.get('playerId') || '';
  const accessToken = searchParams.get('accessToken') || '';

  const [session, setSession] = useState<GameSession | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { socket, isConnected, connect, disconnect, on, off, emit } = useSocketConnection();
  const { nameAdjustment, setAdjustment, acknowledgeAdjustment } = useNameAdjustment();
  const { formattedTime } = useGameTimer(
    session?.status || 'waiting',
    7200 // 2時間
  );

  // 初期データ読み込み
  useEffect(() => {
    const loadInitialData = async () => {
      if (!sessionId || !accessToken) {
        setError('セッション情報が不足しています');
        setIsLoading(false);
        return;
      }

      try {
        const sessionData = await getSession(sessionId, accessToken);
        setSession(sessionData);

        const player = sessionData.players.find((p: Player) => p.id === playerId);
        if (player) {
          setCurrentPlayer(player);
          
          if (player.nameAdjusted && player.originalName && player.name !== player.originalName) {
            setAdjustment({
              original: player.originalName,
              adjusted: player.name,
              reason: 'duplicate'
            });
          }
        }

        const authData: AuthenticationData = {
          sessionId,
          accessToken,
          userId: playerId,
          role: 'player'
        };
        connect(authData);
      } catch (err) {
        setError(normalizeErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [sessionId, accessToken, playerId, connect, setAdjustment]);

  // Socket.io接続後、joinGameイベントを送信
  useEffect(() => {
    if (!socket || !isConnected || !playerId) return;

    // joinGameイベントを送信（types/index.tsに定義済み）
    emit('joinGame', {
      sessionId,
      userId: playerId,
      role: 'player'
    });
  }, [socket, isConnected, sessionId, playerId, emit]);

  // Socket.ioイベントリスナー設定
  useEffect(() => {
    if (!socket) return;

    const handlePlayerJoined = (player: Player) => {
      console.log('Player joined:', player);
      setSession(prev => {
        if (!prev) return prev;
        // 既に存在する場合は追加しない
        if (prev.players.find(p => p.id === player.id)) {
          return prev;
        }
        return {
          ...prev,
          players: [...prev.players, player]
        };
      });
    };

    const handlePlayerLeft = (playerId: string) => {
      console.log('Player left:', playerId);
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.filter(p => p.id !== playerId)
        };
      });
    };

    // 型定義に合わせて修正
    const handleGameStarted = (data?: { sessionId: string }) => {
      console.log('Game started event received:', data);
      // sessionIdの確認
      if (!data || data.sessionId === sessionId) {
        console.log('Navigating to game page...');
        router.push(`/guest/game/${sessionId}?playerId=${playerId}&accessToken=${accessToken}`);
      }
    };

    // any型を具体的な型に変更
    const handleSessionUpdated = (updatedSession: GameSession) => {
      console.log('Session updated:', updatedSession);
      setSession(updatedSession);
      
      // ゲームが開始された場合
      if (updatedSession.status === 'playing') {
        console.log('Game is now playing, navigating to game page...');
        router.push(`/guest/game/${sessionId}?playerId=${playerId}&accessToken=${accessToken}`);
      }
      
      // 自分のプレイヤー情報を更新
      const updatedPlayer = updatedSession.players.find(p => p.id === playerId);
      if (updatedPlayer) {
        setCurrentPlayer(updatedPlayer);
      }
    };

    const handleConnectionError = (errorMessage: string) => {
      console.error('Connection error:', errorMessage);
      setError(errorMessage);
    };

    const handleSessionCancelled = (data: { sessionId: string }) => {
      if (data.sessionId === sessionId) {
        setError('ホストによってゲームが終了されました');
        setTimeout(() => {
          router.push('/guest/join');
        }, 3000);
      }
    };

    // イベントリスナー登録（types/index.tsに定義されているイベント）
    on('player_joined', handlePlayerJoined);
    on('player_left', handlePlayerLeft);
    on('game_started', handleGameStarted);
    on('session_updated', handleSessionUpdated);
    on('connection_error', handleConnectionError);
    
    // カスタムイベント（型定義にない）
    if (socket) {
      socket.on('session_cancelled', handleSessionCancelled);
    }

    return () => {
      off('player_joined', handlePlayerJoined);
      off('player_left', handlePlayerLeft);
      off('game_started', handleGameStarted);
      off('session_updated', handleSessionUpdated);
      off('connection_error', handleConnectionError);
      
      if (socket) {
        socket.off('session_cancelled');
      }
    };
  }, [socket, on, off, router, sessionId, playerId, accessToken]);

  // セッション離脱処理
  const handleLeaveSession = useCallback(async () => {
    if (!session || !currentPlayer) return;

    try {
      await leaveSession(sessionId, currentPlayer.id, accessToken);
      disconnect();
      router.push('/guest/join');
    } catch (err) {
      setError(normalizeErrorMessage(err));
    }
  }, [session, currentPlayer, sessionId, accessToken, disconnect, router]);

  // 再接続処理
  const handleReconnect = useCallback(() => {
    if (!sessionId || !accessToken || !playerId) return;

    const authData: AuthenticationData = {
      sessionId,
      accessToken,
      userId: playerId,
      role: 'player'
    };
    connect(authData);
  }, [sessionId, accessToken, playerId, connect]);

  // ローディング画面
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-lg font-medium drop-shadow-sm">セッション情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  // エラー画面
  if (error && !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white/30 backdrop-blur-md rounded-xl shadow-2xl p-6 border border-white/20">
            <AlertCircle className="w-12 h-12 text-yellow-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white text-center mb-2 drop-shadow-md">
              エラーが発生しました
            </h2>
            <p className="text-white/90 text-center mb-4">
              {error}
            </p>
            <button
              onClick={() => router.push('/guest/join')}
              className="w-full bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white font-bold py-3 rounded-lg shadow-lg transform transition hover:scale-105"
            >
              参加ページに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!session || !currentPlayer) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="w-10 h-10 text-yellow-300 mr-3" />
            <h1 className="text-4xl font-bold text-white drop-shadow-lg">
              {session.gameName}
            </h1>
            <Sparkles className="w-10 h-10 text-yellow-300 ml-3" />
          </div>
          <p className="text-white/90 text-lg">
            セッションID: <span className="font-mono bg-white/20 px-3 py-1 rounded-lg">{session.sessionId}</span>
          </p>
        </div>

        {/* ステータスカード */}
        <div className="bg-white/30 backdrop-blur-md rounded-xl shadow-2xl p-6 mb-6 border border-white/20">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 参加者数 */}
            <div className="bg-gradient-to-br from-pink-400/50 to-red-400/50 rounded-lg p-4 text-center border border-white/30">
              <Users className="w-8 h-8 text-yellow-300 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white drop-shadow-md">
                {session.players.length} / {session.maxPlayers}
              </div>
              <div className="text-sm text-white/90">参加者</div>
            </div>
            
            {/* 残り時間 */}
            <div className="bg-gradient-to-br from-orange-400/50 to-yellow-400/50 rounded-lg p-4 text-center border border-white/30">
              <Timer className="w-8 h-8 text-yellow-300 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white drop-shadow-md">
                {formattedTime}
              </div>
              <div className="text-sm text-white/90">残り時間</div>
            </div>
            
            {/* 接続状態 */}
            <div className="bg-gradient-to-br from-purple-400/50 to-pink-400/50 rounded-lg p-4 text-center border border-white/30">
              {isConnected ? (
                <>
                  <Wifi className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white drop-shadow-md">
                    オンライン
                  </div>
                </>
              ) : (
                <>
                  <WifiOff className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <div className="text-xl font-bold text-white drop-shadow-md">
                    オフライン
                  </div>
                </>
              )}
              <div className="text-sm text-white/90">接続状態</div>
              {!isConnected && (
                <button
                  onClick={handleReconnect}
                  className="mt-2 text-xs bg-yellow-400 text-red-700 px-3 py-1 rounded-full hover:bg-yellow-300 font-bold"
                >
                  再接続
                </button>
              )}
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-500/30 backdrop-blur-md rounded-xl p-4 mb-6 border border-red-400">
            <p className="text-white text-center">{error}</p>
          </div>
        )}

        {/* 待機メッセージ */}
        <div className="bg-yellow-300/80 backdrop-blur-md rounded-xl p-6 mb-6 border-2 border-yellow-400 shadow-lg">
          <div className="flex items-center justify-center">
            <Clock className="w-8 h-8 text-red-700 mr-3 animate-pulse" />
            <div className="text-center">
              <h3 className="text-2xl font-bold text-red-700 drop-shadow-sm">
                ゲーム開始を待機中...
              </h3>
              <p className="text-red-600 mt-1">
                ホストがゲームを開始するまでお待ちください
              </p>
            </div>
          </div>
        </div>

        {/* プレイヤーリスト */}
        <div className="bg-white/30 backdrop-blur-md rounded-xl shadow-2xl p-6 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-4 drop-shadow-md flex items-center">
            <Users className="w-6 h-6 text-yellow-300 mr-2" />
            参加者一覧
          </h2>
          <div className="grid gap-3">
            {session.players.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                isCurrentPlayer={player.id === currentPlayer.id}
                isHost={player.id === session.hostId}
              />
            ))}
          </div>
        </div>

        {/* 離脱ボタン */}
        <div className="mt-6 text-center">
          <button
            onClick={handleLeaveSession}
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3 px-8 rounded-lg shadow-lg transform transition hover:scale-105 inline-flex items-center"
          >
            <LogOut className="w-5 h-5 mr-2" />
            待機室から離脱
          </button>
        </div>
      </div>

      {/* 名前調整通知モーダル */}
      {nameAdjustment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-pink-400 to-orange-400 rounded-xl p-1 max-w-sm w-full">
            <div className="bg-white rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                名前が調整されました
              </h3>
              <p className="text-gray-700 mb-4">
                同じ名前のプレイヤーが既に存在するため、あなたの名前は
                <span className="font-bold text-blue-600 mx-1 text-lg">
                  「{nameAdjustment.adjusted}」
                </span>
                になりました。
              </p>
              <button
                onClick={acknowledgeAdjustment}
                className="w-full bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white font-bold py-3 rounded-lg shadow-lg transform transition hover:scale-105"
              >
                了解しました
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Suspenseでラップしたメインコンポーネント
const WaitingPage: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-lg font-medium drop-shadow-sm">待機ページを読み込み中...</p>
        </div>
      </div>
    }>
      <WaitingPageContent />
    </Suspense>
  );
};

export default WaitingPage;