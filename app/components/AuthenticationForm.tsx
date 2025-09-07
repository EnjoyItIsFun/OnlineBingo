// components/AuthenticationForm.tsx
// 認証フォームコンポーネント（暖色系デザイン対応版）

import React, { useState, useEffect } from 'react';
import { LogIn, QrCode, Loader2 } from 'lucide-react';
import type { AuthenticationFormProps } from '@/types';

export const AuthenticationForm: React.FC<AuthenticationFormProps> = ({
  sessionId: initialSessionId = '',
  accessToken: initialAccessToken = '',
  onSubmit,
  isLoading = false,
  error,
  allowQRScan = true
}) => {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [accessToken, setAccessToken] = useState(initialAccessToken);
  const [showQRScanner, setShowQRScanner] = useState(false);

  // Props更新時に内部状態も更新
  useEffect(() => {
    setSessionId(initialSessionId);
  }, [initialSessionId]);

  useEffect(() => {
    setAccessToken(initialAccessToken);
  }, [initialAccessToken]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ sessionId, accessToken });
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* セッションID入力 */}
        <div>
          <label htmlFor="sessionId" className="block text-white font-semibold mb-2 drop-shadow-sm">
            セッションID
          </label>
          <input
            type="text"
            id="sessionId"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value.toUpperCase())}
            placeholder="例: ABC123"
            className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/40 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all font-mono text-center"
            maxLength={6}
            required
            disabled={isLoading}
          />
        </div>

        {/* アクセストークン入力 */}
        <div>
          <label htmlFor="accessToken" className="block text-white font-semibold mb-2 drop-shadow-sm">
            アクセストークン
          </label>
          <input
            type="text"
            id="accessToken"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="8桁の英数字"
            className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/40 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all font-mono text-center"
            maxLength={8}
            required
            disabled={isLoading}
          />
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-500/30 backdrop-blur-sm border border-red-400/50 rounded-lg p-3 text-white text-center">
            {error}
          </div>
        )}

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={isLoading || !sessionId.trim() || !accessToken.trim()}
          className={`w-full py-3 px-4 font-bold rounded-lg shadow-lg transform transition hover:scale-105 flex items-center justify-center
            ${isLoading || !sessionId.trim() || !accessToken.trim()
              ? 'bg-gray-500/50 cursor-not-allowed text-white/70'
              : 'bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white'
            }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              認証中...
            </>
          ) : (
            <>
              <LogIn className="w-5 h-5 mr-2" />
              ゲームに参加
            </>
          )}
        </button>

        {/* QRコードスキャンボタン */}
        {allowQRScan && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowQRScanner(!showQRScanner)}
              disabled={isLoading}
              className="text-blue-300 hover:text-blue-100 underline text-sm font-medium flex items-center justify-center mx-auto transition-colors"
            >
              <QrCode className="w-4 h-4 mr-1" />
              QRコードで参加
            </button>
          </div>
        )}

        {/* QRスキャナー表示エリア（将来実装） */}
        {showQRScanner && (
          <div className="text-center py-8 text-white/70">
            <QrCode className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">QRコードスキャナーは開発中です</p>
          </div>
        )}
      </form>
    </div>
  );
};