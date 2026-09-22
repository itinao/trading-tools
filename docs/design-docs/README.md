# Design Docs

**変更（プロジェクト・機能）ごとに1本書く。** 承認後も実装中に漏れが見つかれば書き足してよい。**実装済みになったら書き換えない。** 設計を変えるときは新しい Design Doc を書いて古いものを supersede する。
番号は連番、ファイル名は `NNNN-<slug>.md`。

| # | Design Doc | 状態 |
| --- | --- | --- |
| 0001 | [リポジトリ全体](./0001-repository.md) — 目的・方針・ツール群の分割・データストア・エージェント運用 | 承認 |
| 0002 | [基盤（M0）](./0002-foundation.md) — ワークスペース、データストア、CLI 規約、共通設定 | 実装済み |
| 0003 | [保有の取り込みと株価の収集（M1 入力側）](./0003-holdings-and-quotes.md) — 楽天証券 CSV、instruments / holdings / quotes、モック Provider | 実装済み |
| 0004 | [スキーマ図の自動生成](./0004-schema-doc.md) — `docs/schema.md` を Drizzle スキーマから生成し、テストで鮮度を担保 | 実装済み |
| 0009 | [データソースの選定（S1）](./0009-data-sources.md) — Yahoo Finance / Google News RSS / TDnet の検証結果と採用、J-Quants の扱い | 承認 |
| 0010 | [実データの収集（M2 前半）](./0010-real-data-collection.md) — yahoo / google-news / tdnet Provider、fundamentals / financials / news_items / disclosures | 実装済み |
| 0011 | [判定とスコア（M2 後半）](./0011-assessment-and-score.md) — assess ツールとスキル、assessments / scores、ファンダ系シグナル、launchd | 実装済み |
| 0012 | [AI 助言（M3）](./0012-advise.md) — advise ツールとスキル、事実の束、stance、一覧での表示 | 実装済み |
| 0013 | [攻め — ウォッチ銘柄とスクリーニング（M4）](./0013-watch-and-screen.md) — universe / watches / screen、攻めのルール、watch・screen ツール | 実装済み |
| 0014 | [振り返り（M5）](./0014-review.md) — タイムライン、判断の履歴、review ツール、retrospect スキル | 実装済み |
| 0015 | [ダッシュボードの情報設計と画面構成](./0015-dashboard-ia.md) — サイドバー、中央寄せ、銘柄カード、銘柄画面の統合、銘柄詳細のタブ | 実装済み |
| 0016 | [フォントとアイコン](./0016-typography-icons.md) — Google Sans Flex + Noto Sans JP、Material Symbols、自己ホスト | 実装済み |
| 0017 | [ダッシュボードの配信](./0017-dashboard-serving.md) — 同じネットワーク / Tailscale から見る、0.0.0.0、allowedHosts、本番ビルドの起動、フォントのキャッシュ | 実装済み（事後） |
| 0018 | [MCP サーバー](./0018-mcp-server.md) — AI クライアントからデータを読む。`@trading/domain` を直接呼ぶ、stdio、既定は読み取り専用 | 承認 |
| 0005 | [下落の検知とダッシュボード（M1 出力側）](./0005-detect-and-dashboard.md) — signals / actions、detect・actions ツール、TanStack Start | 実装済み |
| 0006 | [ダッシュボードを FSD で構成する](./0006-dashboard-fsd.md) — 層と依存方向、routes の扱い、steiger による検査 | 実装済み |
| 0007 | [デザインシステム（DESIGN.md）の導入](./0007-design-system.md) — Stitch フォーマットの DESIGN.md を正本にし、トークンから CSS 変数を生成 | 実装済み |
| 0008 | [画面遷移図の自動生成](./0008-screen-map.md) — `docs/screens.md` をルートと `<Link to>` から生成し、テストで鮮度を担保 | 実装済み |

状態: 草案 → 承認 → 実装済み → supersede（後続の番号を記す）

| 状態 | 書き換え |
| --- | --- |
| 草案 | 自由に |
| 承認 | 実装中に見つかった漏れの補足は可。方針を変える場合は新しい Design Doc |
| 実装済み | 不可。変更は新しい Design Doc で supersede |

## いつ書くか

- 実行計画のマイルストーンに着手する前に、そのマイルストーンで加える変更について書く
- 1マイルストーンに複数の独立した変更があれば、分けて書いてよい
- 承認済みの設計を変えたくなったときも1本書く（小さくてよい）

## 画面に関わる Design Doc

承認だけでは見た目の判断ができないので、**承認 → モック → OK → 実装** の順を守る。画面やナビが増減するときは、モックと一緒に画面遷移図（`docs/screens.md`）の差分も見せる。モックの作り方は AGENTS.md「画面の変更の手順」。

## 何を書くか

長さは変更の大きさに合わせる。大きい変更でも次の項目が揃っていれば十分。

1. 背景と目的（どの Design Doc・どのゴールに連なる変更か）
2. スコープ / 非スコープ
3. 設計（入出力、データ構造、必要ならER図・画面遷移図）
4. 検討した選択肢と決定、却下した理由
5. リスク・未決事項

## 現在の設計を知るには

Design Doc は時点の記録なので、最新の全体像は `AGENTS.md`（エージェント向けの短い要約）とコードを正とし、詳細は該当する Design Doc を番号順に辿る。
