# Design Doc 0018: MCP サーバー（データソースへのアクセス）

| | |
| --- | --- |
| 状態 | **草案**（壁打ち中） |
| 作成日 | 2026-09-23 |
| 元になる Design Doc | [0001](./0001-repository.md)（エージェントの入口は CLI）、[0002](./0002-foundation.md) §3.3（CLI 規約）、[0017](./0017-dashboard-serving.md)（配信と公開範囲） |
| supersede | なし |
| 対応する実行計画 | [0002](../execution-plans/0002-operations.md) O9（本書で追加） |

## 1. 背景と目的

いま、このデータ（保有・株価・ニュース・判定・助言・アクション）に触れる入口は **CLI と ダッシュボード** の 2 つ。
Claude Code は Bash で `pnpm actions list` を叩けるが、それ以外の AI クライアント（codex、Claude Desktop、スマホ）からは触れない。
**MCP サーバーを足して、AI クライアントからこのデータを読めるようにする。**

非ゴール:

- 外部（インターネット）への公開。0017 と同じく同じネットワーク / Tailscale の中まで
- 投資判断そのもの。MCP は事実と評価を渡すだけで、判断は人が行う（0001 §9）

## 2. 決定（案）

| 項目 | 案 | 理由 |
| --- | --- | --- |
| データへの触り方 | **既存の CLI を子プロセスで呼び、stdout の JSON をそのまま返す** | 「データストアは CLI 経由でのみ触る」（0001）に乗る。MCP 用のクエリを書かないので、CLI とダッシュボードと答えがズレない |
| ツールの定義 | 各ツールの `defineTool` から **自動生成** する | コマンド名・説明・引数がすでにある。CLI が増えれば MCP も増える。手で二重に書かない |
| 書き込み | **既定は読み取り専用**。`--write` を付けたときだけ `actions resolve` / `assess override` / `watch add|remove` を出す | 事故の範囲を限る。`assess record` / `advise record`（AI の書き戻し）は「朝の確認」が CLI で行うので当面出さない |
| transport | **stdio**（ローカルでプロセス起動） | 設定が 1 行で済み、認証が要らない。HTTP は使う人が出てから（§5 U1） |
| 粒度 | まず CLI のコマンドと 1:1 | まとめツール（「今日の状況」）は使ってみてから足す（§5 U2） |
| 置き場所 | `tools/mcp`（`@trading/tool-mcp`）、`pnpm mcp` で起動 | 他のツールと同じ並び。ただし stdout は MCP のプロトコルが占有するので、**CLI 規約（stdout は JSON 1 つ）の例外**になる（§3.3） |

### 出すツール（読み取り）

| MCP ツール | 呼ぶ CLI | 何が返るか |
| --- | --- | --- |
| `actions_list` / `actions_show` | `actions list` / `show` | 未対応のアクションと本文・助言 |
| `instruments_list` | `watch list` ＋ 保有 | 監視している銘柄と株価・スコア |
| `review_timeline` / `review_history` | `review timeline` / `history` | 1 銘柄の時系列、判断の履歴 |
| `screen_runs` / `screen_result` | `screen runs` / `result` | スクリーニングの実行と結果 |
| `assess_pending` / `advise_pending` | `assess pending` / `advise pending` | 未判定のニュース・開示、助言待ちのアクションと事実の束 |

## 3. 実装（案）

### 3.1 構成

```
MCP クライアント（Claude Desktop / codex / Claude Code）
   ↓ stdio（JSON-RPC）
tools/mcp        … ツール定義を defineTool から生成し、引数を argv に組み立てる
   ↓ 子プロセス（tsx tools/<name>/src/main.ts …）
既存の CLI → @trading/domain → @trading/db → data/trading.db
```

### 3.2 CLI の呼び出し

- `execFile` で `tsx tools/<name>/src/main.ts <command> [args]` を実行し、stdout の JSON をパースして `{ ok, data }` の `data` を返す
- `ok: false` のときは MCP のエラーにして `code` と `message` を渡す
- タイムアウトを設ける（既定 60 秒。`screen run` のような長いものは出さない）
- `--db` は MCP サーバーの起動時の設定を引き継ぐ

### 3.3 CLI 規約の例外

`tools/mcp` は stdout を MCP のプロトコルに使うため、「stdout は JSON 1 つ」の規約に従えない。ログは stderr。
`defineTool` は使わず、`tools/mcp/src/main.ts` を直接書く。**規約の例外はこのツールだけ**とし、理由を `AGENTS.md` に一文で書く。

### 3.4 設定

`.mcp.json`（リポジトリ直下、コミットする）:

```json
{
  "mcpServers": {
    "trading-tools": { "command": "pnpm", "args": ["--silent", "mcp"] }
  }
}
```

書き込みを許すときは `args` に `--write` を足す。

## 4. 検討した選択肢

| 選択肢 | 採否 | 理由 |
| --- | --- | --- |
| **A. CLI を子プロセスで呼ぶ**（本案） | 採用 | 既存の決まりに乗る。実装が薄い。CLI が育てば自動で育つ |
| B. `@trading/domain` を直接呼ぶ（ダッシュボードと同じ） | 不採用（将来の選択肢） | 速く、まとめツールを自由に作れるが、**CLI 以外の 2 つ目の入口**になり 0001 の決まりを変える必要がある。速度が問題になってから |
| C. SQL をそのまま実行できるツールを出す | 不採用 | 生 SQL は事故が大きい。読みたいものが増えたら読み取り CLI を足す方が、ダッシュボードとも共有できる |
| D. MCP を作らず Bash で CLI を叩く（現状） | 部分採用 | Claude Code ではこれで足りている。**codex・Claude Desktop など Bash が無いクライアント**のために MCP を作る |

## 5. リスク・未決事項

- **R1 プロセス起動が毎回かかる**（`tsx` の起動で数百 ms）。まとめツールで 1 回の呼び出しに複数の CLI を束ねると効く。遅ければ B に寄せる
- **R2 stdout を汚すツールがあると壊れる**。CLI 規約を守っている限り起きないが、テストで 1 本担保する
- **U1 transport**: stdio で始める。別の端末やスマホから使いたくなったら Streamable HTTP を 0017 と同じ範囲（Tailscale の中）で足す。認証はそのとき決める
- **U2 粒度**: 1:1 で始める。「今日の状況」「銘柄 X の要約」のようなまとめツールは、欲しくなったら `@trading/domain` に関数を足してダッシュボードと共有する
- **U3 書き込み**: 既定は読み取り専用。朝の確認を MCP 越しに行いたくなったら `assess record` / `advise record` を足すか検討する

## 6. 決めてほしいこと（壁打ち）

1. 誰が使うか（codex / Claude Desktop / スマホ）。stdio で足りるか
2. 書き込みを出すか。出すなら最初から `--write` を用意するか、読み取りだけで始めるか
3. 粒度は CLI と 1:1 でよいか、最初からまとめツールが要るか
