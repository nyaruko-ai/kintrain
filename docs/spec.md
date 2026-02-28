# KinTrain 要件定義書（MVP）

最終更新日: 2026-02-28

## 1. 目的

ジムで空いているマシンを使う運用を前提に、トレーニング内容を簡便に記録し、長期参照とAIアドバイス/チャット相談を可能にするWebアプリを提供する。

## 2. 対象範囲

- 対象ユーザー: 個人利用（1ユーザー）
- 対応言語: 日本語
- 対応端末: スマホ/PC（レスポンシブ）
- 利用形態: オンライン前提

## 3. システム構成要件

- Frontend: Web SPA
- 配信: Amazon S3（本番配信はCloudFront併用）
- 認証: Amazon Cognito
- API: Amazon API Gateway + AWS Lambda
- データ保存: Amazon DynamoDB
- AI: Amazon Bedrock AgentCore Runtime + AgentCore Gateway（MCP）
- IaC: AWS CDK（TypeScript）

## 4. ドメイン定義（ユビキタス言語）

- `User`: 認証済み利用者
- `CoreApiEndpoint`: UIがトレーニング記録・マシン管理・体組成管理のCRUDを呼び出すAPI Gatewayエンドポイント
- `AiRuntimeEndpoint`: UIがAIチャット/提案生成を呼び出すAgentCore Runtimeエンドポイント
- `GymVisit`: ジム来館1回分の記録
- `ExerciseEntry`: GymVisit内の1種目記録（例: チェストプレス 22.5kg 12回 3セット）
- `Machine`: 利用マシン定義
- `BodyMetric`: 体重・体脂肪率の記録
- `DailyRecord`: 日付単位の総合記録（体重/体脂肪率、体調、日記、その他トレーニング）
- `OtherActivity`: フリー入力のその他トレーニング記録（例: ジョギング1km）
- `Goal`: 目標体重・目標体脂肪率
- `Advice`: AI提案結果
- `ChatThread`: AI相談履歴
- `AiChatSession`: UI上の1会話スレッドを表すAIチャットセッション（複数ターンで構成）
- `AiAgentRole`: AIエージェントの機能上の役割名（本アプリでは固定で `AIコーチ`）
- `AiCharacterProfile`: AIチャット表示用キャラクター設定（キャラクターID・名前・アイコン・口調プリセット・表情画像マップ）
- `AgentExecutionSession`: AgentCore Runtime実行セッション
- `MemorySession`: AgentCore Memory上でイベントを束ねるセッション

### 4.1 AIチャットセッションの定義

- `AiChatSession` はユーザーがUIで開始する会話単位である。
- 1つの `AiChatSession` は、複数のユーザー発話/AI応答ターンを保持する。
- `AiChatSession` は以下の識別子を関連づける。
- `aiChatSessionId`（アプリ側会話ID）
- `runtimeSessionId`（AgentCore Runtimeの会話継続ID）
- `memorySessionId`（AgentCore Memoryの`sessionId`）
- `runtimeSessionId` が期限切れした場合でも、同一 `aiChatSessionId` を継続し、新しい `runtimeSessionId` を再関連付けできること。
- `memorySessionId` は同一 `AiChatSession` 内で固定し、短期記憶イベントを同一会話として蓄積すること。

### 4.2 用語の明確化（UI仕様整合）

- `TrainingMenu`: 日次固定ではない実施候補リスト。優先順位計算の入力元。
- `TrainingMenuItem`: メニュー内の1項目（マシン名、既定重量/回数/セット、手動順序）。
- `TrainingSession`: ジム滞在中に行う記録作業（未確定状態を含むUI上の作業単位）。
- `TrainingSessionDraft`: `TrainingSession` の途中保存データ。正式記録前の一時状態。
- `GymVisit`: `記録して終了` 後に確定した筋トレ実績（永続データ）。
- `DailyRecord`: 1日単位の総合記録（体組成、体調、日記、その他トレーニング、当日実績サマリ）。
- `BodyMetric`: `DailyRecord` 内の体組成サブ情報（独立永続の主オブジェクトではない）。
- `Daily` 画面: `DailyRecord` を表示/更新するUI画面。ドメインオブジェクト名ではない。
- `ConditionRating`: 体調評価の離散値（1〜5）。

## 5. 機能要件

### 5.1 認証

- メールアドレス+パスワードでサインアップ/ログインできること。
- ログイン済みユーザーのみAPI利用可能であること。

