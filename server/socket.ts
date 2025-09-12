// server/socket.ts
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getDatabase } from '@/lib/database';
import type { GameSession } from '@/types';

// Socket.ioサーバーのインスタンスを保持
let io: SocketIOServer | null = null;

/**
 * Socket.ioサーバーを初期化
 * Next.jsのカスタムサーバーとして動作
 */
export function initSocketServer(httpServer: ReturnType<typeof createServer>) {
  if (io) return io;

  // CORSの設定（開発環境と本番環境両方に対応）
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.NEXT_PUBLIC_APP_URL 
        : 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
    // パフォーマンス最適化の設定
    transports: ['websocket', 'polling'], // WebSocketを優先、フォールバックでポーリング
  });

  // 接続イベントのハンドリング
  io.on('connection', (socket) => {
    console.log('👤 新しいクライアントが接続:', socket.id);

    // セッションに参加
    socket.on('join-session', async (data: { sessionId: string; playerId?: string }) => {
      const { sessionId, playerId } = data;
      
      // ルーム（セッション）に参加
      socket.join(sessionId);
      console.log(`📌 Socket ${socket.id} がセッション ${sessionId} に参加`);

      // DBからセッション情報を取得
      try {
        const db = await getDatabase();
        const session = await db.collection<GameSession>('sessions').findOne({ 
          sessionId 
        }) as GameSession | null;  // 型アサーションを追加

        if (session) {
          // 同じセッションの全員に通知
          io?.to(sessionId).emit('session-updated', {
            players: session.players,
            gameStatus: session.status,  // statusプロパティを使用
            numbers: session.numbers,
          });

          // 参加者が増えたことを通知
          if (playerId) {
            socket.broadcast.to(sessionId).emit('player-joined', {
              playerId,
              playerName: session.players.find(p => p.id === playerId)?.name,
            });
          }
        }
      } catch (error) {
        console.error('セッション情報の取得エラー:', error);
        socket.emit('error', { message: 'セッション情報の取得に失敗しました' });
      }
    });

    // ホストが番号を引く
    socket.on('draw-number', async (data: { 
      sessionId: string; 
      number: number;
      hostId: string;
    }) => {
      const { sessionId, number, hostId } = data;

      try {
        const db = await getDatabase();
        
        // ホストの権限確認とセッション更新
        const result = await db.collection<GameSession>('sessions').findOneAndUpdate(
          { 
            sessionId,
            hostId, // ホストのみが番号を引ける
            status: 'playing'  // statusプロパティを使用
          },
          { 
            $push: { numbers: number }
            // updatedAtは型定義にないため削除
          },
          { returnDocument: 'after' }
        );

        const updatedSession = result as GameSession | null;  // 型アサーション
        if (updatedSession) {
          // 全参加者に新しい番号を通知
          io?.to(sessionId).emit('number-drawn', {
            number,
            allNumbers: updatedSession.numbers,
            timestamp: new Date().toISOString(),
          });

          console.log(`🎰 セッション ${sessionId} で番号 ${number} が引かれました`);
        } else {
          socket.emit('error', { message: '権限がないか、ゲームが開始されていません' });
        }
      } catch (error) {
        console.error('番号抽選エラー:', error);
        socket.emit('error', { message: '番号の抽選に失敗しました' });
      }
    });

    // ビンゴ宣言
    socket.on('declare-bingo', async (data: {
      sessionId: string;
      playerId: string;
      bingoPattern: number[][]; // ビンゴになったマスの座標
    }) => {
      const { sessionId, playerId, bingoPattern } = data;

      try {
        const db = await getDatabase();
        const session = await db.collection<GameSession>('sessions').findOne({ 
          sessionId 
        });

        if (session) {
          const player = session.players.find(p => p.id === playerId);
          
          if (player && validateBingo(player.board, session.numbers, bingoPattern)) {
            // ビンゴが正しい場合
            // winnersプロパティは型定義にないため、別の方法で管理
            // 例：プレイヤーのbingoCountを増やす
            await db.collection<GameSession>('sessions').updateOne(
              { sessionId, 'players.id': playerId },
              { 
                $inc: { 'players.$.bingoCount': 1 }
              }
            );

            // 全員にビンゴ達成を通知
            io?.to(sessionId).emit('bingo-achieved', {
              playerId,
              playerName: player.name,
              pattern: bingoPattern,
            });

            console.log(`🎉 ${player.name} がビンゴを達成！`);
          } else {
            // ビンゴが無効な場合
            socket.emit('bingo-invalid', {
              message: 'ビンゴの検証に失敗しました',
            });
          }
        }
      } catch (error) {
        console.error('ビンゴ宣言エラー:', error);
        socket.emit('error', { message: 'ビンゴの確認に失敗しました' });
      }
    });

    // ゲーム開始（ホストのみ）
    socket.on('start-game', async (data: { sessionId: string; hostId: string }) => {
      const { sessionId, hostId } = data;

      try {
        const db = await getDatabase();
        const result = await db.collection<GameSession>('sessions').findOneAndUpdate(
          { 
            sessionId,
            hostId,
            status: 'waiting'  // statusプロパティを使用
          },
          { 
            $set: { 
              status: 'playing',  // statusプロパティを使用
              startedAt: new Date()
              // updatedAtは型定義にないため削除
            }
          },
          { returnDocument: 'after' }
        );

        const updatedSession = result as GameSession | null;  // 型アサーション
        if (updatedSession) {
          // 全参加者にゲーム開始を通知
          io?.to(sessionId).emit('game-started', {
            startedAt: updatedSession.startedAt || new Date(),
          });

          console.log(`🎮 セッション ${sessionId} のゲームが開始されました`);
        }
      } catch (error) {
        console.error('ゲーム開始エラー:', error);
        socket.emit('error', { message: 'ゲームの開始に失敗しました' });
      }
    });

    // 切断時の処理
    socket.on('disconnect', () => {
      console.log('👋 クライアントが切断:', socket.id);
      // 必要に応じて、プレイヤーのオンライン状態を更新
    });

    // エラーハンドリング
    socket.on('error', (error) => {
      console.error('Socket.ioエラー:', error);
    });
  });

  return io;
}

/**
 * ビンゴの検証関数
 * @param board プレイヤーのビンゴボード
 * @param drawnNumbers 引かれた番号のリスト
 * @param pattern ビンゴパターン（座標の配列）
 * @returns ビンゴが有効かどうか
 */
function validateBingo(
  board: number[][],
  drawnNumbers: number[],
  pattern: number[][]
): boolean {
  // パターンの全てのマスが引かれた番号に含まれているか確認
  for (const [row, col] of pattern) {
    const number = board[row][col];
    
    // 中央のFREEマスは常にOK
    if (row === 2 && col === 2) continue;
    
    // その番号が引かれていない場合は無効
    if (!drawnNumbers.includes(number)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Socket.ioインスタンスを取得
 */
export function getIO(): SocketIOServer | null {
  return io;
}