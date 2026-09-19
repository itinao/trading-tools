# Design Doc 0002: 基盤（M0）

| | |
| --- | --- |
| 状態 | 承認（2026-09-19） |
| 作成日 | 2026-09-19 |
| 元になる Design Doc | [0001 リポジトリ全体](./0001-repository.md) §7, §12 |
| 対応するマイルストーン | [実行計画 0001](../execution-plans/0001-initial.md) M0 |

## 1. 背景と目的

ツール群が同居する土台を作る。以降のマイルストーンで、エージェントが「どこに何を置き、どう動かし、どう試験するか」に迷わない状態にする。

## 2. スコープ / 非スコープ

### スコープ

- pnpm ワークスペースと TypeScript / lint / test の共通設定
- `packages/db`: SQLite への接続、スキーマ定義の置き場、マイグレーションの生成と適用
- `packages/cli`: CLI 共通規約の実装（引数、JSON 出力、終了コード、ログ）
- `db` コマンド: マイグレーション適用と状態表示。CLI 規約に沿った最初のコマンドを兼ねる
- `AGENTS.md` の実装フェーズ向け更新、`.agents/skills/` と `.claude/skills` の配置
- `data/` の配置

### 非スコープ

- 業務テーブル（銘柄、保有など）。M1 の Design Doc 0003 で定義する
- `apps/dashboard`。M1 の Design Doc 0004 で作る
- 日次実行の仕組み（U4）

## 3. 設計

### 3.1 ワークスペース構成

```
trading-tools/
├── package.json               # ワークスペースのルート。共通スクリプト
├── pnpm-workspace.yaml        # tools/*, apps/*, packages/*
├── tsconfig.base.json         # 各パッケージが extends する
├── biome.json                 # lint + format
├── vitest.workspace.ts        # 全パッケージのテストを1コマンドで
├── .node-version              # 22
├── .env.example               # TRADING_DB_PATH など
├── AGENTS.md / CLAUDE.md
├── .agents/skills/            # スキルの正本（M0 では README のみ）
├── .claude/skills → ../.agents/skills
├── packages/
│   ├── db/                    # @trading/db
│   │   ├── src/schema/        # Drizzle スキーマ（テーブルごとに1ファイル）
│   │   ├── src/client.ts      # 接続、PRAGMA、マイグレーション適用
│   │   ├── migrations/        # drizzle-kit が生成した SQL
│   │   └── drizzle.config.ts
│   └── cli/                   # @trading/cli — CLI 規約の実装
├── tools/
│   └── db/                    # @trading/tool-db — `db migrate` / `db status`
├── apps/                      # M1 で dashboard を追加
└── data/
    ├── source/                # 個人データ（gitignore）
    └── trading.db             # gitignore
```

- パッケージ名は `@trading/<name>`。ツールは `@trading/tool-<name>`
- ツールは **ビルドせず `tsx` で直接実行**する。ルートの `package.json` に `"db": "tsx tools/db/src/main.ts"` のように登録し、`pnpm db migrate` で呼ぶ。以降のツールも同じ（`pnpm import-holdings ...`, `pnpm collect ...`）
- ワークスペース内の参照は `workspace:*`

### 3.2 データストア

| 項目 | 決定 |
| --- | --- |
| DB | SQLite 1ファイル。既定 `data/trading.db`、環境変数 `TRADING_DB_PATH` で上書き |
| ドライバ | `better-sqlite3` |
| ORM | Drizzle ORM。スキーマは TypeScript で定義し、型を全ツールで共有する |
| マイグレーション | `drizzle-kit generate` で SQL を生成し `packages/db/migrations/` にコミット。適用は `pnpm db migrate`（Drizzle の migrator） |
| PRAGMA | `journal_mode = WAL`、`foreign_keys = ON`、`busy_timeout = 5000` |
| テスト | `:memory:` にマイグレーションを当てて使う。ヘルパーを `@trading/db/testing` に置く |

スキーマ変更の手順（`AGENTS.md` にも書く）:
1. `packages/db/src/schema/` を編集
2. `pnpm db:generate`（drizzle-kit generate）で SQL を生成
3. `pnpm db migrate` で適用
4. 生成された SQL をコミットする。手で編集しない

### 3.3 CLI 規約

すべてのツールが従う。`@trading/cli` がこれを実装し、ツールは業務ロジックだけを書く。

