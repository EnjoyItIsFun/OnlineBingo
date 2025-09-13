import { Player } from '@/types';

export function generatePlayerId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let playerId = '';
  
  for (let i = 0; i < 16; i++) {
    playerId += chars[Math.floor(Math.random() * chars.length)];
  }
  
  return playerId;
}

export function generateBingoBoard(): number[][] {
  const board: number[][] = Array(5).fill(null).map(() => Array(5).fill(0));
  
  // BINGO各列の範囲定義
  const ranges = [
    { min: 1, max: 15 },   // B列
    { min: 16, max: 30 },  // I列  
    { min: 31, max: 45 },  // N列
    { min: 46, max: 60 },  // G列
    { min: 61, max: 75 }   // O列
  ];
  
  for (let col = 0; col < 5; col++) {
    const { min, max } = ranges[col];
    const availableNumbers = Array.from(
      { length: max - min + 1 }, 
      (_, i) => min + i
    );
    
    // Fisher-Yates シャッフル
    for (let i = availableNumbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableNumbers[i], availableNumbers[j]] = [availableNumbers[j], availableNumbers[i]];
    }
    
    // 各列から5つ選択
    for (let row = 0; row < 5; row++) {
      board[row][col] = availableNumbers[row];
    }
  }
  
  // 中央マスをフリーに（伝統的ルール）
  board[2][2] = 0;
  
  return board;
}

/**
 * 名前の重複をチェックし、必要に応じて調整する関数
 * 
 * 歴史的背景：
 * - 初期のオンラインゲームでは名前の重複を許可しないことが一般的でした
 * - 現在は、UXを優先し、自動的に番号を付与する方式が主流です
 * - Discord、Slack、Zoomなどのモダンなサービスの方式を参考
 */
export function adjustPlayerName(baseName: string, existingPlayers: Player[]): {
  adjustedName: string;
  wasAdjusted: boolean;
} {
  const existingNames = existingPlayers.map(p => p.name);
  
  // 基本名が重複していない場合
  if (!existingNames.includes(baseName)) {
    return {
      adjustedName: baseName,
      wasAdjusted: false
    };
  }
  
  // 重複している場合は番号を付与
  let counter = 2;
  let adjustedName = `${baseName}_${counter}`;
  
  while (existingNames.includes(adjustedName)) {
    counter++;
    adjustedName = `${baseName}_${counter}`;
  }
  
  return {
    adjustedName,
    wasAdjusted: true
  };
}

/**
 * セッションIDを生成（6桁の英数字大文字）
 * 
 * 歴史的背景：
 * - 初期のオンラインゲームでは長いURLが一般的でした
 * - 現在は短く覚えやすいコードが主流（Zoom、Kahootなど）
 */
export function generateSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let sessionId = '';
  
  for (let i = 0; i < 6; i++) {
    sessionId += chars[Math.floor(Math.random() * chars.length)];
  }
  
  return sessionId;
}

/**
 * アクセストークンを生成（8桁の英数字大文字）
 * 
 * セキュリティの観点：
 * - セッションIDだけでは推測可能なため、追加の認証層として機能
 * - 8桁で約2.8兆通りの組み合わせ
 */
export function generateAccessToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  
  for (let i = 0; i < 8; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  
  return token;
}

/**
 * ビンゴボードの検証
 * 生成されたボードが正しい形式かチェック
 */
export function validateBingoBoard(board: number[][]): boolean {
  // 基本構造チェック
  if (!board || board.length !== 5) {
    return false;
  }
  
  if (board.some(row => !row || row.length !== 5)) {
    return false;
  }
  
  // 中央フリーチェック
  if (board[2][2] !== 0) {
    return false;
  }
  
  // 各列の範囲チェック
  const ranges = [
    { min: 1, max: 15 },
    { min: 16, max: 30 },
    { min: 31, max: 45 },
    { min: 46, max: 60 },
    { min: 61, max: 75 }
  ];
  
  for (let col = 0; col < 5; col++) {
    const range = ranges[col];
    
    for (let row = 0; row < 5; row++) {
      // 中央マスはスキップ
      if (col === 2 && row === 2) continue;
      
      const value = board[row][col];
      
      if (value < range.min || value > range.max) {
        return false;
      }
    }
  }
  
  // 列内重複チェック
  for (let col = 0; col < 5; col++) {
    const colValues = board.map(row => row[col]).filter(v => v !== 0);
    const uniqueValues = new Set(colValues);
    
    if (colValues.length !== uniqueValues.size) {
      return false;
    }
  }
  
  return true;
}

/**
 * ビンゴ判定
 * 指定された数字でビンゴが成立しているかチェック
 */
export function checkBingo(board: number[][], calledNumbers: number[]): {
  isBingo: boolean;
  bingoLines: number;
  winningPatterns: string[];
} {
  const marked: boolean[][] = Array(5).fill(null).map(() => Array(5).fill(false));
  const winningPatterns: string[] = [];
  let bingoLines = 0;
  
  // 中央フリースペースは最初からマーク
  marked[2][2] = true;
  
  // 呼ばれた数字をマーク
  for (const num of calledNumbers) {
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (board[row][col] === num) {
          marked[row][col] = true;
        }
      }
    }
  }
  
  // 横のラインをチェック
  for (let row = 0; row < 5; row++) {
    if (marked[row].every(cell => cell)) {
      bingoLines++;
      winningPatterns.push(`横${row + 1}列目`);
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
    if (complete) {
      bingoLines++;
      const colNames = ['B', 'I', 'N', 'G', 'O'];
      winningPatterns.push(`縦${colNames[col]}列`);
    }
  }
  
  // 左上から右下の対角線をチェック
  let diagonal1 = true;
  for (let i = 0; i < 5; i++) {
    if (!marked[i][i]) {
      diagonal1 = false;
      break;
    }
  }
  if (diagonal1) {
    bingoLines++;
    winningPatterns.push('斜め（左上→右下）');
  }
  
  // 右上から左下の対角線をチェック
  let diagonal2 = true;
  for (let i = 0; i < 5; i++) {
    if (!marked[i][4 - i]) {
      diagonal2 = false;
      break;
    }
  }
  if (diagonal2) {
    bingoLines++;
    winningPatterns.push('斜め（右上→左下）');
  }
  
  return {
    isBingo: bingoLines > 0,
    bingoLines,
    winningPatterns
  };
}

/**
 * 番号抽選
 * まだ呼ばれていない番号からランダムに選択
 */
export function drawNumber(calledNumbers: number[]): number | null {
  const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
  const availableNumbers = allNumbers.filter(num => !calledNumbers.includes(num));
  
  if (availableNumbers.length === 0) {
    return null; // すべての番号が呼ばれた
  }
  
  const randomIndex = Math.floor(Math.random() * availableNumbers.length);
  return availableNumbers[randomIndex];
}

/**
 * 番号を文字付きで表示（B-15、I-20など）
 */
export function formatBingoNumber(number: number): string {
  if (number < 1 || number > 75) {
    return String(number);
  }
  
  const column = Math.floor((number - 1) / 15);
  const columns = ['B', 'I', 'N', 'G', 'O'];
  
  return `${columns[column]}-${number}`;
}