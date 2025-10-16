// app/guest/game/[sessionId]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePusherConnection } from '@/hooks/usePusherConnection';
import {
  BingoCell,
  Player,
  GameSession,
  GuestGameState,
  BingoCheckResult,
  NumberDrawnEventData,
  GameStartedEventData,
  SessionUpdatedEventData
} from '@/types';

interface GuestGamePageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ playerId?: string; token?: string }>;
}

// BINGO文字を取得する関数
const getBingoLetter = (number: number): string => {
  if (number >= 1 && number <= 15) return 'B';
  if (number >= 16 && number <= 30) return 'I';
  if (number >= 31 && number <= 45) return 'N';
  if (number >= 46 && number <= 60) return 'G';
  if (number >= 61 && number <= 75) return 'O';
  return '';
};

// ビンゴ判定関数
const checkBingo = (board: BingoCell[][]): BingoCheckResult => {
  const lines: string[] = [];
  let count = 0;

  // 横のチェック
  for (let row = 0; row < 5; row++) {
    if (board[row].every(cell => cell.marked || cell.number === 0)) {
      lines.push(`横${row + 1}列目`);
      count++;
    }
  }

  // 縦のチェック
  for (let col = 0; col < 5; col++) {
    if (board.every(row => row[col].marked || row[col].number === 0)) {
      lines.push(`縦${col + 1}列目`);
      count++;
    }
  }

  // 斜め（左上から右下）
  if (board.every((row, i) => row[i].marked || row[i].number === 0)) {
    lines.push('斜め（＼）');
    count++;
  }

  // 斜め（右上から左下）
  if (board.every((row, i) => row[4 - i].marked || row[4 - i].number === 0)) {
    lines.push('斜め（／）');
    count++;
  }

  return { count, lines, newBingo: false };
};

