'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, Loader2, AlertCircle } from 'lucide-react';

/**
 * URLパラメータを取得するコンポーネント
 * Suspenseで囲む必要があるため分離
 */
function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // URLパラメータから初期値を取得
  const initialSessionId = searchParams.get('session') || '';
  const initialAccessToken = searchParams.get('token') || '';
  
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [accessToken, setAccessToken] = useState(initialAccessToken);
  const [playerName, setPlayerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // URLパラメータが変更されたら更新
  useEffect(() => {
    if (searchParams.get('session')) {
      setSessionId(searchParams.get('session') || '');
    }
    if (searchParams.get('token')) {
      setAccessToken(searchParams.get('token') || '');
    }
  }, [searchParams]);

  /**
   * 参加処理
   */
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // バリデーション
    if (!sessionId || !/^[A-Z0-9]{6}$/.test(sessionId)) {
      setError('有効なセッションIDを入力してください（6桁の英数字）');
      return;
    }

    if (!accessToken || !/^[A-Z0-9]{8}$/.test(accessToken)) {
      setError('有効なアクセストークンを入力してください（8桁の英数字）');
      return;
    }

    if (!playerName.trim() || playerName.length > 25) {
      setError('名前を1〜25文字で入力してください');
      return;
    }

    setIsLoading(true);

    try {
      // 参加APIを呼び出し
      const response = await fetch(`/api/sessions/${sessionId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          accessToken,
          playerName: playerName.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'エラーが発生しました' }));
        throw new Error(errorData.error || `エラー: ${response.status}`);
      }

      const data = await response.json();

      // 参加情報をlocalStorageに保存（再接続用）
      const playerInfo = {
        sessionId,
        accessToken,
        playerId: data.playerId,
        playerName: data.playerName,
        originalName: data.nameAdjustment?.originalName || playerName,
        wasNameAdjusted: data.nameAdjustment?.wasAdjusted || false,
        board: data.board,
        joinedAt: new Date().toISOString()
      };

      localStorage.setItem('playerSession', JSON.stringify(playerInfo));

      // 名前が調整された場合はアラート
      if (data.nameAdjustment?.wasAdjusted) {
        alert(`名前が重複していたため「${data.playerName}」として登録されました。`);
      }

      // 待機画面へ遷移
      const params = new URLSearchParams({
        playerId: data.playerId,
        accessToken
      });
      
      router.push(`/guest/waiting/${sessionId}?${params.toString()}`);

    } catch (err) {
      console.error('参加エラー:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center text-white mb-8 drop-shadow-lg">
          ビンゴ<span className="text-yellow-300">大会</span>に参加
        </h1>
        
        <div className="w-full overflow-hidden rounded-xl shadow-2xl">
          <div className="bg-gradient-to-r from-pink-500/70 to-orange-400/70 p-4 backdrop-blur-sm border-t border-l border-r border-white/20">
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-md">
              参加情報を入力
            </h2>
          </div>
          
          <form onSubmit={handleJoin} className="bg-white/30 backdrop-blur-md p-6 space-y-6 border-b border-l border-r border-white/20">
            {/* エラー表示 */}
            {error && (
              <div className="flex items-start space-x-2 text-yellow-300 bg-red-700/50 rounded-lg p-3">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {/* セッションID */}
            <div className="space-y-2">
              <label htmlFor="sessionId" className="block text-lg font-medium text-white drop-shadow-sm">
                セッションID
              </label>
              <input
                type="text"
                id="sessionId"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="w-full px-4 py-3 rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white placeholder-white/60 font-mono text-xl text-center"
                disabled={isLoading}
                maxLength={6}
              />
              <p className="text-xs text-white/70">6桁の英数字</p>
            </div>

            {/* アクセストークン */}
            <div className="space-y-2">
              <label htmlFor="accessToken" className="block text-lg font-medium text-white drop-shadow-sm">
                アクセストークン
              </label>
              <input
                type="text"
                id="accessToken"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value.toUpperCase())}
                placeholder="QP4L8WR3"
                className="w-full px-4 py-3 rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white placeholder-white/60 font-mono text-xl text-center"
                disabled={isLoading}
                maxLength={8}
              />
              <p className="text-xs text-white/70">8桁の英数字（ホストから共有）</p>
            </div>

            {/* プレイヤー名 */}
            <div className="space-y-2">
              <label htmlFor="playerName" className="block text-lg font-medium text-white drop-shadow-sm">
                あなたの名前
              </label>
              <input
                type="text"
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="山田太郎"
                className="w-full px-4 py-3 rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white placeholder-white/60"
                disabled={isLoading}
                maxLength={25}
              />
              <p className="text-xs text-white/70">他の参加者に表示される名前（最大25文字）</p>
            </div>

            {/* 送信ボタン */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full font-bold py-3 rounded-lg shadow-lg transform transition ${
                isLoading 
                  ? 'bg-gray-400/50 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 hover:scale-105'
              } text-white`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  参加中...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <Users className="mr-2 h-5 w-5" />
                  大会に参加する
                </span>
              )}
            </button>
          </form>
        </div>
        
        {/* ヒント */}
        <div className="mt-6 bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
          <p className="text-sm text-white/90">
            💡 ヒント：QRコードを読み取った場合、セッションIDとアクセストークンは自動入力されます。名前だけ入力してください。
          </p>
        </div>

        {/* 戻るボタン */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/')}
            disabled={isLoading}
            className="text-white hover:text-yellow-300 transition-colors font-medium drop-shadow-md"
          >
            トップページに戻る
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * ゲスト用参加画面
 * QRコードまたは手入力で参加
 */
export default function GuestJoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">読み込み中...</p>
        </div>
      </div>
    }>
      <JoinForm />
    </Suspense>
  );
}