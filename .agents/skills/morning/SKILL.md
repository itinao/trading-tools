---
name: morning
description: 朝の確認。ニュース・開示の判定（assess）→ 検知（detect run）→ 助言（advise）を順に実行し、新しいアクションと助言を要約して報告する。「朝の確認をして」「morning を実行して」「今日の確認」と言われたら使う。
---

# morning — 朝の確認

trading-tools の日次の AI 側の処理をまとめて行う。データストアは直接触らず、必ず CLI を経由する。

## 手順

1. **判定**: `assess` スキルの手順を実行する（`pnpm assess pending --limit 50` → 判定 → `pnpm assess record`。`remaining > 0` なら繰り返す。ただし 1 回の朝で処理するのは新しいものから最大 200 件まででよい。古いニュースはスコアに影響しない）
2. **検知**: `pnpm detect run` を実行し、`signals` / `actions` / `scores` の件数を控える
3. **助言**: `advise` スキルの手順を実行する（`pnpm advise pending` → 助言 → `pnpm advise record`）
4. **報告**: 次の形で要約する
   - 判定した件数（関係あり / 無関係）と、悪材料（sentiment ≤ -1 かつ impact ≥ 2）があれば銘柄と要約
   - 新しく作られたアクション（`pnpm actions list` の未対応）を、銘柄・種類・重大度で 1 行ずつ
   - 各アクションの助言を `stance` とタイトルで 1 行ずつ
   - 収集の失敗があれば（`data/logs/daily-*.log` の最新、または `pnpm collect all` の `errors`）その旨

`collect all` は launchd（`pnpm schedule status`）で前日夕方に実行されている前提。株価の最終取得日が古ければ（`pnpm detect run` の `asOf` が前営業日でない）、先に `pnpm collect all` を実行する。
