// hooks/useRealtimeConnection.ts
// Socket.io/Pusher自動切り替えアダプター
// 環境変数に基づいて適切な接続方式を選択

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSocketConnection } from './useSocketConnection';
import { usePusherConnection } from './usePusherConnection';
import type { 
  GameSession, 
  Player,
  ConnectionType,
  RealtimeEventHandler,
  RealtimeMemberInfo,
  UseRealtimeConnectionReturn
} from '@/types';

// 環境変数でどちらを使うか決定
const getConnectionType = (): ConnectionType => {
  // Vercel環境またはPUSHER_KEYが設定されている場合はPusherを使用
  if (process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.VERCEL) {
    return 'pusher';
  }
  return 'socket';
};

export const useRealtimeConnection = (sessionId: string | null = null): UseRealtimeConnectionReturn => {
  const [connectionType] = useState<ConnectionType>(getConnectionType());
  
  // Hooksは常に呼び出す（条件付きで使用しない）
  const socketConnection = useSocketConnection();
  const pusherConnection = usePusherConnection(sessionId);

  // 統一インターフェースの提供
  const isConnected = connectionType === 'socket' 
    ? socketConnection?.isConnected || false
    : pusherConnection?.isConnected || false;

  // isConnectingはPusherのみに存在するため、Socket.ioの場合はfalse
  const isConnecting = connectionType === 'pusher'
    ? pusherConnection?.isConnecting || false
    : false;

  const members = connectionType === 'pusher'
    ? (pusherConnection?.members || new Map()) as Map<string, RealtimeMemberInfo>
    : new Map<string, RealtimeMemberInfo>();

  // イベント送信（Socket.ioまたはPusher）
  const emit = useCallback((eventName: string, data: Record<string, unknown>) => {
    if (connectionType === 'socket' && socketConnection?.socket) {
      // Socket.ioの場合は直接emit
      socketConnection.socket.emit(eventName, data);
    } else if (connectionType === 'pusher' && pusherConnection) {
      // Pusherの場合はAPIルート経由
      return pusherConnection.emit(eventName, data);
    }
  }, [connectionType, socketConnection, pusherConnection]);

  // イベントリスナー登録
  const on = useCallback((eventName: string, callback: RealtimeEventHandler) => {
    if (connectionType === 'socket' && socketConnection?.socket) {
      socketConnection.socket.on(eventName, callback);
    } else if (connectionType === 'pusher' && pusherConnection) {
      pusherConnection.on(eventName, callback);
    }
  }, [connectionType, socketConnection, pusherConnection]);

  // イベントリスナー解除
  const off = useCallback((eventName: string, callback?: RealtimeEventHandler) => {
    if (connectionType === 'socket' && socketConnection?.socket) {
      if (callback) {
        socketConnection.socket.off(eventName, callback);
      } else {
        socketConnection.socket.off(eventName);
      }
    } else if (connectionType === 'pusher' && pusherConnection) {
      pusherConnection.off(eventName, callback);
    }
  }, [connectionType, socketConnection, pusherConnection]);

  // 再接続
  const reconnect = useCallback(() => {
    if (connectionType === 'socket' && socketConnection) {
      // Socket.ioのreconnect実装
      socketConnection.disconnect();
      setTimeout(() => {
        if (sessionId) {
          const storedAuth = localStorage.getItem('socketAuth');
          if (storedAuth) {
            try {
              const authData = JSON.parse(storedAuth);
              socketConnection.connect(authData);
            } catch (err) {
              console.error('Failed to parse stored auth:', err);
            }
          }
        }
      }, 100);
    } else if (connectionType === 'pusher' && pusherConnection) {
      pusherConnection.reconnect();
    }
  }, [connectionType, socketConnection, pusherConnection, sessionId]);

  // セッションIDが変更された場合の再接続
  useEffect(() => {
    if (sessionId && connectionType === 'socket' && socketConnection && !socketConnection.isConnected) {
      const storedAuth = localStorage.getItem('socketAuth');
      if (storedAuth) {
        try {
          const authData = JSON.parse(storedAuth);
          if (authData.sessionId === sessionId) {
            socketConnection.connect(authData);
          }
        } catch (err) {
          console.error('Failed to parse stored auth:', err);
        }
      }
    }
  }, [sessionId, connectionType, socketConnection]);

  // デバッグ情報の出力
  useEffect(() => {
    console.log(`🔌 Using ${connectionType.toUpperCase()} for realtime connection`);
    console.log(`📡 Connection status: ${isConnected ? 'Connected' : 'Disconnected'}`);
  }, [connectionType, isConnected]);

  return {
    isConnected,
    isConnecting,
    connectionType,
    emit,
    on,
    off,
    reconnect,
    members,
  };
};

// ========================================
// 移行用ヘルパー関数
// ========================================

/**
 * Socket.ioのイベント名をPusher互換に変換
 */
export const convertSocketEventNameToPusher = (socketEventName: string): string => {
  // アンダースコアをハイフンに変換
  return socketEventName.replace(/_/g, '-');
};

/**
 * PusherのイベントデータをSocket.io形式に変換
 */
export const convertPusherEventData = (pusherData: unknown): unknown => {
  // Pusherのデータ構造をSocket.io互換に変換
  if (pusherData && typeof pusherData === 'object') {
    const data = pusherData as Record<string, unknown>;
    
    // session_updatedイベントの場合
    if ('_id' in data && 'sessionId' in data) {
      return data as unknown as GameSession;
    }
    
    // player_joinedイベントの場合
    if ('id' in data && 'name' in data && 'board' in data) {
      return data as unknown as Player;
    }
    
    // number_drawnイベントの場合
    if ('number' in data && 'drawnNumbers' in data) {
      return {
        number: data.number,
        drawnNumbers: data.drawnNumbers,
        allNumbers: data.allNumbers || data.drawnNumbers,
      };
    }
  }
  
  return pusherData;
};

