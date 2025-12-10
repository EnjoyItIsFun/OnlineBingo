// app/guest/game/[sessionId]/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePusherConnection } from '@/hooks/usePusherConnection';
import { Trophy, Crown, Users } from 'lucide-react';
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

// ビンゴ・リーチ判定結果の型
interface BingoReachResult extends BingoCheckResult {
  reachCount: number;
  reachLines: string[];
}

// ビンゴ・リーチ判定関数
const checkBingoAndReach = (board: BingoCell[][]): BingoReachResult => {
  const bingoLines: string[] = [];
  const reachLines: string[] = [];
  let bingoCount = 0;
  let reachCount = 0;

  // ラインをチェックするヘルパー関数
  const checkLine = (cells: BingoCell[], lineName: string) => {
    const markedCount = cells.filter(cell => cell.marked || cell.number === 0).length;
    
    if (markedCount === 5) {
      // ビンゴ
      bingoLines.push(lineName);
      bingoCount++;
    } else if (markedCount === 4) {
      // リーチ（4つマーク済み、1つ未マーク）
      reachLines.push(lineName);
      reachCount++;
    }
  };

  // 横のチェック
  for (let row = 0; row < 5; row++) {
    checkLine(board[row], `横${row + 1}列目`);
  }

  // 縦のチェック
  for (let col = 0; col < 5; col++) {
    const columnCells = board.map(row => row[col]);
    checkLine(columnCells, `縦${col + 1}列目`);
  }

  // 斜め（左上から右下）
  const diagonal1 = board.map((row, i) => row[i]);
  checkLine(diagonal1, '斜め（＼）');

  // 斜め（右上から左下）
  const diagonal2 = board.map((row, i) => row[4 - i]);
  checkLine(diagonal2, '斜め（／）');

  return { 
    count: bingoCount, 
    lines: bingoLines, 
    newBingo: false,
    reachCount,
    reachLines
  };
};

// ランキング用プレイヤーカードコンポーネント
interface RankingPlayerCardProps {
  player: Player;
  rank: number;
  isCurrentPlayer: boolean;
}

