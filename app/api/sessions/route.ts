import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getCollection } from '@/lib/database';
import { 
  GameSession, 
  CreateSessionRequest, 
  CreateSessionResponse, 
  APIError,
  SessionStatus
} from '@/types';

/**
 * セッション作成API
 * POST /api/sessions
 * 
 * セキュリティのポイント：
 * - セッションIDとアクセストークンは暗号学的に安全な乱数を使用
 * - 重複チェックを行い、衝突を防ぐ
 * - Rate Limitingにより、悪意のある大量作成を防ぐ
 */

// レスポンスヘッダー
const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

/**
 * セッションIDを生成（6桁の英数字大文字）
 */
function generateSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let sessionId = '';
  const randomValues = randomBytes(6);
  
  for (let i = 0; i < 6; i++) {
    sessionId += chars[randomValues[i] % chars.length];
  }
  
  return sessionId;
}

/**
 * アクセストークンを生成（8桁の英数字大文字）
 * 
 * 歴史的背景：
 * - 以前は、単純なパスワードやPINコードが使われていました
 * - 現在は、予測困難な乱数トークンを使用することで
 *   セキュリティを向上させています
 */
function generateAccessToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  const randomValues = randomBytes(8);
  
  for (let i = 0; i < 8; i++) {
    token += chars[randomValues[i] % chars.length];
  }
  
  return token;
}

/**
 * POSTリクエスト処理
 * 新しいゲームセッションを作成
 */
export async function POST(request: NextRequest) {
  try {
    // リクエストボディの解析
    const body = await request.json() as CreateSessionRequest;
    
    // バリデーション
    if (!body.gameName || body.gameName.trim().length === 0) {
      return NextResponse.json(
        { error: 'ゲーム名を入力してください' } as APIError,
        { status: 400, headers }
      );
    }
    
    if (body.gameName.length > 50) {
      return NextResponse.json(
        { error: 'ゲーム名は50文字以内で入力してください' } as APIError,
        { status: 400, headers }
      );
    }
    
    const maxPlayers = body.maxPlayers || 25;
    if (maxPlayers < 2 || maxPlayers > 99) {
      return NextResponse.json(
        { error: '参加人数は2〜99人の範囲で設定してください' } as APIError,
        { status: 400, headers }
      );
    }

    // データベース接続
    const sessions = await getCollection<GameSession>('sessions');
    
    // セッションIDの生成（重複チェック付き）
    let sessionId: string;
    let attempts = 0;
    do {
      sessionId = generateSessionId();
      const existing = await sessions.findOne({ sessionId });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);
    
    if (attempts >= 10) {
      throw new Error('セッションIDの生成に失敗しました');
    }

    // アクセストークンの生成
    const accessToken = generateAccessToken();
    
    // ホストIDの生成
    const hostId = randomBytes(16).toString('hex');
    
    // 現在時刻と有効期限（2時間後）
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    console.log("🧪 クライアントから受け取った gameName:", body.gameName);
    console.log("🧪 トリム後の gameName:", body.gameName.trim());
    // セッションデータの作成
    const newSession: GameSession = {
      sessionId,
      accessToken,
      gameName: body.gameName.trim(),
      hostId,
      status: 'waiting' as SessionStatus,
      maxPlayers,
      players: [],
      numbers: [],  // drawnNumbers → numbers に修正
      currentNumber: null,
      createdAt: now,     // Date型に修正
      expiresAt: expiresAt, // Date型に修正
    };

    // データベースに保存
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sessions.insertOne(newSession as any);

    // レスポンスの作成
    const response: CreateSessionResponse = {
      sessionId,
      accessToken,
      hostId,
      participationUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/guest/join?session=${sessionId}`,
      expiresAt: expiresAt.toISOString(),
    };

    return NextResponse.json(response, { status: 201, headers });

  } catch (error) {
    console.error('セッション作成エラー:', error);
    
    return NextResponse.json(
      { 
        error: 'セッションの作成に失敗しました',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      } as APIError,
      { status: 500, headers }
    );
  }
}

/**
 * GETリクエスト処理
 * セッション一覧取得（開発用）
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest) {
  // 本番環境では無効化
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'このエンドポイントは利用できません' } as APIError,
      { status: 404, headers }
    );
  }

  try {
    const sessions = await getCollection<GameSession>('sessions');
    const activeSessions = await sessions
      .find({ expiresAt: { $gt: new Date() } })
      .project({ accessToken: 0, _id: 0 }) // セキュリティ上、アクセストークンは除外
      .limit(10)
      .toArray();

    return NextResponse.json({ sessions: activeSessions }, { status: 200, headers });
  } catch (error) {
    console.error('セッション一覧取得エラー:', error);
    return NextResponse.json(
      { error: 'セッション一覧の取得に失敗しました' } as APIError,
      { status: 500, headers }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}