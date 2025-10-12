// app/api/pusher/auth/route.ts
// Pusherプレゼンスチャンネル認証用APIルート（修正版）

import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';
import { getDatabase } from '@/lib/database';
import type { GameSession } from '@/types';
import { errorLog, debugLog } from '@/utils/validation';

// Pusherサーバーインスタンスの初期化（環境変数チェック付き）
let pusher: Pusher;

try {
  // 環境変数の存在チェック
  if (!process.env.PUSHER_APP_ID || !process.env.PUSHER_KEY || 
      !process.env.PUSHER_SECRET || !process.env.PUSHER_CLUSTER) {
    throw new Error('Missing required Pusher environment variables');
  }

  pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true,
  });
} catch (error) {
  console.error('Failed to initialize Pusher:', error);
  // エラーを投げずに後で処理する
}

export async function POST(req: NextRequest) {
  try {
    // Pusherが初期化されているか確認
    if (!pusher) {
      console.error('Pusher is not initialized. Check environment variables.');
      return NextResponse.json(
        { 
          error: 'Server configuration error',
          details: 'Pusher service is not properly configured'
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { socket_id, channel_name } = body;
    
    // Pusherクライアントから送信される認証パラメータを取得
    // usePusherConnectionではauth.paramsとして送信されているが、
    // Pusherはこれらをbodyに含めて送信する
    const sessionId = body.sessionId;
    const accessToken = body.accessToken;
    const playerId = body.playerId;

    debugLog('Pusher auth request received', {
      channel_name,
      sessionId,
      playerId,
      hasAccessToken: !!accessToken,
      bodyKeys: Object.keys(body)
    });

    // 必須パラメータの検証
    if (!socket_id || !channel_name) {
      errorLog('Missing socket_id or channel_name in auth request');
      return NextResponse.json(
        { error: 'Missing socket_id or channel_name' },
        { status: 400 }
      );
    }

    if (!sessionId || !accessToken) {
      errorLog('Missing authentication parameters in auth request');
      return NextResponse.json(
        { error: 'Missing authentication parameters' },
        { status: 401 }
      );
    }

    // チャンネル名の検証（presence-session-{sessionId}形式）
    const expectedChannelName = `presence-session-${sessionId}`;
    if (channel_name !== expectedChannelName) {
      errorLog(`Invalid channel name: expected ${expectedChannelName}, got ${channel_name}`);
      return NextResponse.json(
        { error: 'Invalid channel name' },
        { status: 403 }
      );
    }

    // データベースでセッションを確認
    let db;
    try {
      db = await getDatabase();
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return NextResponse.json(
        { 
          error: 'Database connection error',
          details: 'Unable to connect to database'
        },
        { status: 500 }
      );
    }

    const session = await db.collection<GameSession>('sessions').findOne({
      sessionId,
      accessToken,
    });

    if (!session) {
      errorLog(`Session not found for sessionId: ${sessionId}`);
      return NextResponse.json(
        { error: 'Invalid session or access token' },
        { status: 401 }
      );
    }

    // ユーザー情報を準備
    let userInfo;
    let userId;

    if (playerId === session.hostId) {
      // ホストの場合
      userId = session.hostId;
      userInfo = {
        id: session.hostId,
        name: 'ホスト',
        role: 'host' as const,
        isHost: true,
      };
      debugLog('Authenticating host', { userId });
    } else if (playerId) {
      // プレイヤーの場合
      const player = session.players.find(p => p.id === playerId);
      if (!player) {
        errorLog(`Player not found in session: ${playerId}`);
        return NextResponse.json(
          { error: 'Player not found in session' },
          { status: 403 }
        );
      }
      
      userId = player.id;
      userInfo = {
        id: player.id,
        name: player.name,
        role: 'player' as const,
        isHost: false,
        board: player.board,
        bingoCount: player.bingoCount || 0,
      };
      debugLog('Authenticating player', { userId, name: player.name });
    } else {
      // playerIdが指定されていない場合（観戦者など）
      userId = `observer-${Date.now()}`;
      userInfo = {
        id: userId,
        name: 'Observer',
        role: 'observer' as const,
        isHost: false,
      };
      debugLog('Authenticating observer', { userId });
    }

    // Pusher認証レスポンスを生成（プレゼンスチャンネル用）
    const presenceData = {
      user_id: userId,
      user_info: userInfo,
    };
    
    // authorizeChannelメソッドを使用して認証
    const authResponse = pusher.authorizeChannel(socket_id, channel_name, presenceData);

    debugLog('Pusher auth successful', {
      channel: channel_name,
      userId,
      role: userInfo.role,
      authResponse: { 
        hasAuth: !!authResponse.auth,
        hasChannelData: !!authResponse.channel_data 
      }
    });

    // 認証成功時、最終アクティブ時刻を更新
    if (playerId && playerId !== session.hostId) {
      await db.collection<GameSession>('sessions').updateOne(
        { sessionId, 'players.id': playerId },
        { 
          $set: { 
            'players.$.lastActiveAt': new Date().toISOString(),
            'players.$.isConnected': true
          }
        }
      );
    }

    // 認証成功レスポンスを返す
    return NextResponse.json(authResponse);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    errorLog(`Pusher auth error: ${errorMessage}`);
    
    return NextResponse.json(
      { error: 'Authentication failed', details: errorMessage },
      { status: 500 }
    );
  }
}