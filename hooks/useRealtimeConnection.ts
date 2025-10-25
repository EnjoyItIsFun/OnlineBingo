// hooks/useRealtimeConnection.ts
// Pusher専用のリアルタイム接続Hook
'use client';

import { useCallback } from 'react';
import { usePusherConnection } from './usePusherConnection';
import type { 
  GameSession, 
  Player,
  RealtimeEventHandler,
  RealtimeMemberInfo,
  UseRealtimeConnectionReturn
} from '@/types';

/**
 * リアルタイム接続用Hook
 * Pusherを使用したリアルタイム通信を提供
 * 
 * @param sessionId - セッションID（nullの場合は接続しない）
 * @returns リアルタイム接続のインターフェース
 */
export const useRealtimeConnection = (sessionId: string | null = null): UseRealtimeConnectionReturn => {
  // Pusher接続を使用
  const pusherConnection = usePusherConnection(sessionId);

  // 統一インターフェースの提供
  const isConnected = pusherConnection?.isConnected || false;
  const isConnecting = pusherConnection?.isConnecting || false;
  const members = (pusherConnection?.members || new Map()) as Map<string, RealtimeMemberInfo>;

  // イベント送信（Pusher APIルート経由）
  const emit = useCallback((eventName: string, data: Record<string, unknown>) => {
    if (pusherConnection) {
      return pusherConnection.emit(eventName, data);
    }
    return Promise.reject(new Error('No connection available'));
  }, [pusherConnection]);

  // イベントリスナー登録（ジェネリック対応）
  const on = useCallback(<T = unknown>(eventName: string, callback: RealtimeEventHandler<T>) => {
    if (pusherConnection) {
      pusherConnection.on<T>(eventName, callback);
    }
  }, [pusherConnection]);

  // イベントリスナー解除（ジェネリック対応）
  const off = useCallback(<T = unknown>(eventName: string, callback?: RealtimeEventHandler<T>) => {
    if (pusherConnection) {
      pusherConnection.off<T>(eventName, callback);
    }
  }, [pusherConnection]);

  // 再接続
  const reconnect = useCallback(() => {
    if (pusherConnection) {
      pusherConnection.reconnect();
    }
  }, [pusherConnection]);

  return {
    isConnected,
    isConnecting,
    connectionType: 'pusher',
    emit,
    on,
    off,
    reconnect,
    members,
  };
};

export const convertSocketEventNameToPusher = (socketEventName: string): string => {
  // アンダースコアをハイフンに変換
  return socketEventName.replace(/_/g, '-');
};

export const convertPusherEventData = (pusherData: unknown): unknown => {
  // Pusherのデータ構造をそのまま返す
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