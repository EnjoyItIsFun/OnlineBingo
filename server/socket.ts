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

    // セッションに参加（joinGameイベントを使用 - types/index.tsに定義済み）
    socket.on('joinGame', async (data: { sessionId: string; userId: string; role: 'host' | 'player' }) => {
      const { sessionId, userId, role } = data;
      
      // ルーム（セッション）に参加
      socket.join(sessionId);
      console.log(`📌 Socket ${socket.id} がセッション ${sessionId} に参加 (${role})`);

      // DBからセッション情報を取得
      try {
        const db = await getDatabase();
        const session = await db.collection<GameSession>('sessions').findOne({ 
          sessionId 
        }) as GameSession | null;

        if (session) {
          // セッション全体の情報を送信（session_updatedイベント）
          io?.to(sessionId).emit('session_updated', session);

          // プレイヤーの場合、参加を通知
          if (role === 'player' && userId) {
            const player = session.players.find(p => p.id === userId);
            if (player) {
              socket.broadcast.to(sessionId).emit('player_joined', player);
            }
          }
        }
      } catch (error) {
        console.error('セッション情報の取得エラー:', error);
        socket.emit('connection_error', 'セッション情報の取得に失敗しました');
      }
    });

    // ホストが番号を引く（draw_numberイベント - types/index.tsに定義済み）
    socket.on('draw_number', async (data: { 
      sessionId: string; 
      number: number;
    }) => {
      const { sessionId, number } = data;

      try {
        const db = await getDatabase();
        
        // セッション更新（番号を追加）
        const result = await db.collection<GameSession>('sessions').findOneAndUpdate(
          { 
            sessionId,
            status: 'playing'
          },
          { 
            $push: { numbers: number },
            $set: { currentNumber: number }
          },
          { returnDocument: 'after' }
        );

        const updatedSession = result as GameSession | null;
        if (updatedSession) {
          // 全参加者に新しい番号を通知（number_drawnイベント）
          io?.to(sessionId).emit('number_drawn', {
            number,
            drawnNumbers: updatedSession.numbers
          });

          // セッション情報も更新通知
          io?.to(sessionId).emit('session_updated', updatedSession);

          console.log(`🎰 セッション ${sessionId} で番号 ${number} が引かれました`);
        } else {
          socket.emit('connection_error', 'ゲームが開始されていません');
        }
      } catch (error) {
        console.error('番号抽選エラー:', error);
        socket.emit('connection_error', '番号の抽選に失敗しました');
      }
    });

    // ゲーム開始（start_gameイベント - types/index.tsに定義済み）
    socket.on('start_game', async (data: { sessionId: string }) => {
      const { sessionId } = data;

      try {
        const db = await getDatabase();
        const result = await db.collection<GameSession>('sessions').findOneAndUpdate(
          { 
            sessionId,
            status: 'waiting'
          },
          { 
            $set: { 
              status: 'playing',
              startedAt: new Date()
            }
          },
          { returnDocument: 'after' }
        );

        const updatedSession = result as GameSession | null;
        if (updatedSession) {
          // 全参加者にゲーム開始を通知（game_startedイベント）
          io?.to(sessionId).emit('game_started', {
            sessionId: sessionId
          });

          // セッション情報も更新通知
          io?.to(sessionId).emit('session_updated', updatedSession);

          console.log(`🎮 セッション ${sessionId} のゲームが開始されました`);
        }
      } catch (error) {
        console.error('ゲーム開始エラー:', error);
        socket.emit('connection_error', 'ゲームの開始に失敗しました');
      }
    });

    // ゲームリセット（reset_gameイベント - types/index.tsに定義済み）
    socket.on('reset_game', async (data: { sessionId: string }) => {
      const { sessionId } = data;

      try {
        const db = await getDatabase();
        
        // プレイヤーのビンゴカウントをリセット
        const session = await db.collection<GameSession>('sessions').findOne({ sessionId });
        if (session) {
          const resetPlayers = session.players.map(p => ({
            ...p,
            bingoCount: 0
          }));

          // セッションをリセット（2つの操作に分割）
          // まず、フィールドを更新
          await db.collection<GameSession>('sessions').updateOne(
            { sessionId },
            { 
              $set: { 
                status: 'waiting',
                numbers: [],
                currentNumber: null,
                players: resetPlayers
              },
              $unset: {
                startedAt: 1  // startedAtフィールドを削除
              }
            }
          );

          // 更新後のセッションを取得
          const result = await db.collection<GameSession>('sessions').findOne({ sessionId });

          if (result) {
            // 全参加者にリセットを通知（session_updatedで対応）
            io?.to(sessionId).emit('session_updated', result);
            
            console.log(`🔄 セッション ${sessionId} がリセットされました`);
          }
        }
      } catch (error) {
        console.error('ゲームリセットエラー:', error);
        socket.emit('connection_error', 'ゲームのリセットに失敗しました');
      }
    });

    // セッション終了（カスタムイベント - 型定義にないため直接実装）
    socket.on('cancel_session', async (data: { sessionId: string }) => {
      const { sessionId } = data;

      try {
        // DBからセッションを削除または終了状態に更新
        const db = await getDatabase();
        await db.collection<GameSession>('sessions').updateOne(
          { sessionId },
          { $set: { status: 'finished', finishedAt: new Date() } }
        );

        // 全参加者に終了を通知
        io?.to(sessionId).emit('session_cancelled', { sessionId });
        
        // 全員をルームから退出
        const sockets = await io?.in(sessionId).fetchSockets();
        sockets?.forEach(s => s.leave(sessionId));
        
        console.log(`❌ セッション ${sessionId} がキャンセルされました`);
      } catch (error) {
        console.error('セッション終了エラー:', error);
      }
    });

    // プレイヤーがビンゴを宣言（カスタムイベント）
    socket.on('declare_bingo', async (data: {
      sessionId: string;
      playerId: string;
      bingoPattern: number[][];
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
            // ビンゴカウントを更新
            const updatedPlayers = session.players.map(p => 
              p.id === playerId 
                ? { ...p, bingoCount: (p.bingoCount || 0) + 1 }
                : p
            );

            const result = await db.collection<GameSession>('sessions').findOneAndUpdate(
              { sessionId },
              { $set: { players: updatedPlayers } },
              { returnDocument: 'after' }
            );

            if (result) {
              // player_bingoイベントで通知
              io?.to(sessionId).emit('player_bingo', {
                player: { ...player, bingoCount: (player.bingoCount || 0) + 1 },
                bingoCount: (player.bingoCount || 0) + 1
              });

              // セッション情報も更新
              io?.to(sessionId).emit('session_updated', result as GameSession);
            }

            console.log(`🎉 ${player.name} がビンゴを達成！`);
          } else {
            socket.emit('bingo_invalid', {
              message: 'ビンゴの検証に失敗しました'
            });
          }
        }
      } catch (error) {
        console.error('ビンゴ宣言エラー:', error);
        socket.emit('connection_error', 'ビンゴの確認に失敗しました');
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