// app/host/waiting/page.tsx
'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSocketConnection } from '@/hooks/useSocketConnection';
import { QrCode, Copy, Users, Wifi, WifiOff, Play, AlertCircle, LogOut } from 'lucide-react';
import { 
  GameSession, 
  Player, 
  AuthenticationData
} from '@/types';
import { 
  getSession, 
  generateParticipationUrl,
  normalizeErrorMessage 
} from '@/utils/api';
import { useQRCode } from '@/hooks/useQRCode';

interface GameInfo {
  sessionId: string;
  accessToken: string;
  gameName: string;
  maxPlayers: number;
  participationUrl: string;
}

const LoadingAnimation = () => (
  <div className="flex justify-center items-center mt-4">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400" />
    <p className="ml-3 text-white drop-shadow-sm">参加者の入室を待っています...</p>
  </div>
);

const WaitingRoomContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { generateQRCode, qrCodeUrl } = useQRCode();
  const { socket, isConnected, connect, disconnect, on, off, emit } = useSocketConnection();

  // URLパラメータから初期値取得
  const sessionId = searchParams.get('sessionId') || '';
  const accessToken = searchParams.get('accessToken') || '';
  const hostId = searchParams.get('hostId') || '';

  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);

  // 初期データ読み込み
  useEffect(() => {
    const loadSessionData = async () => {
      if (!sessionId || !accessToken) {
        setError('セッション情報が不足しています');
        setIsLoading(false);
        return;
      }

      try {
        // セッション情報を取得
        const sessionData = await getSession(sessionId, accessToken);
        setSession(sessionData);
        setPlayers(sessionData.players);

        // 参加URLとQRコード生成
        const participationUrl = generateParticipationUrl(sessionId, accessToken);
        await generateQRCode(participationUrl, { size: 200 });

        const gameInfo: GameInfo = {
          sessionId: sessionData.sessionId,
          accessToken,
          gameName: sessionData.gameName,
          maxPlayers: sessionData.maxPlayers,
          participationUrl
        };
        setGameInfo(gameInfo);

        // Socket.io接続
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

    loadSessionData();
  }, [sessionId, accessToken, hostId, connect, generateQRCode]);

  // Socket.io接続後、joinGameイベントを送信
  useEffect(() => {
    if (!socket || !isConnected || !hostId) return;

    // joinGameイベントを送信（types/index.tsに定義済み）
    emit('joinGame', {
      sessionId,
      userId: hostId,
      role: 'host'
    });
  }, [socket, isConnected, sessionId, hostId, emit]);

  // Socket.ioイベントリスナー設定
  useEffect(() => {
    if (!socket) return;

    const handlePlayerJoined = (player: Player) => {
      console.log('Player joined:', player);
      setPlayers(prev => {
        // 既に存在する場合は追加しない
        if (prev.find(p => p.id === player.id)) {
          return prev;
        }
        return [...prev, player];
      });
      setSession(prev => prev ? {
        ...prev,
        players: [...(prev.players || []), player]
      } : null);
    };

    const handlePlayerLeft = (playerId: string) => {
      console.log('Player left:', playerId);
      setPlayers(prev => prev.filter(p => p.id !== playerId));
      setSession(prev => prev ? {
        ...prev,
        players: prev.players.filter(p => p.id !== playerId)
      } : null);
    };

    const handleSessionUpdated = (updatedSession: GameSession) => {
      console.log('Session updated:', updatedSession);
      setSession(updatedSession);
      setPlayers(updatedSession.players);
    };

    const handleConnectionError = (errorMessage: string) => {
      setError(errorMessage);
    };

    // イベントリスナー登録（types/index.tsに定義されているイベント）
    on('player_joined', handlePlayerJoined);
    on('player_left', handlePlayerLeft);
    on('session_updated', handleSessionUpdated);
    on('connection_error', handleConnectionError);

    return () => {
      // イベントリスナー解除
      off('player_joined', handlePlayerJoined);
      off('player_left', handlePlayerLeft);
      off('session_updated', handleSessionUpdated);
      off('connection_error', handleConnectionError);
    };
  }, [socket, on, off]);

  // 参加URLコピー処理
  const handleCopyUrl = useCallback(async () => {
    if (!gameInfo) return;

    try {
      await navigator.clipboard.writeText(gameInfo.participationUrl);
      // 一時的な成功通知を表示
      const originalError = error;
      setError('参加URLをコピーしました！');
      setTimeout(() => setError(originalError), 2000);
    } catch {
      setError('コピーに失敗しました');
    }
  }, [gameInfo, error]);

  // ゲーム開始処理
  const handleStartGame = useCallback(async () => {
    if (!gameInfo || !socket || players.length < 2) return;

    setIsStartingGame(true);
    try {
      // Socket.ioでゲーム開始をブロードキャスト（types/index.tsに定義済み）
      emit('start_game', {
        sessionId: gameInfo.sessionId
      });

      // 少し待ってからホスト用ゲーム画面に遷移
      setTimeout(() => {
        router.push(`/host/game/${gameInfo.sessionId}?accessToken=${gameInfo.accessToken}&hostId=${hostId}`);
      }, 500);
    } catch (err) {
      setError(normalizeErrorMessage(err));
      setIsStartingGame(false);
    }
  }, [gameInfo, socket, players.length, emit, hostId, router]);

  // ゲームキャンセル処理
  const handleCancelGame = useCallback(async () => {
    if (!isConfirmingCancel) {
      setIsConfirmingCancel(true);
      setTimeout(() => setIsConfirmingCancel(false), 3000);
      return;
    }

    try {
      // Socket.ioでセッション終了をブロードキャスト
      if (socket) {
        socket.emit('cancel_session', {
          sessionId: gameInfo?.sessionId
        });
      }
      
      disconnect();
      router.push('/host');
    } catch (err) {
      setError(normalizeErrorMessage(err));
    }
  }, [isConfirmingCancel, socket, gameInfo, disconnect, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">セッション情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error && !gameInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white/30 backdrop-blur-md rounded-xl p-6 text-center border border-white/20">
            <AlertCircle className="w-12 h-12 text-white mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">エラーが発生しました</h2>
            <p className="text-white/90 mb-4">{error}</p>
            <button
              onClick={() => router.push('/host')}
              className="bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white font-bold py-2 px-4 rounded-lg"
            >
              ホーム画面に戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameInfo || !session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8 flex items-center justify-center">
      <div className="max-w-4xl mx-auto w-full">
        <div className="overflow-hidden rounded-xl shadow-2xl">
          {/* ヘッダー */}
          <div className="bg-gradient-to-r from-pink-500/70 to-orange-400/70 p-6 backdrop-blur-sm border-t border-l border-r border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-md">
                  {gameInfo.gameName}
                </h1>
                <p className="text-white/90 mt-1 font-mono">
                  セッションID: {gameInfo.sessionId}
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* 接続状態 */}
                <div className="flex items-center">
                  {isConnected ? (
                    <Wifi className="w-5 h-5 text-green-300 mr-2" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-300 mr-2" />
                  )}
                  <span className={`text-sm font-medium ${isConnected ? 'text-green-300' : 'text-red-300'}`}>
                    {isConnected ? 'オンライン' : 'オフライン'}
                  </span>
                </div>

                {/* 終了ボタン */}
                <button
                  onClick={handleCancelGame}
                  className="flex items-center text-red-300 hover:text-red-100 text-sm font-medium"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  終了
                </button>
              </div>
            </div>
          </div>

          {/* メインコンテンツ */}
          <div className="bg-white/30 backdrop-blur-md p-8 space-y-8 border-b border-l border-r border-white/20">
            {/* 参加URL・QRコードセクション */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 参加URL */}
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
                <h2 className="text-lg font-semibold text-white drop-shadow-sm mb-3 flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  参加者に共有するURL
                </h2>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-white/20 backdrop-blur-sm border border-white/40 rounded-lg p-3 font-mono text-sm text-white break-all">
                    {gameInfo.participationUrl}
                  </div>
                  <button
                    onClick={handleCopyUrl}
                    className="px-4 py-2 bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white font-bold rounded-lg shadow-lg transform transition hover:scale-105 flex items-center"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    コピー
                  </button>
                </div>
              </div>

              {/* QRコード */}
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
                <h2 className="text-lg font-semibold text-white drop-shadow-sm mb-3 flex items-center">
                  <QrCode className="w-5 h-5 mr-2" />
                  参加用QRコード
                </h2>
                <div className="text-center">
                  {qrCodeUrl ? (
                    <img 
                      src={qrCodeUrl} 
                      alt="参加用QRコード" 
                      className="mx-auto rounded-lg shadow-lg bg-white p-2"
                    />
                  ) : (
                    <div className="w-48 h-48 mx-auto bg-white/30 rounded-lg flex items-center justify-center">
                      <p className="text-white/70">QRコード生成中...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ローディングアニメーション */}
            {session.status === 'waiting' && <LoadingAnimation />}

            {/* 参加者数表示 */}
            <div className="text-center mb-6">
              <p className="text-xl font-medium text-white drop-shadow-sm">
                参加者数: {players.length} / {gameInfo.maxPlayers}
              </p>
            </div>

            {/* エラー表示 */}
            {error && (
              <div className="bg-red-500/30 backdrop-blur-sm border border-red-400/50 rounded-lg p-4">
                <p className="text-white text-center">{error}</p>
              </div>
            )}

            {/* 参加者リスト */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white drop-shadow-sm mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                参加者一覧
              </h2>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 space-y-2 border border-white/30 max-h-60 overflow-y-auto">
                {players.length === 0 ? (
                  <div className="text-center py-8 text-white/70">
                    参加者を待っています...
                  </div>
                ) : (
                  players.map((player, index) => (
                    <div
                      key={player.id}
                      className="bg-white/30 backdrop-blur-sm p-3 rounded-lg flex items-center justify-between border border-white/30"
                    >
                      <span className="text-white font-medium">{player.name}</span>
                      <div className="flex items-center space-x-2">
                        {index === 0 && (
                          <span className="text-sm text-yellow-300 font-medium">
                            ホスト
                          </span>
                        )}
                        <div className={`w-2 h-2 rounded-full ${player.isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ボタングループ */}
            <div className="space-y-4">
              <button
                onClick={handleStartGame}
                disabled={players.length < 2 || isStartingGame}
                className={`w-full py-3 rounded-lg font-medium transition-colors transform hover:scale-105 shadow-lg flex items-center justify-center
                  ${players.length < 2 || isStartingGame
                    ? 'bg-gray-500/50 cursor-not-allowed text-white/70' 
                    : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-red-800 font-bold'}`}
              >
                {isStartingGame ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-800 mr-2" />
                    ゲーム開始中...
                  </>
                ) : players.length < 2 ? (
                  '参加者が揃うまでお待ちください'
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    ビンゴ大会を開始する
                  </>
                )}
              </button>

              {/* キャンセルボタン */}
              <button
                onClick={handleCancelGame}
                disabled={isStartingGame}
                className={`w-full py-2 rounded-lg font-medium transition-colors
                  ${isConfirmingCancel 
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800' 
                    : 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/30'}`}
              >
                {isConfirmingCancel 
                  ? '本当に大会をキャンセルしますか？' 
                  : '大会をキャンセルする'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Suspenseでラップしたメインコンポーネント
const WaitingRoomPage: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">読み込み中...</p>
        </div>
      </div>
    }>
      <WaitingRoomContent />
    </Suspense>
  );
};

export default WaitingRoomPage;