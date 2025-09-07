// hooks/useSocketConnection.ts
// Socket.io接続管理Hook

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Player, GameSession, AuthenticationData } from '@/types';

interface SocketEvents {
  'player_joined': (player: Player) => void;
  'player_left': (playerId: string) => void;
  'game_started': (session: GameSession) => void;
  'game_ended': (session: GameSession) => void;
  'session_updated': (session: GameSession) => void;
  'connection_error': (error: string) => void;
  'reconnect_success': () => void;
}

interface UseSocketConnectionReturn {
  socket: Socket | null;
  isConnected: boolean;
  error: string | null;
  connect: (authData: AuthenticationData) => void;
  disconnect: () => void;
  on: <K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => void;
  off: <K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => void;
  emit: (event: string, data?: Record<string, unknown>) => void;
}

export const useSocketConnection = (): UseSocketConnectionReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback((authData: AuthenticationData) => {
    if (socketRef.current?.connected) {
      console.warn('Socket already connected');
      return;
    }

    try {
      const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        auth: {
          sessionId: authData.sessionId,
          accessToken: authData.accessToken,
          userId: authData.userId,
          role: authData.role || 'player'
        },
        forceNew: true
      });

      // 接続成功
      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        setIsConnected(true);
        setError(null);
        
        // LocalStorageに接続情報を保存（再接続用）
        if (typeof window !== 'undefined') {
          localStorage.setItem('socketAuth', JSON.stringify(authData));
        }
      });

      // 接続エラー
      newSocket.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
        setError('接続に失敗しました。ネットワークを確認してください。');
        setIsConnected(false);
      });

      // 認証エラー
      newSocket.on('auth_error', (err) => {
        console.error('Socket auth error:', err);
        setError('認証に失敗しました。セッション情報を確認してください。');
        setIsConnected(false);
      });

      // 切断
      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect') {
          setError('サーバーから切断されました');
        }
      });

      // 再接続試行
      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`Reconnection attempt ${attemptNumber}`);
        setError('再接続中...');
      });

      // 再接続成功
      newSocket.on('reconnect', () => {
        console.log('Socket reconnected');
        setIsConnected(true);
        setError(null);
      });

      socketRef.current = newSocket;
      setSocket(newSocket);
    } catch (err) {
      console.error('Socket connection setup error:', err);
      setError('接続の初期化に失敗しました');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setError(null);
      
      // LocalStorageの接続情報をクリア
      if (typeof window !== 'undefined') {
        localStorage.removeItem('socketAuth');
      }
    }
  }, []);

  const on = useCallback(<K extends keyof SocketEvents>(
    event: K, 
    handler: SocketEvents[K]
  ) => {
    if (socketRef.current) {
      socketRef.current.on(event as string, handler as (...args: unknown[]) => void);
    }
  }, []);

  const off = useCallback(<K extends keyof SocketEvents>(
    event: K, 
    handler: SocketEvents[K]
  ) => {
    if (socketRef.current) {
      socketRef.current.off(event as string, handler as (...args: unknown[]) => void);
    }
  }, []);

  const emit = useCallback((event: string, data?: Record<string, unknown>) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit event:', event);
    }
  }, []);

  // 自動再接続の実装
  useEffect(() => {
    const handleReconnect = () => {
      if (typeof window !== 'undefined') {
        const savedAuth = localStorage.getItem('socketAuth');
        if (savedAuth && !socketRef.current?.connected) {
          try {
            const authData = JSON.parse(savedAuth);
            connect(authData);
          } catch (err) {
            console.error('Failed to parse saved auth data:', err);
            localStorage.removeItem('socketAuth');
          }
        }
      }
    };

    // ページフォーカス時の再接続
    window.addEventListener('focus', handleReconnect);
    
    return () => {
      window.removeEventListener('focus', handleReconnect);
    };
  }, [connect]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    socket,
    isConnected,
    error,
    connect,
    disconnect,
    on,
    off,
    emit
  };
};