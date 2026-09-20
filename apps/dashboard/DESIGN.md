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
    fontFamily: '"Google Sans Flex Variable", "Noto Sans JP Variable", system-ui, sans-serif'
    fontSize: 20px
    fontWeight: "600"
    lineHeight: 28px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: '"Google Sans Flex Variable", "Noto Sans JP Variable", system-ui, sans-serif'
    fontSize: 15px
    fontWeight: "600"
    lineHeight: 22px
    letterSpacing: 0em
  body-md:
    fontFamily: '"Google Sans Flex Variable", "Noto Sans JP Variable", system-ui, sans-serif'
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 22px
    letterSpacing: 0em
  label-sm:
    fontFamily: '"Google Sans Flex Variable", "Noto Sans JP Variable", system-ui, sans-serif'
    fontSize: 12px
    fontWeight: "500"
    lineHeight: 16px
    letterSpacing: 0.01em
  numeric-md:
    fontFamily: '"Google Sans Flex Variable", "Noto Sans JP Variable", system-ui, sans-serif'
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
  page-padding: 32px
  content-max-width: 1200px
  sidebar-width: 220px
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
  badge-primary:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
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
  score-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.md} {spacing.lg}"
  select:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.DEFAULT}"
    height: 28px
    padding: 0 6px
---

## Overview

trading-tools のダッシュボードは、毎朝数分だけ開いて「何が起きたか」「何をすべきか」を確認するための **計器盤**（コックピットのメーター盤のように、飾りがなく、一目で状態を読み取るためのパネル）である。目立つことではなく、**読み間違えないこと** を最優先にする。

- 性格: 静か、正確、事務的。装飾より情報の密度と整列
- 利用者: 本人1名。毎日見るので、目が慣れる単調さは長所
- 色は **意味があるときだけ** 使う。損益の符号、シグナルの重大度、データが古いことの警告。それ以外は無彩色
- 数字が主役。すべての数値は等幅数字（tabular figures）で右揃えにし、桁を目で追えるようにする
- 日本語と英数字が混在するため、欧文・数字は Google Sans Flex、和文は Noto Sans JP（どちらも Google Fonts の書体、自己ホスト）。行間に余裕を持たせる

## Colors

背景は白ではなく、わずかに青みのある薄い灰（`background`）にし、表やカードの `surface`（白）が浮かび上がるようにする。文字は真っ黒を避け、`on-background` の濃い墨色を使う。

- `primary`（深い紺）は **操作できるもの** の印。リンク、アクティブなナビ・タブ、主ボタン。装飾には使わない
- `gain` / `loss` は **損益と変化率の符号** 専用。利用者が日常的に見る楽天証券のアプリに合わせ、**上昇・含み益は赤、下落・含み損は緑**。損益の赤は「良い」、重大度の赤（`critical`）は「悪い」で意味が異なるため、重大度は必ずバッジ（面つき）で示し、文字色だけの赤と混同させない。コンテナ色（`gain-container` / `loss-container`）は行の強調など面で使うときだけ
- `warn` / `critical` は **シグナルの重大度** 専用。バッジと重大度セルに使い、本文の文字色には使わない
- `warn-container` は「株価が古い」バナーにも使う。警告は1画面に1種類の黄色で統一する
- `on-surface-variant` は補助情報（証券コード、日付、取得元、注記）。本文より一段薄く、それ以上薄くしない（コントラスト比 4.5:1 以上を守る）
- `outline-variant` は表の罫線。`outline` はボタンや入力の枠線

## Typography

書体は Google Fonts のサイトと同じ **Google Sans Flex**（欧文・数字）と **Noto Sans JP**（和文）。どちらも可変フォントで、`@fontsource-variable` で自己ホストする（Design Doc 0016）。見出しは控えめに、本文は 14px を基準にする。長文はほとんどなく、表と短い文が中心なので、行間は 22px で詰めすぎない。

