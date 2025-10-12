'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function HostWaitingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // URLパラメータから取得
  const sessionId = searchParams.get('sessionId');
  const accessToken = searchParams.get('accessToken');
  const hostId = searchParams.get('hostId');
  
  interface SessionDebugInfo {
    sessionId: string;
    accessToken: string;
    hostId: string;
    timestamp: string;
  }

  const [sessionInfo, setSessionInfo] = useState<SessionDebugInfo | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    console.log('=== HostWaitingPage Debug ===');
    console.log('URL Parameters:');
    console.log('- sessionId:', sessionId);
    console.log('- accessToken:', accessToken);
    console.log('- hostId:', hostId);
    
    // LocalStorageの内容を確認
    console.log('LocalStorage Contents:');
    const hostSession = localStorage.getItem('hostSession');
    console.log('- hostSession:', hostSession);
    
    // session_* キーを確認
    const sessionKeys = Object.keys(localStorage).filter(key => key.startsWith('session_'));
    console.log('- session_* keys:', sessionKeys);
    sessionKeys.forEach(key => {
      console.log(`  ${key}:`, localStorage.getItem(key));
    });

    // パラメータチェック
    if (!sessionId || !accessToken) {
      const missingParams = [];
      if (!sessionId) missingParams.push('sessionId');
      if (!accessToken) missingParams.push('accessToken');
      if (!hostId) missingParams.push('hostId');
      
      const errorMsg = `セッション情報が不足しています: ${missingParams.join(', ')}`;
      setError(errorMsg);
      console.error(errorMsg);
      
      // LocalStorageから情報を取得してみる
      if (hostSession) {
        try {
          const stored = JSON.parse(hostSession);
          console.log('LocalStorage session info:', stored);
          
          // LocalStorageから情報が取れた場合、パラメータ付きでリダイレクト
          if (stored.sessionId && stored.accessToken && stored.hostId) {
            const params = new URLSearchParams({
              sessionId: stored.sessionId,
              accessToken: stored.accessToken,
              hostId: stored.hostId
            });
            console.log('Redirecting with params:', params.toString());
            router.replace(`/host/waiting?${params.toString()}`);
            return;
          }
        } catch (e) {
          console.error('Failed to parse hostSession:', e);
        }
      }
      
      // どうしても情報が取れない場合は作成画面へ
      setTimeout(() => {
        router.push('/host/create');
      }, 3000);
      return;
    }

    // 正常な場合
    const debugInfo: SessionDebugInfo = {
      sessionId: sessionId || '',
      accessToken: accessToken || '',
      hostId: hostId || '',
      timestamp: new Date().toISOString()
    };
    setSessionInfo(debugInfo);
  }, [sessionId, accessToken, hostId, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-400 via-red-400 to-yellow-400 p-4 flex items-center justify-center">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-600 mb-4">エラー</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <div className="bg-gray-100 rounded-lg p-4 text-left text-sm">
            <p className="font-mono text-xs">
              <strong>Debug Info:</strong><br/>
              sessionId: {sessionId || 'null'}<br/>
              accessToken: {accessToken || 'null'}<br/>
              hostId: {hostId || 'null'}
            </p>
          </div>
          <p className="text-sm text-gray-600 mt-4">3秒後に作成画面へ戻ります...</p>
        </div>
      </div>
    );
  }

  if (!sessionInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-400 via-red-400 to-yellow-400 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-400 via-red-400 to-yellow-400 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 pt-8">
          <h1 className="text-4xl font-bold text-white mb-2">待機画面（デバッグ版）</h1>
          <p className="text-white/90">パラメータが正しく渡されています</p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">セッション情報</h2>
          
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-600">セッションID</label>
              <p className="font-mono text-lg bg-yellow-100 px-3 py-2 rounded">{sessionId}</p>
            </div>
            
            <div>
              <label className="text-sm text-gray-600">アクセストークン</label>
              <p className="font-mono text-lg bg-yellow-100 px-3 py-2 rounded">{accessToken}</p>
            </div>
            
            <div>
              <label className="text-sm text-gray-600">ホストID</label>
              <p className="font-mono text-lg bg-yellow-100 px-3 py-2 rounded">{hostId}</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-green-100 rounded-lg">
            <p className="text-green-800">✅ URLパラメータが正しく受け取れています</p>
            <p className="text-sm text-green-700 mt-2">
              この画面が表示されている場合、基本的な遷移は成功しています。
              実際の待機画面の実装に進んでください。
            </p>
          </div>

          <button
            onClick={() => router.push('/host/create')}
            className="mt-6 w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold py-3 rounded-lg hover:shadow-lg transition-all"
          >
            新しい大会を作成
          </button>
        </div>
      </div>
    </div>
  );
}