// utils/api.ts
// API関連ユーティリティ

import { 
  JoinSessionRequest, 
  JoinSessionResponse, 
  AuthenticationData,
  GameSession,
  APIError 
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * APIエラーレスポンスをチェックし、適切なエラーを投げる
 */
const handleApiResponse = async (response: Response) => {
  if (!response.ok) {
    let errorMessage = 'APIエラーが発生しました';
    
    try {
      const errorData: APIError = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // JSONパースに失敗した場合はステータステキストを使用
      errorMessage = response.statusText || errorMessage;
    }
    
    throw new Error(errorMessage);
  }
  
  return response.json();
};

/**
 * セッションに参加
 */
export const joinSession = async (
  sessionId: string, 
  request: JoinSessionRequest
): Promise<JoinSessionResponse> => {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleApiResponse(response);
};

/**
 * セッション情報を取得
 */
export const getSession = async (
  sessionId: string, 
  accessToken: string
): Promise<GameSession> => {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  return handleApiResponse(response);
};

/**
 * 認証データの検証
 */
export const validateAuthentication = async (
  authData: AuthenticationData
): Promise<{ valid: boolean; session?: GameSession; error?: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(authData),
    });

    if (!response.ok) {
      const errorData: APIError = await response.json();
      return {
        valid: false,
        error: errorData.error || '認証に失敗しました'
      };
    }

    const session: GameSession = await response.json();
    return {
      valid: true,
      session
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : '認証エラーが発生しました'
    };
  }
};

/**
 * プレイヤーのセッション離脱
 */
export const leaveSession = async (
  sessionId: string,
  playerId: string,
  accessToken: string
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/leave`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ playerId }),
  });

  await handleApiResponse(response);
};

/**
 * プレイヤーの再接続
 */
export const reconnectPlayer = async (
  sessionId: string,
  playerId: string,
  accessToken: string
): Promise<GameSession> => {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/reconnect`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ playerId }),
  });

  return handleApiResponse(response);
};

/**
 * 参加URLの生成
 */
export const generateParticipationUrl = (
  sessionId: string, 
  accessToken: string,
  baseUrl: string = typeof window !== 'undefined' ? window.location.origin : ''
): string => {
  const url = new URL(`${baseUrl}/guest/join`);
  url.searchParams.set('sessionId', sessionId);
  url.searchParams.set('accessToken', accessToken);
  return url.toString();
};

/**
 * ビンゴボードの生成（クライアントサイド用）
 */
export const generateBingoBoard = (): number[][] => {
  const board: number[][] = [];
  const ranges = [
    [1, 15],   // B列
    [16, 30],  // I列
    [31, 45],  // N列
    [46, 60],  // G列
    [61, 75]   // O列
  ];

  for (let col = 0; col < 5; col++) {
    const column: number[] = [];
    const [min, max] = ranges[col];
    const available = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    
    for (let row = 0; row < 5; row++) {
      if (col === 2 && row === 2) {
        // 中央はフリースペース
        column.push(0);
      } else {
        const randomIndex = Math.floor(Math.random() * available.length);
        const number = available.splice(randomIndex, 1)[0];
        column.push(number);
      }
    }
    
    board.push(column);
  }

  // 行と列を転置して正しい形式にする
  const transposed: number[][] = [];
  for (let row = 0; row < 5; row++) {
    transposed.push([]);
    for (let col = 0; col < 5; col++) {
      transposed[row].push(board[col][row]);
    }
  }

  return transposed;
};

/**
 * エラーメッセージの正規化
 */
export const normalizeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object' && 'error' in error) {
    const errorObj = error as Record<string, unknown>;
    return String(errorObj.error);
  }
  
  return '予期しないエラーが発生しました';
};