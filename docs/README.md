# trading-tools ドキュメント

| ディレクトリ | 内容 |
| --- | --- |
| [design-docs/](./design-docs/) | Design Doc。変更ごとに1本、連番。実装済みになったら書き換えない |
| [execution-plans/](./execution-plans/) | 実行計画。マイルストーンと完了の定義 |

## 進め方

1. リポジトリ全体の Design Doc（0001）を壁打ちして固める
2. 実行計画でマイルストーンを切る
3. マイルストーンに着手する前に、その変更の Design Doc を書いて壁打ちする
4. 承認されたらエージェント（codex / Claude Code）が実装する
5. 設計を変えるときは新しい Design Doc を書き、古いものを supersede する
