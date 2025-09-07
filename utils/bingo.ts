/**
 * Fisher-Yatesシャッフルアルゴリズム
 * 配列をランダムにシャッフルする最も効率的なアルゴリズム
 * 時間計算量: O(n)、空間計算量: O(1)
 * 
 * @param array シャッフルする配列
 * @returns シャッフルされた配列
 */
function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array]; // 元の配列を変更しないようコピー
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    // 0からiまでのランダムなインデックスを生成
    const j = Math.floor(Math.random() * (i + 1));
    // ES6の分割代入を使った要素の入れ替え（従来はtemp変数が必要だった）
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

/**
 * 指定された範囲から重複なしでランダムに数字を選択
 * 
 * @param min 最小値（含む）
 * @param max 最大値（含む）
 * @param count 選択する数字の個数
 * @returns 選択された数字の配列
 */
function selectRandomNumbers(min: number, max: number, count: number): number[] {
  // 範囲内のすべての数字を含む配列を生成
  // Array.fromは ES2015から使用可能
  const pool = Array.from(
    { length: max - min + 1 }, 
    (_, index) => min + index
  );
  
  // シャッフルして最初のcount個を取得
  const shuffled = fisherYatesShuffle(pool);
  return shuffled.slice(0, count);
}

/**
 * 5×5のビンゴカードを生成
 * 
 * アメリカ式ビンゴのルール:
 * - B列: 1-15
 * - I列: 16-30
 * - N列: 31-45（中央はFREE）
 * - G列: 46-60
 * - O列: 61-75
 * 
 * @returns 5×5の2次元配列（中央は0でFREEスペースを表現）
 */
export function generateBingoCard(): number[][] {
  // 列ごとの数字範囲定義
  const columnRanges = [
    { min: 1, max: 15 },   // B列
    { min: 16, max: 30 },  // I列
    { min: 31, max: 45 },  // N列
    { min: 46, max: 60 },  // G列
    { min: 61, max: 75 },  // O列
  ];
  
  // 転置用の一時配列（列ごとに生成してから転置）
  const columns: number[][] = [];
  
  for (let col = 0; col < 5; col++) {
    const { min, max } = columnRanges[col];
    const columnNumbers = selectRandomNumbers(min, max, 5);
    columns.push(columnNumbers);
  }
  
  // 行列の転置（列→行に変換）
  // これは数学的な行列転置操作で、従来はネストしたforループで実装していた
  const card: number[][] = Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 5 }, (_, col) => columns[col][row])
  );
  
  // 中央（インデックス[2][2]）をFREEスペースに設定
  // 0を使用（-1でも可、プロジェクトの仕様に応じて調整）
  card[2][2] = 0;
  
  return card;
}

/**
 * ビンゴカードの妥当性を検証
 * デバッグや品質保証のために使用
 * 
 * @param card 検証するビンゴカード
 * @returns 妥当な場合true
 */
export function validateBingoCard(card: number[][]): boolean {
  // サイズチェック
  if (card.length !== 5) return false;
  if (!card.every(row => row.length === 5)) return false;
  
  // 中央がFREEスペースかチェック
  if (card[2][2] !== 0 && card[2][2] !== -1) return false;
  
  // 各列の数字範囲チェック
  const columnRanges = [
    { min: 1, max: 15 },
    { min: 16, max: 30 },
    { min: 31, max: 45 },
    { min: 46, max: 60 },
    { min: 61, max: 75 },
  ];
  
  for (let col = 0; col < 5; col++) {
    const { min, max } = columnRanges[col];
    const columnNumbers: number[] = [];
    
    for (let row = 0; row < 5; row++) {
      // FREEスペースはスキップ
      if (row === 2 && col === 2) continue;
      
      const num = card[row][col];
      
      // 範囲チェック
      if (num < min || num > max) return false;
      
      // 重複チェック（Setを使用、ES2015から利用可能）
      if (columnNumbers.includes(num)) return false;
      
      columnNumbers.push(num);
    }
  }
  
  return true;
}

