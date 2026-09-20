# trading-tools ドキュメント

| ディレクトリ | 内容 |
| --- | --- |
| [design-docs/](./design-docs/) | Design Doc。変更ごとに1本、連番。実装済みになったら書き換えない |
| [execution-plans/](./execution-plans/) | 実行計画。マイルストーンと完了の定義 |
| [schema.md](./schema.md) | 現在の全テーブルの ER 図。`pnpm db:erd` で自動生成 |
| [screens.md](./screens.md) | 現在の画面遷移図。`pnpm screens` で自動生成 |

## 進め方

1. リポジトリ全体の Design Doc（0001）を壁打ちして固める
2. 実行計画でマイルストーンを切る
3. マイルストーンに着手する前に、その変更の Design Doc を書いて壁打ちする
   - 画面に関わる変更は、承認のあとに **モック（静的 HTML のスクリーンショット）を見せて OK を取ってから** 実装する（AGENTS.md「画面の変更の手順」）
4. 承認されたらエージェント（codex / Claude Code）が実装する
5. 設計を変えるときは新しい Design Doc を書き、古いものを supersede する
