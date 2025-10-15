// types/index.ts

// Pusherの型定義を追加
import type { default as PusherClient } from 'pusher-js';
import type { Channel, PresenceChannel } from 'pusher-js';

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

// ========================================
// リアルタイム接続関連の型定義
// ========================================

// 接続タイプ
export type ConnectionType = 'socket' | 'pusher';

// イベントハンドラーの汎用型（ジェネリック対応）
export type RealtimeEventHandler<T = unknown> = (data: T) => void;

// チャンネルメンバー情報
export interface RealtimeMemberInfo {
  id: string;
  name: string;
  role: 'host' | 'player' | 'observer';
  isHost?: boolean;
  board?: number[][];
  bingoCount?: number;
  [key: string]: unknown;
}

// リアルタイム接続の戻り値型
export interface UseRealtimeConnectionReturn {
  isConnected: boolean;
  isConnecting: boolean;
  connectionType: ConnectionType;
  emit: (eventName: string, data: Record<string, unknown>) => void | Promise<void>;
  on: <T = unknown>(eventName: string, callback: RealtimeEventHandler<T>) => void;
  off: <T = unknown>(eventName: string, callback?: RealtimeEventHandler<T>) => void;
  reconnect: () => void;
  members: Map<string, RealtimeMemberInfo>;
}

// Pusher接続の戻り値型
export interface UsePusherConnectionReturn {
  pusher: PusherClient | null;
  channel: Channel | PresenceChannel | null;
  isConnected: boolean;
  isConnecting: boolean;
  members: Map<string, RealtimeMemberInfo>;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  emit: (eventName: string, data: Record<string, unknown>) => Promise<void>;
  on: <T = unknown>(eventName: string, callback: RealtimeEventHandler<T>) => void;
  off: <T = unknown>(eventName: string, callback?: RealtimeEventHandler<T>) => void;
}

// ========================================
// Socket.io イベント型定義
// ========================================

export interface SocketEvents {
  // クライアント → サーバー
  joinGame: (data: { sessionId: string; userId: string; role: 'host' | 'player' }) => void;
  drawNumber: (data: { sessionId: string; number: number }) => void;
  start_game: (data: { sessionId: string }) => void;
  reset_game: (data: { sessionId: string }) => void;
  draw_number: (data: { sessionId: string; number: number }) => void;
  cancel_session: (data: { sessionId: string }) => void;
  
  // サーバー → クライアント
  number_drawn: (data: { number: number; drawnNumbers: number[] }) => void;
  player_bingo: (data: { player: Player; bingoCount: number }) => void;
  game_started: (data?: { sessionId: string }) => void;
  player_joined: (player: Player) => void;
  player_left: (playerId: string) => void;
  session_updated: (session: GameSession) => void;
  connection_error: (error: string) => void;
  session_cancelled: (data: { sessionId: string }) => void;
  
  // 再接続関連
  reconnect: (data: { sessionId: string; userId: string; role: 'host' | 'player' }) => void;
  stateRestored: (data: { gameState: GameSession; playerBoard?: number[][] }) => void;
  reconnectError: (data: { message: string }) => void;
}

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

// セッション離脱リクエスト
export interface LeaveSessionRequest {
  playerId: string;
  accessToken: string;
}

// セッション離脱レスポンス
export interface LeaveSessionResponse {
  success: boolean;
  message: string;
  session?: GameSession;
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

// 再接続データ
export interface ReconnectionData {
  sessionId: string;
  accessToken: string;
  playerId: string;
  playerName: string;
  lastActiveAt: string;
  expiresAt: string;
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
// APIルート用の型定義（Next.js 15対応）
// ========================================

// APIルートのコンテキスト型（Next.js 15）
export interface APIRouteContext<T = Record<string, string>> {
  params: Promise<T>;
}

// セッション関連のルートパラメータ
export interface SessionRouteParams {
  sessionId: string;
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
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ token?: string }>;
}

// ゲストゲームプレイ画面のProps
export interface GuestGamePageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ playerId?: string; token?: string }>;
}

