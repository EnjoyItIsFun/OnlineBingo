// hooks/useGameTimer.ts
// ゲームタイマー管理Hook

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SessionStatus } from '@/types';
import { formatTime } from '@/utils/validation';

interface UseGameTimerReturn {
  timeRemaining: number;
  formattedTime: string;
  isActive: boolean;
  startTimer: (duration: number) => void;
  stopTimer: () => void;
  resetTimer: () => void;
  updateTimer: (newTime: number) => void;
}

export const useGameTimer = (
  sessionStatus: SessionStatus = 'waiting',
  initialDuration: number = 7200 // 2時間（秒）
): UseGameTimerReturn => {
  const [timeRemaining, setTimeRemaining] = useState(initialDuration);
  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = useCallback((duration: number) => {
    setTimeRemaining(duration);
    setIsActive(true);
  }, []);

  const stopTimer = useCallback(() => {
    setIsActive(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    stopTimer();
    setTimeRemaining(initialDuration);
  }, [initialDuration, stopTimer]);

  const updateTimer = useCallback((newTime: number) => {
    setTimeRemaining(newTime);
  }, []);

  // タイマーの実行
  useEffect(() => {
    if (isActive && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prevTime) => {
          if (prevTime <= 1) {
            setIsActive(false);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, timeRemaining]);

  // セッション状態に応じたタイマー制御
  useEffect(() => {
    switch (sessionStatus) {
      case 'playing':
        if (!isActive) {
          setIsActive(true);
        }
        break;
      case 'finished':
      case 'expired':
        stopTimer();
        break;
      case 'waiting':
      default:
        // 待機中はタイマーを停止
        if (isActive) {
          stopTimer();
        }
        break;
    }
  }, [sessionStatus, isActive, stopTimer]);

  // フォーマットされた時間文字列
  const formattedTime = formatTime(timeRemaining);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    timeRemaining,
    formattedTime,
    isActive,
    startTimer,
    stopTimer,
    resetTimer,
    updateTimer
  };
};