import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
// tsxで実行するため、.tsファイルを直接インポート
const { initSocketServer } = await import('./server/socket.ts');

// 環境変数の設定
const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// Next.jsアプリケーションの初期化
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // HTTPサーバーを作成
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      
      // Socket.ioのリクエストをフィルタリング
      // Socket.ioは /socket.io/ パスを使用
      if (parsedUrl.pathname.startsWith('/socket.io/')) {
        // Socket.ioに処理を委譲
        return;
      }
      
      // それ以外はNext.jsで処理
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Socket.ioサーバーを初期化
  try {
    initSocketServer(server);
    console.log('✅ Socket.ioサーバーが初期化されました');
  } catch (err) {
    console.error('❌ Socket.ioサーバーの初期化に失敗:', err);
  }

  // サーバーを起動
  server.listen(port, () => {
    console.log(`🚀 サーバーが起動しました: http://${hostname}:${port}`);
    console.log(`📝 環境: ${dev ? '開発' : '本番'}`);
  });
});