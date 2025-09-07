// utils/validation.ts
// オンラインビンゴアプリケーション - バリデーション関数（修正版）

import { 
  ValidationResult, 
  JoinSessionRequest,
  AuthenticationData,
  GAME_CONSTANTS
} from '@/types';

/**
 * セッション参加リクエストのバリデーション
 */
export const validateJoinSessionRequest = (data: unknown): ValidationResult => {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: ['無効なリクエストデータです'],
      sanitized: null
    };
  }

  const request = data as Record<string, unknown>;
  
  // アクセストークンの検証
  if (!request.accessToken || typeof request.accessToken !== 'string') {
    errors.push('アクセストークンが必要です');
  } else if (request.accessToken.length !== GAME_CONSTANTS.ACCESS_TOKEN_LENGTH) {
    errors.push('アクセストークンの形式が正しくありません');
  }

  // プレイヤー名の検証
  if (!request.playerName || typeof request.playerName !== 'string') {
    errors.push('プレイヤー名が必要です');
  } else {
    const trimmedName = request.playerName.trim();
    if (trimmedName.length === 0) {
      errors.push('プレイヤー名を入力してください');
    } else if (trimmedName.length > GAME_CONSTANTS.PLAYER_NAME_MAX_LENGTH) {
      errors.push(`プレイヤー名は${GAME_CONSTANTS.PLAYER_NAME_MAX_LENGTH}文字以内で入力してください`);
    }
  }

  const sanitized: JoinSessionRequest = {
    accessToken: (request.accessToken as string || '').trim(),
    playerName: (request.playerName as string || '').trim()
  };

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
};

/**
 * 認証データのバリデーション
 */
export const validateAuthenticationData = (data: unknown): ValidationResult => {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: ['無効な認証データです'],
      sanitized: null
    };
  }

  const authData = data as Record<string, unknown>;
  
  // セッションIDの検証
  if (!authData.sessionId || typeof authData.sessionId !== 'string') {
    errors.push('セッションIDが必要です');
  } else if (authData.sessionId.length !== GAME_CONSTANTS.SESSION_ID_LENGTH) {
    errors.push('セッションIDの形式が正しくありません');
  }

  // アクセストークンの検証
  if (!authData.accessToken || typeof authData.accessToken !== 'string') {
    errors.push('アクセストークンが必要です');
  } else if (authData.accessToken.length !== GAME_CONSTANTS.ACCESS_TOKEN_LENGTH) {
    errors.push('アクセストークンの形式が正しくありません');
  }

  const sanitized: AuthenticationData = {
    sessionId: (authData.sessionId as string || '').trim(),
    accessToken: (authData.accessToken as string || '').trim(),
    userId: authData.userId as string,
    role: (authData.role as 'host' | 'player') || 'player'
  };

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
};

/**
 * セッションIDの形式検証
 */
export const isValidSessionId = (sessionId: string): boolean => {
  if (typeof sessionId !== 'string') return false;
  return /^[A-Z0-9]{6}$/.test(sessionId);
};

/**
 * アクセストークンの形式検証
 */
export const isValidAccessToken = (accessToken: string): boolean => {
  if (typeof accessToken !== 'string') return false;
  return /^[A-Z0-9]{8}$/.test(accessToken);
};

/**
 * プレイヤー名の検証
 */
export const isValidPlayerName = (playerName: string): boolean => {
  if (typeof playerName !== 'string') return false;
  const trimmed = playerName.trim();
  return trimmed.length > 0 && trimmed.length <= GAME_CONSTANTS.PLAYER_NAME_MAX_LENGTH;
};

/**
 * 参加URLの解析
 */
export const parseParticipationUrl = (url: string): { sessionId?: string; accessToken?: string } => {
  try {
    const urlObj = new URL(url);
    const sessionId = urlObj.searchParams.get('sessionId') || undefined;
    const accessToken = urlObj.searchParams.get('accessToken') || undefined;
    
    return { sessionId, accessToken };
  } catch {
    return {};
  }
};

/**
 * 時間フォーマット（秒を mm:ss 形式に変換）
 */
export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * デバッグログ出力
 */
export const debugLog = (message: string, data?: unknown): void => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${message}`, data);
  }
};

/**
 * エラーログ出力
 */
export const errorLog = (message: string, error?: unknown): void => {
  console.error(`[ERROR] ${message}`, error);
};