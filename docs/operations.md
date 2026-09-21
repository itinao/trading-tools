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

## 0. 各コマンドの意味

流れは **事実を集める → 評価する → 人が判断する → 振り返る**。コマンドはこの順に並べてある。

### 事実を集める（外部から取ってきて、そのまま保存する）

| コマンド | 何をするか | 結果はどこに出るか |
| --- | --- | --- |
| `pnpm import-holdings run <CSV>` | 楽天証券からダウンロードした保有状況の CSV を読み、**その日の保有（銘柄・数量・取得単価）** を「スナップショット」として保存する。持っている銘柄はこれで決まる。取り込むたびに 1 枚増え、最新の 1 枚が「いまの保有」 | 銘柄 → 保有 タブ |
| `pnpm collect all` | 保有 ∪ ウォッチの銘柄について、外部から **株価**（Yahoo Finance）、**指標**（PER / PBR / 配当利回り / ROE）、**財務諸表**（年次・四半期）、**ニュースの見出し**（Google News）、**適時開示**（TDnet、今日と前日）を取り、取得時刻付きで保存する。同じ日に 2 回走っても増えない | 銘柄詳細 → 株価 / 財務・指標 / ニュース・開示 タブ。左下の「株価 MM-DD」 |
| `pnpm collect quotes` など | `all` の一部だけ。`quotes` は株価が 1 件もない銘柄（新しく持った銘柄）だけ 1 年分の日足を遡る。`--backfill` で全銘柄を遡り直す | 同上 |
| `pnpm collect universe` | 東証の上場銘柄一覧（約 3,900 銘柄。JPX の Excel）を入れ替える。**スクリーナーの母集団** で、`all` には含まれない。月 1 回でよい | スクリーナー（母集団の数） |

### 評価する（集めた事実から、何が起きたか・何をすべきかを機械的に作る）

| コマンド | 何をするか | 結果はどこに出るか |
| --- | --- | --- |
| `pnpm detect run` | 保有 ∪ ウォッチの各銘柄について **スコア**（株価・判定・財務を合わせた 1 つの数字）を計算し、**13 のルール**（取得単価比の下落、60 日高値からの下落、200 日線割れ、前日比の急落、悪材料のニュース、業績予想の下方修正、減配、利益率や自己資本比率の悪化、スコアの低下。ウォッチには割安・成長・売られすぎも）に当てはまれば **シグナル**（何が起きたか）と **アクション**（何をすべきか。「要確認」など）を作る。同じことで何度も鳴らないよう、未対応のアクションがある間は重複させない。閾値は `config/detect.json` | アクション（未対応の一覧）、銘柄詳細のヘッダのスコア |

### AI に判定・助言させる（「朝の確認をして」の中身。ツールは AI を持たず、出し入れだけする）

| コマンド | 何をするか | 結果はどこに出るか |
| --- | --- | --- |
| `pnpm assess pending` | **まだ判定していないニュース・開示** を JSON で出す（開示は PDF の本文つき）。AI がこれを読む | - |
| `pnpm assess record --input <file>` | AI が付けた判定（好材料 / 悪材料 / 中立、向き、要約）を書き込む。**判定は `detect run` の入力になる** ので、書いたら `detect run` をやり直す | 銘柄詳細 → ニュース・開示 タブ（判定の列） |
| `pnpm assess override <id> --sentiment N` | 人が AI の判定を上書きする。AI の判定は消えず、人の判定が優先される | 同上。ダッシュボードからもできる |
| `pnpm advise pending` | **助言がまだ無い未対応のアクション** を、判断に必要な事実の束（株価の推移、判定済みのニュース、財務、保有の状況）と一緒に JSON で出す。AI がこれを読む | - |
| `pnpm advise record --input <file>` | AI の助言（stance = 保有継続 / 要確認 / 売り検討、ウォッチなら 候補 / 様子見 / 見送り、と根拠）を書き込む。**助言は判断材料で、最終判断は人** | アクションのカード（検知の下に助言が出る） |

### 人が判断する

| コマンド | 何をするか | 結果はどこに出るか |
| --- | --- | --- |
| `pnpm actions list` / `show <id>` | 未対応のアクションの一覧 / 1 件の本文 | アクション |
| `pnpm actions resolve <id> --status done\|dismissed --note "..."` | アクションを **対応した / 見送り** にする。何をしたか（売った / 買った / 確認した）をメモに書くと振り返りに使える。普段はダッシュボードのボタンで行う | アクション → 対応した / 見送り タブ、履歴 |
| `pnpm watch add <code> --note "..."` / `remove` / `list` | **ウォッチ銘柄**（まだ持っていないが監視したい銘柄）の追加・削除・一覧。追加した翌日から `collect` と `detect` の対象になる。普段はスクリーナーのボタンで行う | 銘柄 → ウォッチ タブ |
| `pnpm screen run --preset value` | 上場銘柄一覧から **条件に合う銘柄を探す**（value = 割安、growth = 成長、quality = 優良。`config/screen.json`）。指標を Yahoo からまとめて取るので 1〜2 分かかる。結果は実行ごとに保存される | スクリーナー |

### 振り返る

| コマンド | 何をするか | 結果はどこに出るか |
| --- | --- | --- |
| `pnpm review history --since YYYY-MM-DD` | 対応した / 見送りにしたアクションと、**判断した日の株価とその後の変化**、stance × 判断の集計。「振り返りをして」はこれを読んで閾値の調整案を出す（設定は変えない） | 履歴 |
| `pnpm review timeline <code>` | 1 銘柄の出来事（株価、シグナル、判定、助言、判断）を時系列に並べる | 銘柄詳細 → タイムライン タブ |

### 土台

| コマンド | 何をするか |
| --- | --- |
| `pnpm db migrate` / `status` | データベース（`data/trading.db`）を作る / テーブルの定義を最新にする。スキーマを変えた後に 1 回。テーブルの一覧は [schema.md](schema.md) |
| `pnpm schedule install` / `status` / `uninstall` | 平日 18:30 の `collect all` → `detect run` を macOS の launchd に登録 / 確認 / 解除 |

すべてのコマンドに共通: 出力は JSON 1 つ（`{ ok, data }`）。`--dry-run` で書き込まずに予定だけ出す。`--db <path>` で別の DB を使う。

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
