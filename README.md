# beatify-claude-status-line

Beautiful multi-line status line plugin for Claude Code with `{god}` tag, random emoji, context usage, API rate limits, project info, and activity tracking.

## Features

### Line 1: Main Status
- **{god} Tag**: Eye-catching white background tag
- **Random Emoji**: Different emoji each time (⚡️ 🔥 👑 😎 🦄 🌈 🚀 💡 🎉 🔑 🌙)
- **Model Display**: Shows current model with version (Opus 4.5, Sonnet 3.5, Haiku)
- **Progress Bar**: Color-coded context usage (green → yellow → red)
- **Token Count**: Current/total tokens in K/M format
- **Cost Tracking**: Cumulative session cost in USD
- **Compact Rate Limits**: 5h session limit with reset countdown, 7d usage

### Line 2: Project Info
- **Directory Name**: Current working directory
- **Git Branch**: Current git branch (if in a git repo)
- **Config Counts**: CLAUDE.md files, rules, MCPs, hooks
- **Session Duration**: Time since session started

### Line 3-5: Activity (shown when available)
- **Tools Activity**: Running tools with spinner, completed tools with counts
- **Agents Activity**: Running/completed agents with elapsed time
- **Todos Progress**: Current task and completion status

## Output Example

```
{god} 🚀 Opus 4.5 │ ███░░░░░░░ │ 31% │ 63K/200K │ $8.17 │ 5h:34%(3h34m) 7d:63% 7d-S:1%
📁 claude-dashboard git:(main) │ 2 CLAUDE.md │ 5 MCPs │ ⏱️ 24m
✓ Edit ×7 | ✓ Read ×5 | ✓ Bash ×4 | ✓ Write ×3
✓ Explore: Analyze max plan implementation (45s)
▸ Update documentation (3/6)
```

## Installation

### From Plugin Marketplace (Private)

```
/plugin marketplace add goddaehee/beatify-claude-status-line
/plugin install beatify-claude-status-line
/beatify-claude-status-line:setup
```

### Manual Installation

1. Clone the repository:
```bash
git clone git@github.com:goddaehee/beatify-claude-status-line.git ~/.claude/plugins/beatify-claude-status-line
```

2. Run setup:
```
/beatify-claude-status-line:setup
```

## Configuration

Run `/beatify-claude-status-line:setup` with optional arguments:

```
# Default: auto language detection, max plan
/beatify-claude-status-line:setup

# English, pro plan
/beatify-claude-status-line:setup en pro

# Korean, max plan
/beatify-claude-status-line:setup ko max
```

### Configuration File

Settings are stored in `~/.claude/claude-dashboard.local.json`:

```json
{
  "language": "auto",
  "plan": "max",
  "cache": {
    "ttlSeconds": 60
  }
}
```

## Requirements

- **Claude Code** v1.0.80+
- **Node.js** 18+

## Status Line Components

### Line 1: Main Status

| Component | Description |
|-----------|-------------|
| `{god}` | White background tag |
| Emoji | Random emoji (changes each render) |
| Model | Model name with version (e.g., Opus 4.5) |
| Progress Bar | 10-char bar showing context usage |
| Percentage | Context usage percentage |
| Tokens | Current/Total in K/M format |
| Cost | Session cost in USD |
| Rate Limits | 5h, 7d, 7d-S usage with countdown |

### Line 2: Project Info

| Component | Description |
|-----------|-------------|
| 📁 Directory | Current working directory name |
| git:(branch) | Current git branch |
| N CLAUDE.md | Number of CLAUDE.md files |
| N rules | Number of rule files |
| N MCPs | Number of MCP servers |
| N hooks | Number of hooks |
| ⏱️ Duration | Session duration |

### Line 3+: Activity

| Icon | Meaning |
|------|---------|
| ◐ | Tool/Agent running |
| ✓ | Tool/Agent completed |
| ▸ | Todo in progress |

## Color Legend

| Color | Usage % | Meaning |
|-------|---------|---------|
| 🟢 Green | 0-50% | Safe |
| 🟡 Yellow | 51-80% | Warning |
| 🔴 Red | 81-100% | Critical |

## Plan Differences

| Feature | Max | Pro |
|---------|-----|-----|
| 5h rate limit | ✅ | ✅ |
| Reset countdown | ✅ | ✅ |
| 7d all models | ✅ | ❌ |
| 7d Sonnet only | ✅ | ❌ |

## Troubleshooting

### Status line not showing

1. Check if plugin is installed: `/plugin list`
2. Verify settings.json has statusLine config
3. Restart Claude Code

### Rate limits showing ⚠️

- API token may be expired - run `/login` to re-authenticate
- Network issue - check internet connection
- API rate limited - wait 60 seconds for cache refresh

### Activity lines not showing

- Tools/Agents/Todos lines only appear when there is activity
- Requires `transcript_path` in stdin (automatically provided by Claude Code)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test locally
npm test
```

## License

MIT

## Author

**goddaehee** - [GitHub](https://github.com/goddaehee)
