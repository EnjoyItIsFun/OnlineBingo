'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, Copy, CheckCircle, Wifi, WifiOff, AlertCircle, RefreshCw, MoreVertical } from 'lucide-react';
import QRCode from 'qrcode';
import { getClientBaseUrl, createParticipationUrl } from '@/utils/url';
import { usePusherConnection } from '@/hooks/usePusherConnection';
import { getSession, normalizeErrorMessage } from '@/utils/api';
import type { GameSession } from '@/types';

interface SessionInfo {
  sessionId: string;
  accessToken: string;
  hostId: string;
  gameName: string;
  maxPlayers: number;
  participationUrl: string;
  qrCodeDataUrl: string;
}

function WaitingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // URLパラメータの取得（LocalStorageフォールバック付き）
  const urlSessionId = searchParams.get('sessionId');
  const urlAccessToken = searchParams.get('accessToken');
  const urlHostId = searchParams.get('hostId');
  
  // LocalStorageから復元を試みる
  const [sessionId, setSessionId] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [hostId, setHostId] = useState<string>('');
  
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  // DBから取得したセッション情報
  const [session, setSession] = useState<GameSession | null>(null);
  const [copied, setCopied] = useState<'sessionId' | 'accessToken' | 'url' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // 退出メニューの状態管理
  const [menuState, setMenuState] = useState<'closed' | 'open' | 'confirming'>('closed');

  // パラメータの初期化とLocalStorage管理
  useEffect(() => {
    console.log('=== ホスト待機画面 初期化開始 ===');
    console.log('URLパラメータ:', {
      sessionId: urlSessionId,
      accessToken: urlAccessToken,
      hostId: urlHostId
    });

    // URLパラメータがある場合は優先
    if (urlSessionId && urlAccessToken && urlHostId) {
      console.log('URLパラメータから設定');
      setSessionId(urlSessionId);
      setAccessToken(urlAccessToken);
      setHostId(urlHostId);
      
      // LocalStorageに保存（次回アクセス用）
      localStorage.setItem('lastSessionId', urlSessionId);
      localStorage.setItem('lastAccessToken', urlAccessToken);
      localStorage.setItem('lastHostId', urlHostId);
      
      // hostSession形式でも保存
      const hostSession = {
        sessionId: urlSessionId,
        accessToken: urlAccessToken,
        hostId: urlHostId
      };
      localStorage.setItem('hostSession', JSON.stringify(hostSession));
      
      setIsInitializing(false);
    } else {
      // URLパラメータがない場合、LocalStorageから復元を試みる
      console.log('LocalStorageから復元を試みます');
      
      // 方法1: hostSessionから
      const hostSessionStr = localStorage.getItem('hostSession');
      if (hostSessionStr) {
        try {
          const hostSession = JSON.parse(hostSessionStr);
          if (hostSession.sessionId && hostSession.accessToken && hostSession.hostId) {
            console.log('hostSessionから復元:', hostSession);
            setSessionId(hostSession.sessionId);
            setAccessToken(hostSession.accessToken);
            setHostId(hostSession.hostId);
            setIsInitializing(false);
            return;
          }
        } catch (e) {
          console.error('hostSessionのパースエラー:', e);
        }
      }
      
      // 方法2: 個別のキーから
      const lastSessionId = localStorage.getItem('lastSessionId');
      const lastAccessToken = localStorage.getItem('lastAccessToken');
      const lastHostId = localStorage.getItem('lastHostId');
      
      if (lastSessionId && lastAccessToken && lastHostId) {
        console.log('個別キーから復元:', {
          sessionId: lastSessionId,
          accessToken: lastAccessToken,
          hostId: lastHostId
        });
        setSessionId(lastSessionId);
        setAccessToken(lastAccessToken);
        setHostId(lastHostId);
        setIsInitializing(false);
      } else {
        console.error('必要な情報が取得できません。作成画面へリダイレクトします。');
        setError('セッション情報が見つかりません。新しくゲームを作成してください。');
        setTimeout(() => {
          router.push('/host/create');
        }, 3000);
      }
    }
  }, [urlSessionId, urlAccessToken, urlHostId, router]);

  // Pusher接続前に認証情報を保存
  useEffect(() => {
    if (sessionId && accessToken && hostId) {
      console.log('Pusher認証情報を設定');
      // ホスト用の認証情報をLocalStorageに保存（Pusher接続用）
      const reconnectionData = {
        sessionId,
        accessToken,
        playerId: hostId,
        playerName: 'Host',
        lastActiveAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };
      localStorage.setItem('reconnectionData', JSON.stringify(reconnectionData));
      console.log('reconnectionData保存:', reconnectionData);
    }
  }, [sessionId, accessToken, hostId]);

  // Pusher接続（sessionIdが確定してから）
  const { isConnected, emit, on, off, members } = usePusherConnection(sessionId || null);

  // APIから参加者リストを取得する関数
  const fetchSessionData = useCallback(async () => {
    if (!sessionId || !accessToken) return;
    
    try {
      console.log('APIからセッション情報を取得中...');
      const sessionData = await getSession(sessionId, accessToken);
      console.log('セッション情報取得完了:', sessionData);
      setSession(sessionData);
      setError(null);
    } catch (err) {
      console.error('セッション情報の取得に失敗:', err);
      const errorMessage = normalizeErrorMessage(err);
      if (errorMessage.includes('見つかりません') || errorMessage.includes('期限切れ')) {
        setError('セッションが終了しました');
      }
    }
  }, [sessionId, accessToken]);

  // 初期データ読み込み
  useEffect(() => {
    if (sessionId && accessToken && !isInitializing) {
      fetchSessionData();
    }
  }, [sessionId, accessToken, isInitializing, fetchSessionData]);

  // フォアグラウンド復帰時にセッション状態を再取得
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && sessionId && accessToken) {
        console.log('=== ホスト: フォアグラウンド復帰を検知 ===');
        fetchSessionData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sessionId, accessToken, fetchSessionData]);

  // 定期的に参加者リストを更新（30秒ごと）
  useEffect(() => {
    if (!sessionId || !accessToken || isInitializing) return;

    const interval = setInterval(() => {
      console.log('定期ポーリング: 参加者リスト更新');
      fetchSessionData();
    }, 30000);

    return () => clearInterval(interval);
  }, [sessionId, accessToken, isInitializing, fetchSessionData]);

  // セッション情報の生成（QRコード等）
  useEffect(() => {
    if (!sessionId || !accessToken || !hostId) {
      console.log('セッション情報生成スキップ（パラメータ不足）');
      return;
    }

    console.log('セッション情報を生成します');

    // LocalStorageからゲーム名を取得
    const storedSessionKey = `session_${sessionId}`;
    const storedSession = localStorage.getItem(storedSessionKey);
    let gameName = 'ビンゴ大会';
    let maxPlayers = 25;
    
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession);
        gameName = parsed.name || gameName;
        maxPlayers = parsed.maxPlayers || maxPlayers;
        console.log('保存済みセッション情報:', parsed);
      } catch (e) {
        console.error('セッション情報のパースエラー:', e);
      }
    } else {
      // セッション情報がない場合は新規作成として保存
      const newSessionInfo = {
        name: gameName,
        maxPlayers: maxPlayers,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(storedSessionKey, JSON.stringify(newSessionInfo));
      console.log('新規セッション情報を保存:', newSessionInfo);
    }

    // 参加用URLとQRコード生成
    const baseUrl = getClientBaseUrl();
    const participationUrl = createParticipationUrl(baseUrl, sessionId, accessToken);
    console.log('参加URL生成:', participationUrl);

    QRCode.toDataURL(participationUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: 256,
    }).then(qrCodeDataUrl => {
      const info: SessionInfo = {
        sessionId,
        accessToken,
        hostId,
        gameName,
        maxPlayers,
        participationUrl,
        qrCodeDataUrl,
      };
      console.log('SessionInfo設定完了:', info);
      setSessionInfo(info);
      setError(null);
    }).catch(err => {
      console.error('QRコード生成エラー:', err);
      setError('QRコードの生成に失敗しました');
    });
  }, [sessionId, accessToken, hostId]);

  // Pusherイベントリスナー設定（参加者追加/離脱時にAPIから再取得）
  useEffect(() => {
    if (!isConnected || !sessionId) {
      console.log('Pusherイベント設定スキップ（未接続）');
      return;
    }

    console.log('Pusherイベントリスナー設定開始');
    console.log('Pusher接続状態:', isConnected);
    console.log('現在のメンバー数:', members?.size || 0);

    const handlePlayerJoined = (data: unknown) => {
      console.log('player_joined イベント受信:', data);
      // APIから最新の参加者リストを取得
      fetchSessionData();
    };

    const handlePlayerLeft = (data: unknown) => {
      console.log('player_left イベント受信:', data);
      // APIから最新の参加者リストを取得
      fetchSessionData();
    };

    on('player_joined', handlePlayerJoined);
    on('player_left', handlePlayerLeft);

    return () => {
      off('player_joined', handlePlayerJoined);
      off('player_left', handlePlayerLeft);
    };
  }, [isConnected, sessionId, members, on, off, fetchSessionData]);

  // デバッグ情報の定期出力
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('=== デバッグ情報 ===');
      console.log('SessionId:', sessionId);
      console.log('AccessToken:', accessToken);
      console.log('HostId:', hostId);
      console.log('SessionInfo:', sessionInfo ? '設定済み' : '未設定');
      console.log('Session(API):', session ? `参加者${session.players.length}人` : '未取得');
      console.log('Pusher接続:', isConnected);
      console.log('Pusherメンバー数:', members?.size || 0);
      console.log('エラー:', error);
      console.log('==================');
    }, 10000); // 10秒ごと

    return () => clearInterval(interval);
  }, [sessionId, accessToken, hostId, sessionInfo, session, isConnected, members, error]);

  const handleCopy = async (text: string, type: 'sessionId' | 'accessToken' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('コピーに失敗しました:', err);
    }
  };

  const handleStartGame = async () => {
    if (!sessionInfo || !session || session.players.length < 2) return;
    
    console.log('ゲーム開始処理を実行');
    setError(null);
    
    try {
      // 1. Pusher APIを使用してゲーム開始イベントを確実に送信
      const triggerResponse = await fetch('/api/pusher/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionInfo.sessionId,
          accessToken: sessionInfo.accessToken,
          playerId: sessionInfo.hostId,
          eventName: 'start_game',
          data: {
            sessionId: sessionInfo.sessionId,
            startedAt: new Date().toISOString()
          }
        })
      });

      if (!triggerResponse.ok) {
        const errorData = await triggerResponse.json();
        throw new Error(errorData.error || 'ゲーム開始イベントの送信に失敗しました');
      }

      console.log('start_gameイベント送信完了（Pusher API経由）');
      
      // 2. 既存のemitも念のため実行
      await emit('start_game', { sessionId: sessionInfo.sessionId });
      
      // 3. ゲーム画面へ遷移
      setTimeout(() => {
        const gameUrl = `/host/game/${sessionInfo.sessionId}?token=${sessionInfo.accessToken}&hostId=${sessionInfo.hostId}`;
        console.log('ゲーム画面へ遷移:', gameUrl);
        router.push(gameUrl);
      }, 500);
      
    } catch (error) {
      console.error('ゲーム開始エラー:', error);
      setError(error instanceof Error ? error.message : 'ゲームの開始に失敗しました');
    }
  };

  const handleRetry = () => {
    console.log('再試行を実行');
    window.location.reload();
  };

  // 退出処理
  const handleExitGame = () => {
    // LocalStorageをクリア
    localStorage.removeItem('hostSession');
    localStorage.removeItem('lastSessionId');
    localStorage.removeItem('lastAccessToken');
    localStorage.removeItem('lastHostId');
    localStorage.removeItem('reconnectionData');
    if (sessionId) {
      localStorage.removeItem(`session_${sessionId}`);
    }
    
    // トップページへ遷移
    router.push('/');
  };

  // オンライン状態を判定する関数（ホスト用：控えめなインジケーター表示用）
  const isPlayerOnline = (playerId: string): boolean => {
    if (!members) return false;
    return members.has(playerId);
  };

  // 初期化中の表示
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-500 via-red-500 to-orange-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">初期化中...</p>
        </div>
      </div>
    );
  }

  // エラー表示
  if (error && !sessionInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-500 via-red-500 to-orange-500">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-md">
          <div className="flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-300" />
          </div>
          <h2 className="text-2xl font-bold text-white text-center mb-4">エラーが発生しました</h2>
          <p className="text-white/80 text-center mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              再試行
            </button>
            <button
              onClick={() => router.push('/host/create')}
              className="w-full py-3 bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 rounded-lg text-white font-medium transition-all"
            >
              新しくゲームを作成
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ローディング表示
  if (!sessionInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-500 via-red-500 to-orange-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-lg mb-2">ゲーム情報を読み込み中...</p>
          <p className="text-white/60 text-sm">
            SessionId: {sessionId || '取得中...'}<br />
            AccessToken: {accessToken ? '設定済み' : '取得中...'}<br />
            HostId: {hostId || '取得中...'}
          </p>
        </div>
      </div>
    );
  }

  // 参加者リストはsession.playersを使用
  const players = session?.players || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8 pt-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full mb-4">
            <Users className="w-12 h-12 text-yellow-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-md">
            参加者を待っています
          </h1>
          <p className="text-white/90 text-xl font-medium">
            {sessionInfo.gameName}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* 左側: QRコードと参加情報 */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6 border border-white/20 shadow-xl relative">
            {/* ヘッダーと三点メニュー */}
            <div className="flex justify-between items-start">
              <h2 className="text-2xl font-bold text-white">📱 参加用QRコード</h2>
              
              {/* 三点メニュー */}
              <div className="relative">
                <button
                  onClick={() => setMenuState(menuState === 'closed' ? 'open' : 'closed')}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  aria-label="メニュー"
                >
                  <MoreVertical className="w-6 h-6 text-white" />
                </button>
                
                {/* ドロップダウンメニュー */}
                {(menuState === 'open' || menuState === 'confirming') && (
                  <div className="absolute right-0 mt-2 w-48 bg-red-900 rounded-lg shadow-lg z-50 overflow-hidden">
                    <button
                      onClick={() => {
                        if (menuState === 'open') {
                          setMenuState('confirming');
                        } else {
                          handleExitGame();
                        }
                      }}
                      className="w-full px-4 py-3 text-left text-white hover:bg-red-800 transition-colors"
                    >
                      {menuState === 'open' ? (
                        '大会を終了'
                      ) : (
                        <span className="text-red-400">本当に終了しますか？</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* メニュー外クリックで閉じる */}
            {menuState !== 'closed' && (
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setMenuState('closed')}
              />
            )}
            
            {/* QRコード */}
            <div className="flex justify-center mb-6">
              <div className="bg-white p-4 rounded-xl">
                <img 
                  src={sessionInfo.qrCodeDataUrl} 
                  alt="参加用QRコード" 
                  className="w-64 h-64"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            </div>

            {/* セッション情報 */}
            <div className="space-y-4">
              {/* セッションID */}
              <div className="space-y-2">
                <label className="text-white font-medium flex items-center">
                  セッションID
                  <span className="ml-2 text-xs text-yellow-300">（参加者に共有）</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-yellow-400/20 backdrop-blur-sm rounded-lg px-4 py-3 border border-yellow-400/40">
                    <p className="text-yellow-200 font-mono text-2xl font-bold tracking-wider">
                      {sessionInfo.sessionId}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(sessionInfo.sessionId, 'sessionId')}
                    className="p-3 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors"
                    title="コピー"
                  >
                    {copied === 'sessionId' ? (
                      <CheckCircle className="w-5 h-5 text-green-300" />
                    ) : (
                      <Copy className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
                {copied === 'sessionId' && (
                  <p className="text-green-300 text-sm">コピーしました！</p>
                )}
              </div>

              {/* アクセストークン */}
              <div className="space-y-2">
                <label className="text-white font-medium flex items-center">
                  アクセストークン
                  <span className="ml-2 text-xs text-yellow-300">（参加者に共有）</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-yellow-400/20 backdrop-blur-sm rounded-lg px-4 py-3 border border-yellow-400/40">
                    <p className="text-yellow-200 font-mono text-2xl font-bold tracking-wider">
                      {sessionInfo.accessToken}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(sessionInfo.accessToken, 'accessToken')}
                    className="p-3 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors"
                    title="コピー"
                  >
                    {copied === 'accessToken' ? (
                      <CheckCircle className="w-5 h-5 text-green-300" />
                    ) : (
                      <Copy className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
                {copied === 'accessToken' && (
                  <p className="text-green-300 text-sm">コピーしました！</p>
                )}
              </div>

              {/* 参加URL */}
              <div className="space-y-2">
                <label className="text-white font-medium">🔗 参加URL</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/20 backdrop-blur-sm rounded-lg px-4 py-3">
                    <p className="text-xs text-yellow-200 font-mono break-all">
                      {sessionInfo.participationUrl}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(sessionInfo.participationUrl, 'url')}
                    className="p-3 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors"
                    title="URLをコピー"
                  >
                    {copied === 'url' ? (
                      <CheckCircle className="w-5 h-5 text-green-300" />
                    ) : (
                      <Copy className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
                {copied === 'url' && (
                  <p className="text-green-300 text-sm">URLをコピーしました！</p>
                )}
              </div>
            </div>
          </div>

          {/* 右側: 参加者リスト */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">👥 参加者リスト</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <Wifi className="w-5 h-5 text-green-300" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-300" />
                  )}
                  <span className="text-white/80 text-sm">
                    {isConnected ? '接続中' : '接続待機中'}
                  </span>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <span className="text-3xl font-bold text-yellow-300">{players.length}</span>
                  <span className="text-white/90 text-lg ml-1">/ {sessionInfo.maxPlayers}人</span>
                </div>
              </div>
            </div>

            {/* 参加者一覧 */}
            <div className="bg-white/10 rounded-xl p-4 min-h-[400px] max-h-[400px] overflow-y-auto">
              {players.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-4">
                    <Users className="w-12 h-12 text-white/60" />
                  </div>
                  <p className="text-white/60 text-lg mb-2">参加者を待っています...</p>
                  <p className="text-white/40 text-sm">
                    QRコードを読み取るか<br />
                    セッションIDとアクセストークンで参加できます
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {players.map((player, index) => {
                    const online = isPlayerOnline(player.id);
                    return (
                      <div
                        key={player.id}
                        className="flex items-center gap-3 p-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 hover:bg-white/15 transition-colors"
                      >
                        <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold shadow-md">
                          {index + 1}
                        </div>
                        <span className="text-white font-medium text-lg flex-1">
                          {player.name}
                        </span>
                        <div className="flex items-center gap-2">
                          {player.id === hostId && (
                            <span className="px-3 py-1 bg-yellow-400/30 backdrop-blur-sm rounded-full text-yellow-200 text-sm font-medium">
                              ホスト
                            </span>
                          )}
                          {/* 控えめなオンラインインジケーター */}
                          <div 
                            className={`w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-gray-400'}`}
                            title={online ? '画面を見ています' : '他のアプリを見ています'}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* バックグラウンドでも大丈夫という説明 */}
            <div className="mt-4 p-3 bg-blue-500/20 backdrop-blur-sm rounded-lg border border-blue-400/30">
              <p className="text-white/90 text-sm text-center">
                💡 参加者が裏画面でもゲーム開始すると自動でゲーム画面に移動します
              </p>
            </div>

            {/* ゲーム開始ボタン */}
            <div className="mt-4">
              <button
                onClick={handleStartGame}
                disabled={players.length < 2}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-all transform ${
                  players.length >= 2
                    ? 'bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 text-white shadow-lg hover:scale-105'
                    : 'bg-white/20 text-white/50 cursor-not-allowed'
                }`}
              >
                {players.length < 2 
                  ? `あと${2 - players.length}人必要です` 
                  : '🎮 ゲームを開始する'}
              </button>
              <p className="text-center text-white/60 text-sm mt-2">
                ※ ホスト以外に1人以上でゲームを開始できます
              </p>
            </div>
          </div>
        </div>

        {/* 注意事項 */}
        <div className="mt-8 text-center">
          <div className="inline-flex flex-col items-center p-4 bg-yellow-400/20 backdrop-blur-sm rounded-lg border border-yellow-400/40">
            <p className="text-white/90 text-sm">
              💡 参加者はQRコードを読み取るか、セッションIDとアクセストークンを入力して参加できます
            </p>
            <p className="text-white/70 text-sm mt-1">
              ※ セッションは作成から2時間で自動的に削除されます
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HostWaitingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-500 via-red-500 to-orange-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">読み込み中...</p>
        </div>
      </div>
    }>
      <WaitingContent />
    </Suspense>
  );
}