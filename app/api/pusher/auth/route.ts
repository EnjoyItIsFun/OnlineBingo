// app/api/pusher/auth/route.ts
// Pusherプレゼンスチャンネル認証用APIルート（URLエンコード対応版）

import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';
import { getDatabase } from '@/lib/database';
import type { GameSession } from '@/types';

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

    // Content-Typeを最初に確認
    const contentType = req.headers.get('content-type') || '';
    
    let socket_id: string | null = null;
    let channel_name: string | null = null;
    let sessionId: string | null = null;
    let accessToken: string | null = null;
    let playerId: string | null = null;
    
    try {
      if (contentType.includes('application/x-www-form-urlencoded')) {
        // URLエンコードされたフォームデータの処理（Pusherクライアントから）
        const text = await req.text();
        const params = new URLSearchParams(text);
        
        socket_id = params.get('socket_id');
        channel_name = params.get('channel_name');
        sessionId = params.get('sessionId');
        accessToken = params.get('accessToken');
        playerId = params.get('playerId');
        
        console.log('Form-encoded data received:', {
          socket_id,
          channel_name,
          sessionId,
          playerId,
          hasAccessToken: !!accessToken
        });
      } else {
        // JSONデータの処理（testAuth関数など）
        const body = await req.json();
        socket_id = body.socket_id;
        channel_name = body.channel_name;
        sessionId = body.sessionId;
        accessToken = body.accessToken;
        playerId = body.playerId;
        
        console.log('JSON data received:', {
          socket_id,
          channel_name,
          sessionId,
          playerId,
          hasAccessToken: !!accessToken
        });
      }
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { 
          error: 'Invalid request format',
          details: 'Failed to parse request body'
        },
        { status: 400 }
      );
    }

    // 必須パラメータの検証
    if (!socket_id || !channel_name) {
      console.error('Missing required parameters:', { socket_id, channel_name });
      return NextResponse.json(
        { error: 'Missing socket_id or channel_name' },
        { status: 400 }
      );
    }

    if (!sessionId || !accessToken) {
      console.error('Missing authentication parameters:', { sessionId, accessToken });
      return NextResponse.json(
        { error: 'Missing authentication parameters' },
        { status: 401 }
      );
    }

    // チャンネル名の検証（presence-session-{sessionId}形式）
    const expectedChannelName = `presence-session-${sessionId}`;
    if (channel_name !== expectedChannelName) {
      console.error(`Invalid channel name: expected ${expectedChannelName}, got ${channel_name}`);
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
      console.error(`Session not found for sessionId: ${sessionId}`);
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
      console.log('Authenticating host:', { userId });
    } else if (playerId) {
      // プレイヤーの場合
      const player = session.players.find(p => p.id === playerId);
      if (!player) {
        console.error(`Player not found in session: ${playerId}`);
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
      console.log('Authenticating player:', { userId, name: player.name });
    } else {
      // playerIdが指定されていない場合（観戦者など）
      userId = `observer-${Date.now()}`;
      userInfo = {
        id: userId,
        name: 'Observer',
        role: 'observer' as const,
        isHost: false,
      };
      console.log('Authenticating observer:', { userId });
    }

    // Pusher認証レスポンスを生成（プレゼンスチャンネル用）
    const presenceData = {
      user_id: userId,
      user_info: userInfo,
    };
    
    // authorizeChannelメソッドを使用して認証
    const authResponse = pusher.authorizeChannel(socket_id, channel_name, presenceData);

    console.log('Pusher auth successful:', {
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
    console.error('Pusher auth error:', errorMessage);
    
    return NextResponse.json(
      { error: 'Authentication failed', details: errorMessage },
      { status: 500 }
    );
  }
}