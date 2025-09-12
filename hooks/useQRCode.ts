// hooks/useQRCode.ts
// QRコード生成・管理Hook（修正版）

'use client';

import { useState, useCallback } from 'react';
import { QRCodeOptions } from '@/types';

interface UseQRCodeReturn {
  qrCodeUrl: string | null;
  isLoading: boolean;
  error: string | null;
  generateQRCode: (text: string, options?: QRCodeOptions) => Promise<void>;
  clearQRCode: () => void;
}

export const useQRCode = (): UseQRCodeReturn => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateQRCode = useCallback(async (text: string, options: QRCodeOptions = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      // QRコードライブラリを動的インポート
      const QRCode = await import('qrcode');
      
      // QRコード生成オプション
      const qrOptions = {
        errorCorrectionLevel: 'M' as const,
        type: 'image/png' as const,
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: options.size || 256
      };

      // QRコード生成
      const url = await QRCode.toDataURL(text, qrOptions);
      setQrCodeUrl(url);
    } catch (err) {
      console.error('QRコード生成エラー:', err);
      setError('QRコードの生成に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearQRCode = useCallback(() => {
    setQrCodeUrl(null);
    setError(null);
  }, []);

  return {
    qrCodeUrl,
    isLoading,
    error,
    generateQRCode,
    clearQRCode
  };
};