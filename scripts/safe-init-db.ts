//このファイルを実行するときはlib/database.tsに以下を記述すること
// import { config } from 'dotenv';
// import { resolve } from 'path';
// config({ path: resolve(process.cwd(), '.env.local') });

// scripts/safe-init-db.ts
import { config } from 'dotenv';
import { resolve } from 'path';


// .env.localファイルを読み込む
config({ path: resolve(process.cwd(), '.env.local') });


// 環境変数の確認
console.log('環境変数チェック:');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '設定済み' : '未設定');
console.log('MONGODB_DB:', process.env.MONGODB_DB || '未設定');

import { connectToDatabase, createIndexes } from '../lib/database';

async function initializeDatabase() {
  console.log('🔧 データベース初期化を開始します...\n');

  try {
    // データベース接続
    console.log('1️⃣ データベースに接続中...');
    const { db } = await connectToDatabase();
    console.log('✅ データベース接続成功\n');

    // 警告メッセージ
    console.log('⚠️  警告: このスクリプトは以下の処理を行います:');
    console.log('   - bingo-app-db データベースの sessions コレクションをクリア');
    console.log('   - 必要なインデックスを作成\n');
    
    // 確認プロンプト（本番環境では使用しない）
    if (process.env.NODE_ENV === 'production') {
      console.log('❌ 本番環境では実行できません');
      process.exit(1);
    }

    // コレクションのクリア
    console.log('2️⃣ sessions コレクションをクリア中...');
    const sessions = db.collection('sessions');
    const deleteResult = await sessions.deleteMany({});
    console.log(`✅ ${deleteResult.deletedCount} 件のドキュメントを削除しました\n`);

    // インデックスの作成
    console.log('3️⃣ インデックスを作成中...');
    await createIndexes();
    console.log('✅ インデックス作成完了\n');

    console.log('🎉 データベースの初期化が完了しました！');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }

  process.exit(0);
}

// スクリプト実行
initializeDatabase();