/**
 * ビンゴカードを文字列として整形（デバッグ用）
 * 
 * @param card ビンゴカード
 * @returns 整形された文字列
 */
export function formatBingoCard(card: number[][]): string {
  const header = '  B    I    N    G    O  \n';
  const separator = '-------------------------\n';
  
  let result = header + separator;
  
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const num = card[row][col];
      // FREEスペースの表示
      const display = num === 0 ? 'FREE' : num.toString().padStart(2, ' ');
      result += display.padEnd(5, ' ');
    }
    result += '\n';
  }
  
  return result;
}

/**
 * 複数のユニークなビンゴカードを生成
 * 大規模なゲームで使用
 * 
 * @param count 生成するカードの枚数
 * @returns ビンゴカードの配列
 */
export function generateMultipleBingoCards(count: number): number[][][] {
  const cards: number[][][] = [];
  const cardSignatures = new Set<string>();
  
  while (cards.length < count) {
    const card = generateBingoCard();
    
    // カードの一意性を保証するためのシグネチャ生成
    // JSON.stringifyは重い処理なので、実運用では別の方法を検討
    const signature = JSON.stringify(card);
    
    if (!cardSignatures.has(signature)) {
      cards.push(card);
      cardSignatures.add(signature);
    }
    
    // 無限ループ防止（理論上、75!/(70!×5!)^5 通りのカードが可能）
    if (cards.length === 0 && cardSignatures.size > count * 10) {
      throw new Error('Unable to generate enough unique cards');
    }
  }
  
  return cards;
}

/**
 * ビンゴ判定用: 指定された数字がカード上にあるかチェック
 * 
 * @param card ビンゴカード
 * @param number チェックする数字
 * @returns 数字の位置 {row, col} または null
 */
export function findNumberOnCard(
  card: number[][], 
  number: number
): { row: number; col: number } | null {
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (card[row][col] === number) {
        return { row, col };
      }
    }
  }
  return null;
}

/**
 * ビンゴ達成パターンをチェック
 * 
 * @param card ビンゴカード
 * @param drawnNumbers 抽選済みの数字
 * @returns ビンゴが成立している場合true
 */
export function checkBingo(card: number[][], drawnNumbers: number[]): boolean {
  // マークされたセルを記録する2次元配列
  const marked: boolean[][] = Array.from(
    { length: 5 }, 
    () => Array(5).fill(false)
  );
  
  // FREEスペースは最初からマーク
  marked[2][2] = true;
  
  // 抽選された数字をマーク
  for (const num of drawnNumbers) {
    const position = findNumberOnCard(card, num);
    if (position) {
      marked[position.row][position.col] = true;
    }
  }
  
  // 横のラインをチェック
  for (let row = 0; row < 5; row++) {
    if (marked[row].every(cell => cell)) {
      return true;
    }
  }
  
  // 縦のラインをチェック
  for (let col = 0; col < 5; col++) {
    let complete = true;
    for (let row = 0; row < 5; row++) {
      if (!marked[row][col]) {
        complete = false;
        break;
      }
    }
    if (complete) return true;
  }
  
  // 左上から右下の対角線をチェック
  let diagonal1 = true;
  for (let i = 0; i < 5; i++) {
    if (!marked[i][i]) {
      diagonal1 = false;
      break;
    }
  }
  if (diagonal1) return true;
  
  // 右上から左下の対角線をチェック
  let diagonal2 = true;
  for (let i = 0; i < 5; i++) {
    if (!marked[i][4 - i]) {
      diagonal2 = false;
      break;
    }
  }
  if (diagonal2) return true;
  
  return false;
}

// 名前付きオブジェクトとしてデフォルトエクスポート
// ESLint警告を回避しつつ、エクスポートの重複を防ぐ
const bingoUtils = {
  generateBingoCard,
  validateBingoCard,
  formatBingoCard,
  generateMultipleBingoCards,
  findNumberOnCard,
  checkBingo,
};

export default bingoUtils;