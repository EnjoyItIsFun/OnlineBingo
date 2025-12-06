// app/guest/game/[sessionId]/page.tsx - 完全修正版
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
  SessionUpdatedEventData,
  GameSession
} from '@/types';

interface GuestGamePageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ playerId?: string; token?: string; accessToken?: string }>;
}

// APIレスポンス用の拡張型
interface SessionDataFromAPI extends Omit<GameSession, 'createdAt' | 'expiresAt'> {
  drawnNumbers?: number[] | false | null;
  createdAt: string;
  expiresAt: string;
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
  
  // 状態管理（drawnNumbersを内部で管理）
  const [state, setState] = useState<GuestGameState & { drawnNumbers: number[] }>({
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
  const [resolvedSearchParams, setResolvedSearchParams] = useState<{ playerId?: string; token?: string }| null>(null);

  // Pusher接続
  const { isConnected, on, off, emit } = usePusherConnection(resolvedParams?.sessionId || null);

  // PromiseのparamsとsearchParamsを解決
  useEffect(() => {
    Promise.all([params, searchParams]).then(([p, sp]) => {
      console.log('Resolved params:', p, sp);
      setResolvedParams(p);
      // tokenパラメータまたはaccessTokenパラメータを受け入れる
      const searchParams = {
        playerId: sp.playerId,
        token: sp.token || sp.accessToken
      };
      setResolvedSearchParams(searchParams);
    });
  }, [params, searchParams]);

  // セッション情報とプレイヤー情報の取得
  useEffect(() => {
    if (!resolvedParams || !resolvedSearchParams) return;

    const fetchData = async () => {
      try {
        console.log('Fetching session data...');
        console.log('SessionId:', resolvedParams.sessionId);
        console.log('Token:', resolvedSearchParams.token);
        console.log('PlayerId:', resolvedSearchParams.playerId);
        
        // セッション情報取得
        const sessionRes = await fetch(`/api/sessions/${resolvedParams.sessionId}`, {
          headers: {
            'Authorization': `Bearer ${resolvedSearchParams.token}`
          }
        });

        if (!sessionRes.ok) {
          throw new Error('セッションの取得に失敗しました');
        }

        const sessionData: SessionDataFromAPI = await sessionRes.json();
        console.log('Session data received:', sessionData);

        // データ構造を確認してから安全にアクセス
        if (!sessionData.players || !Array.isArray(sessionData.players)) {
          console.error('Invalid session data: players array not found', sessionData);
          throw new Error('セッションデータが不正です');
        }

        const currentPlayer = sessionData.players.find((p: Player) => p.id === resolvedSearchParams.playerId);
        
        if (!currentPlayer) {
          console.error('Player not found in session:', resolvedSearchParams.playerId);
          console.error('Available players:', sessionData.players.map((p: Player) => ({ id: p.id, name: p.name })));
          throw new Error('プレイヤーが見つかりません');
        }

        if (!currentPlayer.board || !Array.isArray(currentPlayer.board)) {
          console.error('Invalid player data: board not found', currentPlayer);
          throw new Error('ビンゴカードが見つかりません');
        }

        // drawnNumbersまたはnumbersの互換性処理
        let drawnNumbers: number[] = [];
        if (Array.isArray(sessionData.drawnNumbers)) {
          drawnNumbers = sessionData.drawnNumbers;
        } else if (Array.isArray(sessionData.numbers)) {
          drawnNumbers = sessionData.numbers;
        } else if (sessionData.drawnNumbers === false || sessionData.drawnNumbers === null || sessionData.drawnNumbers === undefined) {
          drawnNumbers = [];
          console.log('drawnNumbers is not an array, using empty array');
        } else {
          console.warn('Unexpected drawnNumbers/numbers format:', sessionData.drawnNumbers);
        }

        // ボードを2次元配列のBingoCell形式に変換
        const initialBoard: BingoCell[][] = currentPlayer.board.map((row: number[]) =>
          row.map((num: number) => ({
            number: num,
            marked: num === 0 || drawnNumbers.includes(num)
          }))
        );

        // GameSession型に変換
        const session: GameSession = {
          ...sessionData,
          createdAt: new Date(sessionData.createdAt),
          expiresAt: new Date(sessionData.expiresAt),
          numbers: drawnNumbers
        };

        setState(prev => ({
          ...prev,
          session: session,
          board: initialBoard,
          playerName: currentPlayer.name,
          drawnNumbers: drawnNumbers,
          currentNumber: sessionData.currentNumber || null,
          loading: false,
          error: null
        }));

        // 初回のビンゴチェック
        const result = checkBingo(initialBoard);
        setState(prev => ({
          ...prev,
          bingoLines: result.lines,
          bingoCount: result.count
        }));
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
        // boardが空の場合は何もしない
        if (!prev.board || prev.board.length === 0) {
          console.error('Board is not initialized');
          return prev;
        }

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
      setState(prev => {
        // boardが空の場合は何もしない
        if (!prev.board || prev.board.length === 0) {
          return prev;
        }

        return {
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
        };
      });
    };

    const handleSessionUpdated = (data: SessionUpdatedEventData) => {
      console.log('セッションが更新されました:', data);
      
      setState(prev => {
        // 更新されたセッションデータの構造を確認
        if (!data.session || !data.session.players || !Array.isArray(data.session.players)) {
          console.error('Invalid session update data:', data);
          return prev;
        }

        // 更新データからdrawnNumbersまたはnumbersを取得
        let drawnNumbers = prev.drawnNumbers;
        
        // 型安全な方法でdrawnNumbersをチェック
        interface SessionWithDrawnNumbers extends GameSession {
          drawnNumbers?: number[] | false | null;
        }
        
        const sessionWithDraw = data.session as SessionWithDrawnNumbers;
        
        if (Array.isArray(sessionWithDraw.drawnNumbers)) {
          drawnNumbers = sessionWithDraw.drawnNumbers;
        } else if (Array.isArray(data.session.numbers)) {
          drawnNumbers = data.session.numbers;
        }

        return {
          ...prev,
          session: data.session,
          drawnNumbers: drawnNumbers
        };
      });
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
            onClick={() => router.push('/guest/join')}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            参加画面へ戻る
          </button>
        </div>
      </div>
    );
  }

  // boardが初期化されていない場合のフォールバック
  if (!state.board || state.board.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-600">
        <div className="bg-white rounded-lg p-8">
          <p className="text-gray-600 text-xl mb-4">ビンゴカードを準備中...</p>
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
            {state.drawnNumbers && state.drawnNumbers.length > 0 ? (
              state.drawnNumbers.map(num => (
                <span
                  key={num}
                  className={`
                    px-3 py-1 rounded-full text-sm font-medium
                    ${num === state.currentNumber ? 'bg-yellow-400 text-gray-800' : 'bg-gray-200 text-gray-700'}
                  `}
                >
                  {getBingoLetter(num)}-{num}
                </span>
              ))
            ) : (
              <p className="text-gray-500">まだ番号が引かれていません</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}