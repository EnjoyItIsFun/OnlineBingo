// lib/socketContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Socket.ioのイベント型定義
 */
interface ServerToClientEvents {
  'session-updated': (data: {
    players: Array<{
      id: string;
      name: string;
      board: number[][];
      originalName?: string;
      nameAdjusted?: boolean;
      joinedAt: Date;
    }>;
    gameStatus: string;
    numbers: number[];
  }) => void;
  'player-joined': (data: {
    playerId: string;
    playerName: string;
  }) => void;
  'number-drawn': (data: {
    number: number;
    allNumbers: number[];
    timestamp: string;
  }) => void;
  'bingo-achieved': (data: {
    playerId: string;
    playerName: string;
    pattern: number[][];
  }) => void;
  'game-started': (data: {
    startedAt: Date;
  }) => void;
  'bingo-invalid': (data: {
    message: string;
  }) => void;
  'error': (data: {
    message: string;
  }) => void;
}

interface ClientToServerEvents {
  'join-session': (data: {
    sessionId: string;
    playerId?: string;
  }) => void;
  'draw-number': (data: {
    sessionId: string;
    number: number;
    hostId: string;
  }) => void;
  'declare-bingo': (data: {
    sessionId: string;
    playerId: string;
    bingoPattern: number[][];
  }) => void;
  'start-game': (data: {
    sessionId: string;
    hostId: string;
  }) => void;
}

/**
 * Socket.ioコンテキストの型
 */
interface SocketContextType {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;
  joinSession: (sessionId: string, playerId?: string) => void;
  drawNumber: (sessionId: string, number: number, hostId: string) => void;
  declareBingo: (sessionId: string, playerId: string, pattern: number[][]) => void;
  startGame: (sessionId: string, hostId: string) => void;
  lastDrawnNumber: number | null;
  allNumbers: number[];
  gameStarted: boolean;
}

// コンテキストの作成
const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  joinSession: () => {},
  drawNumber: () => {},
  declareBingo: () => {},
  startGame: () => {},
  lastDrawnNumber: null,
  allNumbers: [],
  gameStarted: false,
});

/**
 * Socket.ioプロバイダーコンポーネント
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastDrawnNumber, setLastDrawnNumber] = useState<number | null>(null);
  const [allNumbers, setAllNumbers] = useState<number[]>([]);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    // Socket.ioクライアントの初期化
    const socketInstance = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000',
      {
        // 自動再接続の設定
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      }
    );

    // 接続状態の管理
    socketInstance.on('connect', () => {
      console.log('✅ Socket.ioに接続しました');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('❌ Socket.ioから切断されました');
      setIsConnected(false);
    });

    // イベントリスナーの設定
    socketInstance.on('number-drawn', (data) => {
      console.log('🎰 新しい番号が引かれました:', data.number);
      setLastDrawnNumber(data.number);
      setAllNumbers(data.allNumbers);
    });

    socketInstance.on('game-started', (data) => {
      console.log('🎮 ゲームが開始されました:', data.startedAt);
      setGameStarted(true);
    });

    socketInstance.on('bingo-achieved', (data) => {
      console.log('🎉 ビンゴ達成！', data.playerName);
      // ここでトースト通知などを表示
    });

    socketInstance.on('error', (data) => {
      console.error('❌ エラー:', data.message);
      // エラー通知を表示
    });

    setSocket(socketInstance);

    // クリーンアップ
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // セッションに参加
  const joinSession = (sessionId: string, playerId?: string) => {
    if (socket) {
      socket.emit('join-session', { sessionId, playerId });
      console.log(`📌 セッション ${sessionId} に参加リクエスト送信`);
    }
  };

  // 番号を引く（ホスト用）
  const drawNumber = (sessionId: string, number: number, hostId: string) => {
    if (socket) {
      socket.emit('draw-number', { sessionId, number, hostId });
    }
  };

  // ビンゴ宣言
  const declareBingo = (sessionId: string, playerId: string, pattern: number[][]) => {
    if (socket) {
      socket.emit('declare-bingo', { sessionId, playerId, bingoPattern: pattern });
    }
  };

  // ゲーム開始（ホスト用）
  const startGame = (sessionId: string, hostId: string) => {
    if (socket) {
      socket.emit('start-game', { sessionId, hostId });
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinSession,
        drawNumber,
        declareBingo,
        startGame,
        lastDrawnNumber,
        allNumbers,
        gameStarted,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

/**
 * Socket.ioコンテキストを使用するカスタムフック
 */
export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}