//このファイルを実行するときはlib/database.tsに以下を記述すること
// import { config } from 'dotenv';
// import { resolve } from 'path';
// config({ path: resolve(process.cwd(), '.env.local') });

// dotenvで環境変数を読み込む
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.localファイルを読み込む
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// 環境変数の確認
console.log('環境変数チェック:');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '設定済み' : '未設定');
console.log('MONGODB_DB:', process.env.MONGODB_DB || '未設定');
console.log('');

import { connectToDatabase } from '../lib/database';

async function debugEncoding() {
  console.log('🔍 文字エンコーディングのデバッグ開始...\n');

  try {
    // 1. Node.jsの環境確認
    console.log('1️⃣ Node.js環境情報:');
    console.log('   Node version:', process.version);
    console.log('   Default encoding:', Buffer.isEncoding('utf8') ? 'utf8 supported' : 'utf8 not supported');
    console.log('   LANG env:', process.env.LANG || 'not set');
    console.log('');

    // 2. テスト文字列
    const testStrings = {
      english: 'Test Bingo',
      japanese: 'テストビンゴ大会',
      mixed: 'Test テスト 123'
    };

    console.log('2️⃣ テスト文字列:');
    Object.entries(testStrings).forEach(([key, value]) => {
      console.log(`   ${key}: "${value}"`);
      console.log(`   Buffer: ${Buffer.from(value, 'utf8').toString('hex')}`);
    });
    console.log('');

    // 3. MongoDBへの書き込みテスト
    console.log('3️⃣ MongoDB書き込みテスト:');
    const { db } = await connectToDatabase();
    const testCollection = db.collection('encoding_test');

    // 既存のテストデータを削除
    await testCollection.deleteMany({});

    // テストデータを挿入
    const testDoc = {
      english: testStrings.english,
      japanese: testStrings.japanese,
      mixed: testStrings.mixed,
      timestamp: new Date()
    };

    const result = await testCollection.insertOne(testDoc);
    console.log('   挿入成功:', result.acknowledged);
    console.log('');

    // 4. MongoDBからの読み取りテスト
    console.log('4️⃣ MongoDB読み取りテスト:');
    const readDoc = await testCollection.findOne({ _id: result.insertedId });
    
    if (readDoc) {
      console.log('   読み取り結果:');
      console.log(`   english: "${readDoc.english}"`);
      console.log(`   japanese: "${readDoc.japanese}"`);
      console.log(`   mixed: "${readDoc.mixed}"`);
      console.log('');

      // 文字列比較
      console.log('5️⃣ 文字列比較:');
      console.log(`   english一致: ${readDoc.english === testStrings.english}`);
      console.log(`   japanese一致: ${readDoc.japanese === testStrings.japanese}`);
      console.log(`   mixed一致: ${readDoc.mixed === testStrings.mixed}`);
    }

    // 6. 既存のセッションデータ確認
    console.log('\n6️⃣ 既存セッションの確認:');
    const sessions = db.collection('sessions');
    const existingSession = await sessions.findOne({ sessionId: 'EN2MJV' });
    
    if (existingSession) {
      console.log(`   gameName: "${existingSession.gameName}"`);
      console.log(`   gameName (hex): ${Buffer.from(existingSession.gameName).toString('hex')}`);
      
      // 正しい日本語との比較
      const correctName = 'テストビンゴ大会';
      console.log(`   期待値: "${correctName}"`);
      console.log(`   期待値 (hex): ${Buffer.from(correctName, 'utf8').toString('hex')}`);
    }

    // クリーンアップ
    await testCollection.deleteMany({});
    console.log('\n✅ デバッグ完了');

  } catch (error) {
    console.error('❌ エラー:', error);
  }

  process.exit(0);
}

debugEncoding();