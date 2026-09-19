# trading-tools

資産運用のためのツール群。保有銘柄・ウォッチ銘柄の監視をツールに任せ、**検知 → 確認 → アクション** の流れを人が短時間でこなせる状態にする。

- 対象: 日本株、利用者は本人1名、ローカル運用
- 開発: codex / Claude Code が Design Doc に基づいて実装する

## 現在の状態

**設計フェーズ。** 実装はまだ始まっていない。

| 段階 | 状態 |
| --- | --- |
| Design Doc 0001（リポジトリ全体） | 承認 |
| 実行計画 0001（M0〜M5） | 承認 |
| M0 基盤 | Design Doc 0002 未着手 |

## ドキュメント

| | |
| --- | --- |
| [docs/design-docs/](docs/design-docs/) | Design Doc。変更ごとに1本。[0001](docs/design-docs/0001-repository.md) が全体像 |
| [docs/execution-plans/](docs/execution-plans/) | 実行計画。マイルストーンと完了の定義 |
| [AGENTS.md](AGENTS.md) | エージェント（codex / Claude Code）向けの指示 |

## 進め方

1. 変更の Design Doc を書き、壁打ちして承認を得る
2. 実行計画のマイルストーンに沿って実装する
3. 実装済みの Design Doc は書き換えず、新しい Design Doc で supersede する

## ツール群（予定）

| ツール | 役割 |
| --- | --- |
| `import-holdings` | 楽天証券 CSV を保有スナップショットとして取り込む |
| `collect` | 株価・ニュース・適時開示の収集 |
| `detect` | スコア・シグナル・アクションの生成 |
| `advise` | シグナルに対する AI 助言（エージェントのスキル） |
| `screen` | 新規候補のスクリーニング |
| `dashboard` | 閲覧用 Web |

詳細は [Design Doc 0001](docs/design-docs/0001-repository.md) を参照。
