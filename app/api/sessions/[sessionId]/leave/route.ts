// app/api/sessions/[sessionId]/leave/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import Pusher from 'pusher';
import { 
  GameSession, 
  APIRouteContext, 
  SessionRouteParams,
  LeaveSessionRequest,
  LeaveSessionResponse,
  APIError,
  ErrorCode,
  ERROR_MESSAGES
} from '@/types';

// Pusherインスタンス
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

export async function POST(
  request: NextRequest,
  context: APIRouteContext<SessionRouteParams>
) {
  try {
    // リクエストボディを取得
    const body: LeaveSessionRequest = await request.json();
    const { playerId } = body;
    
    // Authorizationヘッダーからトークンを取得
    const authHeader = request.headers.get('Authorization');
    const accessToken = authHeader?.replace('Bearer ', '');
    
    // paramsをawaitで取得（Next.js 15の新しい仕様）
    const params = await context.params;
    const { sessionId } = params;

    // バリデーション
    if (!playerId || !accessToken) {
      const errorResponse: APIError = {
        error: ERROR_MESSAGES[ErrorCode.VALIDATION_ERROR],
        code: ErrorCode.VALIDATION_ERROR,
        details: '必須パラメータが不足しています'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const db = await getDatabase();
    const collection = db.collection<GameSession>('sessions');

    // セッション情報を取得
    const session = await collection.findOne({ sessionId });

    if (!session) {
      const errorResponse: APIError = {
        error: ERROR_MESSAGES[ErrorCode.INVALID_SESSION],
        code: ErrorCode.INVALID_SESSION
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // アクセストークンの検証
    if (session.accessToken !== accessToken) {
      const errorResponse: APIError = {
        error: ERROR_MESSAGES[ErrorCode.INVALID_ACCESS_TOKEN],
        code: ErrorCode.INVALID_ACCESS_TOKEN
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    // プレイヤーの存在確認
    const playerExists = session.players.find(p => p.id === playerId);
    if (!playerExists) {
      const errorResponse: APIError = {
        error: ERROR_MESSAGES[ErrorCode.PLAYER_NOT_FOUND],
        code: ErrorCode.PLAYER_NOT_FOUND
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // プレイヤーを削除
    const result = await collection.findOneAndUpdate(
      { sessionId },
      { 
        $pull: { 
          players: { id: playerId }
        },
        $set: { updatedAt: new Date() }
      } as { $pull: { players: { id: string } }; $set: { updatedAt: Date } },
      { returnDocument: 'after' }
    );

    // Pusherで退出イベントを送信
    try {
      await pusher.trigger(
        `presence-session-${sessionId}`,
        'player-left',
        playerId
      );
      
      console.log(`Player left event sent: ${playerExists.name} (${playerId})`);
    } catch (pusherError) {
      console.error('Failed to send Pusher event:', pusherError);
      // Pusherエラーは無視して続行（退出自体は成功）
    }

    // 成功レスポンス
    const response: LeaveSessionResponse = {
      success: true,
      message: 'セッションから退出しました',
      session: result as GameSession | undefined
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Leave session error:', error);
    
    const errorResponse: APIError = {
      error: ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR],
      code: ErrorCode.INTERNAL_ERROR,
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}