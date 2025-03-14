'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Player = {
  id: string;
  name: string;
};

const LoadingAnimation = () => (
  <div className="flex justify-center items-center mt-4">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
    <p className="ml-3 text-gray-900">参加者の入室を待っています...</p>
  </div>
);

const WaitingRoomPage = () => {
  const router = useRouter();
  const [gameInfo] = useState({
    gameName: 'みんなでビンゴ！',
    password: 'あいことば123',
    maxPlayers: 10,
  });

  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: 'ホスト' },
  ]);

  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);

  const handleStartGame = () => {
    console.log('Game started');
    router.push('/made-game');
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(gameInfo.password)
      .then(() => {
        alert('合言葉をコピーしました！');
      })
      .catch(err => {
        console.error('コピーに失敗しました:', err);
      });
  };

  const handleCancelGame = () => {
    if (!isConfirmingCancel) {
      setIsConfirmingCancel(true);
      return;
    }
    // ここで大会をキャンセルする処理を実装
    console.log('Game cancelled');
    router.push('/'); // トップページに戻る
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-6">
            {gameInfo.gameName}
          </h1>

          {/* 合言葉セクション */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              参加者に共有する合言葉
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-white border rounded-lg p-3 font-mono text-lg text-gray-900">
                {gameInfo.password}
              </div>
              <button
                onClick={handleCopyPassword}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                コピー
              </button>
            </div>
          </div>

          {/* ローディングアニメーション */}
          <LoadingAnimation />

          {/* 参加者数表示 */}
          <div className="text-center mb-6">
            <p className="text-xl font-medium text-gray-900">
              参加者数: {players.length} / {gameInfo.maxPlayers}
            </p>
          </div>

          {/* 参加者リスト */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              参加者一覧
            </h2>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-gray-900">
              {players.map(player => (
                <div
                  key={player.id}
                  className="bg-white p-3 rounded-lg flex items-center justify-between"
                >
                  <span>{player.name}</span>
                  {player.id === '1' && (
                    <span className="text-sm text-blue-600 font-medium">ホスト</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ボタングループ */}
          <div className="space-y-4">
            <button
              onClick={handleStartGame}
              disabled={players.length < 2}
              className={`w-full py-3 rounded-lg font-medium transition-colors
                ${players.length < 2 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 text-white'}`}
            >
              {players.length < 2 
                ? '参加者が揃うまでお待ちください' 
                : 'ビンゴ大会を開始する'}
            </button>

            {/* キャンセルボタン */}
            <button
              onClick={handleCancelGame}
              className={`w-full py-2 rounded-lg font-medium transition-colors
                ${isConfirmingCancel 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {isConfirmingCancel 
                ? '本当に大会をキャンセルしますか？' 
                : '大会をキャンセルする'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaitingRoomPage;