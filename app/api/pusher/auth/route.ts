// app/api/pusher/auth/route.ts
// Pusherプレゼンスチャンネル認証用APIルート

import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';
import { getDatabase } from '@/lib/database';
import type { GameSession } from '@/types';
import { errorLog, debugLog } from '@/utils/validation';

// Pusherサーバーインスタンス
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { socket_id, channel_name } = body;

    // URLパラメータから認証情報を取得
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');
    const accessToken = url.searchParams.get('accessToken');
    const playerId = url.searchParams.get('playerId');

    debugLog('Pusher auth request', {
      channel_name,
      sessionId,
      playerId,
      hasAccessToken: !!accessToken
    });

    // 必須パラメータの検証
    if (!socket_id || !channel_name) {
      return NextResponse.json(
        { error: 'Missing socket_id or channel_name' },
        { status: 400 }
      );
    }

    if (!sessionId || !accessToken) {
      return NextResponse.json(
        { error: 'Missing authentication parameters' },
        { status: 401 }
      );
    }

    // チャンネル名の検証（presence-session-{sessionId}形式）
    const expectedChannelName = `presence-session-${sessionId}`;
    if (channel_name !== expectedChannelName) {
      return NextResponse.json(
        { error: 'Invalid channel name' },
        { status: 403 }
      );
    }

    // データベースでセッションを確認
    const db = await getDatabase();
    const session = await db.collection<GameSession>('sessions').findOne({
      sessionId,
      accessToken,
    });

    if (!session) {
      errorLog(`Session not found - Pusher auth failed for sessionId: ${sessionId}, channel: ${channel_name}`);
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
        role: 'host',
        isHost: true,
      };
    } else if (playerId) {
      // プレイヤーの場合
      const player = session.players.find(p => p.id === playerId);
      if (!player) {
        return NextResponse.json(
          { error: 'Player not found in session' },
          { status: 403 }
        );
      }
      
      userId = player.id;
      userInfo = {
        id: player.id,
        name: player.name,
        role: 'player',
        isHost: false,
        board: player.board,
        bingoCount: player.bingoCount || 0,
      };
    } else {
      // playerIdが指定されていない場合（観戦者など）
      userId = `observer-${Date.now()}`;
      userInfo = {
        id: userId,
        name: 'Observer',
        role: 'observer',
        isHost: false,
      };
    }

    // Pusher認証レスポンスを生成（プレゼンスチャンネル用）
    const presenceData = {
      user_id: userId,
      user_info: userInfo,
    };
    
    const auth = pusher.authorizeChannel(socket_id, channel_name, presenceData);

    debugLog('Pusher auth successful', {
      channel: channel_name,
      userId,
      role: userInfo.role
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

    return NextResponse.json(auth);

  } catch (error) {
    // エラーの型を適切に処理
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    errorLog(`Pusher auth error: ${errorMessage}`);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}