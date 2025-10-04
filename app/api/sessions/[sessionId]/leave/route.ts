// app/api/sessions/[sessionId]/leave/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
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

export async function POST(
  request: NextRequest,
  context: APIRouteContext<SessionRouteParams>
) {
  try {
    // リクエストボディを取得（型定義使用）
    const body: LeaveSessionRequest = await request.json();
    const { playerId, accessToken } = body;
    
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
        } 
      } as { $pull: { players: { id: string } } },
      { returnDocument: 'after' }
    );

    // 成功レスポンス（型定義使用）
    const response: LeaveSessionResponse = {
      success: true,
      message: 'セッションから退出しました',
      session: result as GameSession | undefined
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Leave session error:', error);
    
    // エラーレスポンス（型定義使用）
    const errorResponse: APIError = {
      error: ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR],
      code: ErrorCode.INTERNAL_ERROR,
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}