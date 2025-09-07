// 名前調整通知コンポーネント

import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { NameAdjustmentNotificationProps } from '@/types';

export const NameAdjustmentNotification: React.FC<NameAdjustmentNotificationProps> = ({
  originalName,
  adjustedName,
  reason,
  onAcknowledge
}) => {
  const getReasonMessage = () => {
    switch (reason) {
      case 'duplicate':
        return '同じ名前の参加者がいたため';
      case 'invalid':
        return '使用できない文字が含まれていたため';
      case 'length':
        return '名前が長すぎたため';
      default:
        return '名前の調整が必要だったため';
    }
  };

  return (
    <div className="fixed top-4 right-4 max-w-sm bg-white rounded-lg shadow-lg border border-yellow-200 p-4 z-50 animate-slide-in">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800 mb-1">
            名前が自動調整されました
          </h3>
          
          <p className="text-sm text-gray-600 mb-2">
            {getReasonMessage()}、名前が調整されました。
          </p>
          
          <div className="bg-gray-50 rounded p-2 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-500">変更前:</span>
              <span className="font-medium line-through text-gray-400">
                {originalName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">変更後:</span>
              <span className="font-medium text-blue-600">
                {adjustedName}
              </span>
            </div>
          </div>
        </div>
        
        <button
          onClick={onAcknowledge}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="閉じる"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};