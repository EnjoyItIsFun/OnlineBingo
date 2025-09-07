import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { GameSession, Player } from '@/types';
import { WithId } from 'mongodb';
import bingoUtils from '@/utils/bingo';

// 名前の重複をチェックし、必要に応じて調整する関数
function adjustPlayerName(baseName: string, existingPlayers: Player[]): string {
  const existingNames = existingPlayers.map(p => p.name);
  
  // 基本名が重複していない場合はそのまま返す
  if (!existingNames.includes(baseName)) {
    return baseName;
  }
  
  // 重複している場合は番号を付与
  let counter = 2;
  let adjustedName = `${baseName}_${counter}`;
  
  while (existingNames.includes(adjustedName)) {
    counter++;
    adjustedName = `${baseName}_${counter}`;
  }
  
  return adjustedName;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const body = await request.json();
    const { playerName } = body;

    // バリデーション
    if (!playerName || typeof playerName !== 'string') {
      return NextResponse.json(
        { error: '名前を入力してください' },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        }
      );
    }

    if (playerName.trim().length === 0) {
      return NextResponse.json(
        { error: '有効な名前を入力してください' },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        }
      );
    }

    // データベース接続
    const { db } = await connectToDatabase();
    const sessions = db.collection<GameSession>('sessions');

    // セッション取得
    const session = await sessions.findOne({ 
      sessionId 
    }) as WithId<GameSession> | null;

    if (!session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        }
      );
    }

    // セッションの有効期限チェック
    if (new Date(session.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'セッションの有効期限が切れています' },
        { 
          status: 410,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        }
      );
    }

    // ゲームが既に開始されているかチェック
    if (session.status !== 'waiting') {
      return NextResponse.json(
        { error: 'このゲームは既に開始されています' },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        }
      );
    }

    // 最大参加人数チェック
    if (session.players.length >= session.maxPlayers) {
      return NextResponse.json(
        { error: 'このゲームは満員です' },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        }
      );
    }

    // 名前の調整（重複チェック）
    const adjustedName = adjustPlayerName(playerName.trim(), session.players);
    const nameAdjusted = adjustedName !== playerName.trim();

    // ====================================
    // ✨ ビンゴカード生成を追加
    // ====================================
    const bingoCard = bingoUtils.generateBingoCard();
    
    // デバッグ用：開発環境でのみカード内容をログ出力
    if (process.env.NODE_ENV === 'development') {
      console.log('Generated Bingo Card for', adjustedName);
      console.log(bingoUtils.formatBingoCard(bingoCard));
    }

    // 新しいプレイヤーの作成
    const newPlayer: Player = {
      id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: adjustedName,
      originalName: nameAdjusted ? playerName.trim() : undefined,
      nameAdjusted: nameAdjusted,
      board: bingoCard,  // ✨ 生成したビンゴカードを設定
      joinedAt: new Date().toISOString(),
      isConnected: true,
      bingoCount: 0
    };

    // セッションを更新
    const updateResult = await sessions.updateOne(
      { sessionId },
      { 
        $push: { players: newPlayer },
        $set: { updatedAt: new Date() }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json(
        { error: 'プレイヤーの追加に失敗しました' },
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        }
      );
    }

    // Socket.ioでの通知（後で実装）
    // io.to(sessionId).emit('playerJoined', {
    //   player: newPlayer,
    //   totalPlayers: session.players.length + 1
    // });

    // レスポンスの返却
    // 重要：クライアントにはビンゴカードの内容は送信しない（セキュリティ対策）
    return NextResponse.json({
      success: true,
      player: {
        id: newPlayer.id,
        name: newPlayer.name,
        joinedAt: newPlayer.joinedAt,
        // board は意図的に除外（ゲーム開始後に本人のみに送信）
      },
      nameAdjusted,
      originalName: nameAdjusted ? playerName.trim() : undefined,
      sessionInfo: {
        sessionId: session.sessionId,
        gameName: session.gameName,
        currentPlayers: session.players.length + 1,
        maxPlayers: session.maxPlayers
      }
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });

  } catch (error) {
    console.error('Join session error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }
    );
  }
}