# オンラインビンゴアプリ - リアルタイムマルチプレイヤーゲーム

## 🎯 プロジェクト概要

家族や友人と楽しめるオンラインビンゴゲームです。**アカウント登録不要**で、セッションIDを共有するだけで複数人が同時参加できます。リアルタイム通信にはPusherを使用し、安定した同期を実現しています。

## 🚀 デモ

- **URL**: https://online-bingo-whoami.vercel.app/
- **ステータス**: 基本機能実装完了

## ✨ 主な機能

### ホスト機能
- セッション作成（セッションID自動生成）
- QRコードによる簡単招待
- 参加者のリアルタイム表示
- ゲーム開始・番号抽選（75個の数字から順次選択）

### ゲスト機能
- セッションID入力またはQRコードによる参加
- 名前重複時の自動調整（例：佐藤→佐藤(2)）
- ビンゴカード自動生成（5×5マス）
- リアルタイム番号受信・自動マーキング

### 共通機能
- MongoDB Atlasによるセッション管理（TTL: 2時間で自動削除）
- Pusherによるリアルタイム通信
- レスポンシブデザイン（スマートフォン最適化）

## 🛠 技術スタック

| カテゴリ | 技術 |
|----------|------|
| フレームワーク | Next.js 15.2.4 (App Router) |
| 言語 | TypeScript 5.x |
| スタイリング | Tailwind CSS 3.x |
| データベース | MongoDB Atlas |
| リアルタイム通信 | Pusher |
| ホスティング | Vercel |
| UIアイコン | Lucide React |

## 💡 技術選定の理由

| 技術 | 選定理由 |
|------|----------|
| Next.js 15 (App Router) | React Server Componentsによるパフォーマンス向上、API Routesでフロントエンド・バックエンドをTypeScriptで統一 |
| MongoDB Atlas | スキーマレスでセッションデータの柔軟な保存が可能、TTLインデックスによる2時間後の自動削除 |
| Pusher | Vercelサーバーレス環境でSocket.ioが動作しないため採用。マネージドサービスでインフラ管理不要 |
| TypeScript | 型安全性による開発効率向上、リファクタリング時のバグ防止、型定義の集約管理 |

## 📊 アーキテクチャ

```
[Client Browser] 
    ↓↑ HTTPS/WSS
[Vercel Edge Network]
    ↓↑ 
[Next.js App]
    ├── API Routes ←→ MongoDB Atlas
    └── Pusher ←→ Realtime Events
```

### データフロー
1. **セッション作成**: Client → API Routes → MongoDB
2. **リアルタイム通信**: Client ↔ Pusher Channels
3. **状態管理**: MongoDB (永続化) + Pusher (配信)

## 🔧 技術的な特徴

### Socket.ioからPusherへの移行

開発当初はSocket.ioを使用していましたが、Vercelのサーバーレス環境では永続的なWebSocket接続を維持できないため、Pusherに移行しました。

```typescript
// 旧: Socket.io（Vercelで動作しない）
socket.emit('start_game', data);
socket.on('game_started', handler);

// 新: Pusher（サーバーレス対応）
await emit('start_game', data);
on('game_started', handler);
```

### 名前重複の自動調整

同じ名前の参加者が複数いる場合、自動的に番号を付与:
- 1人目: 「田中」
- 2人目: 「田中(2)」
- 3人目: 「田中(3)」

## 🎮 使い方

### ホスト（主催者）
1. トップページから「ゲーム作成」をクリック
2. 大会名を設定
3. 生成されたQRコードを参加者に共有
4. 参加者が揃ったら「ゲーム開始」
5. 番号を順次抽選してゲーム進行

### ゲスト（参加者）
1. QRコードを読み取る、または「ゲーム参加」からセッションIDを入力
2. 名前を入力して参加
3. 自動生成されたビンゴカードを確認
4. ホストが抽選する番号に応じてマスをマーク
5. ビンゴ達成時は自動で通知

## 🔨 ローカル開発

### 必要な環境
- Node.js 18.x以上
- npm

### セットアップ

```bash
git clone https://github.com/EnjoyItIsFun/OnlineBingo.git
cd OnlineBingo
npm install
cp .env.local.example .env.local
```

### 環境変数の設定

`.env.local`に以下を設定:

```env
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=bingo-game
PUSHER_APP_ID=your_pusher_app_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=ap3
NEXT_PUBLIC_PUSHER_KEY=your_pusher_key
NEXT_PUBLIC_PUSHER_CLUSTER=ap3
```

### 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 でアクセス可能。

## 📚 開発で学んだこと

- **サーバーレス環境の制約**: Socket.ioはWebSocket接続を維持するためVercelでは動作しない。マネージドサービス（Pusher）への移行で解決
- **リアルタイム通信の設計**: イベント名の命名規則（アンダースコア vs ハイフン）の一貫性の重要性
- **認証設計**: セッションID（6文字）とアクセストークン（8文字）の組み合わせによる簡易認証
- **オーバーエンジニアリングの回避**: 2時間で消えるカジュアルなアプリに複雑な再接続ロジックは不要という判断

## 📝 今後の改善予定

- UIアニメーションの追加
- 効果音の実装
- ビンゴ達成時の演出強化

## 📁 ディレクトリ構成

```
app/
├── api/
│   ├── pusher/
│   │   ├── auth/route.ts          # Pusher認証
│   │   └── trigger/route.ts       # イベントトリガー
│   └── sessions/
│       └── [sessionId]/
│           ├── route.ts           # セッション取得
│           ├── join/route.ts      # 参加API
│           ├── leave/route.ts     # 離脱API
│           └── draw/route.ts      # 番号抽選API
├── host/
│   ├── create/page.tsx            # セッション作成
│   ├── waiting/page.tsx           # ホスト待機画面
│   ├── game/[sessionId]/page.tsx  # ホストゲーム画面
│   └── result/[sessionId]/page.tsx
├── guest/
│   ├── join/page.tsx              # 参加画面
│   ├── waiting/[sessionId]/page.tsx
│   ├── game/[sessionId]/page.tsx
│   └── result/[sessionId]/page.tsx
└── page.tsx                       # トップページ

hooks/
├── usePusherConnection.ts         # Pusher接続管理
├── useRealtimeConnection.ts       # 統一インターフェース
├── useGameTimer.ts
└── useNameAdjustment.ts

types/
└── index.ts                       # 型定義（集約）

utils/
├── api.ts                         # APIクライアント
└── gameUtils.ts                   # ゲームロジック
```