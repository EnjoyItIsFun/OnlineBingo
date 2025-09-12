// 名前調整機能Hook

import { useState, useCallback, useEffect } from 'react';
import type { NameAdjustmentResult } from '@/types';

export const useNameAdjustment = () => {
  const [nameAdjustment, setNameAdjustment] = useState<NameAdjustmentResult | null>(null);

  // 初回ロード時のチェック
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const adjustmentData = sessionStorage.getItem('nameAdjustment');
    if (adjustmentData) {
      try {
        const parsed = JSON.parse(adjustmentData) as NameAdjustmentResult;
        setNameAdjustment(parsed);
        sessionStorage.removeItem('nameAdjustment');
      } catch (error) {
        console.error('Failed to parse name adjustment data:', error);
      }
    }
  }, []);

  // 名前調整を設定
  const setAdjustment = useCallback((adjustment: NameAdjustmentResult) => {
    setNameAdjustment(adjustment);
  }, []);

  // 名前調整を確認（通知を閉じる）
  const acknowledgeAdjustment = useCallback(() => {
    setNameAdjustment(null);
  }, []);

  return {
    nameAdjustment,
    setAdjustment,
    acknowledgeAdjustment
  };
};