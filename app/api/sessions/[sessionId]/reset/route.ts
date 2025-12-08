// app/api/sessions/[sessionId]/reset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { GameSession } from '@/types';
import { debugLog, errorLog } from '@/utils/validation';
import { generateBingoCard } from '@/utils/bingo';
import Pusher from 'pusher';

// Pusherクライアントの初期化
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const params = await context.params;
    const { sessionId } = params;

    const body = await request.json();
    const { hostId, accessToken } = body;

    debugLog(`Reset game request for session: ${sessionId}`);

    // 認証チェック
    if (!hostId || !accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // データベース接続
    const db = await getDatabase();
    
    // セッション取得
    const session = await db.collection<GameSession>('sessions').findOne({ 
      sessionId,
      accessToken 
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // ホスト権限チェック
    if (session.hostId !== hostId) {
      return NextResponse.json(
        { error: 'Only host can reset the game' },
        { status: 403 }
      );
    }

    // プレイヤーのビンゴカードを再生成
    const resetPlayers = session.players.map(player => ({
      ...player,
      board: generateBingoCard(),
      bingoCount: 0,
      bingoAchievedAt: undefined,
    }));

    // セッションをリセット（statusは'playing'を維持）
    const updateResult = await db.collection<GameSession>('sessions').updateOne(
      { sessionId },
      { 
        $set: { 
          status: 'playing' as const,
          numbers: [],
          currentNumber: null,
          players: resetPlayers,
          updatedAt: new Date()
        }
      }
    );

    if (!updateResult.acknowledged) {
      throw new Error('Failed to reset session in database');
    }

    // 更新後のセッションを取得
    const updatedSession = await db.collection<GameSession>('sessions').findOne({ 
      sessionId 
    });

    if (!updatedSession) {
      throw new Error('Failed to retrieve updated session');
    }

    // Pusherで全参加者に通知
    await pusher.trigger(
      `presence-session-${sessionId}`,
      'game-reset',
      {
        sessionId,
        session: updatedSession,
        resetAt: new Date().toISOString()
      }
    );

    // セッション更新イベントも送信
    await pusher.trigger(
      `presence-session-${sessionId}`,
      'session-updated',
      {
        session: updatedSession
      }
    );

    debugLog(`Game reset successfully for session: ${sessionId}`);

    return NextResponse.json({
      success: true,
      message: 'ゲームがリセットされました',
      session: updatedSession
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to reset game';
    errorLog(`Game reset error: ${errorMessage}`);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}