# AGENTS.md

このリポジトリで作業するエージェント（codex / Claude Code）向けの指示。`CLAUDE.md` はこのファイルを参照するだけ。

## このリポジトリは何か

資産運用のツール群。保有銘柄・ウォッチ銘柄の監視をツールに任せ、「検知 → 確認 → アクション」を人が短時間でこなせるようにする。
全体像は [Design Doc 0001](docs/design-docs/0001-repository.md)、基盤は [Design Doc 0002](docs/design-docs/0002-foundation.md)。

## 現在のフェーズ

**実行計画 0001（M0〜M5）完了。実行計画 [0002](docs/execution-plans/0002-operations.md)（運用フェーズの改善）で O1（ダッシュボードの情報設計、Design Doc 0015）を壁打ち中。**
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
| `packages/market-data` | `@trading/market-data` | Provider（yahoo / google-news / tdnet / mock）。外部アクセスは注入可能でテストはフィクスチャ |
| `tools/db` | `@trading/tool-db` | `pnpm db migrate` / `pnpm db status` |
| `tools/import-holdings` | `@trading/tool-import-holdings` | `pnpm import-holdings run <csv>` / `list` |
| `packages/domain` | `@trading/domain` | ツールとダッシュボードが共有する読み書き（保有、株価、アクション） |
| `tools/collect` | `@trading/tool-collect` | `pnpm collect all`（quotes / fundamentals / financials / news / disclosures） |
| `tools/detect` | `@trading/tool-detect` | `pnpm detect run`。スコアを計算し、10 種のルールでシグナルとアクションを作る。閾値・係数は `config/detect.json` |
| `tools/actions` | `@trading/tool-actions` | `pnpm actions list` / `show` / `resolve` |
| `tools/assess` | `@trading/tool-assess` | `pnpm assess pending` / `record` / `override` / `list`。AI 判定の出し入れ |
| `tools/advise` | `@trading/tool-advise` | `pnpm advise pending` / `record`。アクションへの AI 助言の出し入れ |
| `tools/watch` | `@trading/tool-watch` | `pnpm watch add` / `remove` / `list`。ウォッチ銘柄 |
| `tools/screen` | `@trading/tool-screen` | `pnpm screen run --preset value`。母集団は `pnpm collect universe`（JPX、月 1 回） |
| `tools/review` | `@trading/tool-review` | `pnpm review timeline <code>` / `history`。振り返り |
| `tools/schedule` | `@trading/tool-schedule` | `pnpm schedule install` で launchd に日次実行を登録 |
| `apps/dashboard` | `@trading/dashboard` | `pnpm dashboard` で http://127.0.0.1:3000。見た目は `apps/dashboard/DESIGN.md` |
| `tools/<name>` | `@trading/tool-<name>` | 各ツール（M1 以降） |
| `.agents/skills/` | | エージェントのスキル。`morning`（朝の確認: assess → detect → advise）、`assess`、`advise`、`retrospect`（月次の振り返り、提案のみ）。`.claude/skills` はシンボリックリンク |
| `docs/design-docs/` | | Design Doc（連番、変更ごとに1本） |
| `docs/schema.md` | | **現在の全テーブルの ER 図（自動生成）** |
| `docs/screens.md` | | **現在の画面遷移図（自動生成）** |
| `docs/execution-plans/` | | 実行計画（進捗に合わせて更新する） |
| `data/source/` | | 個人データ（gitignore） |
| `data/trading.db` | | SQLite（gitignore）。`TRADING_DB_PATH` で変更可 |

```bash
pnpm install
pnpm db migrate          # DB を作る / マイグレーションを当てる
pnpm test                # 全パッケージのテスト
pnpm lint && pnpm typecheck
```

## 日次の手順

```bash
# 楽天証券の CSV を data/source/ に置いたとき
pnpm import-holdings run "data/source/assetbalance(all)_YYYYMMDD_HHMMSS.csv"

# 毎日（引け後）。launchd に登録すれば平日 18:30 に自動で走る（pnpm schedule install / status）
pnpm collect all         # 株価・指標・財務・ニュース・開示（Yahoo Finance / Google News / TDnet）
pnpm detect run          # スコアの計算、下落・悪材料・財務悪化の検知 → シグナルとアクション

# 朝（エージェントで）。「朝の確認をして」と言うと .agents/skills/morning が assess → detect run → advise を順に行う
pnpm assess pending      # 未判定のニュース・開示（開示は PDF 本文つき）
pnpm assess record --input <file>   # 判定を書き込む → その後 pnpm detect run
pnpm advise pending      # 助言が無い未対応アクションと事実の束
pnpm advise record --input <file>   # 助言を書き込む

# 確認
pnpm actions list        # 未対応のアクション
pnpm dashboard           # http://127.0.0.1:3000

# 振り返り（月 1 回）。「振り返りをして」と言うと .agents/skills/retrospect が履歴を読んで傾向と閾値の調整案を出す（設定は変えない）
pnpm review history --since YYYY-MM-DD
pnpm review timeline <code>

# 攻め（週末など）
pnpm collect universe    # 東証の上場銘柄一覧（月 1 回）
pnpm screen run --preset value    # value | growth | quality、または --per-max 等で条件指定。約 1〜2 分
pnpm watch add <code> --note "..."  # ダッシュボードのスクリーナーからも追加できる
```

