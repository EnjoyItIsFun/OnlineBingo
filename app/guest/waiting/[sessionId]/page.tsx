// app/guest/waiting/[sessionId]/page.tsx
// ゲスト待機ページ（エラー修正版）

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { PlayerList } from '@/app/components/PlayerList';
import { NameAdjustmentNotification } from '@/app/components/NameAdjustmentNotification';
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
import { Clock, AlertCircle, LogOut, Wifi, WifiOff } from 'lucide-react';

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

  const { socket, isConnected, connect, disconnect, on, off } = useSocketConnection();
  const { nameAdjustment, setAdjustment, acknowledgeAdjustment } = useNameAdjustment();
  const { formattedTime, isActive } = useGameTimer(
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
        // セッション情報を取得
        const sessionData = await getSession(sessionId, accessToken);
        setSession(sessionData);

        // 現在のプレイヤーを特定
        const player = sessionData.players.find(p => p.id === playerId);
        if (player) {
          setCurrentPlayer(player);
          
          // 名前調整があった場合の処理
          if (player.nameAdjusted && player.originalName && player.name !== player.originalName) {
            setAdjustment({
              finalName: player.name,
              wasAdjusted: true,
              originalName: player.originalName,
              adjustmentReason: `「${player.originalName}」は既に使用されているため調整されました`
            });
          }
        }

        // Socket.io接続
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

  // Socket.ioイベントリスナー設定
  useEffect(() => {
    if (!socket) return;

    const handlePlayerJoined = (player: Player) => {
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: [...prev.players, player]
        };
      });
    };

    const handlePlayerLeft = (playerId: string) => {
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.filter(p => p.id !== playerId)
        };
      });
    };

    const handleGameStarted = (updatedSession: GameSession) => {
      setSession(updatedSession);
      // ゲーム画面にリダイレクト
      router.push(`/guest/game/${sessionId}?playerId=${playerId}&accessToken=${accessToken}`);
    };

    const handleSessionUpdated = (updatedSession: GameSession) => {
      setSession(updatedSession);
    };

    const handleConnectionError = (errorMessage: string) => {
      setError(errorMessage);
    };

    // イベントリスナー登録
    on('player_joined', handlePlayerJoined);
    on('player_left', handlePlayerLeft);
    on('game_started', handleGameStarted);
    on('session_updated', handleSessionUpdated);
    on('connection_error', handleConnectionError);

    return () => {
      // イベントリスナー解除
      off('player_joined', handlePlayerJoined);
      off('player_left', handlePlayerLeft);
      off('game_started', handleGameStarted);
      off('session_updated', handleSessionUpdated);
      off('connection_error', handleConnectionError);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">セッション情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">エラーが発生しました</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/guest/join')}
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              参加ページに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!session || !currentPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">セッションが見つかりません</h2>
            <p className="text-gray-600 mb-4">
              セッション情報を確認してください
            </p>
            <button
              onClick={() => router.push('/guest/join')}
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              参加ページに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                {session.gameName}
              </h1>
              <p className="text-gray-600 mt-1">
                セッションID: <span className="font-mono">{session.sessionId}</span>
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* 接続状態 */}
              <div className="flex items-center">
                {isConnected ? (
                  <Wifi className="w-5 h-5 text-green-500 mr-2" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500 mr-2" />
                )}
                <span className={`text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {isConnected ? 'オンライン' : 'オフライン'}
                </span>
                {!isConnected && (
                  <button
                    onClick={handleReconnect}
                    className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                  >
                    再接続
                  </button>
                )}
              </div>

              {/* 離脱ボタン */}
              <button
                onClick={handleLeaveSession}
                className="flex items-center text-red-600 hover:text-red-800 text-sm font-medium"
              >
                <LogOut className="w-4 h-4 mr-1" />
                離脱
              </button>
            </div>
          </div>

          {/* ステータス情報 */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-lg font-semibold text-blue-700">
                {session.status === 'waiting' ? '待機中' : 
                 session.status === 'playing' ? 'ゲーム中' : 
                 session.status === 'finished' ? '終了' : '期限切れ'}
              </div>
              <div className="text-sm text-blue-600">ステータス</div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-lg font-semibold text-green-700">
                {session.players.length} / {session.maxPlayers}
              </div>
              <div className="text-sm text-green-600">参加者数</div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-lg font-semibold text-purple-700">
                {formattedTime}
              </div>
              <div className="text-sm text-purple-600">
                {isActive ? '残り時間' : 'セッション時間'}
              </div>
            </div>
          </div>
        </div>

        {/* 待機メッセージ */}
        {session.status === 'waiting' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <Clock className="w-5 h-5 text-yellow-600 mr-2" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                  ゲーム開始を待機中
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  ホストがゲームを開始するまでお待ちください
                </p>
              </div>
            </div>
          </div>
        )}

        {/* プレイヤーリスト */}
        <PlayerList
          players={session.players}
          maxPlayers={session.maxPlayers}
          currentPlayerId={currentPlayer.id}
        />
      </div>

      {/* 名前調整通知 */}
      {nameAdjustment && (
        <NameAdjustmentNotification
          originalName={nameAdjustment.originalName}
          adjustedName={nameAdjustment.finalName}
          reason="duplicate"
          onAcknowledge={acknowledgeAdjustment}
        />
      )}
    </div>
  );
};

// Suspenseでラップしたメインコンポーネント
const WaitingPage: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">待機ページを読み込み中...</p>
        </div>
      </div>
    }>
      <WaitingPageContent />
    </Suspense>
  );
};

export default WaitingPage;