export default function GuestGamePage({ params, searchParams }: GuestGamePageProps) {
  const router = useRouter();
  
  // 状態管理
  const [state, setState] = useState<GuestGameState>({
    session: null,
    board: [],
    currentNumber: null,
    drawnNumbers: [],
    bingoLines: [],
    bingoCount: 0,
    showBingoAnimation: false,
    loading: true,
    error: null,
    playerName: ''
  });

  const [resolvedParams, setResolvedParams] = useState<{ sessionId: string } | null>(null);
  const [resolvedSearchParams, setResolvedSearchParams] = useState<{ playerId?: string; token?: string } | null>(null);

  // Pusher接続
  const { isConnected, on, off, emit } = usePusherConnection(resolvedParams?.sessionId || null);

  // PromiseのparamsとsearchParamsを解決
  useEffect(() => {
    Promise.all([params, searchParams]).then(([p, sp]) => {
      setResolvedParams(p);
      setResolvedSearchParams(sp);
    });
  }, [params, searchParams]);

  // reconnectionDataをlocalStorageに保存
  useEffect(() => {
    if (resolvedParams?.sessionId && resolvedSearchParams?.token && resolvedSearchParams?.playerId) {
      localStorage.setItem('reconnectionData', JSON.stringify({
        sessionId: resolvedParams.sessionId,
        accessToken: resolvedSearchParams.token,
        playerId: resolvedSearchParams.playerId,
        role: 'player'
      }));
    }
  }, [resolvedParams, resolvedSearchParams]);

  // セッション情報とプレイヤー情報の取得
  useEffect(() => {
    if (!resolvedParams || !resolvedSearchParams) return;

    const fetchData = async () => {
      try {
        // セッション情報取得
        const sessionRes = await fetch(`/api/sessions/${resolvedParams.sessionId}`, {
          headers: {
            'Authorization': `Bearer ${resolvedSearchParams.token}`
          }
        });

        if (!sessionRes.ok) {
          throw new Error('セッション情報の取得に失敗しました');
        }

        const sessionData: GameSession = await sessionRes.json();
        
        // プレイヤー情報から自分のボードを取得
        const player = sessionData.players.find(
          (p: Player) => p.id === resolvedSearchParams.playerId
        );

        if (!player) {
          throw new Error('プレイヤー情報が見つかりません');
        }

        // ボードを初期化（マーク状態を含む）
        const initialBoard: BingoCell[][] = player.board.map((row: number[]) =>
          row.map((num: number) => ({
            number: num,
            marked: num === 0 || (sessionData.numbers || []).includes(num)
          }))
        );
        
        // 初期ビンゴチェック
        const { count, lines } = checkBingo(initialBoard);

        setState({
          session: sessionData,
          board: initialBoard,
          currentNumber: sessionData.currentNumber,
          drawnNumbers: sessionData.numbers || [],
          bingoLines: lines,
          bingoCount: count,
          showBingoAnimation: false,
          loading: false,
          error: null,
          playerName: player.name
        });

      } catch (err) {
        setState(prev => ({
          ...prev,
          error: err instanceof Error ? err.message : '予期しないエラーが発生しました',
          loading: false
        }));
      }
    };

    fetchData();
  }, [resolvedParams, resolvedSearchParams]);

  // Pusherイベントリスナー
  useEffect(() => {
    if (!resolvedParams || !resolvedSearchParams) return;

    // ゲーム開始
    const handleGameStarted = () => {
      setState(prev => ({
        ...prev,
        session: prev.session ? { ...prev.session, status: 'playing' } : null
      }));
    };

    // 番号が引かれた
    const handleNumberDrawn = (data: NumberDrawnEventData) => {
      setState(prev => {
        const newBoard = prev.board.map(row =>
          row.map(cell => ({
            ...cell,
            marked: cell.marked || cell.number === data.number
          }))
        );

        // ビンゴチェック
        const { count, lines } = checkBingo(newBoard);
        
        // 新しいビンゴが達成された場合
        const newBingo = count > prev.bingoCount;
        
        if (newBingo) {
          // サーバーに通知
          emit('bingo_achieved', {
            sessionId: resolvedParams.sessionId,
            playerId: resolvedSearchParams.playerId,
            bingoCount: count,
            lines
          });

          // アニメーションを3秒後に非表示
          setTimeout(() => {
            setState(s => ({ ...s, showBingoAnimation: false }));
          }, 3000);
        }

        return {
          ...prev,
          currentNumber: data.number,
          drawnNumbers: data.drawnNumbers,
          board: newBoard,
          bingoCount: count,
          bingoLines: lines,
          showBingoAnimation: newBingo
        };
      });
    };

    // セッション更新
    const handleSessionUpdated = (data: SessionUpdatedEventData) => {
      setState(prev => ({
        ...prev,
        session: data.session
      }));
    };

    // ゲーム終了
    const handleGameEnded = () => {
      setState(prev => ({
        ...prev,
        session: prev.session ? { ...prev.session, status: 'finished' } : null
      }));
    };

    // イベントリスナー登録
    on<GameStartedEventData>('game_started', handleGameStarted);
    on<NumberDrawnEventData>('number_drawn', handleNumberDrawn);
    on<SessionUpdatedEventData>('session_updated', handleSessionUpdated);
    on('game_ended', handleGameEnded);

    return () => {
      off<GameStartedEventData>('game_started', handleGameStarted);
      off<NumberDrawnEventData>('number_drawn', handleNumberDrawn);
      off<SessionUpdatedEventData>('session_updated', handleSessionUpdated);
      off('game_ended', handleGameEnded);
    };
  }, [resolvedParams, resolvedSearchParams, on, off, emit]);

  // ローディング画面
  if (state.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 flex items-center justify-center">
        <div className="text-white text-2xl">読み込み中...</div>
      </div>
    );
  }

  // エラー画面
  if (state.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">エラー</h2>
          <p className="text-gray-700">{state.error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 w-full bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white rounded-lg py-2"
          >
            トップページに戻る
          </button>
        </div>
      </div>
    );
  }

  // メインのゲーム画面
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="w-full overflow-hidden rounded-xl shadow-2xl mb-4">
          <div className="bg-gradient-to-r from-pink-500/70 to-orange-400/70 p-4 backdrop-blur-sm border-t border-l border-r border-white/20">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-md">
                  {state.session?.gameName}
                </h1>
                <p className="text-white/90 drop-shadow-sm">プレイヤー: {state.playerName}</p>
              </div>
              <div className="text-right">
                {state.bingoCount > 0 && (
                  <div className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full font-bold">
                    ビンゴ {state.bingoCount}列達成！
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* ビンゴカード */}
          <div className="lg:col-span-2">
            <div className="w-full overflow-hidden rounded-xl shadow-2xl">
              <div className="bg-gradient-to-r from-pink-500/70 to-orange-400/70 p-4 backdrop-blur-sm border-t border-l border-r border-white/20">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-md">
                  ビンゴカード
                </h2>
              </div>
              
              <div className="bg-white/30 backdrop-blur-md p-6 border-b border-l border-r border-white/20">
                <div className="mb-4 flex justify-center gap-4">
                  {['B', 'I', 'N', 'G', 'O'].map(letter => (
                    <div
                      key={letter}
                      className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-800 text-yellow-300 rounded-lg flex items-center justify-center text-2xl font-bold border border-yellow-400/50 drop-shadow-md"
                    >
                      {letter}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {state.board.map((row, rowIdx) =>
                    row.map((cell, colIdx) => (
                      <div
                        key={`${rowIdx}-${colIdx}`}
                        className={`
                          aspect-square rounded-lg font-bold text-xl transition-all flex items-center justify-center shadow-md
                          ${cell.number === 0 
                            ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-red-700 border-2 border-red-600' 
                            : cell.marked
                              ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-red-700 border-2 border-red-600'
                              : 'bg-gradient-to-br from-red-600 to-red-800 text-yellow-300 border border-yellow-400/50'
                          }
                          ${cell.number === state.currentNumber ? 'ring-4 ring-yellow-400 animate-pulse' : ''}
                        `}
                      >
                        {cell.number === 0 ? '★' : cell.number}
                      </div>
                    ))
                  )}
                </div>

                {/* ビンゴライン表示 */}
                {state.bingoLines.length > 0 && (
                  <div className="mt-4 p-3 bg-yellow-400/30 border-2 border-yellow-400 rounded-lg">
                    <p className="text-sm font-semibold text-yellow-900">
                      達成ライン: {state.bingoLines.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* サイドパネル */}
          <div className="lg:col-span-1">
            {/* 現在の番号 */}
            <div className="w-full overflow-hidden rounded-xl shadow-2xl mb-4">
              <div className="bg-gradient-to-r from-pink-500/70 to-orange-400/70 p-4 backdrop-blur-sm border-t border-l border-r border-white/20">
                <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-md">
                  現在の番号
                </h2>
              </div>
              
              <div className="bg-white/30 backdrop-blur-md p-6 border-b border-l border-r border-white/20">
                {state.currentNumber ? (
                  <div className="text-center">
                    <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-4 border-red-600 flex items-center justify-center shadow-xl mb-3">
                      <span className="text-5xl font-bold text-red-700 drop-shadow-md">
                        {state.currentNumber}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-gray-800">
                      {getBingoLetter(state.currentNumber)}-{state.currentNumber}
                    </div>
                    <div className="text-sm text-gray-700 mt-1">
                      {state.drawnNumbers.length}個目
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500">
                    まだ番号が引かれていません
                  </div>
                )}
              </div>
            </div>

            {/* 最近の番号 */}
            <div className="w-full overflow-hidden rounded-xl shadow-2xl">
              <div className="bg-gradient-to-r from-pink-500/70 to-orange-400/70 p-4 backdrop-blur-sm border-t border-l border-r border-white/20">
                <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-md">
                  既出番号（最新10個）
                </h2>
              </div>
              
              <div className="bg-white/30 backdrop-blur-md p-4 border-b border-l border-r border-white/20">
                <div className="space-y-2">
                  {state.drawnNumbers.slice(-10).reverse().map((num, idx) => (
                    <div
                      key={num}
                      className={`
                        flex items-center justify-between p-2 rounded transition-all
                        ${idx === 0 && num === state.currentNumber 
                          ? 'bg-yellow-400/50 border-2 border-yellow-400' 
                          : 'bg-white/40'
                        }
                      `}
                    >
                      <span className="font-semibold text-gray-800">
                        {getBingoLetter(num)}-{num}
                      </span>
                      {idx === 0 && num === state.currentNumber && (
                        <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded font-bold">
                          最新
                        </span>
                      )}
                    </div>
                  ))}
                  {state.drawnNumbers.length === 0 && (
                    <p className="text-gray-500 text-center text-sm">
                      まだ番号が引かれていません
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ビンゴアニメーション */}
        {state.showBingoAnimation && (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="bg-yellow-400 text-yellow-900 px-12 py-8 rounded-2xl shadow-2xl animate-bounce">
              <h1 className="text-6xl font-bold">BINGO!</h1>
              <p className="text-2xl text-center mt-2">{state.bingoCount}列達成！</p>
            </div>
          </div>
        )}

        {/* 接続状態 */}
        {!isConnected && (
          <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg">
            接続が切断されました。再接続中...
          </div>
        )}

        {/* ゲーム状態表示 */}
        {state.session?.status === 'waiting' && (
          <div className="fixed bottom-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
            ゲーム開始を待っています...
          </div>
        )}

        {/* ゲーム終了モーダル */}
        {state.session?.status === 'finished' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
            <div className="bg-white rounded-lg p-8 max-w-md">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">ゲーム終了！</h2>
              <p className="text-lg text-gray-600 mb-6">
                お疲れ様でした！
                {state.bingoCount > 0 && ` ${state.bingoCount}列のビンゴを達成しました！`}
              </p>
              <button
                onClick={() => router.push('/')}
                className="w-full bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white rounded-lg py-3 text-lg font-bold"
              >
                トップページへ戻る
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}