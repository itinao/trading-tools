# trading-tools

資産運用のためのツール群。保有銘柄・ウォッチ銘柄の監視をツールに任せ、**検知 → 確認 → アクション** の流れを人が短時間でこなせる状態にする。

- 対象: 日本株、利用者は本人1名、ローカル運用
- 開発: codex / Claude Code が Design Doc に基づいて実装する

## 現在の状態

**M3（AI 助言）完了。** 保有 CSV の取り込み → 実データの収集 → AI によるニュース・開示の判定 → スコアと 10 種のルールで検知 → 各アクションに AI の助言（論点・選択肢・確認すること）→ ダッシュボードで確認、が動いている。次は M4（攻め: ウォッチとスクリーニング）。

| 段階 | 状態 |
| --- | --- |
| Design Doc 0001（リポジトリ全体） | 承認 |
| 実行計画 0001（M0〜M5） | 承認 |
| M0 基盤 | 完了 |
| M1 守りの最小経路 | 完了 |
| S1 データソース検証 | 完了 |
| M2 ニュース・開示とスコア | 完了 |
| M3 AI 助言 | 完了 |
| M4 攻め | 未着手 |

## セットアップ

```bash
pnpm install
pnpm db migrate
pnpm test
```

楽天証券の CSV を `data/source/` に置いて取り込む（Git には入らない）:

```bash
pnpm import-holdings run "data/source/assetbalance(all)_YYYYMMDD_HHMMSS.csv"
pnpm collect all
pnpm detect run
pnpm dashboard   # http://127.0.0.1:3000
```

朝はエージェント（Claude Code / codex）に「朝の確認をして」と言うと、ニュース・開示の判定 → 検知 → 各アクションへの助言まで行い、要約を報告する。日次実行の自動化は `pnpm schedule install`。

## ドキュメント

| | |
| --- | --- |
| [docs/design-docs/](docs/design-docs/) | Design Doc。変更ごとに1本。[0001](docs/design-docs/0001-repository.md) が全体像 |
| [docs/execution-plans/](docs/execution-plans/) | 実行計画。マイルストーンと完了の定義 |
| [docs/schema.md](docs/schema.md) | 現在の全テーブルの ER 図（自動生成、常に最新） |
| [docs/screens.md](docs/screens.md) | 現在の画面遷移図（自動生成、常に最新） |
| [apps/dashboard/DESIGN.md](apps/dashboard/DESIGN.md) | ダッシュボードのデザインシステム（Stitch DESIGN.md 形式） |
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
