import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/database';
import { 
  GameSession, 
  Player, 
  JoinSessionResponse, 
  APIError, 
  NameAdjustmentResult 
} from '@/types';
import { 
  generatePlayerId, 
  generateBingoBoard, 
  adjustPlayerName 
} from '@/utils/gameUtils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Next.js 15の新仕様：paramsをawaitで解決
    const { sessionId } = await params;
    
    // リクエストボディの解析
    const body = await request.json();
    const { accessToken, playerName } = body;
    
    // バリデーション
    if (!accessToken || !/^[A-Z0-9]{8}$/.test(accessToken)) {
      return NextResponse.json(
        { error: '無効なアクセストークンです' } as APIError,
        { status: 400 }
      );
    }
    
    if (!playerName || playerName.trim().length === 0) {
      return NextResponse.json(
        { error: '名前を入力してください' } as APIError,
        { status: 400 }
      );
    }
    
    if (playerName.length > 25) {
      return NextResponse.json(
        { error: '名前は25文字以内で入力してください' } as APIError,
        { status: 400 }
      );
    }
    
    // データベース接続
    const sessions = await getCollection<GameSession>('sessions');
    
    // セッション取得（アクセストークンで認証）
    const session = await sessions.findOne({ 
      sessionId,
      accessToken
    });
    
    if (!session) {
      return NextResponse.json(
        { error: 'セッションが見つからないか、アクセストークンが正しくありません' } as APIError,
        { status: 404 }
      );
    }
    
    // 有効期限チェック
    if (new Date(session.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'セッションの有効期限が切れています' } as APIError,
        { status: 410 }
      );
    }
    
    // ゲーム開始済みチェック
    if (session.status !== 'waiting') {
      return NextResponse.json(
        { error: 'このセッションはすでにゲームが開始されています' } as APIError,
        { status: 400 }
      );
    }
    
    // 最大人数チェック
    if (session.players.length >= (session.maxPlayers || 25)) {
      return NextResponse.json(
        { error: 'このセッションは満員です' } as APIError,
        { status: 400 }
      );
    }
    
    const nameAdjustment = adjustPlayerName(playerName.trim(), session.players);
    
    // プレイヤー情報の作成（Player型に完全準拠）
    const newPlayer: Player = {
      id: generatePlayerId(), 
      name: nameAdjustment.adjustedName,
      board: generateBingoBoard(),
      bingoCount: 0,
      joinedAt: new Date().toISOString(),
      isConnected: true
    };
    
    // データベース更新
    await sessions.updateOne(
      { sessionId },
      { 
        $push: { players: newPlayer },
        $set: { updatedAt: new Date() }
      }
    );
    
    // レスポンス作成（JoinSessionResponse型に完全準拠）
    const nameAdjustmentData: NameAdjustmentResult | undefined = nameAdjustment.wasAdjusted 
      ? {
          original: playerName.trim(),
          adjusted: nameAdjustment.adjustedName,
          reason: 'duplicate' as const
        }
      : undefined;
    
    const response: JoinSessionResponse = {
      playerId: newPlayer.id,
      board: newPlayer.board,
      nameAdjustment: nameAdjustmentData
    };
    
    return NextResponse.json(response, { status: 201 });
    
  } catch (error) {
    console.error('参加エラー:', error);
    
    return NextResponse.json(
      { 
        error: 'ゲームへの参加に失敗しました',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      } as APIError,
      { status: 500 }
    );
  }
}

/**
 * OPTIONSリクエスト処理（CORS対応）
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}