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
    <div className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
          ビンゴ大会を作成
        </h1>
        
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 space-y-6">
          <div className="space-y-2">
            <label htmlFor="gameName" className="block text-sm font-medium text-gray-700">
              大会名
            </label>
            <input
              type="text"
              id="gameName"
              name="gameName"
              value={formData.gameName}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="みんなでビンゴ！"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-900">
              参加人数
            </label>
            <input
              type="number"
              id="maxPlayers"
              name="maxPlayers"
              value={formData.maxPlayers}
              onChange={handleChange}
              min="2"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="10"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-900">
              合言葉
            </label>
            <input
              type="text"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="あいことば123"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            大会を作成する
          </button>
        </form>
        <div className="mt-4 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:text-blue-800 transition-colors"
          >
            トップページに戻る
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGamePage;