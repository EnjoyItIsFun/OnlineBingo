'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Copy } from 'lucide-react';
import { getClientBaseUrl, createParticipationUrl } from '@/utils/url';

interface SessionInfo {
  sessionId: string;
  hostId: string;
  accessToken: string;
  name: string;
  maxPlayers: number;
  createdAt: string;
}

export default function MadeGamePage() {
  const router = useRouter();
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [copied, setCopied] = useState<'sessionId' | 'accessToken' | null>(null);

  useEffect(() => {
    // LocalStorageから最新のセッション情報を取得
    const storedSession = localStorage.getItem('hostSession');
    
    if (!storedSession) {
      // 複数の保存キーから探す
      const sessions = Object.keys(localStorage)
        .filter(key => key.startsWith('session_'))
        .map(key => {
          try {
            return JSON.parse(localStorage.getItem(key) || '');
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (sessions.length > 0) {
        setSessionInfo(sessions[0]);
      } else {
        // セッション情報がない場合はホーム画面へ
        router.push('/');
      }
    } else {
      try {
        const session = JSON.parse(storedSession);
        setSessionInfo(session);
      } catch {
        router.push('/');
      }
    }
  }, [router]);

  const handleCopy = async (text: string, type: 'sessionId' | 'accessToken') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('コピーに失敗しました:', err);
    }
  };

  const getParticipationUrl = (): string => {
    if (!sessionInfo) return '';
    
    // 環境に応じた適切なベースURLを取得
    const baseUrl = getClientBaseUrl();
    
    // 参加用URLを生成
    return createParticipationUrl(
      baseUrl,
      sessionInfo.sessionId,
      sessionInfo.accessToken
    );
  };

  const handleProceedToWaiting = () => {
    if (!sessionInfo) return;

    // URLパラメータとしてセッション情報を渡す
    const params = new URLSearchParams({
      sessionId: sessionInfo.sessionId,
      accessToken: sessionInfo.accessToken,
      hostId: sessionInfo.hostId
    });

    router.push(`/host/waiting?${params.toString()}`);
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
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8 pt-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full mb-4">
            <CheckCircle className="w-12 h-12 text-yellow-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-md">
            大会を作成しました！
          </h1>
          <p className="text-white/90 text-lg">
            以下の情報を参加者に共有してください
          </p>
        </div>

        {/* セッション情報カード */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6 border border-white/20 shadow-xl">
          {/* 大会名 */}
          <div className="space-y-2">
            <label className="text-white font-medium">大会名</label>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-3">
              <p className="text-white text-xl font-bold">{sessionInfo.name}</p>
            </div>
          </div>

          {/* 最大参加人数 */}
          <div className="space-y-2">
            <label className="text-white font-medium">最大参加人数</label>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-3">
              <p className="text-white text-xl font-bold">{sessionInfo.maxPlayers}人</p>
            </div>
          </div>

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
              <li>2. または、待機画面で表示されるQRコードを読み取ってもらう</li>
              <li>3. 参加者が名前を入力して参加</li>
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
          <p className="text-white/70 text-sm mt-1">
            ※ セッションは作成から2時間で自動的に削除されます
          </p>
        </div>
      </div>
    </div>
  );
}