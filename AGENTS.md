# AGENTS.md

このリポジトリで作業するエージェント（codex / Claude Code）向けの指示。`CLAUDE.md` はこのファイルを参照するだけ。

## このリポジトリは何か

資産運用のツール群。保有銘柄・ウォッチ銘柄の監視をツールに任せ、「検知 → 確認 → アクション」を人が短時間でこなせるようにする。
全体像は [Design Doc 0001](docs/design-docs/0001-repository.md)、基盤は [Design Doc 0002](docs/design-docs/0002-foundation.md)。

## 現在のフェーズ

**M1（守りの最小経路）実装中。** 入力側 [Design Doc 0003](docs/design-docs/0003-holdings-and-quotes.md) は実装済み。次は出力側の Design Doc 0004（`detect` と `dashboard`）を書いて承認を得る。
進捗は [実行計画 0001](docs/execution-plans/0001-initial.md)。

## 作業を始める前に

1. [README.md](README.md) と [Design Doc 0001](docs/design-docs/0001-repository.md) を読む
2. [実行計画](docs/execution-plans/0001-initial.md) で、今どのマイルストーンにいるかを確認する
3. 着手するマイルストーンの Design Doc が **承認** になっているか確認する。なければ、まず Design Doc を書いて利用者と壁打ちする

## 守ること

- **承認された Design Doc がない変更は実装しない。** 依頼されたら、先に Design Doc を書くことを提案する
- **個人データをコミットしない。** `data/source/` と `*.csv` は `.gitignore` 済み。ツールは `data/source/` を参照するだけで、編集・移動・削除しない
- **事実と評価を分ける。** 外部由来のデータ（株価、ニュース、開示）は取得時点付きで保存し、編集しない。評価（スコア、シグナル、助言）は事実から作り直せるようにする
- **AI に関わる処理はツールの外に置く。** ツールは AI なしで決定的に動く。判定・助言はエージェントのスキルで行い、結果はツールの CLI 経由で書き戻す
- **データストアは CLI 経由でのみ触る。** SQLite を直接読み書きしない
- **Design Doc の書き換えルール。** 草案は自由、承認後は漏れの補足のみ可、実装済みは不可（新しい Design Doc で supersede）
- コミットは依頼があったときだけ。コミット前に `pnpm lint && pnpm typecheck && pnpm test` を通す

## ワークスペース

pnpm ワークスペース。Node 22（`.node-version`）。ビルドせず `tsx` で実行する。

| パス | パッケージ | 内容 |
| --- | --- | --- |
| `packages/cli` | `@trading/cli` | CLI 共通規約の実装（`defineTool`） |
| `packages/db` | `@trading/db` | SQLite 接続、Drizzle スキーマ、マイグレーション |
| `packages/market-data` | `@trading/market-data` | `QuoteProvider` と各 Provider（M1 は mock のみ） |
| `tools/db` | `@trading/tool-db` | `pnpm db migrate` / `pnpm db status` |
| `tools/import-holdings` | `@trading/tool-import-holdings` | `pnpm import-holdings run <csv>` / `list` |
| `tools/collect` | `@trading/tool-collect` | `pnpm collect quotes`。M2 で `news` / `disclosures` |
| `tools/<name>` | `@trading/tool-<name>` | 各ツール（M1 以降） |
| `apps/dashboard` | | 閲覧用 Web（M1 以降） |
| `.agents/skills/` | | エージェントのスキル（M2 以降）。`.claude/skills` はシンボリックリンク |
| `docs/design-docs/` | | Design Doc（連番、変更ごとに1本） |
| `docs/schema.md` | | **現在の全テーブルの ER 図（自動生成）** |
| `docs/execution-plans/` | | 実行計画（進捗に合わせて更新する） |
| `data/source/` | | 個人データ（gitignore） |
| `data/trading.db` | | SQLite（gitignore）。`TRADING_DB_PATH` で変更可 |

```bash
pnpm install
pnpm db migrate          # DB を作る / マイグレーションを当てる
pnpm test                # 全パッケージのテスト
pnpm lint && pnpm typecheck
```

## 日次の手順（M1 時点、手動）

```bash
# 楽天証券の CSV を data/source/ に置いたとき
pnpm import-holdings run "data/source/assetbalance(all)_YYYYMMDD_HHMMSS.csv"

# 株価の取得（M1 はモック。data/source/mock-quotes.json を編集して値を変えられる）
pnpm collect quotes
```

`mock-quotes.json` は初回の `collect quotes` で最新スナップショットの現在値から生成される。

## ツールの作り方（CLI 規約）

規約の全文は Design Doc 0002 §3.3。要点:

- `tools/<name>/src/tool.ts` に `defineTool({ name, description, commands })` でツールを定義し、`src/main.ts` から `process.exitCode = await tool.run(process.argv.slice(2))`。ルートの `package.json` の `scripts` に `"<name>": "tsx tools/<name>/src/main.ts"` を登録する
- **stdout は JSON 1つだけ。** ハンドラの戻り値が `{ ok: true, data }` になる。人向けの文字列は `context.logger` で stderr へ
- 失敗は `ToolError(code, message)` を投げる（終了コード 1）。引数の誤りは `UsageError`（終了コード 2）
- 共通オプション `--db` / `--dry-run` / `--quiet` / `--verbose` / `--input` は `context.options` に入る。`--dry-run` のときは書き込まず、行う予定を返す
- DB は `openDatabase(context.dbPath)` で開き、必ず `close()` する（`tools/db/src/tool.ts` の `withDatabase` を参照）
- 同じ入力で2回実行しても結果が変わらないようにする。何をキーに重複を防ぐかを Design Doc に書く
- 日付は `YYYY-MM-DD`、時刻は ISO 8601（オフセット付き）、タイムゾーンは `Asia/Tokyo`
- テストは `tool.run(argv, { stdout, stderr, env })` で stdout を捕まえて JSON を検証する（`tools/db/test/tool.test.ts` を参照）

## スキーマの変え方

1. `packages/db/src/schema/` にテーブルを1ファイル1テーブルで追加し、`index.ts` から re-export する
2. `pnpm db:generate <名前>` で `packages/db/migrations/` に SQL を生成する。**生成された SQL は手で編集しない**
3. `pnpm db migrate` で適用する
4. `packages/db/src/erd.ts` の `DEFINED_IN` に、そのテーブルを定義した Design Doc の番号を足す
5. `pnpm db:erd` で [docs/schema.md](docs/schema.md) を再生成する（古いままだと `pnpm test` が落ちる）
6. スキーマ・生成された SQL・`meta/`・`docs/schema.md` を一緒にコミットする

テストでは `createTestDatabase()`（`@trading/db/testing`）でマイグレーション済みのメモリ DB を使う。

## 用語

Design Doc 0001 §9 の用語を使う。特に **事実 / 評価**、**シグナル**（何が起きたか）/ **アクション**（何をすべきか）を混同しない。
