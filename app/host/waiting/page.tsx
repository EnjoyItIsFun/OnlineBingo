'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, Copy, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import QRCode from 'qrcode';
import { getClientBaseUrl, createParticipationUrl } from '@/utils/url';
import { usePusherConnection } from '@/hooks/usePusherConnection';

interface SessionInfo {
  sessionId: string;
  accessToken: string;
  hostId: string;
  gameName: string;
  maxPlayers: number;
  participationUrl: string;
  qrCodeDataUrl: string;
}

interface Player {
  id: string;
  name: string;
  isHost?: boolean;
}

function WaitingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const sessionId = searchParams.get('sessionId');
  const accessToken = searchParams.get('accessToken');
  const hostId = searchParams.get('hostId');
  
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [copied, setCopied] = useState<'sessionId' | 'accessToken' | 'url' | null>(null);

  // Pusher接続
  const { isConnected, emit, on, off } = usePusherConnection(sessionId || '');

  useEffect(() => {
    if (!sessionId || !accessToken || !hostId) {
      // パラメータが不足している場合、LocalStorageから取得を試みる
      const hostSession = localStorage.getItem('hostSession');
      if (hostSession) {
        try {
          const stored = JSON.parse(hostSession);
          if (stored.sessionId && stored.accessToken && stored.hostId) {
            const params = new URLSearchParams({
              sessionId: stored.sessionId,
              accessToken: stored.accessToken,
              hostId: stored.hostId
            });
            router.replace(`/host/waiting?${params.toString()}`);
            return;
          }
        } catch (e) {
          console.error('Failed to parse hostSession:', e);
        }
      }
      // どうしても情報が取れない場合は作成画面へ
      router.push('/host/create');
      return;
    }

    // LocalStorageからゲーム名を取得
    const storedSession = localStorage.getItem(`session_${sessionId}`);
    const gameName = storedSession ? JSON.parse(storedSession).name : 'ビンゴ大会';
    const maxPlayers = storedSession ? JSON.parse(storedSession).maxPlayers : 25;

    // 参加用URLとQRコード生成
    const baseUrl = getClientBaseUrl();
    const participationUrl = createParticipationUrl(baseUrl, sessionId, accessToken);

    QRCode.toDataURL(participationUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: 256,
    }).then(qrCodeDataUrl => {
      setSessionInfo({
        sessionId,
        accessToken,
        hostId,
        gameName,
        maxPlayers,
        participationUrl,
        qrCodeDataUrl,
      });
    });
  }, [sessionId, accessToken, hostId, router]);

  // Pusherイベントリスナー設定
  useEffect(() => {
    if (!isConnected || !sessionId) return;

    const handlePlayerJoined = (data: unknown) => {
      const playerData = data as { player: Player };
      setPlayers(prev => [...prev, playerData.player]);
    };

    const handlePlayerLeft = (data: unknown) => {
      const leftData = data as { playerId: string };
      setPlayers(prev => prev.filter(p => p.id !== leftData.playerId));
    };

    on('player_joined', handlePlayerJoined);
    on('player_left', handlePlayerLeft);

    return () => {
      off('player_joined', handlePlayerJoined);
      off('player_left', handlePlayerLeft);
    };
  }, [isConnected, sessionId, on, off]);

  const handleCopy = async (text: string, type: 'sessionId' | 'accessToken' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('コピーに失敗しました:', err);
    }
  };

  const handleStartGame = async () => {
    if (!sessionInfo || players.length < 2) return;
    
    try {
      // ゲーム開始イベントを送信
      await emit('start_game', { sessionId: sessionInfo.sessionId });
      
      // ゲーム画面へ遷移
      router.push(`/host/game/${sessionInfo.sessionId}?accessToken=${sessionInfo.accessToken}&hostId=${sessionInfo.hostId}`);
    } catch (error) {
      console.error('ゲーム開始エラー:', error);
    }
  };

  if (!sessionInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-500 via-red-500 to-orange-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8 pt-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full mb-4">
            <Users className="w-12 h-12 text-yellow-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-md">
            参加者を待っています
          </h1>
          <p className="text-white/90 text-xl font-medium">
            {sessionInfo.gameName}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* 左側: QRコードと参加情報 */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6 border border-white/20 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-4">📱 参加用QRコード</h2>
            
            {/* QRコード */}
            <div className="flex justify-center mb-6">
              <div className="bg-white p-4 rounded-xl">
                <img 
                  src={sessionInfo.qrCodeDataUrl} 
                  alt="参加用QRコード" 
                  className="w-64 h-64"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            </div>

            {/* セッション情報 */}
            <div className="space-y-4">
              {/* セッションID */}
              <div className="space-y-2">
                <label className="text-white font-medium flex items-center">
                  セッションID
                  <span className="ml-2 text-xs text-yellow-300">（参加者に共有）</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-yellow-400/20 backdrop-blur-sm rounded-lg px-4 py-3 border border-yellow-400/40">
                    <p className="text-yellow-200 font-mono text-2xl font-bold tracking-wider">
                      {sessionInfo.sessionId}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(sessionInfo.sessionId, 'sessionId')}
                    className="p-3 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors"
                    title="コピー"
                  >
                    {copied === 'sessionId' ? (
                      <CheckCircle className="w-5 h-5 text-green-300" />
                    ) : (
                      <Copy className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
                {copied === 'sessionId' && (
                  <p className="text-green-300 text-sm">コピーしました！</p>
                )}
              </div>

              {/* アクセストークン */}
              <div className="space-y-2">
                <label className="text-white font-medium flex items-center">
                  アクセストークン
                  <span className="ml-2 text-xs text-yellow-300">（参加者に共有）</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-yellow-400/20 backdrop-blur-sm rounded-lg px-4 py-3 border border-yellow-400/40">
                    <p className="text-yellow-200 font-mono text-2xl font-bold tracking-wider">
                      {sessionInfo.accessToken}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(sessionInfo.accessToken, 'accessToken')}
                    className="p-3 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors"
                    title="コピー"
                  >
                    {copied === 'accessToken' ? (
                      <CheckCircle className="w-5 h-5 text-green-300" />
                    ) : (
                      <Copy className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
                {copied === 'accessToken' && (
                  <p className="text-green-300 text-sm">コピーしました！</p>
                )}
              </div>

              {/* 参加URL */}
              <div className="space-y-2">
                <label className="text-white font-medium">🔗 参加URL</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/20 backdrop-blur-sm rounded-lg px-4 py-3">
                    <p className="text-xs text-yellow-200 font-mono break-all">
                      {sessionInfo.participationUrl}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(sessionInfo.participationUrl, 'url')}
                    className="p-3 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors"
                    title="URLをコピー"
                  >
                    {copied === 'url' ? (
                      <CheckCircle className="w-5 h-5 text-green-300" />
                    ) : (
                      <Copy className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
                {copied === 'url' && (
                  <p className="text-green-300 text-sm">URLをコピーしました！</p>
                )}
              </div>
            </div>
          </div>

          {/* 右側: 参加者リスト */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">👥 参加者リスト</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <Wifi className="w-5 h-5 text-green-300" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-300" />
                  )}
                  <span className="text-white/80 text-sm">
                    {isConnected ? '接続中' : '接続待機中'}
                  </span>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <span className="text-3xl font-bold text-yellow-300">{players.length}</span>
                  <span className="text-white/90 text-lg ml-1">/ {sessionInfo.maxPlayers}人</span>
                </div>
              </div>
            </div>

            {/* 参加者一覧 */}
            <div className="bg-white/10 rounded-xl p-4 min-h-[400px] max-h-[400px] overflow-y-auto">
              {players.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-4">
                    <Users className="w-12 h-12 text-white/60" />
                  </div>
                  <p className="text-white/60 text-lg mb-2">参加者を待っています...</p>
                  <p className="text-white/40 text-sm">
                    QRコードを読み取るか<br />
                    セッションIDとアクセストークンで参加できます
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {players.map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 p-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 hover:bg-white/15 transition-colors"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold shadow-md">
                        {index + 1}
                      </div>
                      <span className="text-white font-medium text-lg flex-1">{player.name}</span>
                      {player.isHost && (
                        <span className="px-3 py-1 bg-yellow-400/30 backdrop-blur-sm rounded-full text-yellow-200 text-sm font-medium">
                          ホスト
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ゲーム開始ボタン */}
            <div className="mt-6">
              <button
                onClick={handleStartGame}
                disabled={players.length < 2}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-all transform ${
                  players.length >= 2
                    ? 'bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white shadow-lg hover:scale-105'
                    : 'bg-white/20 text-white/50 cursor-not-allowed'
                }`}
              >
                {players.length < 2 
                  ? `あと${2 - players.length}人必要です` 
                  : '🎮 ゲームを開始する'}
              </button>
              <p className="text-center text-white/60 text-sm mt-2">
                ※ 参加者が2人以上になるとゲームを開始できます
              </p>
            </div>
          </div>
        </div>

        {/* 注意事項 */}
        <div className="mt-8 text-center">
          <div className="inline-flex flex-col items-center p-4 bg-yellow-400/20 backdrop-blur-sm rounded-lg border border-yellow-400/40">
            <p className="text-white/90 text-sm">
              💡 参加者はQRコードを読み取るか、セッションIDとアクセストークンを入力して参加できます
            </p>
            <p className="text-white/70 text-sm mt-1">
              ※ セッションは作成から2時間で自動的に削除されます
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HostWaitingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-500 via-red-500 to-orange-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">読み込み中...</p>
        </div>
      </div>
    }>
      <WaitingContent />
    </Suspense>
  );
}