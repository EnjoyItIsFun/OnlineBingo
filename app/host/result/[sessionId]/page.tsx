"use client"

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Player, 
  GameSession, 
  GameStatistics,
  HostResultPageProps 
} from '@/types';

// メダルアイコンを返す関数
const getMedalIcon = (rank: number): string => {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return '🏅';
  }
};

// ゲーム時間をフォーマット
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}時間${minutes}分${secs}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${secs}秒`;
  } else {
    return `${secs}秒`;
  }
};

export default function HostResultPage({ params: paramsPromise, searchParams }: HostResultPageProps) {
  const router = useRouter();
  const params = use(paramsPromise); 
  const [session, setSession] = useState<GameSession | null>(null);
  const [statistics, setStatistics] = useState<GameStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // セッション情報の取得
  useEffect(() => {
    const fetchSession = async () => {
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

        // 統計情報を計算
        if (data.startedAt && data.finishedAt) {
          const duration = Math.floor(
            (new Date(data.finishedAt).getTime() - new Date(data.startedAt).getTime()) / 1000
          );

          const playersWithBingo = data.players.filter((p: Player) => p.bingoCount > 0).length;
          
          setStatistics({
            totalNumbers: data.numbers?.length || 0,
            duration,
            totalPlayers: data.players.length,
            completionRate: data.players.length > 0 
              ? Math.round((playersWithBingo / data.players.length) * 100)
              : 0
          });
        }

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
        setLoading(false);
      }
    };

    fetchSession();
  }, [params.sessionId, searchParams.token]);

  // ランキングを作成
  const getRanking = (): Player[] => {
    if (!session) return [];
    
    return [...session.players]
      .filter(p => p.bingoCount > 0)
      .sort((a, b) => {
        // ビンゴ数で降順ソート
        if (b.bingoCount !== a.bingoCount) {
          return b.bingoCount - a.bingoCount;
        }
        // 同じビンゴ数なら達成時刻で昇順ソート
        const timeA = a.bingoAchievedAt ? new Date(a.bingoAchievedAt).getTime() : Infinity;
        const timeB = b.bingoAchievedAt ? new Date(b.bingoAchievedAt).getTime() : Infinity;
        return timeA - timeB;
      });
  };

  // 結果をシェア用テキストとして生成
  const generateShareText = (): string => {
    const ranking = getRanking();
    let text = `🎉 ビンゴ大会「${session?.gameName}」結果発表！\n\n`;
    
    ranking.slice(0, 3).forEach((player, index) => {
      text += `${getMedalIcon(index + 1)} ${index + 1}位: ${player.name} (${player.bingoCount}列)\n`;
    });

    if (statistics) {
      text += `\n📊 ゲーム統計\n`;
      text += `・参加者: ${statistics.totalPlayers}名\n`;
      text += `・ゲーム時間: ${formatDuration(statistics.duration)}\n`;
      text += `・ビンゴ達成率: ${statistics.completionRate}%\n`;
    }

    return text;
  };

  // URLをコピー
  const copyResultUrl = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 flex items-center justify-center">
        <div className="text-white text-2xl">結果を集計中...</div>
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
            onClick={() => router.push('/host')}
            className="mt-4 w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3 rounded-lg shadow-lg"
          >
            ホーム画面に戻る
          </button>
        </div>
      </div>
    );
  }

  const ranking = getRanking();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">🎊 ゲーム終了！</h1>
          <p className="text-2xl text-yellow-300 drop-shadow-md">{session?.gameName}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ランキング */}
          <div className="lg:col-span-2">
            <div className="bg-white/30 backdrop-blur-md rounded-xl p-6 shadow-xl border border-white/20">
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 mb-6 drop-shadow-md">🏆 最終ランキング</h2>
              
              {ranking.length > 0 ? (
                <div className="space-y-3">
                  {ranking.map((player, index) => (
                    <div
                      key={player.id}
                      className={`
                        p-4 rounded-lg border-2 transition-all backdrop-blur-sm
                        ${index === 0 ? 'border-yellow-400 bg-yellow-300/30 transform scale-105' :
                          index === 1 ? 'border-gray-300 bg-gray-200/30' :
                          index === 2 ? 'border-orange-400 bg-orange-300/30' :
                          'border-white/30 bg-white/20'}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-3xl">{getMedalIcon(index + 1)}</span>
                          <div>
                            <p className="text-xl font-bold text-white drop-shadow-md">
                              {index + 1}位: {player.name}
                            </p>
                            <p className="text-sm text-white/90">
                              {player.bingoCount}列達成
                              {player.bingoAchievedAt && 
                                ` - ${new Date(player.bingoAchievedAt).toLocaleTimeString('ja-JP')}`
                              }
                            </p>
                          </div>
                        </div>
                        {index === 0 && (
                          <div className="text-3xl animate-bounce">👑</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-white">
                  <p className="text-xl">ビンゴ達成者はいませんでした</p>
                  <p className="mt-2">次回はもっと頑張りましょう！</p>
                </div>
              )}

              {/* 参加者一覧（ビンゴ未達成） */}
              {session && session.players.filter(p => p.bingoCount === 0).length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-white mb-3">参加者</h3>
                  <div className="flex flex-wrap gap-2">
                    {session.players
                      .filter(p => p.bingoCount === 0)
                      .map(player => (
                        <span
                          key={player.id}
                          className="px-3 py-1 bg-white/30 text-white rounded-full text-sm backdrop-blur-sm"
                        >
                          {player.name}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 統計情報 */}
          <div className="lg:col-span-1 space-y-6">
            {/* ゲーム統計 */}
            <div className="bg-white/30 backdrop-blur-md rounded-xl p-6 shadow-xl border border-white/20">
              <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 mb-4 drop-shadow-md">📊 ゲーム統計</h3>
              
              {statistics && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-white/80">参加人数</p>
                    <p className="text-2xl font-bold text-yellow-300 drop-shadow-md">
                      {statistics.totalPlayers}名
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-white/80">ゲーム時間</p>
                    <p className="text-2xl font-bold text-yellow-300 drop-shadow-md">
                      {formatDuration(statistics.duration)}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-white/80">引いた番号</p>
                    <p className="text-2xl font-bold text-yellow-300 drop-shadow-md">
                      {statistics.totalNumbers} / 75個
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-white/80">ビンゴ達成率</p>
                    <p className="text-2xl font-bold text-yellow-300 drop-shadow-md">
                      {statistics.completionRate}%
                    </p>
                    <div className="mt-2 bg-white/20 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-3 rounded-full transition-all"
                        style={{ width: `${statistics.completionRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* アクションボタン */}
            <div className="bg-white/30 backdrop-blur-md rounded-xl p-6 shadow-xl border border-white/20">
              <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 mb-4 drop-shadow-md">🎮 次のアクション</h3>
              
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/host/create')}
                  className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-red-800 font-bold py-3 rounded-lg shadow-lg transform transition hover:scale-105"
                >
                  新しいゲームを作成
                </button>
                
                <button
                  onClick={() => setShowShareModal(true)}
                  className="w-full bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white font-bold py-3 rounded-lg shadow-lg transform transition hover:scale-105"
                >
                  結果をシェア
                </button>
                
                <button
                  onClick={copyResultUrl}
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3 rounded-lg shadow-lg"
                >
                  {copiedUrl ? '✓ コピーしました' : 'URLをコピー'}
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
                className="w-full h-48 p-3 border-2 border-red-300 rounded-lg resize-none bg-white/50 backdrop-blur-sm"
                value={generateShareText()}
                readOnly
              />
              
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generateShareText());
                    setShowShareModal(false);
                  }}
                  className="flex-1 bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white font-bold py-2 rounded-lg shadow-lg"
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