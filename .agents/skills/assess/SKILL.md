---
name: assess
description: 保有銘柄のニュース・適時開示について、未判定のものを読んで良し悪しを判定し、CLI 経由で記録する。「assess を実行して」「ニュースの判定をして」「開示を評価して」と言われたら使う。判定後は detect run まで実行する。
---

# assess — ニュース・開示の判定

trading-tools の `assess` ツールが出す未判定のニュース・開示を読み、**書かれている事実だけ**から判定を付けて書き戻す。データストアは直接触らず、必ず CLI を経由する（AGENTS.md）。設計は Design Doc 0011。

## 手順

1. リポジトリのルートで `pnpm assess pending --limit 50` を実行し、stdout の JSON を読む
   - `items[]` に未判定が入る。`kind: disclosure` には `text`（PDF 本文、最大 8,000 字）が付く。`textError` があれば本文は取れていない
   - `remaining` は残りの件数
2. 各項目に判定を付ける（下の基準）
3. 判定の配列を一時ファイル（例: `/tmp/assess.json`）に書き、`pnpm assess record --input /tmp/assess.json` で書き込む
   - 1 件でも不正があると全体が失敗し、`error.details` に理由が出る。直して再実行する
4. `remaining > 0` なら 1 に戻る（すべて判定するまで）
5. `pnpm detect run` を実行し、`signals` / `actions` の件数を報告する。新しく作られたアクションがあれば `pnpm actions list` でタイトルを添える

## 判定の基準

| 項目 | 値 | 付け方 |
| --- | --- | --- |
| `relevance` | `relevant` / `irrelevant` | その企業（銘柄）の事業・業績・経営に関する内容なら `relevant`。同名の製品・人物・スポーツ・株価予想記事の見出しだけの羅列などは `irrelevant` |
| `sentiment` | `-2` .. `+2` | 企業価値・業績への影響の向きと強さ。`-2` 業績予想の下方修正・不祥事・減配・大型の損失、`-1` 軽い悪材料、`0` 中立・判断できない、`+1` 軽い好材料、`+2` 上方修正・大型受注・増配 |
| `impact` | `1` .. `3` | 影響の大きさ。`3` 業績予想修正・配当変更・不祥事・大型 M&A、`2` 事業上の意味のある出来事、`1` 話題・PR・小さな動き。**迷ったら小さく付ける** |
| `direction` | `up` / `down` / `none` | **`category` が `forecast_revision` または `dividend` の開示にだけ**付ける。上方修正・増配は `up`、下方修正・減配・無配は `down`、それ以外は `none`。本文に数値があれば前回予想と修正後を比べて決める |
| `summary` | 1〜2 文 | 何が起きたか。日本語 |
| `rationale` | 引用 | 判断の根拠になった見出し・本文の抜粋を「」で引用する。**引用なしは不可** |
| `model` | 文字列 | 自分のモデル名（例 `claude-opus-5`） |

- ニュースは **見出しだけ** が材料。見出しから判断できなければ `sentiment: 0`、`impact: 1` にし、`summary` に「見出しからは判断できない」と書く。推測で埋めない
- 開示は本文を読む。`textError` や本文が空のときは表題だけで判定し、その旨を `summary` に書く
- 同じ出来事のニュースが複数あっても、それぞれに判定を付ける（`detect` 側でまとめる）
- `kind` と `id` は `pending` の出力をそのまま使う。`author` は付けない（既定 `ai`）

## 入力の形（`record`）

```json
[
  {
    "kind": "disclosure",
    "id": 12,
    "relevance": "relevant",
    "sentiment": -2,
    "impact": 3,
    "direction": "down",
    "summary": "2027年3月期の連結業績予想を下方修正。営業利益の予想を 120 億円から 80 億円に引き下げた。",
    "rationale": "「営業利益 12,000 → 8,000（百万円）」「主要顧客の設備投資の先送りにより」",
    "model": "claude-opus-5"
  },
  {
    "kind": "news",
    "id": 2210,
    "relevance": "irrelevant",
    "sentiment": 0,
    "impact": 1,
    "summary": "新型車のレビュー記事。企業の業績に関する情報ではない。",
    "rationale": "「新型セダン発表に反響殺到」",
    "model": "claude-opus-5"
  }
]
```

## やってはいけないこと

- 見出し・本文に書かれていないことを推測して `sentiment` や `direction` を付ける
- `rationale` に引用を入れない
- SQLite を直接読み書きする
- 判定を飛ばして `detect run` だけ実行する（それは単に `pnpm detect run` でよい）