### 5.2 マシン管理

- ユーザーはMachineを追加/編集/無効化できること。
- マシン名は同一ユーザー内で一意であること。

### 5.3 トレーニング記録

- ユーザーはGymVisitを作成/更新/削除できること。
- GymVisitにExerciseEntryを複数登録できること。
- ExerciseEntryは以下を保持すること。
- `machineId`
- `machineNameSnapshot`
- `weightKg`
- `reps`
- `sets`
- `rpe`（任意）
- `note`（任意）
- `weightKg > 0`、`reps > 0`、`sets > 0` を満たすこと。
- 前日利用マシンを参照できること。

### 5.4 履歴参照

- 日付範囲でGymVisit履歴を検索できること。
- Machine別の履歴を参照できること。
- 長期履歴を継続参照できること。

### 5.5 体組成管理

- 体重・体脂肪率を日次記録できること。
- 目標体重・目標体脂肪率を保持できること。
- 体組成推移を参照できること。

### 5.6 Daily記録管理

- 日付ごとに `DailyRecord` を記録/更新できること。
- `DailyRecord` は以下を保持できること。
- `bodyWeightKg`（任意）
- `bodyFatPercent`（任意）
- `bodyMetricRecordedAtUtc`（RFC3339 UTC）
- `bodyMetricRecordedAtLocal`（RFC3339 + offset）
- `timeZoneId`（IANA、例: `Asia/Tokyo`）
- 体調5段階評価（1:最悪, 5:最高）
- 体調コメント（任意）
- 日記（任意）
- その他トレーニング（フリー入力、複数可）
- アイコンタップのみで体調評価を即記録できること（コメント入力なし可）。
- `DailyRecord` は後から更新できること。

### 5.7 カレンダー参照

- 1ヶ月単位カレンダーで「筋トレ実施日」のみ識別できること。
- カレンダーセルに体調評価（5段階）をアイコン表示できること。
- 日付タップで `Daily` 画面へ遷移できること。
- `Daily` 画面で当日の筋トレ内容、体重・体脂肪率、日記、体調、その他トレーニングを確認/更新できること。
- カレンダー上で体調評価を視覚的に確認できること（色またはアイコン）。

### 5.8 AIアドバイス/チャット

- AIエージェントの役割名は `AIコーチ` とする（固定）。
- キャラクター表示名は役割名と分離する（既定: `ニャル子`）。
- 記録データと目標値を参照したAdviceを生成できること。
- ChatThread上で継続相談できること。
- AiChatSession単位で会話を継続できること。
- AiChatSessionはRuntimeのセッション期限切れ後も継続できること（必要に応じてRuntimeセッションを再生成）。
- AI機能は `AiRuntimeEndpoint`（AgentCore Runtime）経由で提供すること。
- AIのシステムプロンプトはプログラムへハードコードせず、コードとは別のテキストファイルで管理すること。
- AI回答は一般的助言のみとし、医療診断は行わないこと。
- `AiCharacterProfile` を設定できること（`characterId`、キャラクター名、アイコン、口調プリセット、表情画像マップ）。
- AIチャット画面で、設定したキャラクターが話しているように表示できること。
- AIチャット画面の表示名は `AIコーチ（{characterName}）` とすること（例: `AIコーチ（ニャル子）`）。
- `AiCharacterProfile` の保持項目:
- `characterId`
- `characterName`
- `avatarImageUrl`
- `tonePreset`
- `expressions`（`default|thinking|surprised|love|doubt|angry` -> 画像URL）
- 既定キャラクターは `nyaruko` を使用すること。
- 既定設定ファイル:
- `assets/characters/nyaruko/character-profile.json`
- 既定表情画像:
- `assets/characters/nyaruko/expressions/*.png`
- キャラクター設定方法:
- 初回表示時は `GET /ai-character-profile` を取得し、未設定時は上記ファイルを読み込む。
- ユーザーは `/ai-chat` の設定UIで変更する。
- 変更内容は `PUT /ai-character-profile` でユーザー単位に保存する。
- 未設定時は `nyaruko` 既定値へフォールバックする。

## 6. API要件（CoreApiEndpoint: API Gateway）

