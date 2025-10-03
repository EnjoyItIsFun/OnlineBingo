// app/api/sessions/[sessionId]/leave/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { GameSession } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { playerId, accessToken } = await request.json();

    if (!playerId || !accessToken) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const collection = db.collection<GameSession>('sessions');

    // セッション情報を取得
    const session = await collection.findOne({
      sessionId: params.sessionId
    });

    if (!session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    // アクセストークンの検証
    if (session.hostId !== accessToken && !session.players.find(p => p.id === playerId)) {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 }
      );
    }

    // プレイヤーを削除
    const updatedSession = await collection.findOneAndUpdate(
      { sessionId: params.sessionId },
      { $pull: { players: { id: playerId } } },
      { returnDocument: 'after' }
    );

    return NextResponse.json({
      success: true,
      message: 'セッションから退出しました',
      session: updatedSession
    });

  } catch (error) {
    console.error('Leave session error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}