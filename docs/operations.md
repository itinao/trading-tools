# 運用: 何を、いつ

## 毎日使うのは 3 つ

| | やること | どうやって |
| --- | --- | --- |
| 1 | 夕方、株価やニュースを集めて、異変を検知する | **自動**（`pnpm schedule install` で launchd に登録。平日 18:30） |
| 2 | 朝、AI にニュースの判定と助言をさせる | Claude Code に **「朝の確認をして」** |
| 3 | アクションを見て、対応した / 見送り にする | **ダッシュボード** `pnpm dashboard` |

## たまに使う

| いつ | やること | コマンド |
| --- | --- | --- |
| 楽天証券の CSV を落としたとき | 保有を更新する | `pnpm import-holdings run "data/source/assetbalance(all)_….csv"` |
| 買いたい銘柄を探すとき | 条件で候補を探し、ウォッチに追加する | `pnpm screen run --preset value`（初回と月 1 回、先に `pnpm collect universe`）→ ダッシュボードのスクリーナーで追加 |
| 月 1 回 | 判断を振り返る | Claude Code に **「振り返りをして」** |

## コマンドの意味（ひとことで）

| コマンド | 意味 |
| --- | --- |
| `collect all` | 保有・ウォッチ銘柄の株価・指標・財務・ニュース・開示を外部から取って保存する |
| `collect universe` | 東証の全銘柄の名簿を取る。スクリーナーの母集団。スクリーナーを使わないなら不要 |
| `detect run` | スコアを計算し、下落・悪材料・財務悪化のルールで **アクション（やるべきこと）** を作る |
| `assess` / `advise` | AI が読む JSON の出し入れ。「朝の確認」の中で使われ、人は叩かない |
| `actions` / `watch` | アクションの状態変更、ウォッチの追加削除。ダッシュボードのボタンと同じ |
| `screen run` | 上場銘柄から条件に合う候補を探す（1〜2 分） |
| `review` | 判断の履歴と銘柄の時系列。「振り返り」の材料 |
| `import-holdings` | 楽天の CSV から保有を取り込む |
| `db migrate` | DB を作る / 更新する。最初と、スキーマを変えたとき |
| `schedule` | 上の 1 を launchd に登録 / 解除 |

共通: 出力は JSON、`--dry-run` で予定だけ、`--db <path>` で別の DB。

## 自動実行（launchd）の中身

- `pnpm schedule install` → `~/Library/LaunchAgents/com.trading-tools.daily.plist` と `data/daily.sh`（`collect all` → `detect run`）
- ログ: `data/logs/daily-YYYY-MM-DD.log`。ダッシュボード左下の「収集」はこれを読む
- Mac がスリープ中は動かない（起きたときに実行される）

## ダッシュボードを常時動かす

`pnpm dashboard:build` → `apps/dashboard/server.mjs` を launchd に登録する。例:

```xml
<!-- ~/Library/LaunchAgents/com.trading-tools.dashboard.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.trading-tools.dashboard</string>
  <key>ProgramArguments</key><array>
    <string>/Users/you/.volta/bin/node</string>
    <string>/path/to/trading-tools/apps/dashboard/server.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>/path/to/trading-tools/apps/dashboard</string>
  <key>EnvironmentVariables</key><dict><key>PORT</key><string>3000</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardErrorPath</key><string>/path/to/trading-tools/data/logs/dashboard.err.log</string>
</dict></plist>
```

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.trading-tools.dashboard.plist   # 登録
launchctl kickstart -k gui/$(id -u)/com.trading-tools.dashboard                             # ビルドし直した後の再起動
launchctl bootout gui/$(id -u)/com.trading-tools.dashboard                                  # 解除
```

認証は無いので、LAN / Tailscale の外には出さない。
