// app/api/pusher/trigger/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';
import { getDatabase } from '@/lib/database';
import type { GameSession } from '@/types';
import { errorLog, debugLog } from '@/utils/validation';

// Pusherサーバーインスタンス（シングルトン）
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, accessToken, playerId, eventName, data } = body;

    // 必須パラメータの検証
    if (!sessionId || !accessToken || !eventName) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // セッション認証
    const db = await getDatabase();
    const session = await db.collection<GameSession>('sessions').findOne({
      sessionId,
      accessToken,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid session or access token' },
        { status: 401 }
      );
    }

    // プレイヤー認証（playerIdが提供された場合）
    if (playerId) {
      const player = session.players.find(p => p.id === playerId);
      if (!player && session.hostId !== playerId) {
        return NextResponse.json(
          { error: 'Player not found in session' },
          { status: 403 }
        );
      }
    }

    // イベント名に基づいた処理とバリデーション
    let processedData = data;
    let updateSession = false;
    const channelName = `presence-session-${sessionId}`;

    switch (eventName) {
      case 'start_game':
      case 'client-start-game':
        // ホストのみがゲーム開始可能
        if (playerId !== session.hostId) {
          return NextResponse.json(
            { error: 'Only host can start the game' },
            { status: 403 }
          );
        }
        
        // セッション状態を更新
        await db.collection<GameSession>('sessions').updateOne(
          { sessionId },
          { 
            $set: { 
              status: 'playing',
              startedAt: new Date()
            }
          }
        );
        
        processedData = {
          sessionId,
          startedAt: new Date().toISOString(),
        };

        // ★ 修正: ゲストが待っている 'game-started' イベントを送信
        await pusher.trigger(channelName, 'game-started', processedData);
        debugLog(`Game started event sent: game-started`, { channel: channelName, data: processedData });

        // session-updated も送信
        const updatedSessionForStart = await db.collection<GameSession>('sessions').findOne({ sessionId });
        if (updatedSessionForStart) {
          await pusher.trigger(channelName, 'session-updated', { session: updatedSessionForStart });
        }

        // 早期リターン（後の汎用処理をスキップ）
        return NextResponse.json({ 
          success: true,
          event: 'game-started',
          channel: channelName 
        });

      case 'draw_number':
      case 'client-draw-number':
        // ホストのみが番号を引ける
        if (playerId !== session.hostId) {
          return NextResponse.json(
            { error: 'Only host can draw numbers' },
            { status: 403 }
          );
        }

        const { number } = data;
        
        // 番号の重複チェック
        if (session.numbers.includes(number)) {
          return NextResponse.json(
            { error: 'Number already drawn' },
            { status: 400 }
          );
        }

        // セッションに番号を追加
        const updatedNumbers = [...session.numbers, number];
        await db.collection<GameSession>('sessions').updateOne(
          { sessionId },
          { 
            $set: { 
              currentNumber: number,
              numbers: updatedNumbers 
            }
          }
        );

        processedData = {
          number,
          drawnNumbers: updatedNumbers,
          allNumbers: updatedNumbers,
          timestamp: new Date().toISOString(),
        };
        updateSession = true;
        break;

      case 'reset_game':
      case 'client-reset-game':
        // ホストのみがリセット可能
        if (playerId !== session.hostId) {
          return NextResponse.json(
            { error: 'Only host can reset the game' },
            { status: 403 }
          );
        }

        // セッションをリセット
        await db.collection<GameSession>('sessions').updateOne(
          { sessionId },
          { 
            $set: { 
              status: 'waiting',
              numbers: [],
              currentNumber: null,
            },
            $unset: {
              startedAt: 1
            }
          }
        );
        
        processedData = { sessionId };
        updateSession = true;
        break;

      case 'bingo_achieved':
        // ビンゴ達成の処理
        const achievingPlayer = session.players.find(p => p.id === playerId);
        if (!achievingPlayer) {
          return NextResponse.json(
            { error: 'Player not found' },
            { status: 404 }
          );
        }

        const newBingoCount = data.bingoCount || 1;

        // データベースのプレイヤー情報を更新
        await db.collection<GameSession>('sessions').updateOne(
          { sessionId, 'players.id': playerId },
          { 
            $set: { 
              'players.$.bingoCount': newBingoCount,
              'players.$.bingoAchievedAt': new Date().toISOString()
            }
          }
        );

        processedData = {
          player: {
            ...achievingPlayer,
            bingoCount: newBingoCount
          },
          bingoCount: newBingoCount,
          lines: data.lines || [],
          achievedAt: new Date().toISOString()
        };
        
        // player-bingoイベントとして配信
        await pusher.trigger(
          channelName,
          'player-bingo',
          processedData
        );
        
        debugLog(`Player ${achievingPlayer.name} achieved BINGO! Count: ${newBingoCount}`);
        
        updateSession = true;
        break;

      case 'player_bingo':
        // ビンゴ宣言の処理（後方互換性のため残す）
        const player = session.players.find(p => p.id === playerId);
        if (!player) {
          return NextResponse.json(
            { error: 'Player not found' },
            { status: 404 }
          );
        }

        processedData = {
          player,
          bingoCount: data.bingoCount || 1,
        };
        break;

      default:
        // その他のカスタムイベント
        debugLog(`Triggering custom event: ${eventName}`, data);
    }

    // イベント名をPusher互換に変換（client-プレフィックスを除去）
    const pusherEventName = eventName.startsWith('client-') 
      ? eventName.replace('client-', '').replace(/_/g, '-')
      : eventName.replace(/_/g, '-');

    // bingo_achievedは既に上で処理済みなので、ここではスキップ
    if (eventName !== 'bingo_achieved') {
      await pusher.trigger(
        channelName,
        pusherEventName,
        processedData
      );
      
      debugLog(`Pusher event triggered: ${pusherEventName}`, {
        channel: channelName,
        data: processedData
      });
    }

    // セッション更新イベントも送信
    if (updateSession) {
      const updatedSession = await db.collection<GameSession>('sessions').findOne({ sessionId });
      if (updatedSession) {
        await pusher.trigger(
          channelName,
          'session-updated',
          { session: updatedSession }
        );
      }
    }

    return NextResponse.json({ 
      success: true,
      event: pusherEventName,
      channel: channelName 
    });

  } catch (error) {
    // エラーの型を適切に処理
    const errorMessage = error instanceof Error ? error.message : 'Failed to trigger Pusher event';
    errorLog(`Pusher trigger error: ${errorMessage}`);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}