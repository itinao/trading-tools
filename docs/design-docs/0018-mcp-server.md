# Design Doc 0018: MCP サーバー（データソースへのアクセス）

| | |
| --- | --- |
| 状態 | **承認**（2026-09-23） |
| 作成日 | 2026-09-23 |
| 元になる Design Doc | [0001](./0001-repository.md)（エージェントの入口は CLI）、[0002](./0002-foundation.md) §3.3（CLI 規約）、[0017](./0017-dashboard-serving.md)（配信と公開範囲） |
| supersede | [0001](./0001-repository.md)「データストアは CLI 経由でのみ触る」→「SQLite を直接触らない。読み書きは `@trading/domain` を通す。エージェントの入口は CLI と MCP」 |
| 対応する実行計画 | [0002](../execution-plans/0002-operations.md) O9（本書で追加） |

## 1. 背景と目的

いま、このデータ（保有・株価・ニュース・判定・助言・アクション）に触れる入口は **CLI と ダッシュボード** の 2 つ。
Claude Code は Bash で `pnpm actions list` を叩けるが、それ以外の AI クライアント（codex、Claude Desktop、スマホ）からは触れない。
**MCP サーバーを足して、AI クライアントからこのデータを読めるようにする。**

非ゴール:

- 外部（インターネット）への公開。0017 と同じく同じネットワーク / Tailscale の中まで
- 投資判断そのもの。MCP は事実と評価を渡すだけで、判断は人が行う（0001 §9）

## 2. 決定

| 項目 | 決定 | 理由 |
| --- | --- | --- |
| データへの触り方 | **`@trading/domain` を直接呼ぶ**（ダッシュボードと同じ） | 画面が使っている読み取りはすべて domain にある。読み取り系の CLI は domain を呼ぶだけの薄い皮で、そこを経由しても同じ関数に `tsx` の起動（数百 ms）を足すだけ |
| 位置づけ | `apps/mcp`（`@trading/mcp`）。**ツールではなくアプリ** | ダッシュボードと同じ「domain を使う表示層」。CLI 規約（stdout は JSON 1 つ）に従えないものを `tools/` に置かない |
| 0001 の決まり | 「データストアは CLI 経由でのみ触る」を **「SQLite を直接触らない。読み書きは `@trading/domain` を通す。エージェントの入口は CLI と MCP」** に改める | ダッシュボードは既に domain を直接使っており、決まりの実態と文言がズレていた。守りたいのは「生 SQL を散らさない」こと |
| 書き込み | **既定は読み取り専用**。`--write` のときだけ 対応した / 見送り、判定の上書き、ウォッチの追加削除 を出す | 事故の範囲を限る。domain 側に検証（`WatchError` など）があるので、CLI を通さなくても不正な書き込みは弾かれる |
| ツールの粒度 | **画面と同じ「まとめて返す」単位**。`actions_today`（アクション画面の中身）、`instrument_overview`（銘柄詳細）、`instruments_list`、`review_history`、`screen_result`、`assess_pending` / `advise_pending` | 1 回の呼び出しで判断に足りる情報が返る。LLM が何度も往復しない。ダッシュボードの `pages/*/api` と同じ形なので、共通化できるものは domain に寄せる |
| transport | **stdio**（ローカルでプロセス起動） | 設定が 1 行で済み、認証が要らない。HTTP は使う人が出てから（§5 U1） |
| 接続 | プロセスに 1 本の SQLite 接続を使い回す（`openDatabase` を 1 回） | ダッシュボードと同じ。読み取りだけなら他のツールの書き込みと衝突しない（WAL） |

### 出すツール（読み取り）

| MCP ツール | 中身（domain の関数） | 何が返るか |
| --- | --- | --- |
| `actions_today` | `listActions` + `adviceForActions` + `dashboardStatus` | 未対応のアクション、助言、株価の鮮度・未判定の件数 |
| `instruments_list` | `positions` / `listWatches` + `latestQuotes` + `latestScores` | 監視している銘柄と株価・スコア・損益 |
| `instrument_overview` | `timeline` / `recentNews` / `latestFundamentals` / `financialHistory` / `quoteHistory` | 1 銘柄の「今どうか」と出来事 |
| `review_history` | `history` | 判断の履歴と stance × 判断の集計 |
| `screen_result` | `listScreenRuns` / `getScreenRun` | スクリーニングの実行と結果 |
| `assess_pending` / `advise_pending` | `pendingSubjects` / `pendingAdvice` + `factBundle` | 未判定のニュース・開示、助言待ちのアクションと事実の束 |

