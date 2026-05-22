# 実施画面 メニューセット切り替え設計

最終更新日: 2026-05-22
対象ブランチ: `dev`

## 1. 目的

- 実施画面 `/training-session` で、初期表示はデフォルトメニューセットのままにする。
- 画面上で他のメニューセットへ切り替えられるようにする。
- 1回のジム利用中に、マシン用、ケーブル用など複数のメニューセットを切り替えながら入力できるようにする。
- 保存時は、現在表示中のメニューセットだけではなく、そのセッション中に入力した全種目を1回分の `GymVisit` として登録する。

## 2. 現状

### 2.1 画面

- `/training-session` は `TrainingSessionPage` で表示している。
- 画面表示時に `GET /training-session-view?date=YYYY-MM-DD` を呼ぶ。
- APIレスポンスの `items` を優先順に並べ、種目カードとして表示する。
- 入力中の値は `trainingDraft.entriesByItemId` に `menuItemId` をキーとして保持している。
- 保存時は `trainingDraft.entriesByItemId` のうち、重量、回数、セットが揃ったものを `POST /gym-visits` で登録する。

### 2.2 API

- `GET /training-session-view` は現在、デフォルトメニューセットを固定で取得する。
- デフォルトセットの種目を取得し、各種目について `TrainingPerformanceTable.UserTrainingMenuItemPerformedAtIndex` を `Limit 1` で参照して直近実績を付与する。

## 3. 要件

- 実施画面の初期表示はデフォルトメニューセットにする。
- 実施画面内でメニューセットを選択できる。
- メニューセットを切り替えても、入力済みの下書きは消さない。
- 保存対象は、表示中メニューセットの種目ではなく、下書きに入力された全種目とする。
- 同じ種目が複数メニューセットに含まれる場合は、同一 `trainingMenuItemId` の1つの入力として扱う。
- 1回の保存件数上限は現行通り最大12種目とする。
- DBテーブルの追加・変更は行わない。

## 4. UX設計

### 4.1 メニューセット選択

- 実施画面のヘッダー付近にメニューセット選択UIを追加する。
- 初期値は `isDefault === true` のメニューセットとする。
- デフォルトが存在しない場合は、既存の `data.menuSets[0]` をフォールバックにする。
- 選択肢は `data.menuSets` の有効なメニューセット一覧を使う。

表示例:

- `メニューセット: [デフォルト ▼]`
- 選択肢: `デフォルト`, `マシン用`, `ケーブル用`, `フリーウェイト用`

### 4.2 切り替え時の挙動

- 選択中の `trainingMenuSetId` が変わったら、同じ日付のまま `GET /training-session-view?date=...&trainingMenuSetId=...` を呼び直す。
- API取得中は現在と同じく読み込み状態を表示する。
- 切り替え前に入力した下書きは維持する。
- 切り替え後に同じ `trainingMenuItemId` が表示された場合、既存の下書きをそのカードに反映する。
- 切り替え後に表示されていない種目でも、下書きに残っていれば保存対象に含める。

### 4.3 保存確認

- 確認モーダルは現行通り、入力済みの全種目を一覧表示する。
- 現在表示中のメニューセットに含まれない入力済み種目も表示する。
- ユーザーが「マシン用」「ケーブル用」を切り替えて入力した場合、両方の種目が同じ確認モーダルに出る。

### 4.4 上限超過

- 現行の最大12種目制限を維持する。
- メニューセットを切り替えて入力しても、下書き全体で12種目を超えたら追加入力を止める。
- エラーメッセージは現行の `一度に登録できる実施は12件までです。` 系を継続利用する。

## 5. API設計

### 5.1 変更対象

- `GET /training-session-view`

### 5.2 クエリパラメータ

現行:

- `date`: `YYYY-MM-DD`

追加:

- `trainingMenuSetId`: 任意。指定された場合、そのメニューセットの種目を返す。

### 5.3 挙動

- `trainingMenuSetId` が指定されない場合:
  - 現行通りデフォルトメニューセットを取得する。
- `trainingMenuSetId` が指定された場合:
  - `TrainingMenuSetTable` から対象セットを `Get` する。
  - 対象セットが存在しない、または `isActive === false` の場合は `404` を返す。
  - 対象セットに紐づく `TrainingMenuSetItemTable` を `UserSetItemsBySetOrderIndex` で取得する。
  - 種目定義は現行通り `TrainingMenuTable` を `BatchGet` する。
  - 直近実績は現行通り各種目ごとに `TrainingPerformanceTable.UserTrainingMenuItemPerformedAtIndex` を `Limit 1` で取得する。

### 5.4 レスポンス

既存レスポンスは維持する。

```ts
type TrainingSessionViewResponse = {
  items: TrainingSessionViewItemDto[];
  todayDoneTrainingMenuItemIds: string[];
};
```

必要に応じて、フロントの表示確認用に以下を追加してもよい。

```ts
selectedTrainingMenuSetId?: string;
```

ただし、必須ではない。フロントは自分で選択中IDを持てるため、初回実装ではレスポンス契約変更を最小にし、既存フィールドのままとする。

## 6. フロントエンド設計

### 6.1 状態

`TrainingSessionPage` に選択中メニューセットIDを持たせる。

```ts
const [selectedMenuSetId, setSelectedMenuSetId] = useState('');
```

初期値は `data.menuSets` から以下の優先順で決める。

1. `isDefault === true`
2. `data.menuSets[0]`
3. 空文字

### 6.2 API呼び出し

