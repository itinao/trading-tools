# データストアのスキーマ（現在）

**このファイルは自動生成。手で編集しない。** 生成元は `packages/db/src/schema/`、生成コマンドは `pnpm db:erd`。
古くなっていると `pnpm test` が落ちる。各テーブルの設計意図は、定義した Design Doc を参照。

| テーブル | 定義した Design Doc |
| --- | --- |
| `actions` | [0005](design-docs/0005-detect-and-dashboard.md) |
| `holding_snapshots` | [0003](design-docs/0003-holdings-and-quotes.md) |
| `holdings` | [0003](design-docs/0003-holdings-and-quotes.md) |
| `instruments` | [0003](design-docs/0003-holdings-and-quotes.md) |
| `quotes` | [0003](design-docs/0003-holdings-and-quotes.md) |
| `signals` | [0005](design-docs/0005-detect-and-dashboard.md) |

```mermaid
erDiagram
    actions {
        integer id PK
        text instrument_id FK "-> instruments"
        integer signal_id FK "-> signals; unique(signal_id, origin); nullable"
        text origin "unique(signal_id, origin)"
        text title
        text body
        text status
        text note "nullable"
        text created_at
        text resolved_at "nullable"
    }
    holding_snapshots {
        integer id PK
        text source "unique(source, as_of)"
        text as_of "unique(source, as_of)"
        text file_name
        text imported_at
        integer row_count
        text skipped_json
    }
    holdings {
        integer snapshot_id PK,FK "-> holding_snapshots"
        text instrument_id PK,FK "-> instruments"
        text account PK
        integer quantity
        real average_cost
        real price_at_snapshot
        integer market_value
        integer unrealized_pnl
        real unrealized_pnl_pct
    }
    instruments {
        text id PK
        text market
        text code
        text name
        text created_at
        text updated_at
    }
    quotes {
        integer id PK
        text instrument_id FK "-> instruments; unique(instrument_id, as_of, source)"
        text as_of "unique(instrument_id, as_of, source)"
        real price
        real previous_close "nullable"
        text source "unique(instrument_id, as_of, source)"
        text fetched_at
    }
    signals {
        integer id PK
        text instrument_id FK "-> instruments; unique(instrument_id, kind, as_of)"
        text kind "unique(instrument_id, kind, as_of)"
        text as_of "unique(instrument_id, kind, as_of)"
        text severity
        real value
        text details_json
        text created_at
        text updated_at
    }
    holding_snapshots ||--o{ holdings : ""
    instruments ||--o{ actions : ""
    instruments ||--o{ holdings : ""
    instruments ||--o{ quotes : ""
    instruments ||--o{ signals : ""
    signals ||--o{ actions : ""
```
