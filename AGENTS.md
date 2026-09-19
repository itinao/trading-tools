# AGENTS.md

このリポジトリで作業するエージェント（codex / Claude Code）向けの指示。`CLAUDE.md` はこのファイルを参照するだけ。

## このリポジトリは何か

資産運用のツール群。保有銘柄・ウォッチ銘柄の監視をツールに任せ、「検知 → 確認 → アクション」を人が短時間でこなせるようにする。
全体像は [Design Doc 0001](docs/design-docs/0001-repository.md)。

## 現在のフェーズ

**設計フェーズ。実装は始まっていない。** 実行計画 [0001](docs/execution-plans/0001-initial.md) を壁打ち中。

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
- コミットは依頼があったときだけ

## ファイルの場所

| パス | 内容 |
| --- | --- |
| `docs/design-docs/` | Design Doc（連番、変更ごとに1本） |
| `docs/execution-plans/` | 実行計画（進捗に合わせて更新する） |
| `.agents/skills/` | エージェントのスキル（`advise` など。M3 以降） |
| `tools/` `apps/` `packages/` | 実装（M0 以降。構成は Design Doc 0001 §7） |
| `data/source/` | 個人データ（gitignore） |
| `data/trading.db` | SQLite（gitignore） |

## 用語

Design Doc 0001 §9 の用語を使う。特に **事実 / 評価**、**シグナル**（何が起きたか）/ **アクション**（何をすべきか）を混同しない。
