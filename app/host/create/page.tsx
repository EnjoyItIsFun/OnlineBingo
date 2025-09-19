'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 型定義
interface SessionFormData {
  name: string;
  maxPlayers: number;
  passphrase?: string;
}

interface SessionResponse {
  sessionId: string;
  hostId: string;  
  accessToken: string;
  passphrase?: string;
}

/**
 * ホスト用セッション作成画面
 */
export default function CreateSessionPage() {
  const router = useRouter();
  
  // フォームデータの状態管理
  const [formData, setFormData] = useState<SessionFormData>({
    name: '',
    maxPlayers: 10,
    passphrase: ''
  });
  
  // UI状態の管理
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * フォーム入力値の変更ハンドラー
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  /**
   * セッション作成の処理
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // バリデーション
      if (!formData.name.trim()) {
        throw new Error('大会名を入力してください');
      }
      
      if (formData.maxPlayers < 2 || formData.maxPlayers > 100) {
        throw new Error('参加人数は2〜100人の間で設定してください');
      }

      // APIリクエストの準備
      const requestBody = {
        gameName: formData.name.trim(),
        maxPlayers: formData.maxPlayers,
        passphrase: formData.passphrase?.trim() || undefined
      };

      console.log('Sending request:', requestBody);

      // セッション作成APIを呼び出し
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'エラーが発生しました' }));
        console.error('API Error:', errorData);
        throw new Error(errorData.error || `エラー: ${response.status}`);
      }

      const data: SessionResponse = await response.json();
      console.log('API Response:', data);

      // セッション情報の保存（hostId使用）
      const sessionInfo = {
        sessionId: data.sessionId,
        hostId: data.hostId,  // hostIdを使用
        accessToken: data.accessToken,
        name: formData.name,
        maxPlayers: formData.maxPlayers,
        passphrase: data.passphrase,
        createdAt: new Date().toISOString()
      };

      // localStorageに保存
      localStorage.setItem('hostSession', JSON.stringify(sessionInfo));
      
      // 複数セッション管理用
      const allSessions = JSON.parse(localStorage.getItem('allHostSessions') || '[]');
      allSessions.push(sessionInfo);
      localStorage.setItem('allHostSessions', JSON.stringify(allSessions));

      // 作成完了画面へ遷移
      router.push('/host/made-game');

    } catch (err) {
      console.error('セッション作成エラー:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* タイトル */}
        <h1 className="text-4xl font-bold text-center text-white mb-8 drop-shadow-lg">
          ビンゴ<span className="text-yellow-300">大会</span>を作成
        </h1>
        
        {/* メインカード */}
        <div className="w-full overflow-hidden rounded-xl shadow-2xl">
          {/* カードヘッダー */}
          <div className="bg-gradient-to-r from-pink-500/70 to-orange-400/70 p-4 backdrop-blur-sm border-t border-l border-r border-white/20">
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-md">
              大会情報を入力
            </h2>
          </div>
          
          {/* フォーム本体 */}
          <form onSubmit={handleSubmit} className="bg-white/30 backdrop-blur-md p-6 space-y-6 border-b border-l border-r border-white/20">
            {/* エラー表示 */}
            {error && (
              <div className="text-yellow-300 font-medium bg-red-700/50 rounded-lg p-3 text-center">
                {error}
              </div>
            )}

            {/* 大会名入力 */}
            <div className="space-y-2">
              <label htmlFor="name" className="block text-lg font-medium text-white drop-shadow-sm">
                大会名
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white placeholder-white/60"
                placeholder="みんなでビンゴ！"
                disabled={isLoading}
                maxLength={50}
              />
            </div>

            {/* 参加人数 */}
            <div className="space-y-2">
              <label htmlFor="maxPlayers" className="block text-lg font-medium text-white drop-shadow-sm">
                参加人数
              </label>
              <input
                type="number"
                id="maxPlayers"
                name="maxPlayers"
                value={formData.maxPlayers}
                onChange={handleInputChange}
                min="2"
                max="100"
                className="w-full px-4 py-3 rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white placeholder-white/60"
                placeholder="10"
                disabled={isLoading}
              />
            </div>

            {/* 合言葉（オプション） */}
            <div className="space-y-2">
              <label htmlFor="passphrase" className="block text-lg font-medium text-white drop-shadow-sm">
                合言葉（オプション）
              </label>
              <input
                type="text"
                id="passphrase"
                name="passphrase"
                value={formData.passphrase}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white placeholder-white/60"
                placeholder="秘密の合言葉"
                disabled={isLoading}
                maxLength={50}
              />
              <p className="text-xs text-white/70">
                ※ 設定すると、参加時に合言葉の入力が必要になります
              </p>
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
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  作成中...
                </span>
              ) : (
                '大会を作成する'
              )}
            </button>
          </form>
        </div>
        
        {/* 戻るボタン */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/host')}
            disabled={isLoading}
            className="text-white hover:text-yellow-300 transition-colors font-medium drop-shadow-md"
          >
            トップページに戻る
          </button>
        </div>

        {/* ヒント */}
        <div className="mt-6 bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
          <p className="text-sm text-white/90">
            💡 ヒント：作成後、<strong>アクセストークン</strong>が生成されます。参加者はセッションIDとアクセストークンで参加できます。
          </p>
        </div>
      </div>
    </div>
  );
}