- `GET /me/profile`
- `PUT /me/profile`
- `GET /machines`
- `POST /machines`
- `PUT /machines/{machineId}`
- `DELETE /machines/{machineId}`（論理削除）
- `POST /gym-visits`
- `GET /gym-visits?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /gym-visits/{visitId}`
- `PUT /gym-visits/{visitId}`
- `DELETE /gym-visits/{visitId}`
- `GET /calendar?month=YYYY-MM`
- `GET /daily-records/{date}`（`date`: `YYYY-MM-DD`）
- `GET /daily-records?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `PUT /daily-records/{date}`（`date`: `YYYY-MM-DD`）
- `GET /ai-character-profile`
- `PUT /ai-character-profile`
- `GET /goals`
- `PUT /goals`

### 6.1 AI Runtime呼び出し要件（AiRuntimeEndpoint）

- UIはAIチャット/提案生成を `AiRuntimeEndpoint` の `InvokeAgentRuntime` で実行すること。
- API Gateway配下に `/ai/*` エンドポイントは設けないこと。

## 7. データ要件

- 保存先: DynamoDB単一テーブル
- ユーザー分離: 全アイテム/全GSIで `userId` をキーに含める
- データ保持: 無期限
- 単位: 重量はkg
- 既定タイムゾーン: `Asia/Tokyo`
- `scan` は実行しない（`GetItem` / `Query` のみ使用）

### 7.1 userIdの定義

- `userId` は Cognito アクセストークンの `sub` を使用する。
- 理由:
- 不変で一意であり、メールアドレスやユーザー名変更の影響を受けないため。
- API Gateway/LambdaでJWT検証後、`sub` をサーバー側で取り出して利用する。

### 7.2 ユーザ属性情報

- ユーザ属性は `PROFILE` アイテムで管理する。
- 必須項目:
- `userId`（= sub）
- `displayName`（ユーザ名）
- `heightCm`（身長）
- `birthDate`（生年月日、`YYYY-MM-DD`）
- 推奨項目:
- `sex`
- `createdAt`
- `updatedAt`

### 7.3 DynamoDB物理設計（単一テーブル）

- テーブル名: `KinTrain`
- 主キー:
- `PK = USER#{userId}`
- `SK = <ENTITY>#...`
- 代表SK:
- `PROFILE`
- `MACHINE#{machineId}`
- `GYM_VISIT#{yyyy-MM-dd}#{visitId}`
- `EXERCISE_ENTRY#{visitId}#{entryId}`
- `DAILY_RECORD#{yyyy-MM-dd}`
- `GOAL#CURRENT`
- `AI_CHARACTER_PROFILE`
- `AI_CHAT_SESSION#{chatSessionId}`
- `AI_CHAT_MESSAGE#{chatSessionId}#{timestamp}`
- `AI_ADVICE#{timestamp}#{adviceId}`
- `AI_CHARACTER_PROFILE` には `characterId`, `characterName`, `avatarImageUrl`, `tonePreset`, `expressions`, `updatedAt` を保持する。
- `AI_CHARACTER_PROFILE` が未作成のユーザーは `assets/characters/nyaruko/character-profile.json` を既定として扱う。

### 7.4 日付・時刻フォーマット規約（共通）

- TimeZoneは IANA形式で保持する（例: `Asia/Tokyo`）。
- 日付のみ項目は `YYYY-MM-DD`（ローカル日付）を使用する。
- 時刻付き項目は RFC3339 を使用する。
- UTC保存: `YYYY-MM-DDTHH:mm:ss.SSSZ`（例: `2026-02-28T05:12:30.123Z`）
- ローカル表示用: `YYYY-MM-DDTHH:mm:ss.SSS+09:00`（例: `2026-02-28T14:12:30.123+09:00`）
- `DailyRecord` の日付キーは `timeZoneId` 基準のローカル日付で決定する。
- AIに渡す時刻コンテキストは `timeZoneId` / `nowUtc` / `nowLocal` を必須にする。
- AI判断でUTCのみを根拠に日付解釈しないこと。

### 7.5 GSI設計（すべてuserIdを含む）

- `GSI1`（マシン履歴検索）
- `GSI1PK = USER#{userId}#MACHINE#{machineId}`
- `GSI1SK = DATE#{yyyy-MM-dd}#VISIT#{visitId}#ENTRY#{entryId}`
- 用途: `machineId` 単位で過去履歴を時系列取得

- `GSI2`（チャットセッション一覧）
- `GSI2PK = USER#{userId}#CHAT`
- `GSI2SK = UPDATED_AT#{timestamp}#SESSION#{chatSessionId}`
- 用途: AIチャットセッションを新しい順に取得

### 7.6 アクセスパターンとクエリ設計（Scan禁止）

- AP-01 プロファイル取得: `GetItem(PK=USER#{sub}, SK=PROFILE)`
- AP-02 プロファイル更新: `UpdateItem(PK=USER#{sub}, SK=PROFILE)`
- AP-03 マシン一覧: `Query PK=USER#{sub} AND begins_with(SK, 'MACHINE#')`
- AP-04 GymVisit日付範囲: `Query PK=USER#{sub} AND SK BETWEEN 'GYM_VISIT#{from}' AND 'GYM_VISIT#{to}~'`
- AP-05 GymVisit詳細: `GetItem(PK=USER#{sub}, SK=GYM_VISIT#{date}#{visitId})`
- AP-06 前日利用マシン: AP-04で前日範囲を取得し、`machineId` を集合化
- AP-07 マシン別履歴: `Query GSI1PK=USER#{sub}#MACHINE#{machineId}`（GSI1）
- AP-08 DailyRecord範囲: `Query PK=USER#{sub} AND SK BETWEEN 'DAILY_RECORD#{from}' AND 'DAILY_RECORD#{to}~'`
- AP-09 DailyRecord単日取得: `GetItem(PK=USER#{sub}, SK=DAILY_RECORD#{date})`
- AP-10 DailyRecord単日更新: `PutItem(PK=USER#{sub}, SK=DAILY_RECORD#{date})`
- AP-11 月次カレンダー表示: AP-08で当月範囲を取得し、実施有無/体調アイコンを計算
- AP-12 AIキャラクター設定取得: `GetItem(PK=USER#{sub}, SK=AI_CHARACTER_PROFILE)`
- AP-13 AIキャラクター設定更新: `PutItem(PK=USER#{sub}, SK=AI_CHARACTER_PROFILE)`
- AP-14 目標値取得: `GetItem(PK=USER#{sub}, SK=GOAL#CURRENT)`
- AP-15 AIチャットメッセージ: `Query PK=USER#{sub} AND begins_with(SK, 'AI_CHAT_MESSAGE#{chatSessionId}#')`
- AP-16 AIチャットセッション一覧: `Query GSI2PK=USER#{sub}#CHAT`（GSI2）
- AP-17 AIアドバイス履歴: `Query PK=USER#{sub} AND begins_with(SK, 'AI_ADVICE#')`

## 8. セキュリティ要件

- API GatewayはCognito JWT Authorizerで保護すること。
- Runtime -> Gateway -> LambdaはIAM最小権限で接続すること。
- 他ユーザーのデータ参照は不可能であること。

## 9. AgentCore Runtime / Gateway 要件

### 9.1 Runtime

- `CoachAgent` をRuntimeに配置し、会話制御と応答生成を行うこと。
- `CoachAgent` の役割名（表示/設定上の正本）は `AIコーチ` とすること。
- `AgentExecutionSession` を保持し、会話継続性を提供すること。

### 9.2 Gateway（MCP）

- 以下ツールをMCPとして公開すること。
- `get_recent_gym_visits(days)`
- `get_machine_history(machineId, limit)`
- `get_daily_records(from, to)`
- `get_daily_record(date)`
- `get_goal()`
- `get_ai_character_profile()`
- `save_advice_log(advice)`
- `userId` はツール公開引数に含めず、RuntimeがJWT `sub` を内部注入すること。

### 9.3 連携方式

- RuntimeがGateway経由でMCPツールを呼び出し、DynamoDBの記録を参照してAdvice/Chatを生成すること。

## 10. UI要件

- 必須画面:
- `/login`
- `/dashboard`
- `/training-session`
- `/training-menu`
- `/training-menu/ai-generate`
- `/calendar`
- `/daily/:date`
- `/machines`
- `/history`
- `/progress`
- `/ai-chat`
- 詳細UI仕様は `docs/ui-spec.md` を正本とする。
- `/dashboard` に `トレーニング開始` と `本日の日記をつける` 導線を設けること。
- トレーニング一覧は日次固定ではなく履歴ベースで優先順表示すること。
- 一覧行で `重量/回数/セット` を直接入力できること。
- `前回と同じ` のワンクリック入力を提供すること。
- セット詳細入力はオプション表示（初期非表示）とすること。
- 途中入力はリロード後も復元されること（ドラフト保存）。
- 「記録して終了」を押した時のみ正式記録すること。
- 画面の日時表示は `timeZoneId` を明示したローカル時刻で統一すること。
- `/ai-chat` でAIキャラクターアイコンと名前を表示し、発話主体が視覚的に分かること。

## 11. 開発プロセス要件（モックUI先行）

- 実装はモックUIから開始すること。
- フロー:
- 画面モック作成（APIはモックデータ）
- 操作確認・レビュー
- 要件確定
- バックエンド実装開始
- レビュー完了まで本実装（API/Lambda/DynamoDB/AgentCore接続）を開始しないこと。

## 12. 受け入れ基準

- GymVisit/ExerciseEntryの作成・更新・削除が可能であること。
- 「マシン名・重量・回数・セット」を保存し再参照できること。
- カレンダーで日別の実施内容を確認できること。
- 体調を5段階+コメントで記録できること。
- 体調をアイコンタップのみで記録できること。
- `Daily` 画面で当日の体重・体脂肪率・日記・体調・その他トレーニングを更新できること。
- 前日利用マシンを当日画面で確認できること。
- 体重/体脂肪率推移を表示できること。
- AI提案カードとチャット応答が動作すること。
- AIキャラクター（アイコン/名前/口調）が設定・反映できること。
- 不正値（重量/回数/セットが0以下）は登録できないこと。
- 他ユーザーのデータにアクセスできないこと。

## 13. 未確定・不足要件（要決定）

- 同日複数回の来館をどう扱うか（複数GymVisitを許可するか）。
- 1 ExerciseEntry内でセットごとに重量/回数を変える仕様を許可するか。
- ウォームアップセット/ドロップセットの記録要否。
- GymVisitの開始時刻/終了時刻を必須にするか。
- AIアドバイスの出力形式（固定テンプレートか自由文か）。
- AIの禁止事項文面と免責文言の確定。
- 退会時のデータ削除ポリシー（無期限保持との整合）。
- 運用環境（dev/stg/prod）とAWSリージョンの確定。
- 性能目標値（API p95、画面表示時間）の数値確定。
- モックUIレビューの合格条件（必須シナリオと承認者）の確定。

## 14. 共通命名規則

### 14.1 基本方針

- 本プロジェクトの標準は `camelCase` とする（TypeScript/JavaScriptで最も一般的なため）。
- `snake_case` は標準として採用しない。例外は環境変数など外部慣習が強い項目のみ。

### 14.2 プログラム命名

- 変数/関数/メソッド/プロパティ: `camelCase`
- 型/クラス/インターフェース/列挙型: `PascalCase`
- 定数/環境変数: `UPPER_SNAKE_CASE`
- 真偽値: `is` / `has` / `can` で開始する（例: `isActive`）

### 14.3 ファイル命名

- 通常ファイル名: `kebab-case`（例: `gym-visit-service.ts`）
- Reactコンポーネントファイル: `PascalCase` を許可（例: `GymVisitCard.tsx`）
- テストファイル: `<name>.test.ts` / `<name>.test.tsx`
- AIシステムプロンプトファイル: `config/prompts/system-prompt.ja.txt`
- AIエージェント設定ファイル（固定名）: `config/prompts/PERSONA.md`, `config/prompts/SOUL.md`

### 14.4 API命名

- URLパス: `kebab-case`（例: `/gym-visits`）
- クエリパラメータ: `camelCase`
- JSONのキー: `camelCase`

### 14.5 DynamoDB命名

- テーブル名: `PascalCase`（例: `KinTrain`）
- パーティション/ソートキー属性名: `PK`, `SK`（大文字固定）
- GSIキー属性名: `GSI1PK`, `GSI1SK`（大文字固定）
- エンティティ属性名: `camelCase`（例: `createdAt`, `machineNameSnapshot`）
- 識別子プレフィックス: 大文字スネーク風トークン + `#`（例: `USER#`, `GYM_VISIT#`）
- DynamoDB属性名にハイフンは使用しない。

## 15. 参考（公式）

- Bedrock AgentCore GA（2025-10-13）  
  https://aws.amazon.com/about-aws/whats-new/2025/10/amazon-bedrock-agentcore-generally-available/
- AgentCore Runtime ドキュメント  
  https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime.html
- AgentCore Gateway ドキュメント  
  https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway.html
- Gateway targets（Lambda/API等）  
  https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-targets.html
- Bedrock Responses API と AgentCore Gateway連携（2026-02-24）  
  https://aws.amazon.com/about-aws/whats-new/2026/02/amazon-bedrock-responses-api-agentcore-gateway/
