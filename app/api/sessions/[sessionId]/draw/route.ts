// app/api/sessions/[sessionId]/draw/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';
import { getDatabase } from '@/lib/database';
import { errorLog } from '@/utils/validation';
import { APIRouteContext, SessionRouteParams, GameSession } from '@/types';

// Pusherインスタンス初期化
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true
});

// ビンゴレター取得（1-15: B, 16-30: I, 31-45: N, 46-60: G, 61-75: O）
function getBingoLetter(number: number): string {
  if (number <= 15) return 'B';
  if (number <= 30) return 'I';
  if (number <= 45) return 'N';
  if (number <= 60) return 'G';
  return 'O';
}

export async function POST(
  request: NextRequest,
  context: APIRouteContext<SessionRouteParams>
) {
  const startTime = Date.now();
  
  try {
    // パラメータ取得（Next.js 15の新しい方式）
    const params = await context.params;
    const { sessionId } = params;
    
    // リクエストボディ取得
    const body = await request.json();
    const { accessToken, hostId } = body;

    // バリデーション
    if (!sessionId || !accessToken || !hostId) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています' },
        { status: 400 }
      );
    }

    console.log('番号抽選リクエスト:', { sessionId, hostId });

    // データベース接続
    const db = await getDatabase();
    // GameSession型を部分的に使用（MongoDBのフィールドを考慮）
    const sessionsCollection = db.collection<GameSession>('sessions');

    // セッション取得と認証確認
    const session = await sessionsCollection.findOne({ 
      sessionId,
      accessToken 
    });

    if (!session) {
      errorLog('セッションが見つからないか、認証に失敗しました');
      return NextResponse.json(
        { error: 'セッションが見つからないか、認証に失敗しました' },
        { status: 404 }
      );
    }

    // ホスト権限確認
    if (session.hostId !== hostId) {
      errorLog('ホスト権限がありません');
      return NextResponse.json(
        { error: 'ホスト権限がありません' },
        { status: 403 }
      );
    }

    // ゲーム状態確認
    if (session.status !== 'playing') {
      return NextResponse.json(
        { error: 'ゲームが開始されていません' },
        { status: 400 }
      );
    }

    // 全ての番号が抽選済みかチェック
    const drawnNumbers = session.numbers || [];
    if (drawnNumbers.length >= 75) {
      return NextResponse.json(
        { error: '全ての番号が抽選済みです' },
        { status: 400 }
      );
    }

    // 未抽選の番号から1つ選択
    const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
    const availableNumbers = allNumbers.filter(n => !drawnNumbers.includes(n));
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const drawnNumber = availableNumbers[randomIndex];

    // データベース更新
    const updateResult = await sessionsCollection.updateOne(
      { sessionId },
      {
        $push: { numbers: drawnNumber },
        $set: { 
          currentNumber: drawnNumber,
          updatedAt: new Date()
        }
      }
    );

    if (updateResult.matchedCount === 0) {
      errorLog('セッションの更新に失敗しました');
      return NextResponse.json(
        { error: 'セッションの更新に失敗しました' },
        { status: 500 }
      );
    }

    // Pusherで全参加者にイベント送信
    try {
      const eventData = {
        number: drawnNumber,
        bingoLetter: getBingoLetter(drawnNumber),
        drawnNumbers: [...drawnNumbers, drawnNumber],
        drawnAt: new Date().toISOString()
      };

      console.log('Pusherイベント送信:', eventData);

      await pusher.trigger(
        `presence-session-${sessionId}`,
        'number-drawn',  // Pusher形式のイベント名
        eventData
      );

      console.log('番号抽選成功:', {
        sessionId,
        drawnNumber,
        totalDrawn: drawnNumbers.length + 1,
        responseTime: Date.now() - startTime
      });

      // 成功レスポンス
      return NextResponse.json({
        success: true,
        number: drawnNumber,
        bingoLetter: getBingoLetter(drawnNumber),
        drawnNumbers: [...drawnNumbers, drawnNumber],
        message: `番号 ${getBingoLetter(drawnNumber)}-${drawnNumber} が抽選されました`
      });

    } catch (pusherError) {
      // Pusherエラーでも番号は抽選済みなので、エラーログは残すが処理は続行
      errorLog(`Pusherイベント送信エラー: ${(pusherError as Error).message}`);
      console.error('Pusher error details:', pusherError);
      
      // クライアントには成功を返す（番号は抽選済みのため）
      return NextResponse.json({
        success: true,
        number: drawnNumber,
        bingoLetter: getBingoLetter(drawnNumber),
        drawnNumbers: [...drawnNumbers, drawnNumber],
        message: `番号 ${getBingoLetter(drawnNumber)}-${drawnNumber} が抽選されました`,
        warning: 'リアルタイム通知の送信に一部問題が発生しました'
      });
    }

  } catch (error) {
    errorLog(`番号抽選エラー: ${(error as Error).message}`);
    console.error('Draw number error:', error);
    
    return NextResponse.json(
      { 
        error: 'サーバーエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

// GETリクエストの処理（現在の抽選状態を取得）
export async function GET(
  request: NextRequest,
  context: APIRouteContext<SessionRouteParams>
) {
  try {
    const params = await context.params;
    const { sessionId } = params;

    // データベース接続
    const db = await getDatabase();
    const sessionsCollection = db.collection('sessions');

    // セッション取得
    const session = await sessionsCollection.findOne(
      { sessionId },
      { projection: { numbers: 1, currentNumber: 1, status: 1 } }
    );

    if (!session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      drawnNumbers: session.numbers || [],
      currentNumber: session.currentNumber || null,
      status: session.status,
      totalDrawn: (session.numbers || []).length
    });

  } catch (error) {
    errorLog(`抽選状態取得エラー: ${(error as Error).message}`);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}