// app/guest/waiting/[sessionId]/page.tsx
'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useRealtimeConnection } from '@/hooks/useRealtimeConnection';
import { useNameAdjustment } from '@/hooks/useNameAdjustment';
import { useGameTimer } from '@/hooks/useGameTimer';
import { 
  GameSession, 
  Player
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
// 待機ページのメインコンポーネント
const WaitingPageContent: React.FC = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const sessionId = params.sessionId as string;
  const playerId = searchParams.get('playerId') || '';
  const accessToken = searchParams.get('token') || searchParams.get('accessToken') || '';

  const [session, setSession] = useState<GameSession | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ★ 追加: joinGame送信済みフラグ
  const hasJoinedRef = useRef(false);

  const { nameAdjustment, setAdjustment, acknowledgeAdjustment } = useNameAdjustment();
  const { formattedTime } = useGameTimer(
    session?.status || 'waiting',
    7200 // 2時間
  );

  // ★ 追加: Pusher認証用のreconnectionDataを最初に設定
  useEffect(() => {
    if (sessionId && accessToken && playerId) {
      const reconnectionData = {
        sessionId,
        accessToken,
        playerId,
        playerName: '',
        lastActiveAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };
      localStorage.setItem('reconnectionData', JSON.stringify(reconnectionData));
      console.log('ゲスト: reconnectionData保存完了');
    }
  }, [sessionId, accessToken, playerId]);

  // リアルタイム接続（reconnectionData設定後に接続）
  const connection = useRealtimeConnection(sessionId);
  const { isConnected, emit, on, off, reconnect, connectionType } = connection;

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

        // ★ 追加: 既にゲームが開始されている場合は即座に遷移
        if (sessionData.status === 'playing') {
          console.log('ゲームは既に開始されています。ゲーム画面へ遷移します。');
          router.push(`/guest/game/${sessionId}?playerId=${playerId}&token=${accessToken}`);
          return;
        }

        const player = sessionData.players.find((p: Player) => p.id === playerId);
        if (player) {
          setCurrentPlayer(player);
          
          // reconnectionDataにプレイヤー名を追加
          const reconnectionData = {
            sessionId,
            accessToken,
            playerId,
            playerName: player.name,
            lastActiveAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          };
          localStorage.setItem('reconnectionData', JSON.stringify(reconnectionData));
          
          if (player.nameAdjusted && player.originalName && player.name !== player.originalName) {
            setAdjustment({
              original: player.originalName,
              adjusted: player.name,
              reason: 'duplicate'
            });
          }
        }
      } catch (err) {
        setError(normalizeErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [sessionId, accessToken, playerId, setAdjustment, router]);

  // ★ 修正: 接続後、joinGameイベントを一度だけ送信
  useEffect(() => {
    if (!isConnected || !playerId || hasJoinedRef.current) return;

    hasJoinedRef.current = true;
    
    emit('joinGame', {
      sessionId,
      userId: playerId,
      role: 'player'
    });
    
    console.log(`Connected via ${connectionType.toUpperCase()} - joinGame sent once`);
  }, [isConnected, sessionId, playerId, emit, connectionType]);

  // リアルタイムイベントリスナー設定
  useEffect(() => {
    if (!isConnected) return;

    const handlePlayerJoined = (data: unknown) => {
      const player = data as Player;
      console.log('Player joined:', player);
      setSession(prev => {
        if (!prev) return prev;
        if (prev.players.find(p => p.id === player.id)) {
          return prev;
        }
        return {
          ...prev,
          players: [...prev.players, player]
        };
      });
    };

    const handlePlayerLeft = (data: unknown) => {
      const playerId = data as string;
      console.log('Player left:', playerId);
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.filter(p => p.id !== playerId)
        };
      });
    };

    // ★ 修正: game-started イベントハンドラー（ハイフン版も登録）
    const handleGameStarted = (data: unknown) => {
      console.log('=== game-started イベント受信 ===');
      console.log('受信データ:', data);
      
      const gameUrl = `/guest/game/${sessionId}?playerId=${playerId}&token=${accessToken}`;
      console.log('遷移先URL:', gameUrl);
      
      router.push(gameUrl);
    };

    const handleSessionUpdated = (data: unknown) => {
      const updatedData = data as { session?: GameSession } | GameSession;
      const updatedSession = 'session' in updatedData ? updatedData.session : updatedData as GameSession;
      
      console.log('Session updated:', updatedSession);
      
      if (updatedSession) {
        setSession(updatedSession);
        
        // ゲームが開始された場合
        if (updatedSession.status === 'playing') {
          console.log('Game is now playing, navigating to game page...');
          router.push(`/guest/game/${sessionId}?playerId=${playerId}&token=${accessToken}`);
        }
        
        const updatedPlayer = updatedSession.players?.find(p => p.id === playerId);
        if (updatedPlayer) {
          setCurrentPlayer(updatedPlayer);
        }
      }
    };

    const handleConnectionError = (data: unknown) => {
      const errorMessage = data as string;
      console.error('Connection error:', errorMessage);
      setError(errorMessage);
    };

    const handleSessionCancelled = (data: unknown) => {
      const cancelData = data as { sessionId: string };
      if (cancelData.sessionId === sessionId) {
        setError('ホストによってゲームが終了されました');
        setTimeout(() => {
          router.push('/guest/join');
        }, 3000);
      }
    };

    // イベントリスナー登録
    // ★ 重要: アンダースコア版とハイフン版の両方を登録
    on('player_joined', handlePlayerJoined);
    on('player-joined', handlePlayerJoined);
    on('player_left', handlePlayerLeft);
    on('player-left', handlePlayerLeft);
    on('game_started', handleGameStarted);
    on('game-started', handleGameStarted);  // ★ ハイフン版も追加
    on('session_updated', handleSessionUpdated);
    on('session-updated', handleSessionUpdated);  // ★ ハイフン版も追加
    on('connection_error', handleConnectionError);
    on('session_cancelled', handleSessionCancelled);

    console.log('イベントリスナー登録完了（アンダースコア版・ハイフン版両方）');

    return () => {
      off('player_joined', handlePlayerJoined);
      off('player-joined', handlePlayerJoined);
      off('player_left', handlePlayerLeft);
      off('player-left', handlePlayerLeft);
      off('game_started', handleGameStarted);
      off('game-started', handleGameStarted);
      off('session_updated', handleSessionUpdated);
      off('session-updated', handleSessionUpdated);
      off('connection_error', handleConnectionError);
      off('session_cancelled', handleSessionCancelled);
    };
  }, [isConnected, on, off, router, sessionId, playerId, accessToken]);

  // セッション離脱処理
// セッション離脱処理
  const handleLeaveSession = useCallback(async () => {
    if (!session || !currentPlayer) return;

    try {
      await leaveSession(sessionId, currentPlayer.id, accessToken);
      
      // 完全退出：関連するLocalStorageをクリア
      localStorage.removeItem('reconnectionData');
      localStorage.removeItem(`session_${sessionId}`);
      
      router.push('/guest/join');
    } catch (err) {
      setError(normalizeErrorMessage(err));
    }
  }, [session, currentPlayer, sessionId, accessToken, router]);

  // 再接続処理
  const handleReconnect = useCallback(() => {
    reconnect();
  }, [reconnect]);

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
          <p className="text-white/70 text-sm mt-1">
            接続方式: {connectionType.toUpperCase()}
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