- `headline-md`（20px / 600）: ページタイトル。1画面に1つ
- `title-sm`（15px / 600）: 銘柄詳細のセクション見出し（保有、アクション、シグナル、株価）
- `body-md`（14px / 400）: 本文、表のセル、タブ
- `label-sm`（12px / 500）: 表のヘッダ、バッジ、証券コード、日付などの補助情報
- `numeric-md`（14px / 500、tabular figures）: 数値セル。`font-feature-settings: "tnum" 1, "lnum" 1` を必ず付け、右揃えにする
- 銘柄名は全角英数が混じる（証券会社由来）。そのまま表示し、無理に半角化しない

## Icons

**Material Symbols Outlined**（可変、weight 400、optical size 20、`material-symbols` で自己ホスト）。使いどころを限る。

- 使う: サイドバーの項目、状態の帯の各面、銘柄詳細のタブ、外部リンク（`open_in_new`）、空状態
- 使わない: ボタンの中、バッジの中、表のセル、見出し。文字で足りる所に飾りとして置かない
- 必ずラベルと一緒に置き、単独で意味を持たせない（`aria-hidden`）。色は周囲の文字色を継承する

## Layout

- 左に幅 220px の **サイドバー**（固定、画面の高さいっぱい）、右がコンテンツ。1,024px 未満ではサイドバーを上部の横並びに畳み、説明文と最終収集は隠す
- コンテンツは **中央寄せ、最大幅 1,200px**、左右の余白 32px
- 4px を基本単位とし、8 / 12 / 16 / 24 / 32 の階段で間隔を取る
- ページの先頭は **ヘッダ帯**（`page-header`）: タイトル（`headline-md`）と 1 行の要約を左、画面固有の操作を右
- 節の見出し（`title-sm`）の上は 32px、下は 12px。節の区切りを目で追えるようにする
- 表は縦の罫線を引かず、横の罫線（`outline-variant`）だけ。ヘッダ行は `surface-container` で薄く塗り、スクロールしても固定する
- セルの余白は縦 8px、横 12px。数値列は右揃え、文字列は左揃え
- 情報の優先順位は「アクション > 銘柄 > スクリーナー > 履歴」。アクションは 1 銘柄 = 1 カードで、検知と助言を 1 か所にまとめる

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

### サイドバー（`sidebar` / `sidebar-item` / `sidebar-item-active`）
白地、右に 1px の罫線。上にアプリ名と株価の鮮度（古ければ `warn` の文字色）、中に 4 項目（ラベル + 1 行の説明 `label-sm`）、下に最終収集。アクティブは左に 3px の `primary` の縦線と `primary-container` の面。未対応の件数は `badge-critical`。

### 状態の帯（`status-strip` / `status-cell`）
アクション画面の先頭。4 つの面（株価の鮮度 / 最終収集 / 未判定 / 未対応）を横に並べる。値は 20px の等幅数字。注意が要る面は `warn-container`（古い・失敗）か `primary-container`（未判定あり）で塗る。

### 銘柄カード（`card` / `card-header` / `card-item`）
アクションの単位。ヘッダ（`surface-container`）に銘柄名・保有 / ウォッチ・スコア・一括操作、本体に 1 行 1 アクション（重大度または「買い検討」のバッジ、タイトル、折りたたみの本文、個別の操作）、その下に助言（左に 2px の罫線でぶら下げる）。

### ページタイトル / セクション見出し（`page-title` / `section-title`）
装飾なし。セクション見出しの上には 24px、下には 8px の余白。

### 表（`table` / `table-header` / `table-cell` / `table-cell-numeric` / `table-row-hover`）
白地・角丸 8px・`outline-variant` の枠線。ヘッダは `surface-container` に `label-sm` の薄い文字。行ホバーで `surface-container`。数値セルは `numeric-md` で右揃え。損益・変化率のセルは値の符号で `gain` / `loss` の文字色（背景は塗らない）。