- 株価が 1 件もない銘柄（新規保有）は `collect quotes` が自動で 1 年分の日足を遡る。全銘柄を遡り直すなら `pnpm collect quotes --backfill`
- 手元の検証でモックを使うなら `pnpm collect quotes --provider mock`（`data/source/mock-quotes.json` を編集）。実データと混ざらないよう、検証後は `quotes` の `source = 'mock'` を消す
- 外部ソースは非公式（Yahoo / Google News）を含む。止まったら `failed` に出て、ダッシュボードの「株価が古い」バナーで気づく（Design Doc 0009）
- AI の判定は `pnpm assess override <id> --sentiment N` かダッシュボードで人が上書きできる。AI の判定は消えず、human が優先される
- 助言は `actions` に `origin = 'ai'`、ルール生成のアクションと同じ `signal_id` で保存され、一覧では同じ行の中に出る。事実の束（`advise pending`）に無いことを根拠にしない
- アクションを「対応した」にするときは、何をしたか（売った / 買った / 確認した）をメモに書く。履歴（`/history`）と `retrospect` がそれを使う
- 監視対象は保有 ∪ ウォッチ。攻めのルール（`valuation_cheap` / `growth_streak` / `oversold_quality`）はウォッチ銘柄にだけ適用され、アクションは「買い検討」バッジで区別される。ウォッチの助言の stance は candidate / review / pass

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

## ダッシュボードの作り方（FSD）

`apps/dashboard/src` は [Feature-Sliced Design](https://feature-sliced.design/) で構成する（Design Doc 0006）。

- 層と依存方向: `app → pages → widgets → features → entities → shared`。上の層は下の層だけを import する。同じ層のスライス同士は import しない
- `routes/` は TanStack Router の規約上の場所で、層ではない。ルートファイルは `pages` のコンポーネントとサーバー関数を呼ぶだけの薄いアダプタにする
- スライス名は単数形（`entities/action`、`widgets/action-table`）。steiger の命名チェックは不可算名詞（`advice`）を誤検知するため切ってある
- スライスは `index.ts` を公開 API とし、他からはそこだけを import する。`shared` は層の `index.ts` を持たず、`shared/api` / `shared/lib` / `shared/ui` のセグメントごとに `index.ts` を置く
- サーバー関数（`createServerFn`）は `api` セグメントに置く。画面のデータ取得は `pages/<page>/api`、利用者の操作（書き込み）は `features/<feature>/api`。DB を触るモジュール（`shared/api`、`@trading/domain`、`@trading/db`）は **handler 内で動的 import** し、クライアントバンドルに入れない
- widgets は自分でデータを取らず props で受け取る
- 画面（`routes/*.tsx`）や `<Link>` を足したら `pnpm screens` で [docs/screens.md](docs/screens.md) を再生成する（古いままだと `pnpm test` が落ちる）。`<Link to>` には文字列リテラルを書く（変数を渡すと遷移図に載らない）。`pages/<page>/ui/*Page.tsx` の先頭には画面の説明を JSDoc で書く
- `pnpm --filter @trading/dashboard fsd`（`pnpm lint` に含まれる）で層の逆流・公開 API の迂回を検査する。通らない構成は直す

### 見た目（DESIGN.md）

- ダッシュボードの見た目は [apps/dashboard/DESIGN.md](apps/dashboard/DESIGN.md)（Google Stitch の DESIGN.md フォーマット）に従う（Design Doc 0007）。front matter がトークン（色・文字・角丸・余白・コンポーネント）、本文が意図と Do's / Don'ts
- 色・文字・角丸・余白の値は `pnpm design:tokens` で `apps/dashboard/src/app/tokens.css` に生成される。CSS は **この変数だけ** を使い、生の色コードや px を `styles.css` に書かない。DESIGN.md を変えたら再生成する（古いままだと `pnpm test` が落ちる）
- 新しい UI 部品を作るときは、先に DESIGN.md の `components` と本文の Components に定義を足し、`styles.css` にそのコンポーネント名のクラスを書く
- 損益・変化率の色は楽天証券に合わせて **赤 = 上昇（`gain`）、緑 = 下落（`loss`）**。重大度（`warn` / `critical`）は必ずバッジ（面つき）で示し、損益の文字色と混同させない

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
