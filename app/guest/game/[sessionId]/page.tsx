// app/guest/game/[sessionId]/page.tsx - TypeScriptエラー修正版
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePusherConnection } from '@/hooks/usePusherConnection';
import {
  BingoCell,
  Player,
  GuestGameState,
  BingoCheckResult,
  NumberDrawnEventData,
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
          throw new Error('セッションの取得に失敗しました');
        }

        const sessionData = await sessionRes.json();
        const currentPlayer = sessionData.players.find((p: Player) => p.id === resolvedSearchParams.playerId);

        if (currentPlayer && currentPlayer.board) {
          // ボードを2次元配列のBingoCell形式に変換
          const initialBoard: BingoCell[][] = currentPlayer.board.map((row: number[]) =>
            row.map((num: number) => ({
              number: num,
              marked: num === 0 || sessionData.drawnNumbers?.includes(num)
            }))
          );

          setState(prev => ({
            ...prev,
            session: sessionData,
            board: initialBoard,
            playerName: currentPlayer.name,
            drawnNumbers: sessionData.drawnNumbers || [],
            currentNumber: sessionData.currentNumber,
            loading: false
          }));

          // 初回のビンゴチェック
          const result = checkBingo(initialBoard);
          setState(prev => ({
            ...prev,
            bingoLines: result.lines,
            bingoCount: result.count
          }));
        }
      } catch (error) {
        console.error('データ取得エラー:', error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'エラーが発生しました',
          loading: false
        }));
      }
    };

    fetchData();
  }, [resolvedParams, resolvedSearchParams]);

  // Pusherイベントリスナー
  useEffect(() => {
    if (!isConnected) return;

    const handleNumberDrawn = (data: NumberDrawnEventData) => {
      console.log('番号が引かれました:', data);
      
      setState(prev => {
        const newBoard = prev.board.map(row =>
          row.map(cell => ({
            ...cell,
            marked: cell.marked || cell.number === data.number
          }))
        );

        const bingoResult = checkBingo(newBoard);
        const newBingo = bingoResult.count > prev.bingoCount;

        // ビンゴ達成時の処理
        if (newBingo && resolvedSearchParams?.playerId) {
          emit('bingo_achieved', {
            sessionId: resolvedParams?.sessionId || '',
            playerId: resolvedSearchParams.playerId,
            bingoCount: bingoResult.count,
            lines: bingoResult.lines
          });
        }

        return {
          ...prev,
          board: newBoard,
          currentNumber: data.number,
          drawnNumbers: [...prev.drawnNumbers, data.number],
          bingoLines: bingoResult.lines,
          bingoCount: bingoResult.count,
          showBingoAnimation: newBingo
        };
      });
    };

    const handleGameReset = () => {
      console.log('ゲームがリセットされました');
      setState(prev => ({
        ...prev,
        board: prev.board.map(row =>
          row.map(cell => ({
            ...cell,
            marked: cell.number === 0
          }))
        ),
        currentNumber: null,
        drawnNumbers: [],
        bingoLines: [],
        bingoCount: 0,
        showBingoAnimation: false
      }));
    };

    const handleSessionUpdated = (data: SessionUpdatedEventData) => {
      console.log('セッションが更新されました:', data);
      setState(prev => ({
        ...prev,
        session: data.session
      }));
    };

    const handleGameEnded = () => {
      console.log('ゲームが終了しました');
      router.push(`/guest/result/${resolvedParams?.sessionId}`);
    };

    // イベントリスナー登録
    on('number-drawn', handleNumberDrawn);
    on('game-reset', handleGameReset);
    on('session-updated', handleSessionUpdated);
    on('game-ended', handleGameEnded);

    return () => {
      off('number-drawn', handleNumberDrawn);
      off('game-reset', handleGameReset);
      off('session-updated', handleSessionUpdated);
      off('game-ended', handleGameEnded);
    };
  }, [isConnected, on, off, emit, router, resolvedParams, resolvedSearchParams]);

  // ビンゴアニメーション制御
  useEffect(() => {
    if (state.showBingoAnimation) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, showBingoAnimation: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state.showBingoAnimation]);

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-600">
        <div className="text-white text-2xl">読み込み中...</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-600">
        <div className="bg-white rounded-lg p-8">
          <p className="text-red-600 text-xl mb-4">エラー: {state.error}</p>
          <button
            onClick={() => router.push('/guest')}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            トップへ戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-pink-600 p-4">
      {/* ビンゴアニメーション */}
      {state.showBingoAnimation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-12 animate-bounce-in">
            <h2 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 animate-pulse">
              BINGO!!
            </h2>
            <p className="text-2xl text-gray-700 mt-4 text-center">{state.bingoCount}ライン達成！</p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {state.session?.gameName || 'ビンゴゲーム'}
          </h1>
          <div className="flex justify-between items-center">
            <p className="text-lg text-gray-600">プレイヤー: {state.playerName}</p>
            <div className="text-right">
              <p className="text-sm text-gray-500">接続状態: {isConnected ? '✅ 接続中' : '❌ 切断'}</p>
              {state.bingoCount > 0 && (
                <p className="text-lg font-bold text-purple-600">
                  {state.bingoCount}ビンゴ達成！
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 現在の番号表示 */}
        {state.currentNumber && (
          <div className="bg-yellow-400 rounded-lg shadow-xl p-6 mb-6 animate-slide-in">
            <p className="text-center text-gray-800 text-lg mb-2">現在の番号</p>
            <p className="text-center text-6xl font-bold text-gray-900">
              {getBingoLetter(state.currentNumber)}-{state.currentNumber}
            </p>
          </div>
        )}

        {/* ビンゴカード */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <table className="w-full">
            <thead>
              <tr>
                {['B', 'I', 'N', 'G', 'O'].map(letter => (
                  <th key={letter} className="text-2xl font-bold text-purple-600 p-2">
                    {letter}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.board.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, colIndex) => (
                    <td key={colIndex} className="p-2">
                      <div className={`
                        aspect-square flex items-center justify-center text-xl font-bold rounded-lg transition-all
                        ${cell.marked ? 'bg-purple-600 text-white scale-95' : 'bg-gray-100 text-gray-800'}
                        ${cell.number === 0 ? 'bg-yellow-400 text-gray-800' : ''}
                        hover:scale-105
                      `}>
                        {cell.number === 0 ? 'FREE' : cell.number}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 履歴 */}
        <div className="bg-white rounded-lg shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">抽選履歴</h3>
          <div className="flex flex-wrap gap-2">
            {state.drawnNumbers.map(num => (
              <span
                key={num}
                className={`
                  px-3 py-1 rounded-full text-sm font-medium
                  ${num === state.currentNumber ? 'bg-yellow-400 text-gray-800' : 'bg-gray-200 text-gray-700'}
                `}
              >
                {getBingoLetter(num)}-{num}
              </span>
            ))}
            {state.drawnNumbers.length === 0 && (
              <p className="text-gray-500">まだ番号が引かれていません</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}