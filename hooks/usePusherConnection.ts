// hooks/usePusherConnection.ts
// Pusher接続管理Hook（Socket.ioからの移行版）

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Pusher, { Channel, PresenceChannel } from 'pusher-js';
import { debugLog, errorLog } from '@/utils/validation';
import type { 
  RealtimeMemberInfo, 
  UsePusherConnectionReturn,
  RealtimeEventHandler 
} from '@/types';

// Pusherイベント名のマッピング（Socket.ioイベント名と互換性を保つ）
const EVENT_MAPPING = {
  // サーバー→クライアント
  game_started: 'game-started',
  number_drawn: 'number-drawn',
  player_joined: 'player-joined',
  player_left: 'player-left',
  session_updated: 'session-updated',
  connection_error: 'connection-error',
  player_bingo: 'player-bingo',
  
  // クライアント→サーバー（APIルート経由で送信）
  joinGame: 'client-join-game',
  start_game: 'client-start-game',
  draw_number: 'client-draw-number',
  reset_game: 'client-reset-game',
} as const;

// 再接続データを取得（ローカルストレージから）
const getReconnectionData = () => {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem('reconnectionData');
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

export const usePusherConnection = (sessionId: string | null): UsePusherConnectionReturn => {
  const [pusher, setPusher] = useState<Pusher | null>(null);
  const [channel, setChannel] = useState<Channel | PresenceChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [members, setMembers] = useState<Map<string, RealtimeMemberInfo>>(new Map());
  
  const pusherRef = useRef<Pusher | null>(null);
  const channelRef = useRef<Channel | PresenceChannel | null>(null);
  const eventHandlers = useRef<Map<string, Set<RealtimeEventHandler>>>(new Map());

  // Pusherイベントをクライアントから送信（APIルート経由）
  const emit = useCallback(async (eventName: string, data: Record<string, unknown>) => {
    if (!sessionId) {
      errorLog('Session ID is required for emit');
      return;
    }

    const reconnectionData = getReconnectionData();
    if (!reconnectionData || reconnectionData.sessionId !== sessionId) {
      errorLog('No valid authentication data found');
      return;
    }

    try {
      debugLog(`Emitting event via API: ${eventName}`, data);
      
      // APIルートを通じてPusherイベントをトリガー
      const response = await fetch('/api/pusher/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          accessToken: reconnectionData.accessToken,
          playerId: reconnectionData.playerId,
          eventName,
          data,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger event: ${response.statusText}`);
      }
      
      debugLog(`Event ${eventName} triggered successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      errorLog(`Failed to emit event ${eventName}: ${errorMessage}`);
    }
  }, [sessionId]);

  // イベントリスナー登録
  const on = useCallback((eventName: string, callback: RealtimeEventHandler) => {
    if (!channelRef.current) {
      debugLog(`Channel not ready, queuing listener for ${eventName}`);
    }

    // ハンドラーを保存
    if (!eventHandlers.current.has(eventName)) {
      eventHandlers.current.set(eventName, new Set());
    }
    eventHandlers.current.get(eventName)?.add(callback);

    // チャンネルが接続済みなら即座にバインド
    if (channelRef.current) {
      const pusherEventName = EVENT_MAPPING[eventName as keyof typeof EVENT_MAPPING] || eventName;
      channelRef.current.bind(pusherEventName, callback);
      debugLog(`Event listener bound: ${pusherEventName}`);
    }
  }, []);

  // イベントリスナー解除
  const off = useCallback((eventName: string, callback?: RealtimeEventHandler) => {
    const pusherEventName = EVENT_MAPPING[eventName as keyof typeof EVENT_MAPPING] || eventName;
    
    if (channelRef.current) {
      if (callback) {
        channelRef.current.unbind(pusherEventName, callback);
        eventHandlers.current.get(eventName)?.delete(callback);
      } else {
        channelRef.current.unbind(pusherEventName);
        eventHandlers.current.delete(eventName);
      }
      debugLog(`Event listener unbound: ${pusherEventName}`);
    }
  }, []);

  // Pusher接続
  const connect = useCallback(() => {
    if (!sessionId || pusherRef.current) return;

    setIsConnecting(true);
    debugLog('Connecting to Pusher...', { sessionId });

    const reconnectionData = getReconnectionData();
    if (!reconnectionData || reconnectionData.sessionId !== sessionId) {
      errorLog('No valid reconnection data found');
      setIsConnecting(false);
      return;
    }

    try {
      // Pusherクライアント初期化
      const pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
        
        // 認証エンドポイント（プライベートチャンネル用）
        authEndpoint: '/api/pusher/auth',
        auth: {
          headers: {
            'Content-Type': 'application/json',
          },
          params: {
            sessionId,
            accessToken: reconnectionData.accessToken,
            playerId: reconnectionData.playerId,
          },
        },
        
        // 接続オプション
        enabledTransports: ['ws', 'wss'],
        disabledTransports: ['xhr_polling', 'xhr_streaming'],
        forceTLS: true,
      });

      // 接続状態の監視
      pusherClient.connection.bind('state_change', (states: { previous: string; current: string }) => {
        debugLog(`Pusher state change: ${states.previous} -> ${states.current}`);
        
        if (states.current === 'connected') {
          setIsConnected(true);
          setIsConnecting(false);
          debugLog('Pusher connected successfully');
        } else if (states.current === 'disconnected') {
          setIsConnected(false);
          debugLog('Pusher disconnected');
        } else if (states.current === 'unavailable') {
          setIsConnected(false);
          setIsConnecting(false);
          errorLog('Pusher connection unavailable');
        }
      });

      // エラーハンドリング
      pusherClient.connection.bind('error', (err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errorLog(`Pusher connection error: ${errorMessage}`);
        setIsConnecting(false);
      });

      // プレゼンスチャンネルに購読（参加者の入退室を追跡）
      const channelName = `presence-session-${sessionId}`;
      const presenceChannel = pusherClient.subscribe(channelName) as PresenceChannel;

      // メンバー管理（プレゼンスチャンネル）
      interface PusherMembers {
        count: number;
        each: (callback: (member: { id: string; info: RealtimeMemberInfo }) => void) => void;
      }
      
      presenceChannel.bind('pusher:subscription_succeeded', (members: PusherMembers) => {
        debugLog(`Subscribed to channel: ${channelName}`, { memberCount: members.count });
        
        const memberMap = new Map<string, RealtimeMemberInfo>();
        members.each((member: { id: string; info: RealtimeMemberInfo }) => {
          memberMap.set(member.id, member.info);
        });
        setMembers(memberMap);
      });

      presenceChannel.bind('pusher:member_added', (member: { id: string; info: RealtimeMemberInfo }) => {
        debugLog('Member joined:', member);
        setMembers(prev => new Map(prev).set(member.id, member.info));
        
        // Socket.io互換のplayer_joinedイベントを発火
        const playerJoinedHandlers = eventHandlers.current.get('player_joined');
        if (playerJoinedHandlers) {
          playerJoinedHandlers.forEach(handler => handler(member.info));
        }
      });

      presenceChannel.bind('pusher:member_removed', (member: { id: string }) => {
        debugLog('Member left:', member);
        setMembers(prev => {
          const newMembers = new Map(prev);
          newMembers.delete(member.id);
          return newMembers;
        });
        
        // Socket.io互換のplayer_leftイベントを発火
        const playerLeftHandlers = eventHandlers.current.get('player_left');
        if (playerLeftHandlers) {
          playerLeftHandlers.forEach(handler => handler(member.id));
        }
      });

      // 保存済みのイベントハンドラーを再バインド
      eventHandlers.current.forEach((handlers, eventName) => {
        const pusherEventName = EVENT_MAPPING[eventName as keyof typeof EVENT_MAPPING] || eventName;
        handlers.forEach(handler => {
          presenceChannel.bind(pusherEventName, handler);
        });
        debugLog(`Re-bound ${handlers.size} handlers for event: ${pusherEventName}`);
      });

      pusherRef.current = pusherClient;
      channelRef.current = presenceChannel;
      setPusher(pusherClient);
      setChannel(presenceChannel);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      errorLog(`Failed to initialize Pusher: ${errorMessage}`);
      setIsConnecting(false);
    }
  }, [sessionId]);

  // 切断
  const disconnect = useCallback(() => {
    if (pusherRef.current) {
      debugLog('Disconnecting from Pusher...');
      
      // チャンネルの購読解除
      if (channelRef.current) {
        pusherRef.current.unsubscribe(channelRef.current.name);
        channelRef.current = null;
        setChannel(null);
      }
      
      // Pusher切断
      pusherRef.current.disconnect();
      pusherRef.current = null;
      setPusher(null);
      setIsConnected(false);
      setMembers(new Map());
    }
  }, []);

  // 再接続
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => connect(), 100);
  }, [connect, disconnect]);

  // 初回接続とクリーンアップ
  useEffect(() => {
    if (sessionId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [sessionId, connect, disconnect]);

  return {
    pusher,
    channel,
    isConnected,
    isConnecting,
    members,
    connect,
    disconnect,
    reconnect,
    emit,
    on,
    off,
  };
};