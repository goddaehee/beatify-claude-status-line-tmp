#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

import type { StdinInput, Config, Translations, UsageLimits } from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import { COLORS, RESET, getColorForPercent, colorize } from './utils/colors.js';
import { formatTokens, formatCost, formatTimeRemaining, shortenModelName, calculatePercent } from './utils/formatters.js';
import { renderProgressBar } from './utils/progress-bar.js';
import { fetchUsageLimits } from './utils/api-client.js';
import { getTranslations } from './utils/i18n.js';
import { basename } from 'path';

const CONFIG_PATH = join(homedir(), '.claude', 'claude-dashboard.local.json');
const SEPARATOR = ` ${COLORS.dim}│${RESET} `;

// Random emojis for status line
const EMOJIS = ['⚡️', '🔥', '👑', '😎', '🐸', '🦄', '🌈', '🚀', '💡', '🎉', '🔑', '🌙'];

function getRandomEmoji(): string {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

function getGodTag(): string {
  return `${COLORS.black}${COLORS.bgWhite}{god}${RESET}`;
}

/**
 * Read and parse stdin JSON
 */
async function readStdin(): Promise<StdinInput | null> {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    const content = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(content) as StdinInput;
  } catch {
    return null;
  }
}

/**
 * Load user configuration
 */
async function loadConfig(): Promise<Config> {
  try {
    const content = await readFile(CONFIG_PATH, 'utf-8');
    const userConfig = JSON.parse(content);
    return { ...DEFAULT_CONFIG, ...userConfig };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Build context section: {god} tag, emoji, model, directory, progress bar, %, tokens, cost
 */
function buildContextSection(
  input: StdinInput,
  t: Translations
): string {
  const parts: string[] = [];

  // {god} tag + random emoji + model name
  const godTag = getGodTag();
  const emoji = getRandomEmoji();
  const modelName = shortenModelName(input.model.display_name);
  parts.push(`${godTag} ${emoji} ${COLORS.cyan}${modelName}${RESET}`);

  // Directory name
  const dirName = basename(input.workspace.current_dir);
  parts.push(colorize(dirName, COLORS.dim));

  // Check if we have context usage data
  const usage = input.context_window.current_usage;
  if (!usage) {
    parts.push(colorize(t.errors.no_context, COLORS.dim));
    return parts.join(SEPARATOR);
  }

  // Calculate current tokens used
  const currentTokens =
    usage.input_tokens +
    usage.cache_creation_input_tokens +
    usage.cache_read_input_tokens;
  const totalTokens = input.context_window.context_window_size;

  // Calculate percentage
  const percent = calculatePercent(currentTokens, totalTokens);

  // Progress bar
  parts.push(renderProgressBar(percent));

  // Percentage with color
  const percentColor = getColorForPercent(percent);
  parts.push(colorize(`${percent}%`, percentColor));

  // Token count
  parts.push(`${formatTokens(currentTokens)}/${formatTokens(totalTokens)}`);

  // Cost
  parts.push(colorize(formatCost(input.cost.total_cost_usd), COLORS.yellow));

  return parts.join(SEPARATOR);
}

/**
 * Format time remaining in compact format (e.g., "4h40m" or "45m")
 */
function formatTimeCompact(resetAt: string | Date): string {
  const reset = typeof resetAt === 'string' ? new Date(resetAt) : resetAt;
  const now = new Date();
  const diffMs = reset.getTime() - now.getTime();

  if (diffMs <= 0) return '0m';

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Build rate limits section based on plan type (compact format)
 */
function buildRateLimitsSection(
  limits: UsageLimits | null,
  config: Config,
  _t: Translations
): string {
  if (!limits) {
    // Show warning icon if API failed
    return colorize('⚠️', COLORS.yellow);
  }

  const parts: string[] = [];

  // 5h rate limit (both Max and Pro) - compact format: "5h:7%(4h40m)"
  if (limits.five_hour) {
    const pct = Math.round(limits.five_hour.utilization);
    const color = getColorForPercent(pct);
    let text = `5h:${colorize(`${pct}%`, color)}`;

    // Add reset time if available
    if (limits.five_hour.resets_at) {
      const remaining = formatTimeCompact(limits.five_hour.resets_at);
      text += `(${remaining})`;
    }

    parts.push(text);
  }

  if (config.plan === 'max') {
    // Max plan: Show 7d (all models) - compact format: "7d:49%"
    if (limits.seven_day) {
      const pct = Math.round(limits.seven_day.utilization);
      const color = getColorForPercent(pct);
      parts.push(`7d:${colorize(`${pct}%`, color)}`);
    }

    // Sonnet only usage - compact format: "7d-S:1%"
    if (limits.seven_day_sonnet) {
      const pct = Math.round(limits.seven_day_sonnet.utilization);
      const color = getColorForPercent(pct);
      parts.push(`7d-S:${colorize(`${pct}%`, color)}`);
    }
  }
  // Pro plan: Only 5h is shown (already added above)

  return parts.join(' ');
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Load configuration
  const config = await loadConfig();

  // Get translations
  const t = getTranslations(config);

  // Read stdin
  const input = await readStdin();
  if (!input) {
    console.log(colorize('⚠️', COLORS.yellow));
    return;
  }

  // Build context section
  const contextSection = buildContextSection(input, t);

  // Fetch rate limits (uses cache)
  const limits = await fetchUsageLimits(config.cache.ttlSeconds);

  // Build rate limits section
  const rateLimitsSection = buildRateLimitsSection(limits, config, t);

  // Combine sections
  const output = [contextSection, rateLimitsSection]
    .filter(Boolean)
    .join(SEPARATOR);

  console.log(output);
}

// Run
main().catch(() => {
  console.log(colorize('⚠️', COLORS.yellow));
});
