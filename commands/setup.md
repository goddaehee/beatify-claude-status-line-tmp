---
description: Configure beatify-claude-status-line settings
argument-hint: "[language] [plan]"
allowed-tools: Read, Write, Bash(jq:*), Bash(cat:*), Bash(mkdir:*)
---

# Beatify Claude Status Line Setup

Configure the beatify-claude-status-line plugin.

## Arguments

- `$1`: Language preference
  - `auto` (default): Detect from system language
  - `en`: English
  - `ko`: Korean (한국어)

- `$2`: Subscription plan
  - `max` (default): Shows 5h + 7d (all models) + 7d-S (Sonnet)
  - `pro`: Shows 5h only

- `$3`: Username (optional)
  - Default: `god`
  - Your custom name to display in `{username}` tag

## Tasks

### 1. Create configuration file

Create `~/.claude/claude-dashboard.local.json` with user preferences:

```json
{
  "language": "$1 or auto",
  "plan": "$2 or max",
  "username": "$3 or god",
  "cache": {
    "ttlSeconds": 60
  }
}
```

### 2. Update settings.json

Add or update the statusLine configuration in `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ${CLAUDE_PLUGIN_ROOT}/dist/index.js"
  }
}
```

**Important**: Use `${CLAUDE_PLUGIN_ROOT}` for the plugin path to ensure portability.

### 3. Verify setup

After configuration:
1. Check that the configuration file was created successfully
2. Verify the settings.json was updated
3. Inform the user that the status line will appear on the next message

### 4. Show example output

Display what the status line will look like based on their plan:

**Max plan (multi-line):**
```
{username} 🚀 Opus 4.5 │ ███░░░░░░░ │ 31% │ 63K/200K │ $8.17 │ 5h:34%(3h34m) 7d:63% 7d-S:1%
📁 myproject git:(main) │ 2 CLAUDE.md │ 3 MCPs │ ⏱️ 24m
✓ Edit ×7 | ✓ Read ×5 | ✓ Bash ×4
▸ Implement feature (3/6)
```

**Pro plan (multi-line):**
```
{alice} ⚡️ Sonnet 3.5 │ ██████░░░░ │ 60% │ 120K/200K │ $0.45 │ 5h:42%(2h30m)
📁 myproject git:(develop) │ 1 CLAUDE.md │ 2 hooks │ ⏱️ 15m
✓ Read ×3 | ✓ Write ×2
```

## Status Line Components

### Line 1: Main Status
- `{username}` tag (white background, customizable)
- Random emoji
- Model name with version
- Progress bar + percentage
- Token count (current/total)
- Cost in USD
- Rate limits (5h, 7d, 7d-S for Max plan)

### Line 2: Project Info
- 📁 Directory name
- Git branch
- Config counts (CLAUDE.md, rules, MCPs, hooks)
- ⏱️ Session duration

### Line 3+: Activity (shown when available)
- Tools: Running (◐) and completed (✓) with counts
- Agents: Running/completed with elapsed time
- Todos: Current task (▸) and progress

## Notes

- If no arguments provided, use defaults (auto language, max plan)
- The status line will start working immediately after configuration
- To change settings later, run this command again with new arguments
- Activity lines only appear when there is tool/agent/todo activity