| 項目 | 規約 |
| --- | --- |
| 引数 | `pnpm <tool> <subcommand> [options]`。パーサは `commander` |
| stdout | **JSON のみ**。1コマンド1オブジェクト。人向けの文字列は出さない |
| stderr | ログ。人向け。`--quiet` で抑制、`--verbose` で詳細 |
| 成功時の形 | `{ "ok": true, "data": ... }` |
| 失敗時の形 | `{ "ok": false, "error": { "code": "...", "message": "..." } }` |
| 終了コード | `0` 成功、`1` 実行時の失敗、`2` 引数の誤り |
| JSON 入力 | `--input <path>`、`-` で stdin |
| 共通オプション | `--db <path>`（`TRADING_DB_PATH` より優先）、`--dry-run`（書き込みを行わず、行う予定を `data` に返す）、`--quiet`、`--verbose` |
| 冪等性 | 同じ入力で2回実行しても結果が変わらない。各ツールの Design Doc で「何をキーに重複を防ぐか」を書く |
| 日付・時刻 | タイムゾーンは `Asia/Tokyo`。日付は `YYYY-MM-DD`、時刻は ISO 8601（オフセット付き）の文字列 |
| 例外 | 捕捉されなかった例外は `ok: false`, `code: "internal"`, 終了コード `1` に変換する |

`db` コマンドの例:

```
$ pnpm db migrate
{"ok":true,"data":{"applied":["0000_init"],"pending":[]}}

$ pnpm db status
{"ok":true,"data":{"path":"data/trading.db","applied":["0000_init"],"pending":[]}}
```

### 3.4 共通設定

| 項目 | 決定 |
| --- | --- |
| Node | 22（`.node-version`）。`node:sqlite` は experimental のため使わない |
| TypeScript | `strict`、ESM、`moduleResolution: bundler` |
| lint / format | Biome。`pnpm lint`, `pnpm format` |
| test | Vitest。ルートの `pnpm test` で全パッケージ |
| 型検査 | `pnpm typecheck`（各パッケージで `tsc --noEmit`） |

### 3.5 エージェント向けファイル

- `AGENTS.md` に追記: ワークスペースの構成、ツールの実行方法、CLI 規約の要点、スキーマ変更の手順、テストの書き方
- `.agents/skills/README.md`: スキルの置き方（`<name>/SKILL.md`）。M3 まで中身はない
- `.claude/skills` は `.agents/skills` へのシンボリックリンク

## 4. 検討した選択肢と決定

| 論点 | 決定 | 却下した選択肢と理由 |
| --- | --- | --- |
| SQLite ドライバ | `better-sqlite3` | `node:sqlite`: Node 22 では experimental 警告が出る。ORM の公式アダプタもない。`libsql`: 機能は十分だがローカル1ファイル用途では better-sqlite3 の方が実績が多い |
| ORM | Drizzle | Kysely: 型付きクエリビルダとしては良いが、スキーマを型から生成する方向で、マイグレーション生成がない。素の SQL: 型共有ができず、エージェントが書くコード量が増える |
| CLI パーサ | `commander` | `node:util.parseArgs`: 依存ゼロだがサブコマンド・ヘルプを自前で書くことになる。`citty`: 軽量だがエージェントの学習データに少ない |
| ツールの実行 | `tsx` で直接実行 | ビルドしてから実行: 手順が増える。ローカル運用なので起動時間は問題にならない |
| lint / format | Biome | ESLint + Prettier: 設定ファイルが増える。Biome 1つで両方できる |
| ワークスペース | pnpm workspace（Turborepo 等は使わない） | パッケージ数が少なく、タスクランナーは不要 |
| stdout の形 | 常に JSON | `--json` で切替: 人向けとエージェント向けの2系統を保守することになる。人はダッシュボードを見る |

## 5. リスク・未決事項

| # | 内容 | 対応 |
| --- | --- | --- |
| R1 | `better-sqlite3` はネイティブモジュール。Node のメジャー更新時に再ビルドが必要 | `.node-version` で固定。更新時は `pnpm rebuild` |
| R3 | **（実装中に判明）** `better-sqlite3` v13 は N-API 10 を要求し、Node 22.13（N-API 9）では DB を開いた時点で SIGSEGV になる | v12 系（`^12.11`）に固定。Node を 22.14 以降に上げたら v13 に更新できる |
| R2 | `tsx` 実行はワークスペース内の相対 import 解決に依存する | `packages/*` を `exports` で公開し、ツールからは `@trading/db` のように参照する。相対パスで跨がない |
| U1 | 金額・数量の型（整数円か、小数を許すか） | 0003 で保有・株価のテーブルを定義するときに決める |
