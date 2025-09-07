import { 
  generateBingoCard, 
  validateBingoCard, 
  formatBingoCard,
  checkBingo 
} from '../utils/bingo';

console.log('🎯 ビンゴカード生成テスト開始\n');

// 1. カード生成テスト
console.log('1️⃣ カード生成テスト');
const card = generateBingoCard();
console.log(formatBingoCard(card));

// 2. バリデーションテスト
console.log('2️⃣ バリデーションテスト');
const isValid = validateBingoCard(card);
console.log(`カードの妥当性: ${isValid ? '✅ 有効' : '❌ 無効'}\n`);

// 3. 複数カード生成テスト
console.log('3️⃣ 複数カード生成テスト');
const startTime = Date.now();
const cards = Array.from({ length: 10 }, () => generateBingoCard());
const endTime = Date.now();
console.log(`10枚のカード生成時間: ${endTime - startTime}ms`);

// 重複チェック
const signatures = cards.map(c => JSON.stringify(c));
const uniqueCount = new Set(signatures).size;
console.log(`ユニークなカード数: ${uniqueCount}/10\n`);

// 4. ビンゴ判定テスト
console.log('4️⃣ ビンゴ判定テスト');
const testCard = generateBingoCard();
console.log('テスト用カード:');
console.log(formatBingoCard(testCard));

// 最初の行の数字を全て抽選したことにする
const firstRowNumbers = testCard[0];
console.log(`最初の行の数字: [${firstRowNumbers.join(', ')}]`);

const isBingo = checkBingo(testCard, firstRowNumbers);
console.log(`ビンゴ判定: ${isBingo ? '✅ ビンゴ！' : '❌ まだビンゴではない'}\n`);

// 5. パフォーマンステスト
console.log('5️⃣ パフォーマンステスト');
const perfStart = Date.now();
for (let i = 0; i < 1000; i++) {
  generateBingoCard();
}
const perfEnd = Date.now();
console.log(`1000枚生成時間: ${perfEnd - perfStart}ms`);
console.log(`平均生成時間: ${(perfEnd - perfStart) / 1000}ms/枚\n`);

console.log('✨ テスト完了！');