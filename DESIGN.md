---
version: alpha
name: trading-tools 計器盤
description: 個人の資産運用ダッシュボード。毎朝数分で「検知 → 確認 → アクション」をこなすための、静かで読みやすい計器盤。
colors:
  background: "#F6F7F9"
  on-background: "#1C2128"
  surface: "#FFFFFF"
  on-surface: "#1C2128"
  on-surface-variant: "#5C6773"
  surface-container: "#F0F2F5"
  surface-container-high: "#E6E9ED"
  outline: "#D3D8DF"
  outline-variant: "#E7EAEE"
  primary: "#1F4E79"
  on-primary: "#FFFFFF"
  primary-container: "#E2ECF6"
  on-primary-container: "#173A5A"
  gain: "#C0392B"
  gain-container: "#FCE9E6"
  loss: "#1B6E3A"
  loss-container: "#E3F2E7"
  warn: "#9A6700"
  warn-container: "#FFF3CD"
  critical: "#B3261E"
  critical-container: "#FCE4E1"
  on-critical: "#FFFFFF"
typography:
  headline-md:
    fontFamily: Inter, "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif
    fontSize: 20px
    fontWeight: "600"
    lineHeight: 28px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Inter, "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif
    fontSize: 15px
    fontWeight: "600"
    lineHeight: 22px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter, "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 22px
    letterSpacing: 0em
  label-sm:
    fontFamily: Inter, "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif
    fontSize: 12px
    fontWeight: "500"
    lineHeight: 16px
    letterSpacing: 0.01em
  numeric-md:
    fontFamily: Inter, "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif
    fontSize: 14px
    fontWeight: "500"
    lineHeight: 22px
    letterSpacing: 0em
    fontFeature: '"tnum" 1, "lnum" 1'
rounded:
  sm: 4px
  DEFAULT: 6px
  md: 8px
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  page-padding: 24px
  content-max-width: 1120px
  cell-padding-y: 8px
  cell-padding-x: 12px
components:
  page-title:
    textColor: "{colors.on-background}"
    typography: "{typography.headline-md}"
  section-title:
    textColor: "{colors.on-background}"
    typography: "{typography.title-sm}"
  nav:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-md}"
    height: 48px
    padding: 0 24px
  nav-active:
    textColor: "{colors.primary}"
  table:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
  table-header:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-sm}"
    padding: "{spacing.cell-padding-y} {spacing.cell-padding-x}"
  table-cell:
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    padding: "{spacing.cell-padding-y} {spacing.cell-padding-x}"
  table-cell-numeric:
    textColor: "{colors.on-surface}"
    typography: "{typography.numeric-md}"
  table-row-hover:
    backgroundColor: "{colors.surface-container}"
  tab:
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-md}"
    padding: 6px 2px
  tab-active:
    textColor: "{colors.primary}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.DEFAULT}"
    height: 28px
    padding: 0 10px
  button-secondary-hover:
    backgroundColor: "{colors.surface-container}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.DEFAULT}"
    height: 28px
    padding: 0 10px
  button-primary-hover:
    backgroundColor: "{colors.on-primary-container}"
  badge-warn:
    backgroundColor: "{colors.warn-container}"
    textColor: "{colors.warn}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 1px 8px
  badge-critical:
    backgroundColor: "{colors.critical-container}"
    textColor: "{colors.critical}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 1px 8px
  badge-neutral:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 1px 8px
  banner-stale:
    backgroundColor: "{colors.warn-container}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.md} {spacing.lg}"
  link:
    textColor: "{colors.primary}"
  code-inline:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: 0 4px
  detail-body:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-md}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.md}"
---

## Overview

trading-tools のダッシュボードは、毎朝数分だけ開いて「何が起きたか」「何をすべきか」を確認するための **計器盤** である。目立つことではなく、**読み間違えないこと** を最優先にする。

- 性格: 静か、正確、事務的。装飾より情報の密度と整列
- 利用者: 本人1名。毎日見るので、目が慣れる単調さは長所
- 色は **意味があるときだけ** 使う。損益の符号、シグナルの重大度、データが古いことの警告。それ以外は無彩色
- 数字が主役。すべての数値は等幅数字（tabular figures）で右揃えにし、桁を目で追えるようにする
- 日本語と英数字が混在するため、和文は Hiragino Sans / Noto Sans JP、数字と英字は Inter を優先し、行間に余裕を持たせる

## Colors

背景は白ではなく、わずかに青みのある薄い灰（`background`）にし、表やカードの `surface`（白）が浮かび上がるようにする。文字は真っ黒を避け、`on-background` の濃い墨色を使う。

- `primary`（深い紺）は **操作できるもの** の印。リンク、アクティブなナビ・タブ、主ボタン。装飾には使わない
- `gain` / `loss` は **損益と変化率の符号** 専用。日本の証券アプリの慣習に合わせ、**上昇・含み益は赤、下落・含み損は緑**。コンテナ色（`gain-container` / `loss-container`）は行の強調など面で使うときだけ
- `warn` / `critical` は **シグナルの重大度** 専用。バッジと重大度セルに使い、本文の文字色には使わない
- `warn-container` は「株価が古い」バナーにも使う。警告は1画面に1種類の黄色で統一する
- `on-surface-variant` は補助情報（証券コード、日付、取得元、注記）。本文より一段薄く、それ以上薄くしない（コントラスト比 4.5:1 以上を守る）
- `outline-variant` は表の罫線。`outline` はボタンや入力の枠線

## Typography

