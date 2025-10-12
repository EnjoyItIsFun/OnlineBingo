'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const [copied, setCopied] = useState(false);

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
        maxPlayers: 25,
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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-400 via-red-400 to-yellow-400 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 pt-8">
          <h1 className="text-4xl font-bold text-white mb-2">参加者を待っています</h1>
          <p className="text-white/90">{sessionInfo.gameName}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 左側: QRコードと参加情報 */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">参加用QRコード</h2>
            
            <div className="text-center mb-4">
              <img 
                src={sessionInfo.qrCodeDataUrl} 
                alt="参加用QRコード" 
                className="mx-auto"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">セッションID</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-yellow-100 px-3 py-2 rounded font-mono text-lg font-bold">
                    {sessionInfo.sessionId}
                  </code>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600">アクセストークン</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-yellow-100 px-3 py-2 rounded font-mono text-lg font-bold">
                    {sessionInfo.accessToken}
                  </code>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600">参加URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={sessionInfo.participationUrl}
                    readOnly
                    className="flex-1 bg-gray-50 px-3 py-2 rounded border border-gray-300 text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(sessionInfo.participationUrl)}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium transition-colors"
                  >
                    {copied ? '✓' : 'コピー'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 右側: 参加者リスト */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">参加者</h2>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-pink-500">{players.length}</span>
                <span className="text-gray-600">人</span>
              </div>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {players.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  参加者を待っています...
                </p>
              ) : (
                players.map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-orange-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <span className="font-medium text-gray-800">{player.name}</span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                  <span className="text-sm text-gray-600">
                    {isConnected ? '接続中' : '接続待機中'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleStartGame}
                disabled={players.length < 2}
                className={`w-full px-6 py-2 rounded-lg font-bold transition-all ${
                  players.length >= 2
                    ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white hover:shadow-lg'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {players.length < 2 ? `あと${2 - players.length}人必要です` : 'ゲーム開始'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-white/80 text-sm">
          ※ 参加者が2人以上になるとゲームを開始できます
        </div>
      </div>
    </div>
  );
}

export default function HostWaitingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    }>
      <WaitingContent />
    </Suspense>
  );
}