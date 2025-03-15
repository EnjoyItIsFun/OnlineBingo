'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CreateGamePage = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    gameName: '',
    maxPlayers: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // バリデーション
    if (!formData.gameName.trim()) {
      setError('大会名を入力してください');
      return;
    }
    if (!formData.maxPlayers || Number(formData.maxPlayers) < 2) {
      setError('参加人数は2人以上で設定してください');
      return;
    }
    if (!formData.password.trim()) {
      setError('合言葉を入力してください');
      return;
    }

    try {
      // ここでAPIを呼び出してゲームを作成
      console.log('Form submitted:', formData);
      // 成功したら次のページへ
      router.push('/host/waiting');
    } catch {
      setError('ゲームの作成に失敗しました。もう一度お試しください。');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center text-white mb-8 drop-shadow-lg">
          ビンゴ<span className="text-yellow-300">大会</span>を作成
        </h1>
        
        <div className="w-full overflow-hidden rounded-xl shadow-2xl">
          <div className="bg-gradient-to-r from-pink-500/70 to-orange-400/70 p-4 backdrop-blur-sm border-t border-l border-r border-white/20">
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-md">
              大会情報を入力
            </h2>
          </div>
          
          <form onSubmit={handleSubmit} className="bg-white/30 backdrop-blur-md p-6 space-y-6 border-b border-l border-r border-white/20">
            <div className="space-y-2">
              <label htmlFor="gameName" className="block text-lg font-medium text-white drop-shadow-sm">
                大会名
              </label>
              <input
                type="text"
                id="gameName"
                name="gameName"
                value={formData.gameName}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white placeholder-white/60"
                placeholder="みんなでビンゴ！"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="maxPlayers" className="block text-lg font-medium text-white drop-shadow-sm">
                参加人数
              </label>
              <input
                type="number"
                id="maxPlayers"
                name="maxPlayers"
                value={formData.maxPlayers}
                onChange={handleChange}
                min="2"
                className="w-full px-4 py-3 rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white placeholder-white/60"
                placeholder="10"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-lg font-medium text-white drop-shadow-sm">
                合言葉
              </label>
              <input
                type="text"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white placeholder-white/60"
                placeholder="あいことば123"
              />
            </div>

            {error && (
              <p className="text-yellow-300 font-medium bg-red-700/50 rounded-lg p-2 text-center">{error}</p>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white font-bold py-3 rounded-lg shadow-lg transform transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              大会を作成する
            </button>
          </form>
        </div>
        
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-white hover:text-yellow-300 transition-colors font-medium drop-shadow-md"
          >
            トップページに戻る
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGamePage;