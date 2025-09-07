// components/PlayerList.tsx
// プレイヤー一覧表示コンポーネント（修正版）

import React, { useMemo } from 'react';
import { User, Trophy, Wifi, WifiOff, UserCheck } from 'lucide-react';
import type { Player, PlayerListProps } from '@/types';

export const PlayerList: React.FC<PlayerListProps> = ({
  players,
  currentUserId,
  isHost = false,
  onKickPlayer,
  showNameAdjustment = true,
  showConnectionStatus = true
}) => {
  // ビンゴ数でソート
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      if (a.bingoCount !== b.bingoCount) {
        return b.bingoCount - a.bingoCount;
      }
      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    });
  }, [players]);

  const getPlayerStatusIcon = (player: Player) => {
    if (!showConnectionStatus) return null;
    
    return player.isConnected ? (
      <div className="relative group">
        <Wifi className="w-4 h-4 text-green-500" aria-label="接続中" />
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          接続中
        </div>
      </div>
    ) : (
      <div className="relative group">
        <WifiOff className="w-4 h-4 text-gray-400" aria-label="切断中" />
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          切断中
        </div>
      </div>
    );
  };

  const getPlayerRank = (index: number) => {
    if (index === 0 && sortedPlayers[0].bingoCount > 0) {
      return (
        <div className="relative group">
          <Trophy className="w-5 h-5 text-yellow-500" aria-label="1位" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            1位
          </div>
        </div>
      );
    }
    return null;
  };

  if (players.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>まだ参加者がいません</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedPlayers.map((player, index) => (
        <div
          key={player.id}
          className={`
            flex items-center justify-between p-3 rounded-lg border
            ${player.id === currentUserId 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-gray-50 border-gray-200'
            }
            ${!player.isConnected && showConnectionStatus ? 'opacity-60' : ''}
          `}
        >
          <div className="flex items-center gap-3">
            {/* ランキング */}
            <div className="w-6 text-center">
              {getPlayerRank(index) || (
                <span className="text-sm text-gray-500">
                  {index + 1}
                </span>
              )}
            </div>

            {/* アイコンとステータス */}
            <div className="relative">
              <User className="w-8 h-8 text-gray-400" />
              {player.id === currentUserId && (
                <UserCheck className="w-4 h-4 text-blue-500 absolute -bottom-1 -right-1" />
              )}
            </div>

            {/* 名前 */}
            <div>
              <div className="font-medium text-gray-800">
                {player.name}
                {player.id === currentUserId && (
                  <span className="text-xs text-blue-600 ml-1">(あなた)</span>
                )}
              </div>
              {showNameAdjustment && player.nameAdjusted && (
                <div className="text-xs text-gray-500">
                  元の名前: {player.originalName}
                </div>
              )}
            </div>
          </div>

          {/* 右側の情報 */}
          <div className="flex items-center gap-3">
            {/* ビンゴ数 */}
            {player.bingoCount > 0 && (
              <div className="flex items-center gap-1 bg-yellow-100 px-2 py-1 rounded">
                <Trophy className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-bold text-yellow-700">
                  {player.bingoCount}
                </span>
              </div>
            )}

            {/* 接続状態 */}
            {getPlayerStatusIcon(player)}

            {/* キックボタン（ホストのみ） */}
            {isHost && player.id !== currentUserId && onKickPlayer && (
              <button
                onClick={() => onKickPlayer(player.id)}
                className="text-red-500 hover:text-red-700 text-sm"
                aria-label={`${player.name}を退出させる`}
              >
                退出
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};