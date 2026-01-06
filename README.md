# beatify-claude-status-line

Beautiful status line plugin for Claude Code with `{god}` tag, random emoji, context usage, API rate limits, and cost tracking.

## Features

- **{god} Tag**: Eye-catching white background tag
- **Random Emoji**: Different emoji each time (⚡️ 🔥 👑 😎 🦄 🌈 🚀 💡 🎉 🔑 🌙)
- **Model Display**: Shows current model (Opus, Sonnet, Haiku)
- **Directory Name**: Shows current working directory
- **Progress Bar**: Color-coded context usage (green → yellow → red)
- **Token Count**: Current/total tokens in K/M format
- **Cost Tracking**: Cumulative session cost in USD
- **Compact Rate Limits**: 5h session limit with reset countdown, 7d usage

## Output Example

```
{god} 🔥 Opus │ myproject │ ████░░░░░░ │ 40% │ 80K/200K │ $1.25 │ 5h:8%(4h30m) 7d:50% 7d-S:1%
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
