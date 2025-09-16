"use client"

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import BingoCard from '../../../components/BingoCard';
import { 
  Player, 
  GameSession, 
  PersonalStats,
  BingoCell,
  GuestResultPageProps 
} from '@/types';

// メダルアイコンを返す関数
const getMedalIcon = (rank: number): string => {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return '';
  }
};

// 順位のテキストを返す関数
const getRankText = (rank: number, totalPlayers: number): string => {
  if (rank === 0) return '順位なし';
  
  const percentage = ((totalPlayers - rank + 1) / totalPlayers) * 100;
  
  if (percentage <= 10) return 'トップ10%！';
  if (percentage <= 30) return 'トップ30%！';
  if (percentage <= 50) return 'トップ50%！';
  return `${rank}位`;
};

// 励ましのメッセージを返す関数
const getEncouragementMessage = (stats: PersonalStats): string => {
  if (stats.rank === 1) {
    return '🎊 おめでとうございます！見事な優勝です！';
  } else if (stats.rank <= 3) {
    return '🎉 素晴らしい！入賞おめでとうございます！';
  } else if (stats.bingoCount > 0) {
    return '✨ ビンゴ達成おめでとうございます！';
  } else if (stats.markedCells >= 20) {
    return '👏 もう少しでビンゴでした！次回も頑張りましょう！';
  } else if (stats.markedCells >= 15) {
    return '💪 なかなか良い調子でした！次回に期待！';
  } else {
    return '😊 参加ありがとうございました！次回は運が向くかも！';
  }
};

