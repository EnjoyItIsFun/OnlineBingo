'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, CheckCircle, Users, Clock, Key } from 'lucide-react';

interface SessionInfo {
  sessionId: string;
  hostId: string;
  accessToken: string;
  name: string;
  maxPlayers: number;
  passphrase?: string;
  createdAt: string;
}

/**
 * セッション作成完了画面
 * セッション情報の表示と次のステップへの案内
 */
export default function MadeGamePage() {
  const router = useRouter();
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [copied, setCopied] = useState<'sessionId' | 'accessToken' | null>(null);

  useEffect(() => {
    // localStorageからセッション情報を取得
    const storedSession = localStorage.getItem('hostSession');
    
    if (!storedSession) {
      // セッション情報がない場合はホーム画面へリダイレクト
      router.push('/host');
      return;
    }

    try {
      const session = JSON.parse(storedSession);
      setSessionInfo(session);
    } catch (error) {
      console.error('セッション情報の読み込みエラー:', error);
      router.push('/host');
    }
  }, [router]);

  /**
   * テキストをクリップボードにコピー
   */
  const handleCopy = async (text: string, type: 'sessionId' | 'accessToken') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      
      // 3秒後にコピー状態をリセット
      setTimeout(() => {
        setCopied(null);
      }, 3000);
    } catch (error) {
      console.error('コピーに失敗しました:', error);
    }
  };

  /**
   * 参加URLを生成
   */
  const getParticipationUrl = () => {
    if (!sessionInfo) return '';
    
    // 本番環境では環境変数から取得
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    return `${baseUrl}/guest/join?session=${sessionInfo.sessionId}&token=${sessionInfo.accessToken}`;
  };

  /**
   * 待機画面へ進む
   */
  const handleProceedToWaiting = () => {
    if (!sessionInfo) return;

    // URLパラメータとしてセッション情報を渡す
    const params = new URLSearchParams({
      sessionId: sessionInfo.sessionId,
      accessToken: sessionInfo.accessToken,
      hostId: sessionInfo.hostId  // hostIdを使用
    });

    router.push(`/host/waiting?${params.toString()}`);
  };

  if (!sessionInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8 flex items-center justify-center">
      <div className="max-w-2xl w-full">
        {/* 成功メッセージ */}
        <div className="text-center mb-8">
          <CheckCircle className="w-16 h-16 text-yellow-300 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">
            大会を作成しました！
          </h1>
          <p className="text-white/90 text-lg">
            以下の情報を参加者に共有してください
          </p>
        </div>

        {/* セッション情報カード */}
        <div className="bg-white/30 backdrop-blur-md rounded-xl p-6 space-y-6 border border-white/20">
          {/* 大会名 */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {sessionInfo.name}
            </h2>
            <div className="flex items-center space-x-4 text-white/90">
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-1" />
                <span className="text-sm">最大{sessionInfo.maxPlayers}人</span>
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                <span className="text-sm">制限時間: 2時間</span>
              </div>
            </div>
          </div>

          {/* セッションID */}
          <div className="space-y-2">
            <label className="text-white font-medium">セッションID</label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-white/20 backdrop-blur-sm rounded-lg px-4 py-3">
                <code className="text-2xl font-mono text-yellow-300 font-bold">
                  {sessionInfo.sessionId}
                </code>
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
              <Key className="w-4 h-4 mr-1" />
              アクセストークン（参加者に共有）
            </label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-white/20 backdrop-blur-sm rounded-lg px-4 py-3">
                <code className="text-xl font-mono text-yellow-300 font-bold">
                  {sessionInfo.accessToken}
                </code>
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

          {/* 合言葉（設定されている場合） */}
          {sessionInfo.passphrase && (
            <div className="space-y-2">
              <label className="text-white font-medium">
                🔐 合言葉（参加時に必要）
              </label>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-3">
                <code className="text-lg font-mono text-yellow-300">
                  {sessionInfo.passphrase}
                </code>
              </div>
            </div>
          )}

          {/* 参加URL */}
          <div className="space-y-2">
            <label className="text-white font-medium flex items-center">
              🔗 参加URL（QRコード用）
            </label>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-3">
              <p className="text-xs text-yellow-200 font-mono break-all">
                {getParticipationUrl()}
              </p>
            </div>
            <p className="text-white/70 text-xs">
              ※ このURLをQRコード化すると、参加者は読み取るだけで参加画面に移動できます
            </p>
          </div>

          {/* 参加方法の説明 */}
          <div className="p-4 bg-yellow-400/20 rounded-lg border border-yellow-400/40">
            <p className="text-white text-sm mb-2">
              <strong>💡 参加方法：</strong>
            </p>
            <ol className="text-white/90 text-sm space-y-1 ml-4">
              <li>1. セッションIDとアクセストークンを参加者に共有</li>
              {sessionInfo.passphrase && <li>2. 合言葉も一緒に共有</li>}
              <li>{sessionInfo.passphrase ? '3' : '2'}. または、待機画面で表示されるQRコードを読み取ってもらう</li>
              <li>{sessionInfo.passphrase ? '4' : '3'}. 参加者が名前を入力して参加</li>
            </ol>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="mt-8 space-y-4">
          <button
            onClick={handleProceedToWaiting}
            className="w-full bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white font-bold py-4 rounded-lg shadow-lg transform transition hover:scale-105 text-lg"
          >
            待機画面へ進む
          </button>
          
          <button
            onClick={() => router.push('/host')}
            className="w-full bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white font-medium py-3 rounded-lg transition"
          >
            ホーム画面に戻る
          </button>
        </div>

        {/* 注意事項 */}
        <div className="mt-6 text-center">
          <p className="text-white/70 text-sm">
            ※ このページを離れても、セッション情報は保存されています
          </p>
        </div>
      </div>
    </div>
  );
}