- `getTrainingSessionView(date)` を `getTrainingSessionView(date, trainingMenuSetId?)` に拡張する。
- `selectedMenuSetId` が変わったら再取得する。
- `date` と `selectedMenuSetId` を `useEffect` の依存配列に入れる。

### 6.3 下書き維持

- 現行の `trainingDraft.entriesByItemId` は `menuItemId` キーなので、メニューセット切り替えと相性が良い。
- 切り替え時に `clearDraft` は呼ばない。
- 表示中リストに存在しない下書きも削除しない。
- 同一種目が複数セットに含まれる場合、同じ下書きを共有する。

### 6.4 確認モーダルの表示名

現行の保存処理は `data.menuItems.find(...)` からメニュー情報を引く。

注意点:

- `data.menuItems` は初期同期で取得したメニュー一覧に依存する。
- APIで表示された `sessionItems` のみから入力した種目が、何らかの理由で `data.menuItems` に存在しない場合、保存時の表示名が `不明トレーニング` になる可能性がある。

対応方針:

- まずは既存の `refreshCoreData` が取得する `data.menuItems` を正とする。
- 実装時に必要なら、`TrainingSessionPage` 内で `sessionItems` の情報を補助マップとして持ち、保存前表示や保存 payload 作成で参照できるようにする。
- ただし `finalizeTrainingSession` は `AppState` 側にあるため、保存 payload の完全な改善まで行う場合は `AppState` のデータモデルも慎重に確認する。

## 7. バックエンド設計

### 7.1 セット解決処理

`getTrainingSessionView` 内で、以下の分岐を追加する。

- `trainingMenuSetId` あり:
  - `TrainingMenuSetTable` を `GetCommand` で取得
  - 所有者は `userId` PKで担保
  - inactive または未存在なら `404`
- `trainingMenuSetId` なし:
  - 現行の `UserDefaultMenuSetIndex` `Limit 1`

### 7.2 セット内種目取得

現行の `setItemsBySetOrderIndex` 利用をそのまま使う。

- `KeyConditionExpression: userId = :userId AND begins_with(menuSetOrderKey, :setPrefix)`
- `:setPrefix = ${resolvedMenuSetId}#`

### 7.3 直近実績取得

現行維持。

- 表示対象種目ごとに `getLatestPerformanceSnapshot(userId, trainingMenuItemId)`
- `ScanIndexForward: false`
- `Limit: 1`

このため、データ履歴総量には強いが、表示対象メニュー数には比例する。

## 8. 性能とスケール

### 8.1 履歴件数

- `TrainingPerformanceTable` の種目別GSIを使うため、過去履歴が増えても直近実績取得は大きく悪化しにくい。
- 各種目の直近1件だけを読む。

### 8.2 メニューセット内種目数

- APIのDynamoDB Query数は、主に表示対象種目数に比例する。
- 通常のメニューセットが10から30種目程度であれば現行方式で問題は小さい。
- 100種目以上のセットを想定する場合は、直近実績キャッシュや一括取得方式を別途検討する。

### 8.3 保存件数

- `POST /gym-visits` は `TrainingHistoryTable` と `TrainingPerformanceTable` へトランザクション書き込みする。
- 現在の最大12種目制限は、DynamoDB `TransactWriteItems` の25件上限に収めるために必要。
- メニューセット切り替え後もこの制約は変えない。

## 9. テスト観点

### 9.1 フロントエンド

- 初期表示でデフォルトメニューセットが選択される。
- メニューセットを切り替えると表示種目が変わる。
- 切り替え前に入力した種目が、切り替え後も下書きとして保持される。
- 切り替え前後で入力した複数セットの種目が、確認モーダルにまとめて表示される。
- 同じ種目が複数セットにある場合、入力値が共有される。
- 12件を超える入力はブロックされる。

### 9.2 バックエンド

- `trainingMenuSetId` 未指定時はデフォルトセットを返す。
- `trainingMenuSetId` 指定時は指定セットを返す。
- 他ユーザーのセットIDや存在しないセットIDは返さない。
- inactive セットは返さない。
- 直近実績が指定セットの各種目に付与される。
- 空のセットは `items: []` を返す。

### 9.3 回帰確認

- 既存のデフォルトセットのみ利用するユーザー体験は変わらない。
- 既存の保存処理で `GymVisit` と `TrainingPerformance` が正しく作成される。
- Daily / Calendar / Dashboard 側の実施済み表示に影響しない。

## 10. 実装手順案

1. `coreApi.getTrainingSessionView` に任意の `trainingMenuSetId` を追加する。
2. `training-history-api` の `GET /training-session-view` で `trainingMenuSetId` 指定を処理する。
3. `TrainingSessionPage` にメニューセット選択状態と選択UIを追加する。
4. 選択中メニューセットIDをAPI呼び出しに渡す。
5. メニューセット切り替え時に下書きが残ることを確認する。
6. 確認モーダルと保存結果を確認する。
7. 必要に応じてテストを追加・更新する。

## 11. 非対象

- メニューセット作成・編集画面の機能追加。
- DBテーブル、GSI、既存データ移行の追加。
- 12件保存上限の緩和。
- 複数の `GymVisit` に自動分割して保存する機能。
- メニューセットごとに別々の履歴として保存する機能。

## 12. 未決定事項

- メニューセット選択UIを `select` にするか、チップ型にするか。
- 確認モーダルで、各種目がどのメニューセットから入力されたかを表示するか。
- `todayDoneTrainingMenuItemIds` を実施画面上で明示表示するか。

初回実装では、UIはシンプルな `select`、確認モーダルは現行表示維持、`todayDoneTrainingMenuItemIds` は既存レスポンス維持のみとする方針が安全。
