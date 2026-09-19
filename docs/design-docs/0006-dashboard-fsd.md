# Design Doc 0006: ダッシュボードを Feature-Sliced Design で構成する

| | |
| --- | --- |
| 状態 | 実装済み（2026-09-20） |
| 作成日 | 2026-09-20 |
| 元になる Design Doc | [0005](./0005-detect-and-dashboard.md) §3.5 ダッシュボード |
| supersede | 0005 §3.5 のうち、ファイル構成に関する記述 |

## 1. 背景と目的

M1 のダッシュボードは 3 画面を `routes/` に直接書き、共有コードを `format.ts` と `server/fns.ts` に置いた素朴な構成になっている。M2 以降で画面と部品が増える（銘柄詳細にニュース・開示・スコア推移、M4 でウォッチ、M5 で振り返り）ため、**責務の置き場を先に決めて**、エージェントが迷わず追加できるようにする。

構成は [Feature-Sliced Design](https://feature-sliced.design/)（FSD）に従う。層と依存方向が規約として決まっており、エージェントに「どこに何を置くか」を説明しやすい。

## 2. スコープ / 非スコープ

- スコープ: `apps/dashboard/src` の構成。既存 3 画面の移し替え。層の依存方向を機械的に検査する仕組み
- 非スコープ: CLI ツール群・`packages/` の構成（FSD はフロントエンド向けの規約であり、ワークスペースには持ち込まない）。画面の見た目や機能の変更

## 3. 設計

### 3.1 層と依存方向

上の層は下の層だけを import できる。同じ層のスライス同士は import しない。

```
app → pages → widgets → features → entities → shared
```

| 層 | 責務 | このダッシュボードでの中身 |
| --- | --- | --- |
| `app` | アプリの初期化。ルーター、ルートレイアウト、グローバル CSS | `router.tsx`、`layout.tsx`（ナビ付きの `RootDocument`）、`styles.css` |
| `pages` | 1 画面 = 1 スライス。画面のデータ取得（ローダー用のサーバー関数）と、widgets を並べる | `actions`、`holdings`、`instrument` |
| `widgets` | 画面をまたいで使う、自己完結した大きな部品 | `action-table`、`holdings-table`、`signal-table`、`quote-history-table`、`stale-quotes-banner` |
| `features` | 利用者の操作（書き込みを伴うもの） | `resolve-action`（対応した / 見送り / 未対応に戻す） |
| `entities` | ドメインの概念の表示と型 | `action`（重大度・kind・状態のラベルと表示）、`instrument`（銘柄リンク）、`quote`、`holding` |
| `shared` | ドメインを知らない共通部品 | `api/db.ts`（サーバー専用の DB ハンドル）、`lib/format.ts`（金額・％の整形）、`ui/`（表のセルなど） |

### 3.2 ディレクトリ

```
apps/dashboard/src/
├── routes/                     # TanStack Router のファイルルート（配置は Router の規約）。
│   ├── __root.tsx              #   app/layout を呼ぶだけ
│   ├── index.tsx               #   pages/actions を呼ぶだけ（validateSearch とローダーはここ）
│   ├── holdings.tsx
│   └── instruments.$id.tsx
├── app/
│   ├── router.tsx
│   ├── layout.tsx
│   └── styles.css
├── pages/
│   ├── actions/    { api/get-actions-page.ts, ui/ActionsPage.tsx, index.ts }
│   ├── holdings/   { api/get-holdings-page.ts, ui/HoldingsPage.tsx, index.ts }
│   └── instrument/ { api/get-instrument-page.ts, ui/InstrumentPage.tsx, index.ts }
├── widgets/
│   ├── action-table/         { ui/ActionTable.tsx, index.ts }
│   ├── holdings-table/
│   ├── signal-table/
│   ├── quote-history-table/
│   └── stale-quotes-banner/
├── features/
│   └── resolve-action/       { api/resolve-action.ts, ui/ResolveButtons.tsx, index.ts }
├── entities/
│   ├── action/     { model/labels.ts, ui/SeverityBadge.tsx, index.ts }
│   ├── instrument/ { ui/InstrumentLink.tsx, index.ts }
│   ├── holding/    { model/pct.ts, index.ts }
│   └── quote/      { model/change.ts, index.ts }
└── shared/
    ├── api/db.ts
    ├── lib/format.ts
    └── ui/PctCell.tsx
```

- `routes/` は TanStack Router が要求する場所なので FSD の層には含めず、**`app` 層の一部（ルーターのアダプタ）として扱う**。ルートファイルは薄く保ち、画面の中身は `pages` に置く
- スライスは `index.ts` を公開 API とし、他の層はそこからだけ import する（`pages/actions/ui/ActionsPage.tsx` を直接 import しない）
- セグメントは `ui` / `api` / `model` / `lib` を使う。`api` にはサーバー関数（`createServerFn`）を置く

### 3.3 サーバー関数の置き場

| 種類 | 置き場 | 理由 |
| --- | --- | --- |
| 画面のデータ取得（読み） | `pages/<page>/api/` | 画面単位で必要なデータを1回で取る。widgets は props で受け取り、自分では取らない |
| 利用者の操作（書き） | `features/<feature>/api/` | 操作と一緒に置く |
| DB ハンドル | `shared/api/db.ts` | サーバー専用。`api` セグメントの handler 内で動的 import する（0005 と同じ。クライアントバンドルに入れない） |

`@trading/domain` / `@trading/db` は `api` セグメントからだけ使う。`ui` / `model` はワークスペースのパッケージに依存しない（型は `import type` のみ可）。

### 3.4 依存方向の検査

FSD 公式のリンター [steiger](https://github.com/feature-sliced/steiger) を `apps/dashboard` に入れ、`pnpm --filter @trading/dashboard fsd` で層の逆流・スライス間の直接参照・公開 API を通さない import を検出する。ルートの `pnpm lint` からも呼ぶ。`routes/` は steiger の対象外にする（層ではないため）。

steiger がこの構成で実用にならない場合（TanStack のファイル名 `$id` や `?url` import で誤検知が多い等）は、Biome の `noRestrictedImports` で「下の層から上の層への import 禁止」だけを書く。実装時に判断し、本書に補足する。

## 4. 検討した選択肢と決定

| 論点 | 決定 | 却下した選択肢と理由 |
| --- | --- | --- |
| `routes/` の扱い | `app` 層の一部（薄いアダプタ） | `routes/` を `pages` とみなす: ルートファイルに画面の中身を書くと `pages` 層が空になり、FSD の意味がない。`app/routes` に移す: TanStack Router の既定 `src/routes` を変える設定が増える |
| 読みのサーバー関数の置き場 | `pages/*/api` | `entities/*/api`: 画面に必要なデータが複数エンティティにまたがり、往復が増える。FSD でも「ページ単位のデータ取得は pages に置いてよい」とされている |
| ワークスペース全体への適用 | しない | CLI ツールに `ui` / `widgets` の概念はない。層の依存方向（tools → domain → db/cli）は既に 0005 §3.6 で決めている |
| 検査ツール | steiger（ダメなら Biome） | 検査なし: エージェントが規約を破っても気づけない |

## 5. リスク・未決事項

| # | 内容 | 対応 |
| --- | --- | --- |
| R1 | 3 画面の移し替えで動作が変わる | 移し替え前後で同じ操作（一覧、状態変更、詳細、404）をブラウザで確認する。機能追加は同時にしない |
| R2 | steiger が TanStack Start の構成で誤検知する | §3.4 の代替案 |

## 実装時の補足（2026-09-20）

- `shared` 層は FSD の規約上、層全体の `index.ts` を持たず、セグメント（`api` / `lib` / `ui`）ごとに公開 API を置く。steiger の `no-layer-public-api` で検出された
- steiger の `insignificant-slice`（参照が1つのスライスは統合を促す）は無効化した。M2 以降で再利用する前提で widgets を分けているため
- ルーターは `tanstackStart({ router: { entry: 'app/router.tsx' } })` で `app` 層に置いた（パスは `src` 基準）
- CSS は `routes/__root.tsx` で `import '../app/styles.css'` の副作用 import にした
- ルートの `pnpm lint` は Biome に続けて steiger を実行する
