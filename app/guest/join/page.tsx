// app/guest/join/page.tsx
// 大会参加ページ（ゴージャスデザイン版）

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthenticationForm } from '@/app/components/AuthenticationForm';
import { NameAdjustmentNotification } from '@/app/components/NameAdjustmentNotification';
import { useQRCode } from '@/hooks/useQRCode';
import { useNameAdjustment } from '@/hooks/useNameAdjustment';
import { QrCode, Users, Sparkles, ArrowLeft } from 'lucide-react';
import { 
  AuthenticationData, 
  JoinSessionRequest,
  JoinSessionResponse 
} from '@/types';
import { 
  joinSession, 
  validateAuthentication, 
  generateParticipationUrl,
  normalizeErrorMessage 
} from '@/utils/api';

// 参加ページのメインコンポーネント
const JoinPageContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { generateQRCode, qrCodeUrl } = useQRCode();
  const { nameAdjustment, setAdjustment, acknowledgeAdjustment } = useNameAdjustment();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [authData, setAuthData] = useState<AuthenticationData | null>(null);

  // URLパラメータから初期値を取得
  const initialSessionId = searchParams.get('sessionId') || '';
  const initialAccessToken = searchParams.get('accessToken') || '';

  // QRコードの生成
  useEffect(() => {
    if (initialSessionId && initialAccessToken) {
      const participationUrl = generateParticipationUrl(initialSessionId, initialAccessToken);
      generateQRCode(participationUrl, { size: 200 });
    }
  }, [initialSessionId, initialAccessToken, generateQRCode]);

  // 認証処理
  const handleAuthentication = useCallback(async (authenticationData: AuthenticationData) => {
    setIsLoading(true);
    setError(null);

    try {
      // 認証データの検証
      const validation = await validateAuthentication(authenticationData);
      
      if (!validation.valid) {
        throw new Error(validation.error || '認証に失敗しました');
      }

      // 認証成功 - 名前入力フェーズへ
      setAuthData(authenticationData);
      setShowNameInput(true);
    } catch (err) {
      setError(normalizeErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // プレイヤー名で参加処理
  const handleJoinWithName = useCallback(async () => {
    if (!authData || !playerName.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const joinRequest: JoinSessionRequest = {
        accessToken: authData.accessToken,
        playerName: playerName.trim()
      };

      const response: JoinSessionResponse = await joinSession(authData.sessionId, joinRequest);

      // 名前調整があった場合の処理
      if (response.nameAdjustment) {
        setAdjustment(response.nameAdjustment);
      }

      // 待機ページへリダイレクト
      router.push(`/guest/waiting/${authData.sessionId}?playerId=${response.playerId}&accessToken=${authData.accessToken}`);
    } catch (err) {
      setError(normalizeErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [authData, playerName, setAdjustment, router]);

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
          <div className="bg-white/30 backdrop-blur-md p-8 space-y-8 border-b border-l border-r border-white/20">
            {!showNameInput ? (
              // 認証フェーズ
              <>
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

                {/* 認証フォーム */}
                <div className="space-y-6">
                  <AuthenticationForm
                    sessionId={initialSessionId}
                    accessToken={initialAccessToken}
                    onSubmit={handleAuthentication}
                    isLoading={isLoading}
                    error={error || undefined}
                    allowQRScan={true}
                  />
                </div>

                {/* QRコード表示 */}
                {qrCodeUrl && (
                  <div className="text-center space-y-4">
                    <div className="flex items-center justify-center mb-3">
                      <QrCode className="w-5 h-5 text-yellow-300 mr-2" />
                      <h3 className="text-lg font-semibold text-white drop-shadow-sm">
                        参加用QRコード
                      </h3>
                    </div>
                    <div className="inline-block bg-white rounded-lg p-4 shadow-lg">
                      <img 
                        src={qrCodeUrl} 
                        alt="参加用QRコード" 
                        className="mx-auto"
                      />
                    </div>
                    <p className="text-white/70 text-sm">
                      このQRコードをスキャンして参加できます
                    </p>
                  </div>
                )}
              </>
            ) : (
              // 名前入力フェーズ
              <>
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6 text-yellow-300 mr-2" />
                    <h2 className="text-2xl font-bold text-white drop-shadow-sm">
                      プレイヤー名を入力
                    </h2>
                  </div>
                  <p className="text-white/80 text-sm">
                    ゲーム中に表示される名前を入力してください
                  </p>
                </div>

                {/* エラー表示 */}
                {error && (
                  <div className="bg-red-500/30 backdrop-blur-sm border border-red-400/50 rounded-lg p-4">
                    <p className="text-white text-center font-medium">{error}</p>
                  </div>
                )}

                {/* 名前入力フォーム */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="playerName" className="block text-white font-semibold mb-2 drop-shadow-sm">
                      プレイヤー名
                    </label>
                    <input
                      type="text"
                      id="playerName"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="あなたの名前を入力"
                      maxLength={25}
                      className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/40 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                      disabled={isLoading}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && playerName.trim()) {
                          handleJoinWithName();
                        }
                      }}
                    />
                    <p className="mt-2 text-white/70 text-sm">
                      最大25文字まで入力できます
                    </p>
                  </div>
                </div>

                {/* ボタングループ */}
                <div className="space-y-4">
                  <button
                    onClick={handleJoinWithName}
                    disabled={isLoading || !playerName.trim()}
                    className={`w-full py-4 rounded-lg font-bold text-lg transition-colors transform hover:scale-105 shadow-lg
                      ${isLoading || !playerName.trim()
                        ? 'bg-gray-500/50 cursor-not-allowed text-white/70' 
                        : 'bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white'}`}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-800 mr-2" />
                        参加中...
                      </div>
                    ) : (
                      <>
                        <Users className="w-5 h-5 inline mr-2" />
                        大会に参加する
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setShowNameInput(false)}
                    disabled={isLoading}
                    className="w-full py-3 rounded-lg font-medium transition-colors bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/30 disabled:opacity-50 flex items-center justify-center"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    戻る
                  </button>
                </div>
              </>
            )}

            {/* 注意事項 */}
            <div className="text-center">
              <p className="text-white/80 text-sm">
                {!showNameInput ? (
                  '参加には有効なセッションIDとアクセストークンが必要です'
                ) : (
                  '同じ名前のプレイヤーがいる場合、自動的に調整されます'
                )}
              </p>
            </div>

            {/* トップページに戻るボタン */}
            <div className="text-center">
              <button
                onClick={() => router.push('/')}
                className="text-white/80 hover:text-white underline text-sm font-medium transition-colors"
              >
                トップページに戻る
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 名前調整通知 */}
      {nameAdjustment && (
        <NameAdjustmentNotification
          originalName={nameAdjustment.original}
          adjustedName={nameAdjustment.adjusted}
          reason="duplicate"
          onAcknowledge={acknowledgeAdjustment}
        />
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