export default function GuestResultPage({ params: paramsPromise, searchParams }: GuestResultPageProps) {
  const router = useRouter();
  const params = use(paramsPromise); 
  const [session, setSession] = useState<GameSession | null>(null);
  const [personalStats, setPersonalStats] = useState<PersonalStats | null>(null);
  const [boardCells, setBoardCells] = useState<BingoCell[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // セッション情報の取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/sessions/${params.sessionId}`, {
          headers: {
            'Authorization': `Bearer ${searchParams.token}`
          }
        });

        if (!res.ok) {
          throw new Error('セッション情報の取得に失敗しました');
        }

        const data = await res.json();
        setSession(data);

        // 自分のプレイヤー情報を取得
        const player = data.players.find((p: Player) => p.id === searchParams.playerId);
        
        if (!player) {
          throw new Error('プレイヤー情報が見つかりません');
        }

        // ボードの状態を設定
        if (player.board) {
          const cells = player.board.map((row: number[]) =>
            row.map((num: number) => ({
              number: num,
              marked: num === 0 || (data.numbers || []).includes(num)
            }))
          );
          setBoardCells(cells);
        }

        // ランキングと統計を計算
        const sortedPlayers = [...data.players]
          .filter((p: Player) => p.bingoCount > 0)
          .sort((a: Player, b: Player) => {
            if (b.bingoCount !== a.bingoCount) {
              return b.bingoCount - a.bingoCount;
            }
            const timeA = a.bingoAchievedAt ? new Date(a.bingoAchievedAt).getTime() : Infinity;
            const timeB = b.bingoAchievedAt ? new Date(b.bingoAchievedAt).getTime() : Infinity;
            return timeA - timeB;
          });

        const rank = player.bingoCount > 0 
          ? sortedPlayers.findIndex(p => p.id === player.id) + 1
          : 0;

        const markedCells = player.board 
          ? player.board.flat().filter((num: number) => 
              num === 0 || (data.numbers || []).includes(num)
            ).length
          : 0;

        const percentile = rank > 0 
          ? Math.round(((data.players.length - rank + 1) / data.players.length) * 100)
          : 0;

        setPersonalStats({
          rank,
          totalPlayers: data.players.length,
          bingoCount: player.bingoCount || 0,
          markedCells,
          percentile
        });

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
        setLoading(false);
      }
    };

    fetchData();
  }, [params.sessionId, searchParams.playerId, searchParams.token]);

  // シェア用テキストを生成
  const generateShareText = (): string => {
    let text = `🎯 ビンゴ大会「${session?.gameName}」に参加しました！\n\n`;
    
    if (personalStats) {
      if (personalStats.rank > 0) {
        text += `${getMedalIcon(personalStats.rank)} 結果: ${personalStats.rank}位 / ${personalStats.totalPlayers}人中\n`;
        text += `📊 ビンゴ: ${personalStats.bingoCount}列達成\n`;
      } else {
        text += `📊 マーク数: ${personalStats.markedCells}個\n`;
        text += `参加者: ${personalStats.totalPlayers}名\n`;
      }
    }
    
    text += '\n#オンラインビンゴ #ビンゴ大会';
    
    return text;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 flex items-center justify-center">
        <div className="text-white text-2xl drop-shadow-lg">結果を読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 flex items-center justify-center">
        <div className="bg-white/30 backdrop-blur-md rounded-xl p-8 max-w-md border border-white/20 shadow-xl">
          <h2 className="text-2xl font-bold text-red-700 mb-4">エラー</h2>
          <p className="text-gray-800">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3 rounded-lg shadow-lg"
          >
            トップページに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">ゲーム終了！</h1>
          <p className="text-xl text-yellow-300 drop-shadow-md">{session?.gameName}</p>
        </div>

        {/* 個人結果 */}
        {personalStats && personalStats.rank > 0 && personalStats.rank <= 3 && (
          <div className="mb-6 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-xl p-6 text-center animate-bounce border-4 border-red-600 shadow-xl">
            <div className="text-6xl mb-2">{getMedalIcon(personalStats.rank)}</div>
            <h2 className="text-3xl font-bold text-red-700">
              {personalStats.rank}位入賞！
            </h2>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* 左側：ビンゴカード */}
          <div>
            <div className="bg-white/30 backdrop-blur-md rounded-xl p-6 shadow-xl border border-white/20">
              <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 mb-4 text-center drop-shadow-md">
                あなたのビンゴカード
              </h2>
              
              <div className="flex justify-center">
                <BingoCard
                  board={boardCells}
                  isInteractive={false}
                  size="medium"
                  showNumbers={true}
                />
              </div>

              {/* 励ましのメッセージ */}
              {personalStats && (
                <div className="mt-6 p-4 bg-yellow-300/30 border-2 border-yellow-400 rounded-lg text-center backdrop-blur-sm">
                  <p className="text-lg font-semibold text-red-700">
                    {getEncouragementMessage(personalStats)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 右側：統計とランキング */}
          <div className="space-y-6">
            {/* 個人統計 */}
            <div className="bg-white/30 backdrop-blur-md rounded-xl p-6 shadow-xl border border-white/20">
              <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 mb-4 drop-shadow-md">📊 あなたの成績</h3>
              
              {personalStats && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-white/20 rounded-lg backdrop-blur-sm">
                    <p className="text-sm text-white/80">順位</p>
                    <p className="text-2xl font-bold text-yellow-300 drop-shadow-md">
                      {personalStats.rank > 0 ? (
                        <>
                          {getMedalIcon(personalStats.rank)} {personalStats.rank}位
                        </>
                      ) : (
                        '-'
                      )}
                    </p>
                    <p className="text-xs text-white/70">
                      {personalStats.totalPlayers}人中
                    </p>
                  </div>
                  
                  <div className="text-center p-4 bg-white/20 rounded-lg backdrop-blur-sm">
                    <p className="text-sm text-white/80">ビンゴ数</p>
                    <p className="text-2xl font-bold text-yellow-300 drop-shadow-md">
                      {personalStats.bingoCount}列
                    </p>
                    <p className="text-xs text-white/70">
                      {personalStats.bingoCount > 0 ? '達成！' : '未達成'}
                    </p>
                  </div>
                  
                  <div className="text-center p-4 bg-white/20 rounded-lg backdrop-blur-sm">
                    <p className="text-sm text-white/80">マーク数</p>
                    <p className="text-2xl font-bold text-yellow-300 drop-shadow-md">
                      {personalStats.markedCells}/25
                    </p>
                    <p className="text-xs text-white/70">
                      {Math.round((personalStats.markedCells / 25) * 100)}%
                    </p>
                  </div>
                  
                  <div className="text-center p-4 bg-white/20 rounded-lg backdrop-blur-sm">
                    <p className="text-sm text-white/80">上位</p>
                    <p className="text-2xl font-bold text-yellow-300 drop-shadow-md">
                      {personalStats.percentile > 0 ? `${personalStats.percentile}%` : '-'}
                    </p>
                    <p className="text-xs text-white/70">
                      {getRankText(personalStats.rank, personalStats.totalPlayers)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* トップ3ランキング */}
            <div className="bg-white/30 backdrop-blur-md rounded-xl p-6 shadow-xl border border-white/20">
              <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 mb-4 drop-shadow-md">🏆 トップ3</h3>
              
              {session && (
                <div className="space-y-3">
                  {session.players
                    .filter(p => p.bingoCount > 0)
                    .sort((a, b) => {
                      if (b.bingoCount !== a.bingoCount) {
                        return b.bingoCount - a.bingoCount;
                      }
                      const timeA = a.bingoAchievedAt ? new Date(a.bingoAchievedAt).getTime() : Infinity;
                      const timeB = b.bingoAchievedAt ? new Date(b.bingoAchievedAt).getTime() : Infinity;
                      return timeA - timeB;
                    })
                    .slice(0, 3)
                    .map((player, index) => (
                      <div
                        key={player.id}
                        className={`
                          p-3 rounded-lg flex items-center justify-between backdrop-blur-sm
                          ${player.id === searchParams.playerId 
                            ? 'bg-yellow-300/40 border-2 border-yellow-400' 
                            : 'bg-white/20 border border-white/30'}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getMedalIcon(index + 1)}</span>
                          <div>
                            <p className="font-semibold text-white drop-shadow-md">
                              {player.name}
                              {player.id === searchParams.playerId && (
                                <span className="ml-2 text-sm text-yellow-300">(あなた)</span>
                              )}
                            </p>
                            <p className="text-xs text-white/80">
                              {player.bingoCount}列達成
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  
                  {session.players.filter(p => p.bingoCount > 0).length === 0 && (
                    <p className="text-center text-white/80 py-4">
                      ビンゴ達成者はいませんでした
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* アクションボタン */}
            <div className="bg-white/30 backdrop-blur-md rounded-xl p-6 shadow-xl border border-white/20">
              <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 mb-4 drop-shadow-md">🎮 次のアクション</h3>
              
              <div className="space-y-3">
                <button
                  onClick={() => setShowShareModal(true)}
                  className="w-full bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white font-bold py-3 rounded-lg shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a9.001 9.001 0 01-7.432 0m9.032-4.026A9.001 9.001 0 0112 3c-4.474 0-8.268 3.12-9.032 7.326m0 4.026a9.001 9.001 0 009.032 4.026" />
                  </svg>
                  結果をシェア
                </button>
                
                <button
                  onClick={() => {
                    // スクリーンショット用の処理（ブラウザAPIを使用）
                    window.print();
                  }}
                  className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-red-800 font-bold py-3 rounded-lg shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  スクリーンショット
                </button>
                
                <button
                  onClick={() => router.push('/guest/join')}
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3 rounded-lg shadow-lg"
                >
                  別のゲームに参加
                </button>
                
                <button
                  onClick={() => router.push('/')}
                  className="w-full border-2 border-white/30 text-white rounded-lg py-3 font-semibold hover:bg-white/10 transition-colors backdrop-blur-sm"
                >
                  トップページへ
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* シェアモーダル */}
        {showShareModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 max-w-md w-full border border-white/20 shadow-xl">
              <h3 className="text-xl font-bold text-red-700 mb-4">結果をシェア</h3>
              
              <textarea
                className="w-full h-32 p-3 border-2 border-red-300 rounded-lg resize-none bg-white/50 backdrop-blur-sm"
                value={generateShareText()}
                readOnly
              />
              
              <div className="mt-4 grid grid-cols-2 gap-3">
                {/* Twitter/X シェア */}
                <button
                  onClick={() => {
                    const text = encodeURIComponent(generateShareText());
                    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
                    setShowShareModal(false);
                  }}
                  className="bg-black text-white rounded-lg py-2 font-semibold hover:bg-gray-800 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  Xでシェア
                </button>
                
                {/* LINE シェア */}
                <button
                  onClick={() => {
                    const text = encodeURIComponent(generateShareText());
                    window.open(`https://social-plugins.line.me/lineit/share?url=${window.location.href}&text=${text}`, '_blank');
                    setShowShareModal(false);
                  }}
                  className="bg-green-500 text-white rounded-lg py-2 font-semibold hover:bg-green-600 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                  </svg>
                  LINEでシェア
                </button>
              </div>
              
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generateShareText());
                    setShowShareModal(false);
                  }}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-2 rounded-lg shadow-lg"
                >
                  コピーして閉じる
                </button>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="flex-1 border-2 border-red-300 text-red-700 rounded-lg py-2 font-semibold hover:bg-red-50"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}