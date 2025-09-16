// プレイヤー
export interface Player {
  id: string;
  name: string;
  originalName?: string;
  nameAdjusted?: boolean;
  board: number[][];
  joinedAt: string;
  isConnected: boolean;
  bingoCount: number;
  lastActiveAt?: string;
  bingoAchievedAt?: string;
}

// ゲームセッション
export interface GameSession {
  _id?: string;
  sessionId: string;
  accessToken: string;
  hostId: string;
  gameName: string;
  status: SessionStatus;
  players: Player[];
  maxPlayers: number;
  numbers: number[];
  currentNumber: number | null;
  createdAt: Date;
  expiresAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
}

// セッション状態
export type SessionStatus = 'waiting' | 'playing' | 'finished' | 'expired';

// エラーコード
export enum ErrorCode {
  INVALID_SESSION = 'INVALID_SESSION',
  INVALID_ACCESS_TOKEN = 'INVALID_ACCESS_TOKEN',
  SESSION_FULL = 'SESSION_FULL',
  DUPLICATE_NAME = 'DUPLICATE_NAME',
  GAME_ALREADY_STARTED = 'GAME_ALREADY_STARTED',
  PLAYER_NOT_FOUND = 'PLAYER_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  ACCESS_TOKEN_EXPIRED = 'ACCESS_TOKEN_EXPIRED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED'
}

// ========================================
// APIリクエスト・レスポンス型
// ========================================

// セッション作成リクエスト
export interface CreateSessionRequest {
  gameName: string;
  maxPlayers?: number;
}

// セッション作成レスポンス
export interface CreateSessionResponse {
  sessionId: string;
  accessToken: string;
  hostId: string;
  participationUrl: string;
  expiresAt: string;
}

// ゲーム参加リクエスト
export interface JoinSessionRequest {
  accessToken: string;
  playerName: string;
}

// ゲーム参加レスポンス
export interface JoinSessionResponse {
  playerId: string;
  board: number[][];
  nameAdjustment?: NameAdjustmentResult;
  adjustedName?: string;
}

// 認証データ
export interface AuthenticationData {
  sessionId: string;
  accessToken: string;
  userId?: string;
  role?: 'host' | 'player';
}

// 名前調整結果
export interface NameAdjustmentResult {
  original: string;
  adjusted: string;
  reason: 'duplicate' | 'invalid' | 'length';
}


// QRコード設定
export interface QRCodeOptions {
  size?: number;
  includeText?: boolean;
}

export interface AuthenticationFormProps {
  sessionId?: string;
  accessToken?: string;
  onSubmit: (data: AuthenticationData) => void;
  isLoading?: boolean;
  error?: string;
  allowQRScan?: boolean;
}

// ========================================
// バリデーション
// ========================================

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  type?: 'string' | 'number' | 'boolean';
  custom?: (value: unknown) => boolean | string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  sanitized?: unknown;
}

// ========================================
// 定数定義
// ========================================

export const GAME_CONSTANTS = {
  BINGO_SIZE: 5,
  MAX_NUMBER: 75,
  SESSION_ID_LENGTH: 6,
  ACCESS_TOKEN_LENGTH: 8,
  GAME_DURATION: 7200, // 2時間（秒）
  MAX_PLAYERS: 99,
  MIN_PLAYERS: 2,
  SESSION_ID_CHARSET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  ACCESS_TOKEN_CHARSET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  PLAYER_NAME_MAX_LENGTH: 25,
  GAME_NAME_MAX_LENGTH: 50
} as const;

export const ERROR_MESSAGES = {
  [ErrorCode.INVALID_SESSION]: 'セッションが見つかりません',
  [ErrorCode.INVALID_ACCESS_TOKEN]: 'アクセストークンが無効です',
  [ErrorCode.SESSION_FULL]: 'セッションが満員です',
  [ErrorCode.DUPLICATE_NAME]: '同じ名前のプレイヤーが既に存在します',
  [ErrorCode.GAME_ALREADY_STARTED]: 'ゲームは既に開始されています',
  [ErrorCode.PLAYER_NOT_FOUND]: 'プレイヤーが見つかりません',
  [ErrorCode.UNAUTHORIZED]: '権限がありません',
  [ErrorCode.VALIDATION_ERROR]: '入力内容に誤りがあります',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'アクセスが集中しています。しばらくお待ちください',
  [ErrorCode.INTERNAL_ERROR]: 'サーバーエラーが発生しました',
  [ErrorCode.ACCESS_TOKEN_EXPIRED]: 'アクセストークンの有効期限が切れました',
  [ErrorCode.AUTHENTICATION_FAILED]: '認証に失敗しました'
} as const;

// エラーレスポンス型
export interface APIError {
  error: string;
  code?: ErrorCode;
  details?: string;
}

// ========================================
// コンポーネントのProps型定義
// ========================================

// プレイヤーリストコンポーネントのProps
export interface PlayerListProps {
  players: Player[];
  maxPlayers: number;
  currentPlayerId?: string;
  currentUserId?: string;
  isHost?: boolean;
  onKickPlayer?: (playerId: string) => void;
  showNameAdjustment?: boolean;
  showConnectionStatus?: boolean;
}

// 名前調整通知コンポーネントのProps
export interface NameAdjustmentNotificationProps {
  originalName: string;
  adjustedName: string;
  reason: 'duplicate' | 'invalid' | 'length';
  onAcknowledge: () => void;
}

// ========================================
// ユーティリティ関数の型定義
// ========================================

// 参加URLのパース結果
export interface ParsedParticipationUrl {
  sessionId?: string;
  accessToken?: string;
}

// QRスキャンコンポーネントのProps
export interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  isActive?: boolean;
}

// 時間フォーマット関数の型
export type FormatTimeFunction = (seconds: number) => string;

// ========================================
// 結果画面用の型定義
// ========================================

// ゲーム統計
export interface GameStatistics {
  totalNumbers: number;
  duration: number;
  totalPlayers: number;
  completionRate: number;
}

// 個人統計
export interface PersonalStats {
  rank: number;
  totalPlayers: number;
  bingoCount: number;
  markedCells: number;
  percentile: number;
}

// ビンゴセル
export interface BingoCell {
  number: number;
  marked: boolean;
  isLatest?: boolean;
}

// ========================================
// ページコンポーネントのProps型定義
// ========================================

// ホストゲーム進行画面のProps
export interface HostGamePageProps {
  params: { sessionId: string };
  searchParams: { token?: string };
}

// ゲストゲームプレイ画面のProps
export interface GuestGamePageProps {
  params: { sessionId: string };
  searchParams: { playerId?: string; token?: string };
}

// ホスト結果画面のProps
export interface HostResultPageProps {
  params: { sessionId: string };
  searchParams: { token?: string };
}

// ゲスト結果画面のProps
export interface GuestResultPageProps {
  params: { sessionId: string };
  searchParams: { playerId?: string; token?: string };
}

// ========================================
// コンポーネントのProps型定義
// ========================================

// ビンゴカードコンポーネントのProps
export interface BingoCardProps {
  board: BingoCell[][];
  onCellClick?: (row: number, col: number) => void;
  isInteractive?: boolean;
  bingoLines?: string[];
  showNumbers?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}