見出しは控えめに、本文は 14px を基準にする。長文はほとんどなく、表と短い文が中心なので、行間は 22px で詰めすぎない。

- `headline-md`（20px / 600）: ページタイトル。1画面に1つ
- `title-sm`（15px / 600）: 銘柄詳細のセクション見出し（保有、アクション、シグナル、株価）
- `body-md`（14px / 400）: 本文、表のセル、タブ
- `label-sm`（12px / 500）: 表のヘッダ、バッジ、証券コード、日付などの補助情報
- `numeric-md`（14px / 500、tabular figures）: 数値セル。`font-feature-settings: "tnum" 1, "lnum" 1` を必ず付け、右揃えにする
- 銘柄名は全角英数が混じる（証券会社由来）。そのまま表示し、無理に半角化しない

## Layout

- 4px を基本単位とし、8 / 12 / 16 / 24 / 32 の階段で間隔を取る
- コンテンツ幅は最大 1120px、左右の余白は 24px。表は幅いっぱいに使う
- ナビは高さ 48px、下に 1px の罫線。その下にページタイトル（上 24px）、本文
- 表は縦の罫線を引かず、横の罫線（`outline-variant`）だけ。ヘッダ行は `surface-container` で薄く塗る
- セルの余白は縦 8px、横 12px。数値列は右揃え、文字列は左揃え、操作列は左揃えでボタンを横に並べる
- 情報の優先順位は「アクション一覧 > 保有 > 詳細」。一覧は 1 行 = 1 アクションで、折りたたみ（本文）は行の中に収める

## Elevation & Depth

影は使わない。階層は **面の色の差と 1px の罫線** だけで表す。

- レベル 0: `background`（ページ）
- レベル 1: `surface`（表、カード）。`outline-variant` の 1px 罫線で縁取る
- レベル 2: `surface-container`（表ヘッダ、ホバー、折りたたみ本文の背景）
- 浮いて見せる必要のある要素（モーダル等）は現時点で存在しない。将来必要になっても、影ではなく `outline` の罫線と背景の差で表す

## Shapes

- 角丸は控えめ。表とバナーは 8px（`md`）、ボタンと折りたたみ本文は 6px（`DEFAULT`）、インラインコードは 4px（`sm`）
- バッジだけは完全な丸（`full`）にして、重大度が一目で「ラベル」と分かるようにする
- 角丸を大きくして柔らかく見せることはしない。計器盤の性格に合わない

## Components

### ナビゲーション（`nav` / `nav-active`）
白地に文字リンクを横に並べる。アクティブは `primary` の文字色と、下線 2px（`primary`）。ホバーは文字色を `on-surface` に。

### ページタイトル / セクション見出し（`page-title` / `section-title`）
装飾なし。セクション見出しの上には 24px、下には 8px の余白。

### 表（`table` / `table-header` / `table-cell` / `table-cell-numeric` / `table-row-hover`）
白地・角丸 8px・`outline-variant` の枠線。ヘッダは `surface-container` に `label-sm` の薄い文字。行ホバーで `surface-container`。数値セルは `numeric-md` で右揃え。損益・変化率のセルは値の符号で `gain` / `loss` の文字色（背景は塗らない）。

### タブ（`tab` / `tab-active`）
文字リンクの横並び。アクティブは `primary` の文字色と下線 2px。件数は `(2)` のように括弧で続ける。

### ボタン（`button-secondary` / `button-primary`）
高さ 28px の小さなボタン。既定は白地に `outline` の枠線（secondary）。1画面で最も重要な操作だけ `primary` の塗り（M1 では該当なし。将来の「取り込む」等）。ホバーは背景を一段濃く。押下中は `outline` を `primary` に。フォーカスリングは `primary` の 2px。

### バッジ（`badge-warn` / `badge-critical` / `badge-neutral`）
重大度の表示。`critical` は文字を `600` にする。シグナル由来でないアクション（`ai` / `manual`）は `badge-neutral`。

### バナー（`banner-stale`）
株価が今日の分でないときだけ表示。黄色の面に本文色の文字。閉じるボタンは付けない（原因を解消すれば消える）。

### 折りたたみ本文（`detail-body`）
アクションの本文。`<details>` の中に `surface-container` の面で表示し、Markdown の箇条書きをそのまま読める行間にする。

### リンク（`link`）
`primary` の文字色、下線なし。ホバーで下線。

### インラインコード（`code-inline`）
`pnpm collect quotes` のようなコマンド。`surface-container` の面に等幅フォント。

## Do's and Don'ts

- Do: 数値は必ず右揃え・等幅数字。桁区切りはカンマ、% は小数 2 桁、符号は `+` / `-` を明示する
- Do: 色を使うときは、その色が何を意味するか（損益 / 重大度 / 警告 / 操作）が一意に決まるようにする
- Do: 空状態には次にやるコマンドを書く（例: 「`pnpm import-holdings run` で取り込む」）
- Do: 助言ではなく事実の整理であることを、控えめな注記で毎回示す
- Don't: 影、グラデーション、アイコンの多用、アニメーション。計器盤に演出はいらない
- Don't: 上昇・下落の色を欧米式（緑 = 上昇）にしない。日本の証券アプリの慣習（赤 = 上昇）に固定する
- Don't: 警告色を複数使わない。黄色（`warn`）と赤（`critical`）の2段階だけ
- Don't: 文字を `on-surface-variant` より薄くしない。読めない補助情報は出さない方がよい
- Don't: 銘柄名を省略・切り詰めない。列幅が足りなければ折り返す
