# Design Doc 0007: デザインシステム（DESIGN.md）の導入

| | |
| --- | --- |
| 状態 | 草案（壁打ち中） |
| 作成日 | 2026-09-20 |
| 元になる Design Doc | [0006](./0006-dashboard-fsd.md)（ダッシュボードの構成） |
| 参考 | [google-labs-code/design.md](https://github.com/google-labs-code/design.md)（DESIGN.md フォーマット仕様）、[Qiita: DESIGN.md と Claude Code](https://qiita.com/miruky/items/a6312c14e6352376ec00) |

## 1. 背景と目的

ダッシュボードは素の CSS で最低限の見た目しかない。今後エージェントが画面を足すたびに見た目がばらつくのを防ぐため、**デザインの正本を1つのファイルに固定し、エージェントがそれに従って実装する**状態にする。

正本には Google Stitch が公開した **DESIGN.md フォーマット**を使う。YAML front matter（機械が読むトークン: 色・文字・角丸・余白・コンポーネント）と Markdown 本文（人が読む意図と Do's / Don'ts）の2層で、エージェント向けに設計されている。

## 2. スコープ / 非スコープ

- スコープ: `apps/dashboard/DESIGN.md`、トークンから CSS 変数を生成する仕組み、既存3画面への適用、`AGENTS.md` への指示
- 非スコープ: ダークモード（トークンは1セットのみ）、新しい画面や機能、アイコン、チャート

## 3. 設計

### 3.1 DESIGN.md

- 場所: `apps/dashboard/DESIGN.md`。仕様の既定はリポジトリルートだが、それは単一アプリのリポジトリを想定した既定。このモノレポで見た目を持つのはダッシュボードだけなので、アプリのルートに置く。Stitch の CLI もカレントディレクトリで探すため `apps/dashboard` で実行すればよい
- front matter のトークン名は仕様の慣習（Material 風の `surface` / `on-surface` / `primary` …）に寄せる。このプロジェクト固有の役割色として `gain` / `loss`（損益の符号）、`warn` / `critical`（重大度）を追加する
- 本文の見出しは仕様で固定された英語（Overview / Colors / Typography / Layout / Elevation & Depth / Shapes / Components / Do's and Don'ts）。**散文は日本語**で書く
- デザインの方向: 「静かな計器盤」。色は意味があるときだけ、数値は等幅数字で右揃え、影なし

### 3.2 トークンの反映

DESIGN.md の front matter から CSS 変数を **自動生成** し、手書きの CSS はその変数だけを使う。`docs/schema.md` と同じ「生成物はテストで鮮度を担保する」流儀。

| 生成元 | 生成物 | コマンド |
| --- | --- | --- |
| `apps/dashboard/DESIGN.md` の `colors` / `typography` / `rounded` / `spacing` | `apps/dashboard/src/app/tokens.css`（`:root { --color-primary: …; --font-body-md-size: …; }`） | `pnpm design:tokens` |

- `components` はコンポーネントごとの値の組み合わせなので CSS 変数にはせず、`styles.css` に **クラスとして手書き**する。生成物には `{colors.primary}` の参照解決を含めない（CSS 側で `var(--color-primary)` を書く）
- テスト: 生成結果とコミット済みの `tokens.css` が一致すること。DESIGN.md を変えて再生成を忘れると `pnpm test` が落ちる
- パーサ: front matter の YAML は `yaml` パッケージで読む

### 3.3 適用

- `app/styles.css` を DESIGN.md の Components に沿って書き直す（クラス名はコンポーネント名に合わせる: `.badge-warn`、`.banner-stale` …）
- FSD の各層は既存のまま。`entities/action/ui/SeverityBadge` がバッジのクラスを付ける、など UI の責務は変えない
- 損益・変化率の色を **日本式（赤 = 上昇、緑 = 下落）** に変更する（現状は欧米式）

### 3.4 エージェントへの指示

`AGENTS.md` に「ダッシュボードの見た目は `apps/dashboard/DESIGN.md` に従う。新しい UI は Components に定義してから実装する。トークンを増やしたら `pnpm design:tokens`」を追加する。

## 4. 検討した選択肢と決定

| 論点 | 決定 | 却下した選択肢と理由 |
| --- | --- | --- |
| DESIGN.md の置き場 | `apps/dashboard/`（アプリのルート） | リポジトリルート: 仕様の既定だが、CLI ツール群には無関係。見た目を持つアプリが増えたらそれぞれのアプリに置く |
| デザインの正本 | DESIGN.md（Stitch フォーマット） | 独自の Markdown: 構造が決まっている方がエージェントの読み取りが安定する。Figma: テキストでないためエージェントが読めない |
| CSS の実装 | 素の CSS + 生成した CSS 変数 | Tailwind: トークンを `tailwind.config` に写す工程が増え、正本が2つになる。CSS-in-JS: SSR の設定が増える。画面数が少ないうちは素の CSS で十分 |
| `components` の扱い | CSS に手書き | 自動生成: `padding: 0 10px` のような複合値や hover の表現を汎用に生成するのは割に合わない |
| 上昇・下落の色 | 日本式（赤 = 上昇） | 欧米式: 利用者が日常的に見る証券アプリと逆になり、毎朝の確認で読み違えるリスクがある |
| ダークモード | 今はやらない | トークンを2セット維持する負担。将来は DESIGN.md の別バージョン（`DESIGN-dark.md`）で扱える |

## 5. リスク・未決事項

| # | 内容 | 対応 |
| --- | --- | --- |
| R1 | Inter が端末に無い | システムフォントにフォールバック。Web フォントの読み込みはしない（ローカル運用で不要） |
| R2 | DESIGN.md の仕様が alpha で変わる | front matter の構造だけに依存し、生成スクリプトは薄く保つ |

## 要確認

1. デザインの方向「静かな計器盤」（色は意味があるときだけ、影なし、数値中心）でよいか
2. 損益の色を **日本式（赤 = 上昇 / 緑 = 下落）** にしてよいか
3. アクセント色は深い紺（`#1F4E79`）でよいか。好みの色があれば差し替える
4. ライトテーマ固定でよいか
