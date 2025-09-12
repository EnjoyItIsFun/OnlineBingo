import { MongoClient, Db, Document } from 'mongodb';
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI環境変数が設定されていません');
}

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// 開発環境では、グローバル変数を使用してホットリロード時の再接続を防ぐ
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // 本番環境では、通常通り接続
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

/**
 * MongoDBデータベースインスタンスを取得
 * @returns Promise<Db> データベースインスタンス
 */
export async function getDatabase(): Promise<Db> {
  const client = await clientPromise;
  return client.db('bingo-app-db');
}

/**
 * データベース接続を取得（スクリプト用）
 * @returns Promise<{db: Db, client: MongoClient}>
 */
export async function connectToDatabase(): Promise<{ db: Db; client: MongoClient }> {
  const client = await clientPromise;
  const db = client.db('bingo-app-db');
  return { db, client };
}

/**
 * 必要なインデックスを作成
 */
export async function createIndexes(): Promise<void> {
  const db = await getDatabase();
  const sessions = db.collection('sessions');

  // セッションIDでの検索を高速化
  await sessions.createIndex({ sessionId: 1 }, { unique: true });
  
  // アクセストークンでの検索を高速化
  await sessions.createIndex({ accessToken: 1 });
  
  // 有効期限切れセッションの自動削除（TTLインデックス）
  await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  
  // ホストIDでの検索を高速化
  await sessions.createIndex({ hostId: 1 });
  
  // ステータスでの検索を高速化
  await sessions.createIndex({ status: 1 });
  
  console.log('✅ インデックスを作成しました:');
  console.log('  - sessionId (unique)');
  console.log('  - accessToken');
  console.log('  - expiresAt (TTL)');
  console.log('  - hostId');
  console.log('  - status');
}

/**
 * コレクションの取得（型安全）
 * @param collectionName コレクション名
 * @returns コレクションインスタンス
 */
export async function getCollection<T extends Document = Document>(collectionName: string) {
  const db = await getDatabase();
  return db.collection<T>(collectionName);
}

// デフォルトエクスポート（既存のコードとの互換性維持）
export default clientPromise;