### タブ（`tab` / `tab-active`）
文字リンクの横並び。アクティブは `primary` の文字色と下線 2px。件数は `(2)` のように括弧で続ける。

### ボタン（`button-secondary` / `button-primary`）
高さ 28px の小さなボタン。既定は白地に `outline` の枠線（secondary）。1画面で最も重要な操作だけ `primary` の塗り（M1 では該当なし。将来の「取り込む」等）。ホバーは背景を一段濃く。押下中は `outline` を `primary` に。フォーカスリングは `primary` の 2px。

### バッジ（`badge-warn` / `badge-critical` / `badge-neutral` / `badge-primary`）
重大度の表示。`critical` は文字を `600` にする。シグナル由来でないアクション（`ai` / `manual`）は `badge-neutral`。重大度ではない分類（開示の種別など）は `badge-primary`（紺の薄い面）で、警告色と混同させない。

### バナー（`banner-stale`）
株価が今日の分でないときだけ表示。黄色の面に本文色の文字。閉じるボタンは付けない（原因を解消すれば消える）。

### 折りたたみ本文（`detail-body`）
アクションの本文。`<details>` の中に `surface-container` の面で表示し、Markdown の箇条書きをそのまま読める行間にする。

### スコアカード（`score-card`）
銘柄詳細の先頭。大きな数字（28px、等幅数字）と、判定 / 株価 / 財務の内訳を横に並べる。数字の色は `score_low` の閾値と揃え、-40 以下で `warn`、-60 以下で `critical` の文字色。

### セレクト（`select`）
判定の上書きに使う。ボタンと同じ高さ 28px・枠線・角丸で、横に並べたとき揃うようにする。

### 折れ線（`sparkline`）
株価（1 年）とスコアの小さな折れ線。素の SVG、線は `primary` の 1.5px、目盛りは最小値と最大値だけ、アクションの日に `critical` の小さな丸。装飾ではなく「いつ下がって、いつ検知したか」を読むためのもの。

### 助言（`advice`）
アクションの行の中に置く。`stance` のバッジ（保有継続 = neutral、要確認 = primary、縮小を検討 = warn）とタイトルを 1 行、折りたたみで本文（Markdown をそのまま）と参照リンク。直下に免責の注記（`label-sm`、`on-surface-variant`）を常時表示し、AI の生成物であることを隠さない。

### リンク（`link`）
`primary` の文字色、下線なし。ホバーで下線。

### インラインコード（`code-inline`）
`pnpm collect quotes` のようなコマンド。`surface-container` の面に等幅フォント。

## Do's and Don'ts

- Do: 数値は必ず右揃え・等幅数字。桁区切りはカンマ、% は小数 2 桁、符号は `+` / `-` を明示する
- Do: 色を使うときは、その色が何を意味するか（損益 / 重大度 / 警告 / 操作）が一意に決まるようにする
- Do: 空状態には次にやるコマンドを書く（例: 「`pnpm import-holdings run` で取り込む」）
- Do: 画面のつながりはサイドバーの 1 行の説明と、画面内のリンク（「スクリーナーで探す →」など）で示す。グループ名で分類しない
- Do: 助言ではなく事実の整理であることを、控えめな注記で毎回示す
- Don't: 影、グラデーション、アニメーション、Icons に書いた場所以外のアイコン。計器盤に演出はいらない
- Don't: 上昇・下落の色を欧米式（緑 = 上昇）にしない。楽天証券の慣習（赤 = 上昇）に固定する。重大度の赤は必ずバッジで示し、損益の赤（文字色のみ）と見分けがつくようにする
- Don't: 警告色を複数使わない。黄色（`warn`）と赤（`critical`）の2段階だけ
- Don't: 文字を `on-surface-variant` より薄くしない。読めない補助情報は出さない方がよい
- Don't: 銘柄名を省略・切り詰めない。列幅が足りなければ折り返す
