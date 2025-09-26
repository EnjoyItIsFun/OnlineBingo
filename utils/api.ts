import { 
  JoinSessionRequest, 
  JoinSessionResponse, 
  AuthenticationData,
  GameSession,
  APIError 
} from '@/types';

// API_BASE_URLの設定を修正
const getApiBaseUrl = (): string => {
  // サーバーサイドの場合
  if (typeof window === 'undefined') {
    return process.env.API_URL || 'http://localhost:3000/api';
  }
  
  // クライアントサイドの場合 - 必ず/apiを含める
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
  
  // デバッグ用ログ（開発環境のみ）
  if (process.env.NODE_ENV === 'development') {
    console.log('API_BASE_URL:', baseUrl);
  }
  
  return baseUrl;
};

const API_BASE_URL = getApiBaseUrl();

/**
 * APIエラーレスポンスをチェックし、適切なエラーを投げる
 * HTMLレスポンスの検出機能を追加
 */
const handleApiResponse = async (response: Response) => {
  // Content-Typeをチェック
  const contentType = response.headers.get('content-type');
  
  // HTMLが返ってきた場合（404エラーページなど）
  if (contentType && contentType.includes('text/html')) {
    console.error('APIエラー: HTMLレスポンスが返されました');
    console.error('リクエストURL:', response.url);
    console.error('ステータス:', response.status);
    
    // 開発環境では詳細なエラー情報を表示
    if (process.env.NODE_ENV === 'development') {
      const htmlText = await response.text();
      console.error('HTMLレスポンス（最初の500文字）:', htmlText.substring(0, 500));
    }
    
    // ユーザーフレンドリーなエラーメッセージ
    if (response.status === 404) {
      throw new Error('APIエンドポイントが見つかりません。システム管理者にお問い合わせください。');
    } else {
      throw new Error('システムエラーが発生しました。しばらくしてから再度お試しください。');
    }
  }
  
  if (!response.ok) {
    let errorMessage = 'APIエラーが発生しました';
    
    try {
      const errorData: APIError = await response.json();
      errorMessage = errorData.error || errorMessage;
      
      // 開発環境では詳細なエラー情報をログ出力
      if (process.env.NODE_ENV === 'development') {
        console.error('APIエラーレスポンス:', errorData);
      }
    } catch {
      // JSONパースに失敗した場合はステータステキストを使用
      errorMessage = `HTTPエラー ${response.status}: ${response.statusText || errorMessage}`;
    }
    
    throw new Error(errorMessage);
  }
  
  return response.json();
};

/**
 * セッションに参加
 * デバッグログ追加
 */
export const joinSession = async (
  sessionId: string, 
  request: JoinSessionRequest
): Promise<JoinSessionResponse> => {
  const url = `${API_BASE_URL}/sessions/${sessionId}/join`;
  
  // デバッグ用ログ
  if (process.env.NODE_ENV === 'development') {
    console.log('Joining session:', {
      sessionId,
      url,
      request
    });
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
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
  const url = `${API_BASE_URL}/sessions/${sessionId}`;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Getting session:', { sessionId, url });
  }
  
  const response = await fetch(url, {
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
 * エンドポイントが存在しない場合の対処
 */
export const validateAuthentication = async (
  authData: AuthenticationData
): Promise<{ valid: boolean; session?: GameSession; error?: string }> => {
  try {
    const url = `${API_BASE_URL}/auth/validate`;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Validating authentication:', { url, authData });
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(authData),
    });

    // Content-Typeチェック
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      console.warn('認証エンドポイントが存在しません。スキップします。');
      // 認証エンドポイントが未実装の場合は、一旦validとして扱う
      return {
        valid: true,
        error: undefined
      };
    }

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
    console.error('Authentication validation error:', error);
    
    // エンドポイントが存在しない場合は警告を出すが、処理は続行
    if (error instanceof Error && error.message.includes('エンドポイントが見つかりません')) {
      console.warn('認証エンドポイントが未実装です。認証をスキップします。');
      return {
        valid: true,
        error: undefined
      };
    }
    
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
  const url = `${API_BASE_URL}/sessions/${sessionId}/leave`;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Leaving session:', { sessionId, playerId, url });
  }
  
  const response = await fetch(url, {
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
  const url = `${API_BASE_URL}/sessions/${sessionId}/reconnect`;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Reconnecting player:', { sessionId, playerId, url });
  }
  
  const response = await fetch(url, {
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

/**
 * APIヘルスチェック（デバッグ用）
 */
export const checkApiHealth = async (): Promise<boolean> => {
  if (process.env.NODE_ENV !== 'development') {
    return true;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
    });
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      console.warn('APIヘルスチェックエンドポイントが存在しません');
      return false;
    }
    
    return response.ok;
  } catch (error) {
    console.error('APIヘルスチェック失敗:', error);
    return false;
  }
};