// ホスト結果画面のProps
export interface HostResultPageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ token?: string }>;
}

// ゲスト結果画面のProps
export interface GuestResultPageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ playerId?: string; token?: string }>;
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

// ========================================
// MongoDB関連の型定義
// ========================================

import type { Db, MongoClient } from 'mongodb';

// MongoDB接続の戻り値型
export interface DatabaseConnection {
  client: MongoClient;
  db: Db;
}

// getDatabase関数の戻り値型  
export type GetDatabaseReturn = Promise<DatabaseConnection>;

// MongoDB操作用のヘルパー型
export interface DatabaseHelpers {
  getDatabase: () => GetDatabaseReturn;
  getDb: () => Promise<Db>;
  getClient: () => Promise<MongoClient>;
}

// セッションドキュメントの型（MongoDB用）
export interface SessionDocument extends Omit<GameSession, 'createdAt' | 'expiresAt' | 'startedAt' | 'finishedAt'> {
  createdAt: Date;
  expiresAt: Date;
  updatedAt?: Date;
  startedAt?: Date;
  finishedAt?: Date;
}

// プレイヤードキュメントの型（MongoDB用）  
export interface PlayerDocument extends Omit<Player, 'joinedAt' | 'lastActiveAt'> {
  joinedAt: Date;
  lastActiveAt?: Date;
}
// ========================================
// 番号抽選関連の型定義
// ========================================

// 番号抽選APIのリクエスト
export interface DrawNumberRequest {
  accessToken: string;
  hostId: string;
}

// 番号抽選APIのレスポンス
export interface DrawNumberResponse {
  success: boolean;
  number: number;
  bingoLetter: string;
  drawnNumbers: number[];
  message: string;
  warning?: string;
}

// 番号抽選状態取得のレスポンス
export interface DrawStatusResponse {
  drawnNumbers: number[];
  currentNumber: number | null;
  status: SessionStatus;
  totalDrawn: number;
}

// ========================================
// Pusherイベントのペイロード型定義
// ========================================

// 番号が引かれた時のイベントデータ
export interface NumberDrawnEventData {
  number: number;
  bingoLetter: string;
  drawnNumbers: number[];
  drawnAt: string;
}

// プレイヤーがビンゴした時のイベントデータ
export interface PlayerBingoEventData {
  player: Player;
  bingoCount: number;
  lines?: string[];
  achievedAt?: string;
}

// ゲーム開始時のイベントデータ
export interface GameStartedEventData {
  sessionId?: string;
  startedAt?: string;
}

// セッション更新時のイベントデータ
export interface SessionUpdatedEventData {
  session: GameSession;
  updateType?: 'player_joined' | 'player_left' | 'status_changed' | 'number_drawn';
}

// ========================================
// ビンゴカード関連の型定義
// ========================================

// ビンゴのセル
export interface BingoCell {
  number: number;
  marked: boolean;
  isLatest?: boolean;
}

// ビンゴ判定の結果
export interface BingoCheckResult {
  count: number;
  lines: string[];
  newBingo: boolean;
}

// ========================================
// ゲームページコンポーネントの内部状態型
// ========================================

// ホストゲーム画面の状態
export interface HostGameState {
  session: GameSession | null;
  drawnNumbers: number[];
  currentNumber: number | null;
  remainingNumbers: number[];
  isLoading: boolean;
  isDrawing: boolean;
  error: string | null;
  isConfirmingEnd: boolean;
}

// ゲストゲーム画面の状態
export interface GuestGameState {
  session: GameSession | null;
  board: BingoCell[][];
  currentNumber: number | null;
  drawnNumbers: number[];
  bingoLines: string[];
  bingoCount: number;
  showBingoAnimation: boolean;
  loading: boolean;
  error: string | null;
  playerName: string;
}