# スキル

エージェント（codex / Claude Code）が運用時に使うスキルの正本。`.claude/skills` はここへのシンボリックリンク。

- 1スキル1ディレクトリ: `<name>/SKILL.md`
- スキルはデータストアを直接触らず、ツールの CLI を呼ぶ（Design Doc 0001 §12）
- 最初のスキルは M2 の `assess`、M3 の `advise`
