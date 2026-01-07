# Claude Code Configuration

## Project Overview

**beatify-claude-status-line** is a Claude Code plugin that provides a beautiful multi-line status line showing context usage, API rate limits, cost tracking, git branch, config counts, session duration, and activity tracking.

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.0+
- **Build**: esbuild
- **Target**: Claude Code Plugin

## Project Structure

```
beatify-claude-status-line/
├── .claude-plugin/
│   ├── plugin.json          # Plugin manifest
│   └── marketplace.json     # Marketplace metadata
├── commands/
│   └── setup.md             # /beatify-claude-status-line:setup command
├── scripts/
│   ├── statusline.ts        # Main entry point
│   ├── types.ts             # TypeScript interfaces
│   └── utils/
│       ├── api-client.ts    # OAuth API client with caching
│       ├── colors.ts        # ANSI color codes
│       ├── config-counter.ts # CLAUDE.md, rules, MCPs, hooks counting
│       ├── credentials.ts   # Keychain/credentials extraction
│       ├── formatters.ts    # Token/cost/time formatting
│       ├── git.ts           # Git branch detection
│       ├── i18n.ts          # Internationalization
│       ├── progress-bar.ts  # Progress bar rendering
│       └── transcript.ts    # Tool/Agent/Todo parsing
├── locales/
│   ├── en.json              # English translations
│   └── ko.json              # Korean translations
├── dist/
│   └── index.js             # Built output (committed)
└── package.json
```

## Development Workflow

```bash
# Install dependencies
npm install

# Build
npm run build

# Test locally
echo '{"model":{"display_name":"Opus"},...}' | node dist/index.js
```

## Code Style

- Use TypeScript strict mode
- ESM modules (import/export)
- Functional style preferred
- No external runtime dependencies (Node.js built-ins only)

## Key Conventions

1. **dist/index.js is committed** - Plugin users don't need to build
2. **60-second API cache** - Avoid rate limiting
3. **Graceful degradation** - Show ⚠️ on API errors, not crash
4. **i18n** - All user-facing strings in locales/*.json

## Testing Checklist

Before committing:
- [ ] `npm run build` succeeds
- [ ] Max plan output format correct (5 lines max)
- [ ] Pro plan output format correct
- [ ] Korean/English switching works
- [ ] API error shows ⚠️ instead of crash
- [ ] Git branch displays correctly
- [ ] Config counts display correctly
- [ ] Activity lines display when available

## Common Tasks

### Adding a new locale

1. Create `locales/{lang}.json` copying from `en.json`
2. Update `scripts/utils/i18n.ts` to import new locale
3. Test with `/beatify-claude-status-line:setup {lang}`

### Modifying status line format

1. Edit `scripts/statusline.ts` `formatOutput()` function
2. Update `README.md` examples
3. Update `commands/setup.md` examples
4. Rebuild and test

### Updating API client

1. Edit `scripts/utils/api-client.ts`
2. Check cache invalidation logic
3. Test with expired cache (`rm /tmp/claude-dashboard-cache.json`)