## 3. 実装

### 3.1 構成

```
MCP クライアント（Claude Desktop / codex / Claude Code）
   ↓ stdio（JSON-RPC）
apps/mcp          … ツール定義（入力スキーマ）と、domain を呼んで整える処理
   ↓
@trading/domain → @trading/db → data/trading.db
```

ダッシュボードと横並びの関係になる:

```
apps/dashboard  ─┐
apps/mcp        ─┼→ @trading/domain → @trading/db
tools/*（CLI）  ─┘
```

### 3.2 ダッシュボードとの共通化

`apps/mcp` のツールと `apps/dashboard` の `pages/*/api` は、ほぼ同じものを組み立てる。二重に書かないため、**画面用に整える処理のうち表示に依らない部分は `@trading/domain` に寄せる**（例: アクション + 助言 + 状態を束ねる関数）。表示の都合（列の並び、丸め）はそれぞれに残す。

### 3.3 設定

`.mcp.json`（リポジトリ直下、コミットする）:

```json
{
  "mcpServers": {
    "trading-tools": { "command": "pnpm", "args": ["--silent", "mcp"] }
  }
}
```

書き込みを許すときは `args` に `--write` を足す。`--db` で DB の場所を変えられる。

## 4. 検討した選択肢

| 選択肢 | 採否 | 理由 |
| --- | --- | --- |
| **A. `@trading/domain` を直接呼ぶ**（本案） | 採用 | 画面と同じ経路。プロセス起動が無く、まとめて返すツールを自由に作れる |
| B. 既存の CLI を子プロセスで呼び、stdout の JSON を返す | 不採用 | 「入口は CLI」の文言には合うが、読み取り系の CLI は domain の薄い皮なので、同じ関数に `tsx` の起動を足すだけになる。引数の組み立ても増える |
| C. SQL をそのまま実行できるツールを出す | 不採用 | 生 SQL は事故が大きい。読みたいものが増えたら domain に関数を足す方が、画面とも共有できる |
| D. MCP を作らず Bash で CLI を叩く（現状） | 部分採用 | Claude Code ではこれで足りている。**codex・Claude Desktop など Bash が無いクライアント**のために MCP を作る |

## 5. リスク・未決事項

- **R1 入口が増える**。同じ「未対応のアクション」を CLI・画面・MCP の 3 か所が組み立てるので、答えがズレうる。読み取りは必ず `@trading/domain` の関数を通し、束ねる処理も domain に置くことで防ぐ（§3.2）。テストで 1 本担保する
- **R2 書き込みの経路も増える**。検証は domain にあるので不正な値は弾かれるが、`--dry-run` のような CLI の安全装置は無い。既定を読み取り専用にして、`--write` を明示したときだけ出す
- **U1 transport**: stdio で始める。別の端末やスマホから使いたくなったら Streamable HTTP を 0017 と同じ範囲（Tailscale の中）で足す。認証はそのとき決める
- **U2 粒度**: まとめて返す 6〜7 個で始める。足りなければ足す。細かい読み取りが要るなら domain に関数を足す
- **U3 書き込み**: 既定は読み取り専用。朝の確認を MCP 越しに行いたくなったら `assess record` / `advise record` を足すか検討する

## 6. 壁打ちの結果（2026-09-23）

| 論点 | 決定 |
| --- | --- |
| データの取り方 | `@trading/domain` を直接呼ぶ（当初案の「CLI を子プロセスで呼ぶ」は、読み取り系の CLI が domain の薄い皮だと分かったので取り下げ） |
| 置き場所 | `apps/mcp`。ダッシュボードと横並びの「domain を使うアプリ」 |
| 粒度 | 画面と同じ「まとめて返す」単位（§2 の表） |
| transport | stdio。別の端末から使いたくなったら HTTP を足す（U1） |
| 書き込み | 既定は読み取り専用。`--write` のときだけ出す |
| 0001 の文言 | 「SQLite を直接触らない。読み書きは `@trading/domain` を通す。エージェントの入口は CLI と MCP」に改める（本書で supersede。AGENTS.md は実装時に更新する） |
