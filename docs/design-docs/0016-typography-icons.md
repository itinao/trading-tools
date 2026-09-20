# Design Doc 0016: フォントとアイコン

| | |
| --- | --- |
| 状態 | 実装済み（2026-09-20） |
| 作成日 | 2026-09-20 |
| 元になる Design Doc | [0007](./0007-design-system.md)（DESIGN.md）、[0015](./0015-dashboard-ia.md) |
| supersede | 0007 R1「Web フォントの読み込みはしない」、DESIGN.md の Typography と「アイコンの多用」の Don't |
| 対応する実行計画 | [0002](../execution-plans/0002-operations.md) O7（本書で追加） |

## 1. 背景と目的

システムフォント任せの見た目を、Google Fonts のサイトと同じ書体に揃え、画面の要素（ナビ、状態、タブ）にアイコンを添えて認知を速くする。

## 2. 決定

| 項目 | 決定 | 理由 |
| --- | --- | --- |
| 欧文・数字 | **Google Sans Flex**（可変） | Google Fonts のサイトの書体。2025 年に公開。等幅数字（`tnum`）に対応 |
| 和文 | **Noto Sans JP**（可変） | Google の日本語書体。Google Sans と組み合わせる前提で設計されている |
| 等幅（コード） | システムの等幅（`ui-monospace`） | コマンド表示だけなので追加しない |
| アイコン | **Material Symbols Outlined**（可変、weight 400、size 20） | Google Fonts のアイコン。線の太さを本文に合わせられる |
| 配信 | **自己ホスト**（`@fontsource-variable/google-sans-flex`、`@fontsource-variable/noto-sans-jp`、`material-symbols`） | 外部への通信なし。ローカル運用で毎朝開く画面が Google のサーバーに依存しない。ライセンスはいずれも OFL |

### アイコンの使いどころ（DESIGN.md に書く）

| 使う | 使わない |
| --- | --- |
| サイドバーの項目、状態の帯の各面、銘柄詳細のタブ、外部リンク（`open_in_new`）、空状態 | ボタンの中、バッジの中、表のセル、見出し。文字で足りる所に飾りとして置かない |

アイコンは必ずラベルと一緒に置き、単独で意味を持たせない（`aria-hidden`）。

## 3. 実装

- `apps/dashboard/src/app/fonts.css`: fontsource と material-symbols の CSS を import
- DESIGN.md の `typography.*.fontFamily` を `"Google Sans Flex", "Noto Sans JP", system-ui, sans-serif` に。`numeric-md` の `fontFeature` はそのまま
- `shared/ui/Icon`: `<span class="material-symbols-outlined" aria-hidden>name</span>`
- 適用: `widgets/sidebar`、`widgets/status-strip`、`pages/instrument` のタブ、外部リンク

## 実装時の補足（2026-09-20）

- fontsource の可変フォントのファミリー名は `"Google Sans Flex Variable"` / `"Noto Sans JP Variable"`（`Variable` 付き）。DESIGN.md の `fontFamily` はこの名前で書く。YAML では先頭が `"` だと引用スカラーになるので、値全体を `'…'` で囲む
- Noto Sans JP はユニコード範囲ごとに分割配信され（1 ファイル 15〜20KB）、表示に使う範囲だけ読まれる。Material Symbols Outlined は 1 ファイル 3.9MB（可変・全アイコン）。ローカル配信でキャッシュされるので許容した。減らしたくなったら使うアイコン名で subset する
- 空状態（`.empty`）のアイコンは CSS の `::before` で付けた（部品ごとに書かなくて済む）
