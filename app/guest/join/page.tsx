'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNameAdjustment } from '@/hooks/useNameAdjustment';
import { Users, Sparkles, ArrowLeft, AlertCircle } from 'lucide-react';
import { 
  JoinSessionRequest,
  JoinSessionResponse 
} from '@/types';
import { 
  joinSession,
  normalizeErrorMessage 
} from '@/utils/api';

// 参加ページのメインコンポーネント
const JoinPageContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { nameAdjustment, setAdjustment, acknowledgeAdjustment } = useNameAdjustment();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [playerName, setPlayerName] = useState('');

  // URLパラメータから初期値を取得
  useEffect(() => {
    const initialSessionId = searchParams.get('sessionId') || searchParams.get('session') || '';
    const initialAccessToken = searchParams.get('accessToken') || searchParams.get('token') || '';
    
    if (initialSessionId) {
      setSessionId(initialSessionId);
    }
    if (initialAccessToken) {
      setAccessToken(initialAccessToken);
    }

    // デバッグログ
    console.log('URL Parameters:', {
      sessionId: initialSessionId,
      accessToken: initialAccessToken
    });
  }, [searchParams]);

  // セッション参加処理（認証スキップ版）
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // 入力値のバリデーション
      if (!sessionId || !/^[A-Z0-9]{6}$/.test(sessionId)) {
        throw new Error('有効なセッションIDを入力してください（6桁の英数字）');
      }

      if (!accessToken || accessToken.length < 6) {
        throw new Error('有効なアクセストークンを入力してください');
      }

      if (!playerName.trim() || playerName.length > 25) {
        throw new Error('名前を1〜25文字で入力してください');
      }

      console.log('Joining session with:', {
        sessionId,
        accessToken,
        playerName: playerName.trim()
      });

      // 参加リクエスト
      const joinRequest: JoinSessionRequest = {
        accessToken,
        playerName: playerName.trim()
      };

      const response: JoinSessionResponse = await joinSession(sessionId, joinRequest);

      console.log('Join response:', response);

      // 名前調整があった場合の処理
      if (response.nameAdjustment) {
        setAdjustment(response.nameAdjustment);
        
        // LocalStorageに保存（後で通知表示用）
        sessionStorage.setItem('nameAdjustment', JSON.stringify(response.nameAdjustment));
      }

      // 参加情報をLocalStorageに保存
      const participantInfo = {
        sessionId,
        playerId: response.playerId,
        playerName: response.adjustedName || playerName.trim(),
        accessToken,
        joinedAt: new Date().toISOString()
      };
      localStorage.setItem('participantInfo', JSON.stringify(participantInfo));

      // 待機画面へリダイレクト
      router.push(`/guest/waiting/${sessionId}?playerId=${response.playerId}&token=${accessToken}`);
      
    } catch (err) {
      console.error('Join error:', err);
      setError(normalizeErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8 flex items-center justify-center">
      <div className="max-w-2xl mx-auto w-full">
        <div className="overflow-hidden rounded-xl shadow-2xl">
          {/* ヘッダー */}
          <div className="bg-gradient-to-r from-pink-500/70 to-orange-400/70 p-6 backdrop-blur-sm border-t border-l border-r border-white/20">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Sparkles className="w-8 h-8 text-yellow-300 mr-2" />
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-md">
                  オンラインビンゴ
                </h1>
                <Sparkles className="w-8 h-8 text-yellow-300 ml-2" />
              </div>
              <p className="text-white/90 text-lg font-medium drop-shadow-sm">
                大会に参加しましょう！
              </p>
            </div>
          </div>

          {/* メインコンテンツ */}
          <div className="bg-white/30 backdrop-blur-md p-8 border-b border-l border-r border-white/20">
            <form onSubmit={handleJoin} className="space-y-6">
              <div className="text-center mb-6">
                <div className="flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-yellow-300 mr-2" />
                  <h2 className="text-2xl font-bold text-white drop-shadow-sm">
                    セッション情報を入力
                  </h2>
                </div>
                <p className="text-white/80 text-sm">
                  セッションIDとアクセストークンを入力してください
                </p>
              </div>

              {/* セッションID入力 */}
              <div>
                <label htmlFor="sessionId" className="block text-white font-semibold mb-2 drop-shadow-sm">
                  セッションID
                </label>
                <input
                  type="text"
                  id="sessionId"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                  placeholder="M9CFU4"
                  maxLength={6}
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/40 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                  disabled={isLoading}
                  required
                />
              </div>

              {/* アクセストークン入力 */}
              <div>
                <label htmlFor="accessToken" className="block text-white font-semibold mb-2 drop-shadow-sm">
                  アクセストークン
                </label>
                <input
                  type="text"
                  id="accessToken"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="1R2SGFHX"
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/40 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                  disabled={isLoading}
                  required
                />
              </div>

              {/* プレイヤー名入力 */}
              <div>
                <label htmlFor="playerName" className="block text-white font-semibold mb-2 drop-shadow-sm">
                  あなたの名前
                </label>
                <input
                  type="text"
                  id="playerName"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="表示名を入力"
                  maxLength={25}
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/40 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                  disabled={isLoading}
                  required
                />
                <p className="mt-2 text-white/70 text-sm">
                  ※同じ名前のプレイヤーがいる場合、自動的に番号が付けられます
                </p>
              </div>

              {/* エラー表示 */}
              {error && (
                <div className="bg-red-500/30 backdrop-blur-sm border border-red-400/50 rounded-lg p-4 flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-300 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-white font-medium">{error}</p>
                </div>
              )}

              {/* ボタングループ */}
              <div className="space-y-4">
                <button
                  type="submit"
                  disabled={isLoading || !sessionId || !accessToken || !playerName}
                  className={`w-full py-4 rounded-lg font-bold text-lg transition-all transform hover:scale-105 shadow-lg
                    ${isLoading || !sessionId || !accessToken || !playerName
                      ? 'bg-gray-500/50 cursor-not-allowed text-white/70' 
                      : 'bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white'}`}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                      参加中...
                    </div>
                  ) : (
                    <>
                      <Users className="w-5 h-5 inline mr-2" />
                      ゲームに参加
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/')}
                  disabled={isLoading}
                  className="w-full py-3 rounded-lg font-medium transition-colors bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/30 disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4 inline mr-2" />
                  トップページに戻る
                </button>
              </div>

              {/* ヒント */}
              <div className="text-center mt-6">
                <p className="text-white/80 text-sm">
                  💡 ヒント：セッションIDとアクセストークンは、大会のホストから共有されます
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 名前調整通知（モーダル） */}
      {nameAdjustment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-3">名前が調整されました</h3>
            <p className="text-gray-700 mb-4">
              同じ名前のプレイヤーが既に存在するため、あなたの名前は
              <span className="font-bold text-blue-600 mx-1">
                「{nameAdjustment.adjusted}」
              </span>
              になりました。
            </p>
            <button
              onClick={acknowledgeAdjustment}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              了解しました
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Suspenseでラップしたメインコンポーネント
const JoinPage: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-lg font-medium drop-shadow-sm">読み込み中...</p>
        </div>
      </div>
    }>
      <JoinPageContent />
    </Suspense>
  );
};

export default JoinPage;