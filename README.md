# KinTrain

ジムでの筋トレ記録を「空いているマシン優先」で継続するためのWebアプリです。  
トレーニング実績、Daily記録、カレンダー参照、AIコーチ相談UIを1つにまとめています。

## 現在の実装状況（2026-02-28）

- フロントエンド: 実装済み（React + Vite + TypeScript）
- 認証: 実装済み（Amazon Cognito / アクセストークン認可）
- Core API: 実装済み（API Gateway + Lambda分割）
- DynamoDB: 実装済み（モデル別テーブル）
- AI Runtime/Gateway/Memory: 設計済み、未実装

## 実装済み機能

- ログイン / ログアウト
- 初回ログイン時の新パスワード設定、パスワード再設定
- トレーニング実施記録
  - 重量・回数・セット入力
  - 下書き自動保存 / リロード復元
  - セット詳細入力
  - 「前回と同じ」「入力クリア」
- トレーニングメニュー管理
  - 追加・更新・削除・並び替え
  - 回数レンジ（`defaultRepsMin/defaultRepsMax`）対応
- Daily記録
  - 体重・体脂肪率・測定時刻
  - 体調（5段階）・コメント・日記・その他運動
- カレンダー表示（月次、実施日/体調アイコン）
- AIチャット画面（キャラクター表示つき、モックストリーミング）
- iPhoneホーム画面追加対応（PWA manifest / standalone起動メタタグ）

注記:
- AIチャットは現時点でモック応答です。
- AIキャラクター設定はUI上で反映されます（AgentCore連携は未実装）。

## 実装済みバックエンド構成

- IaC: `amplify/backend.ts`（Amplify Gen2 + CDK）
- 認証: Cognito User Pool / App Client
- Core API: API Gateway（Cognito authorizer + scope）
- Lambda（機能分割）
  - `profile-api`
  - `training-menu-api`
  - `training-history-api`
  - `daily-record-api`
  - `ai-settings-api`
- DynamoDB
  - `KinTrainUserProfileV2`
  - `KinTrainTrainingMenuV2`
  - `KinTrainTrainingHistoryV2`
  - `KinTrainDailyRecordV2`
  - `KinTrainGoalV2`
  - `KinTrainAiSettingV2`

## フロントエンド配信

- 現行運用: S3バケットへ `frontend/dist` を同期して配信
  - バケット: `kintrain-web-335723620954-ap-northeast-1`
- 将来方針: Amplify Gen2 Fullstack Branch Deployment へ統合

## ローカル実行

```bash
npm install
npm run frontend:dev
```

ビルド:

```bash
npm run frontend:build
```

バックエンド型チェック:

```bash
npm run backend:typecheck
```

## デプロイ

バックエンド（sandbox）:

```bash
npx ampx sandbox --once --identifier nijot
```

フロントエンド（S3配信）:

```bash
npm run frontend:build
aws s3 sync frontend/dist s3://kintrain-web-335723620954-ap-northeast-1 --delete
```

## 主要ドキュメント

- 要件定義: `docs/spec.md`
- UI仕様: `docs/ui-spec.md`
- AI実装仕様: `docs/ai-implementation-spec.md`
