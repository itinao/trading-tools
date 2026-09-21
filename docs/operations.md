# 運用: いつ・何を動かすか

定期的に動かすものの一覧。**自動化されているのは平日夕方の 1 本だけ** で、あとは人が起動する（自動化の予定は実行計画 0002 の O5）。

| いつ | 何を | コマンド | どう動かすか |
| --- | --- | --- | --- |
| 平日 18:30（引け後） | 株価・指標・財務・ニュース・開示の収集 → 検知（シグナルとアクション） | `pnpm collect all` → `pnpm detect run` | **launchd（自動）**。`pnpm schedule install` で登録する |
| 毎朝 | 朝の確認。未判定のニュース・開示の AI 判定 → 検知のやり直し → 未対応アクションへの AI 助言 | `pnpm assess pending` → `assess record` → `detect run` → `advise pending` → `advise record` | 人が Claude Code に **「朝の確認をして」** と言う（`.agents/skills/morning`）。O5 で `claude -p` による自動化を予定 |
| 楽天証券の CSV を落としたとき | 保有の取り込み | `pnpm import-holdings run "data/source/assetbalance(all)_YYYYMMDD_HHMMSS.csv"` | 手動。ファイル名の `(all)` のため引用符が要る |
| 月 1 回 | 東証の上場銘柄一覧（スクリーナーの母集団） | `pnpm collect universe` | 手動 |
| 週末など | スクリーニング → ウォッチに追加 | `pnpm screen run --preset value`（growth / quality も） | 手動。約 1〜2 分。結果はダッシュボードのスクリーナーで見てウォッチに追加する |
| 月 1 回 | 振り返り。判断の履歴から傾向と閾値の調整案 | `pnpm review history --since YYYY-MM-DD` | 人が Claude Code に **「振り返りをして」** と言う（`.agents/skills/retrospect`）。設定は変えない |
| 常時 | ダッシュボード | `pnpm dashboard`（開発）または `pnpm dashboard:build && pnpm dashboard:start`（本番） | 手動。常時動かすなら下の launchd の例 |

## 1. 日次実行（launchd）

```bash
pnpm schedule install            # 平日 18:30 JST。--at 19:00 で時刻変更
pnpm schedule status
pnpm schedule uninstall
```

`install` が作るもの:

| パス | 内容 |
| --- | --- |
| `~/Library/LaunchAgents/com.trading-tools.daily.plist` | launchd の定義。平日（月〜金）の指定時刻に `data/daily.sh` を `/bin/sh` で実行する。`TZ=Asia/Tokyo` |
| `data/daily.sh` | `collect all` → `detect run` の順に実行する（1 つが失敗しても次を実行し、終了コードは最後の失敗）。**生成物なので手で編集しない** |
| `data/logs/daily-YYYY-MM-DD.log` | その日の実行ログ。`=== <時刻> done status=<終了コード>` で終わる。ダッシュボードの左下「収集」はこれを読む |
| `data/logs/launchd.{out,err}.log` | launchd 自体の出力（通常は空） |

注意:

- Mac がスリープしていると時刻になっても動かない（launchd は次に起きたときに実行する）。常用するならシステム設定でスリープを切るか、`pmset repeat wake` を使う
- 休日は株価が無いので `detect run` は直近の営業日を評価する（Design Doc 0010 §3.4）。実行自体は毎平日で問題ない
- Yahoo / Google News / TDnet は非公式のソースで、止まると `failed` に出る。ダッシュボードの「株価が古い」バナーと左下の「株価」の日付で気づける（Design Doc 0009）

## 2. 朝の確認（手動 → O5 で自動化予定）

AI（Claude Code）が必要なので、いまは人が起動する。手順は `.agents/skills/morning/SKILL.md`。自動化するときは `claude -p` を launchd に登録し、結果は同じ CLI（`assess record` / `advise record`）で書き戻す（実行計画 0002 の O5）。

## 3. ダッシュボードを常時動かす

`pnpm schedule` はダッシュボードを登録しない（ツール化するなら Design Doc が要る）。手で登録する場合の例:

```bash
cd /path/to/trading-tools && pnpm dashboard:build
```

`~/Library/LaunchAgents/com.trading-tools.dashboard.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.trading-tools.dashboard</string>
  <key>ProgramArguments</key>
  <array>
    <string>/path/to/node</string>          <!-- `which node` の結果（Volta なら ~/.volta/bin/node） -->
    <string>/path/to/trading-tools/apps/dashboard/server.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>/path/to/trading-tools/apps/dashboard</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key><string>3000</string>
    <key>TZ</key><string>Asia/Tokyo</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/path/to/trading-tools/data/logs/dashboard.out.log</string>
  <key>StandardErrorPath</key><string>/path/to/trading-tools/data/logs/dashboard.err.log</string>
</dict>
</plist>
```

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.trading-tools.dashboard.plist   # 登録
launchctl bootout gui/$(id -u)/com.trading-tools.dashboard                                    # 解除
```

ソースを変えたら `pnpm dashboard:build` のあと `launchctl kickstart -k gui/$(id -u)/com.trading-tools.dashboard` で再起動する。認証は無いので、LAN / Tailscale の外には出さない。

## 4. macOS 以外（VPS 等）に置く場合

`schedule` ツールは launchd 専用。cron なら `data/daily.sh` と同じ内容を `30 18 * * 1-5` で登録する（`pnpm schedule install --dry-run` で中身が見られる）。ダッシュボードは systemd の service にする。詳しくは移す時に Design Doc を書く。