const RankingPlayerCard: React.FC<RankingPlayerCardProps> = ({ player, rank, isCurrentPlayer }) => {
  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg ${isCurrentPlayer ? 'bg-yellow-400/30 border border-yellow-400/50' : 'bg-white/10'}`}>
      <div className={`
        w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
        ${rank === 1 ? 'bg-yellow-400 text-yellow-900' : 
          rank === 2 ? 'bg-gray-300 text-gray-700' : 
          rank === 3 ? 'bg-orange-400 text-orange-900' :
          'bg-white/30 text-white'}
      `}>
        {rank}
      </div>
      <span className={`text-sm truncate flex-1 ${isCurrentPlayer ? 'text-yellow-300 font-bold' : 'text-white'}`}>
        {player.name}
        {isCurrentPlayer && ' (あなた)'}
      </span>
      <div className="flex items-center gap-1 text-yellow-300 text-xs">
        <Trophy className="w-3 h-3" />
        <span>{player.bingoCount}</span>
      </div>
    </div>
  );
};

export default function GuestGamePage({ params, searchParams }: GuestGamePageProps) {
  const router = useRouter();
  
  // 状態管理（drawnNumbersとisExpiredを内部で管理）
  const [state, setState] = useState<GuestGameState & { drawnNumbers: number[]; isExpired: boolean }>({
    session: null,
    board: [],
    currentNumber: null,
    drawnNumbers: [],
    bingoLines: [],
    bingoCount: 0,
    showBingoAnimation: false,
    loading: true,
    error: null,
    playerName: '',
    isExpired: false
  });

  // リーチ・ビンゴ状態の管理
  const [reachCount, setReachCount] = useState(0);
  const [showReachAnimation, setShowReachAnimation] = useState(false);
  const hasReachedRef = useRef(false); // 初めてリーチになったかを追跡
  const hasBingodRef = useRef(false);  // 初めてビンゴになったかを追跡（演出用）

  const [resolvedParams, setResolvedParams] = useState<{ sessionId: string } | null>(null);
  const [resolvedSearchParams, setResolvedSearchParams] = useState<{ playerId?: string; token?: string }| null>(null);
  
  // メニュー状態: 'closed' | 'open' | 'confirming'
  const [menuState, setMenuState] = useState<'closed' | 'open' | 'confirming'>('closed');

  // ランキング表示/非表示
  const [showRanking, setShowRanking] = useState(false);

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

        // 404チェック（期限切れ判定）
        if (sessionRes.status === 404) {
          setState(prev => ({
            ...prev,
            error: 'セッションが見つかりません。制限時間（2時間）が経過してデータが削除された可能性があります。',
            loading: false,
            isExpired: true
          }));
          return;
        }

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
          error: null,
          isExpired: false
        }));

        // 初回のビンゴ・リーチチェック
        const result = checkBingoAndReach(initialBoard);
        setState(prev => ({
          ...prev,
          bingoLines: result.lines,
          bingoCount: result.count
        }));
        setReachCount(result.reachCount);
        
        // 既にリーチ状態なら、初回リーチフラグを立てる
        if (result.reachCount > 0) {
          hasReachedRef.current = true;
        }
        // 既にビンゴ状態なら、初回ビンゴフラグを立てる
        if (result.count > 0) {
          hasBingodRef.current = true;
        }
      } catch (error) {
        console.error('データ取得エラー:', error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'エラーが発生しました',
          loading: false,
          isExpired: false
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

        const result = checkBingoAndReach(newBoard);
        const isFirstBingo = !hasBingodRef.current && result.count > 0;
        const newReach = !hasReachedRef.current && result.reachCount > 0;

        // ビンゴ達成時の処理
        if (result.count > 0 && resolvedSearchParams?.playerId) {
          // 初回フラグを更新（演出制御用）
          if (isFirstBingo) {
            hasBingodRef.current = true;
          }
          
          // イベントは毎回送信（bingoCount更新のため）
          emit('bingo_achieved', {
            sessionId: resolvedParams?.sessionId || '',
            playerId: resolvedSearchParams.playerId,
            playerName: prev.playerName,
            bingoCount: result.count,
            lines: result.lines
          });
        }

        // 初めてリーチになった時の処理
        if (newReach && resolvedSearchParams?.playerId) {
          hasReachedRef.current = true;
          setShowReachAnimation(true);
          emit('reach_achieved', {
            sessionId: resolvedParams?.sessionId || '',
            playerId: resolvedSearchParams.playerId,
            playerName: prev.playerName,
            reachCount: result.reachCount,
            reachLines: result.reachLines
          });
        }

        setReachCount(result.reachCount);

        return {
          ...prev,
          board: newBoard,
          currentNumber: data.number,
          drawnNumbers: [...prev.drawnNumbers, data.number],
          bingoLines: result.lines,
          bingoCount: result.count,
          showBingoAnimation: isFirstBingo  // 演出は初回のみ
        };
      });
    };

    const handleGameReset = () => {
      console.log('ゲームがリセットされました');
      hasReachedRef.current = false;
      hasBingodRef.current = false;
      setReachCount(0);
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

  // リーチアニメーション制御
  useEffect(() => {
    if (showReachAnimation) {
      const timer = setTimeout(() => {
        setShowReachAnimation(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showReachAnimation]);

  // ランキング計算: ビンゴ達成者を最初にビンゴした順にソート
  const rankedPlayers = [...(state.session?.players || [])]
    .filter(p => p.bingoCount > 0 && p.bingoAchievedAt)
    .sort((a, b) => 
      new Date(a.bingoAchievedAt!).getTime() - new Date(b.bingoAchievedAt!).getTime()
    );

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
        <div className="bg-white/20 backdrop-blur-md rounded-lg p-8 border border-white/30 max-w-md mx-4">
          {state.isExpired ? (
            <>
              <div className="text-5xl text-center mb-4">⏰</div>
              <h2 className="text-xl font-bold text-white text-center mb-2">セッション期限切れ</h2>
              <p className="text-white/80 text-center mb-6">
                制限時間（2時間）が経過したため、ゲームデータが削除されました。
              </p>
            </>
          ) : (
            <p className="text-white text-xl mb-4 text-center">エラー: {state.error}</p>
          )}
          <button
            onClick={() => router.push('/')}
            className="w-full px-6 py-3 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors border border-white/30 font-semibold"
          >
            トップページへ戻る
          </button>
        </div>
      </div>
    );
  }

  // boardが初期化されていない場合のフォールバック
  if (!state.board || state.board.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-600">
        <div className="bg-white/20 backdrop-blur-md rounded-lg p-8 border border-white/30">
          <p className="text-white text-xl mb-4">ビンゴカードを準備中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-pink-600 p-4">
      {/* ビンゴアニメーション */}
      {state.showBingoAnimation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white/20 backdrop-blur-md rounded-2xl p-12 animate-bounce-in border border-white/30">
            <h2 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 animate-pulse">
              BINGO!!
            </h2>
            <p className="text-2xl text-white mt-4 text-center">{state.bingoCount}ライン達成！</p>
          </div>
        </div>
      )}

      {/* リーチアニメーション（ビンゴより控えめ） */}
      {showReachAnimation && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
          <div className="bg-gradient-to-r from-orange-400 to-pink-500 rounded-full px-8 py-3 shadow-lg border-2 border-white/50">
            <p className="text-2xl font-bold text-white text-center">
              🎯 リーチ！
            </p>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto">
        {/* ヘッダー */}
        <div className="bg-white/20 backdrop-blur-md rounded-lg shadow-xl p-4 mb-4 border border-white/30 relative">
          {/* 三点メニューボタン */}
          <div className="absolute top-2 right-2">
            <button
              onClick={() => setMenuState(prev => prev === 'closed' ? 'open' : 'closed')}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              aria-label="メニュー"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <circle cx="10" cy="4" r="2" />
                <circle cx="10" cy="10" r="2" />
                <circle cx="10" cy="16" r="2" />
              </svg>
            </button>
            
            {/* ドロップダウンメニュー */}
            {menuState !== 'closed' && (
              <div className="absolute top-10 right-0 bg-purple-900 rounded-lg shadow-xl border border-purple-400/50 overflow-hidden min-w-[180px] z-10">
                {menuState === 'open' ? (
                  <button
                    onClick={() => setMenuState('confirming')}
                    className="w-full px-4 py-3 text-left text-white hover:bg-purple-800 transition-colors text-sm"
                  >
                    ゲームを退出
                  </button>
                ) : (
                  <button
                    onClick={() => router.push('/')}
                    className="w-full px-4 py-3 text-left text-red-400 hover:bg-red-900/50 transition-colors text-sm font-medium"
                  >
                    本当に退出しますか？
                  </button>
                )}
              </div>
            )}
          </div>
          
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-400 mb-2 pr-8">
            {state.session?.gameName || 'ビンゴゲーム'}
          </h1>
          <div className="flex justify-between items-center">
            <p className="text-sm text-white/90">プレイヤー: {state.playerName}</p>
            <div className="text-right">
              <p className="text-xs text-white/70">{isConnected ? '✅ 接続中' : '❌ 切断'}</p>
              {state.bingoCount > 0 && (
                <p className="text-sm font-bold text-yellow-300">
                  {state.bingoCount}ビンゴ達成！
                </p>
              )}
              {state.bingoCount === 0 && reachCount > 0 && (
                <p className="text-sm font-bold text-orange-300">
                  {reachCount}リーチ！
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 現在の番号表示 */}
        {state.currentNumber && (
          <div className="bg-gradient-to-r from-yellow-300 to-yellow-500 rounded-lg shadow-xl p-4 mb-4 animate-slide-in border-2 border-yellow-600">
            <p className="text-center text-purple-800 text-sm mb-1">現在の番号</p>
            <p className="text-center text-5xl font-bold text-purple-900">
              {state.currentNumber}
            </p>
          </div>
        )}

        {/* ビンゴカード */}
        <div className="bg-white/20 backdrop-blur-md rounded-lg shadow-xl p-4 mb-4 border border-white/30">
          {/* B I N G O ヘッダー */}
          <div className="grid grid-cols-5 gap-2 mb-3">
            {['B', 'I', 'N', 'G', 'O'].map(letter => (
              <div 
                key={letter} 
                className="text-center font-extrabold text-xl p-1 text-transparent bg-clip-text bg-gradient-to-br from-yellow-200 to-yellow-400 drop-shadow-sm"
              >
                {letter}
              </div>
            ))}
          </div>
          
          {/* ビンゴ数字グリッド */}
          <div className="grid grid-cols-5 gap-2">
            {state.board.map((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`
                    aspect-square flex items-center justify-center
                    rounded-lg shadow-md transition-all
                    ${cell.number === 0
                      ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-purple-700 border-2 border-purple-600'
                      : cell.marked
                        ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-purple-700 border-2 border-purple-600 scale-95'
                        : 'bg-gradient-to-br from-purple-700 to-purple-900 text-pink-200 border border-pink-400/50 hover:brightness-110'}
                  `}
                >
                  <span className={`
                    font-bold drop-shadow-md
                    ${cell.number === 0 ? 'text-2xl' : 'text-lg'}
                  `}>
                    {cell.number === 0 ? '★' : cell.number}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ランキングセクション */}
        <div className="bg-white/20 backdrop-blur-md rounded-lg shadow-xl p-4 mb-4 border border-white/30">
          <button
            onClick={() => setShowRanking(!showRanking)}
            className="w-full flex items-center justify-between text-left"
          >
            <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-400 flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" />
              ビンゴ達成者
              {rankedPlayers.length > 0 && (
                <span className="text-sm text-yellow-300">({rankedPlayers.length}名)</span>
              )}
            </h3>
            <span className="text-white/70 text-sm">
              {showRanking ? '▲ 閉じる' : '▼ 開く'}
            </span>
          </button>
          
          {showRanking && (
            <div className="mt-3 space-y-2">
              {rankedPlayers.length > 0 ? (
                rankedPlayers.map((player, index) => (
                  <RankingPlayerCard
                    key={player.id}
                    player={player}
                    rank={index + 1}
                    isCurrentPlayer={player.id === resolvedSearchParams?.playerId}
                  />
                ))
              ) : (
                <p className="text-white/60 text-center py-2 text-sm">まだビンゴ達成者はいません</p>
              )}
            </div>
          )}
        </div>

        {/* 参加者数表示 */}
        <div className="bg-white/20 backdrop-blur-md rounded-lg shadow-xl p-3 mb-4 border border-white/30">
          <div className="flex items-center justify-center gap-2 text-white/80">
            <Users className="w-4 h-4" />
            <span className="text-sm">{state.session?.players.length || 0}名が参加中</span>
          </div>
        </div>
        {/* 履歴 */}
        <div className="bg-white/20 backdrop-blur-md rounded-lg shadow-xl p-4 border border-white/30">
          <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-400 mb-3">抽選履歴</h3>
          <div className="flex flex-wrap gap-2">
            {state.drawnNumbers && state.drawnNumbers.length > 0 ? (
              state.drawnNumbers.map(num => (
                <span
                  key={num}
                  className={`
                    px-2 py-1 rounded-full text-xs font-medium
                    ${num === state.currentNumber 
                      ? 'bg-gradient-to-r from-yellow-300 to-yellow-500 text-purple-800' 
                      : 'bg-white/30 text-white'}
                  `}
                >
                  {num}
                </span>
              ))
            ) : (
              <p className="text-white/70 text-sm">まだ番号が引かれていません</p>
            )}
          </div>
        </div>
      </div>

      {/* リーチアニメーション用のスタイル */}
      <style jsx>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translate(-50%, -100%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}