import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/database';
import { GameSession, APIError } from '@/types';
import { WithId } from 'mongodb';

//セッション情報取得API
// レスポンスヘッダーの共通設定
const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, max-age=0',
};

export async function GET(
  request: NextRequest,
  context : { params: { sessionId: string } }
) {
  try {
    const { sessionId } = context.params;
    
    // バリデーション
    if (!sessionId || !/^[A-Z0-9]{6}$/.test(sessionId)) {
      return NextResponse.json(
        { error: '無効なセッションIDです' } as APIError,
        { status: 400, headers }
      );
    }

    // データベースからセッション情報を取得
    const sessions = await getCollection<GameSession>('sessions');
    const session = await sessions.findOne({ sessionId });

    if (!session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' } as APIError,
        { status: 404, headers }
      );
    }

    // 期限切れチェック
    if (new Date(session.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'セッションの有効期限が切れています' } as APIError,
        { status: 410, headers }
      );
    }

    // MongoDBの_idフィールドを除外して返す
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...sessionData } = session as WithId<GameSession>;

    return NextResponse.json(sessionData, { status: 200, headers });

  } catch (error) {
    console.error('セッション取得エラー:', error);
    
    return NextResponse.json(
      { 
        error: 'セッション情報の取得に失敗しました',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      } as APIError,
      { status: 500, headers }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}