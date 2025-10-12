// app/api/sessions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { nanoid } from 'nanoid';
import type { GameSession } from '@/types';
import { getBaseUrl, createParticipationUrl } from '@/utils/url';
import { errorLog } from '@/utils/validation';

// セッションID生成（6文字の英数字大文字）
function generateSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let sessionId = '';
  for (let i = 0; i < 6; i++) {
    sessionId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return sessionId;
}

// アクセストークン生成（8文字）
function generateAccessToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// GETリクエスト: セッション一覧取得
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    
    // アクティブなセッションのみ取得
    const sessions = await db
      .collection<GameSession>('sessions')
      .find({ status: { $ne: 'finished' } })
      .project({
        sessionId: 1,
        gameName: 1,
        status: 1,
        maxPlayers: 1,
        players: 1,
        createdAt: 1,
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    // 環境に応じたベースURLを取得
    const baseUrl = getBaseUrl(request);

    // 各セッションに参加用URLを追加
    const sessionsWithUrls = sessions.map(session => ({
      ...session,
      currentPlayers: session.players.length,
      participationUrl: createParticipationUrl(
        baseUrl,
        session.sessionId,
        session.accessToken || ''
      ),
    }));

    return NextResponse.json(sessionsWithUrls);
  } catch (error) {
    errorLog(`Failed to fetch sessions: ${error}`);
    return NextResponse.json(
      { error: 'セッション一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// POSTリクエスト: 新規セッション作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameName, maxPlayers = 25 } = body;

    // 入力値検証
    if (!gameName || typeof gameName !== 'string') {
      return NextResponse.json(
        { error: 'ゲーム名は必須です' },
        { status: 400 }
      );
    }

    if (gameName.length < 1 || gameName.length > 50) {
      return NextResponse.json(
        { error: 'ゲーム名は1〜50文字で入力してください' },
        { status: 400 }
      );
    }

    if (typeof maxPlayers !== 'number' || maxPlayers < 2 || maxPlayers > 100) {
      return NextResponse.json(
        { error: '最大参加人数は2〜100人の間で設定してください' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    
    // ユニークなセッションIDを生成（重複チェック付き）
    let sessionId = generateSessionId();
    let exists = true;
    let attempts = 0;
    
    while (exists && attempts < 10) {
      exists = await db
        .collection<GameSession>('sessions')
        .findOne({ sessionId }) !== null;
      
      if (exists) {
        sessionId = generateSessionId();
        attempts++;
      }
    }

    if (exists) {
      return NextResponse.json(
        { error: 'セッションIDの生成に失敗しました。もう一度お試しください。' },
        { status: 500 }
      );
    }

    // アクセストークン生成
    const accessToken = generateAccessToken();
    
    // ホストID生成
    const hostId = nanoid();

    // セッションドキュメント作成
    const session: GameSession = {
      sessionId,
      accessToken,
      gameName,
      hostId,
      maxPlayers,
      players: [],
      numbers: [], // 抽選済み番号
      currentNumber: null,
      status: 'waiting',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2時間後
    };

    // MongoDBに保存
    const result = await db.collection<GameSession>('sessions').insertOne(session);

    if (!result.acknowledged) {
      return NextResponse.json(
        { error: 'セッションの作成に失敗しました' },
        { status: 500 }
      );
    }

    // 環境に応じたベースURLを取得してQRコード用URLを生成
    const baseUrl = getBaseUrl(request);
    const participationUrl = createParticipationUrl(baseUrl, sessionId, accessToken);

    // QRコード生成（オプション - QRコードライブラリを使用する場合）
    let qrCodeDataUrl = null;
    try {
      // QRコード生成ライブラリがインストールされている場合
      // 動的インポートを使用（ESLintエラー回避）
      const { default: QRCode } = await import('qrcode');
      qrCodeDataUrl = await QRCode.toDataURL(participationUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        width: 256,
      });
    } catch (qrError) {
      // QRコードライブラリが無い場合はスキップ
      console.log('QR code generation skipped:', qrError);
    }

    // レスポンス
    return NextResponse.json({
      success: true,
      sessionId,
      accessToken,
      hostId,
      gameName,
      maxPlayers,
      participationUrl,
      qrCode: qrCodeDataUrl,
      expiresAt: session.expiresAt,
      message: 'セッションが作成されました',
    });

  } catch (error) {
    errorLog(`Failed to create session: ${error}`);
    return NextResponse.json(
      { error: 'セッションの作成中にエラーが発生しました' },
      { status: 500 }
    );
  }
}