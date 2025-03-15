'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

type Player = {
  id: string;
  name: string;
};

const LoadingAnimation = () => (
  <div className="flex justify-center items-center mt-4">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400" />
    <p className="ml-3 text-white drop-shadow-sm">参加者の入室を待っています...</p>
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
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8 flex items-center justify-center">
      <div className="max-w-2xl mx-auto w-full">
        <div className="overflow-hidden rounded-xl shadow-2xl">
          {/* ヘッダー */}
          <div className="bg-gradient-to-r from-pink-500/70 to-orange-400/70 p-4 backdrop-blur-sm border-t border-l border-r border-white/20">
            <h1 className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-md">
              {gameInfo.gameName}
            </h1>
          </div>

          {/* メインコンテンツ */}
          <div className="bg-white/30 backdrop-blur-md p-8 space-y-8 border-b border-l border-r border-white/20">
            {/* 合言葉セクション */}
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 border border-white/30">
              <h2 className="text-lg font-semibold text-white drop-shadow-sm mb-3">
                参加者に共有する合言葉
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-white/20 backdrop-blur-sm border border-white/40 rounded-lg p-3 font-mono text-lg text-white">
                  {gameInfo.password}
                </div>
                <button
                  onClick={handleCopyPassword}
                  className="px-4 py-2 bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white font-bold rounded-lg shadow-lg transform transition hover:scale-105"
                >
                  コピー
                </button>
              </div>
            </div>

            {/* ローディングアニメーション */}
            <LoadingAnimation />

            {/* 参加者数表示 */}
            <div className="text-center mb-6">
              <p className="text-xl font-medium text-white drop-shadow-sm">
                参加者数: {players.length} / {gameInfo.maxPlayers}
              </p>
            </div>

            {/* 参加者リスト */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white drop-shadow-sm mb-4">
                参加者一覧
              </h2>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 space-y-2 border border-white/30">
                {players.map(player => (
                  <div
                    key={player.id}
                    className="bg-white/30 backdrop-blur-sm p-3 rounded-lg flex items-center justify-between border border-white/30"
                  >
                    <span className="text-white">{player.name}</span>
                    {player.id === '1' && (
                      <span className="text-sm text-yellow-300 font-medium">ホスト</span>
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
                className={`w-full py-3 rounded-lg font-medium transition-colors transform hover:scale-105 shadow-lg
                  ${players.length < 2 
                    ? 'bg-gray-500/50 cursor-not-allowed text-white/70' 
                    : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-red-800 font-bold'}`}
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
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800' 
                    : 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/30'}`}
              >
                {isConfirmingCancel 
                  ? '本当に大会をキャンセルしますか？' 
                  : '大会をキャンセルする'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaitingRoomPage;