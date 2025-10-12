// utils/url.ts
import { NextRequest } from 'next/server';

/**
 * 環境に応じた適切なベースURLを取得
 * 優先順位:
 * 1. Vercel環境変数 (VERCEL_URL)
 * 2. Public環境変数 (NEXT_PUBLIC_BASE_URL)
 * 3. リクエストヘッダー (host)
 * 4. サーバー環境変数 (BASE_URL)
 * 5. デフォルト値 (http://localhost:3000)
 */
export function getBaseUrl(request?: Request | NextRequest): string {
  // 1. Vercel環境変数を優先（本番環境で自動設定される）
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // 2. Next.jsのpublic環境変数（手動設定）
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  
  // 3. リクエストヘッダーから取得（動的）
  if (request) {
    const host = request.headers.get('host');
    if (host) {
      // 本番環境ではHTTPS、開発環境ではHTTPを使用
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      return `${protocol}://${host}`;
    }
  }
  
  // 4. サーバー側環境変数
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }
  
  // 5. デフォルト値（開発環境用）
  return 'http://localhost:3000';
}

/**
 * クライアントサイドで使用可能なベースURLを取得
 * ※ サーバー専用の環境変数にはアクセスできないため、
 *    NEXT_PUBLIC_プレフィックスの環境変数のみを使用
 */
export function getClientBaseUrl(): string {
  // windowオブジェクトが存在する場合は現在のorigin を使用
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // SSR時はpublic環境変数を使用
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  
  // Vercel環境変数（ビルド時に解決される）
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  
  // デフォルト値
  return 'http://localhost:3000';
}

/**
 * 参加用URLを生成
 * @param baseUrl ベースURL
 * @param sessionId セッションID
 * @param accessToken アクセストークン
 * @returns 完全な参加用URL
 */
export function createParticipationUrl(
  baseUrl: string,
  sessionId: string,
  accessToken: string
): string {
  // URLオブジェクトを使用して安全にURLを構築
  const url = new URL('/guest/join', baseUrl);
  url.searchParams.set('session', sessionId);
  url.searchParams.set('token', accessToken);
  return url.toString();
}

/**
 * QRコード表示用のURLを生成
 * @param sessionId セッションID
 * @param accessToken アクセストークン
 * @param request オプショナル - サーバーサイドで利用可能な場合
 * @returns QRコード用URL
 */
export function generateQRCodeUrl(
  sessionId: string,
  accessToken: string,
  request?: Request | NextRequest
): string {
  const baseUrl = request ? getBaseUrl(request) : getClientBaseUrl();
  return createParticipationUrl(baseUrl, sessionId, accessToken);
}

/**
 * URLからセッション情報を抽出
 * @param url 参加用URL
 * @returns セッションIDとアクセストークン
 */
export function parseParticipationUrl(url: string): {
  sessionId: string | null;
  accessToken: string | null;
} {
  try {
    const urlObj = new URL(url);
    return {
      sessionId: urlObj.searchParams.get('session'),
      accessToken: urlObj.searchParams.get('token'),
    };
  } catch (error) {
    console.error('Invalid URL:', error);
    return {
      sessionId: null,
      accessToken: null,
    };
  }
}

/**
 * 相対URLを絶対URLに変換
 * @param path 相対パス
 * @param request オプショナル - サーバーサイドで利用可能な場合
 * @returns 絶対URL
 */
export function toAbsoluteUrl(
  path: string,
  request?: Request | NextRequest
): string {
  const baseUrl = request ? getBaseUrl(request) : getClientBaseUrl();
  
  // すでに絶対URLの場合はそのまま返す
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // パスが/で始まらない場合は追加
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${baseUrl}${normalizedPath}`;
}