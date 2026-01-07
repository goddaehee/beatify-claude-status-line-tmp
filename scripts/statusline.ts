#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';

import type { StdinInput, Config, Translations, UsageLimits, ConfigCounts, TranscriptData, ToolEntry, AgentEntry, TodoEntry } from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import { COLORS, RESET, getColorForPercent, colorize } from './utils/colors.js';
import { formatTokens, formatCost, formatTimeRemaining, shortenModelName, calculatePercent } from './utils/formatters.js';
import { renderProgressBar } from './utils/progress-bar.js';
import { fetchUsageLimits } from './utils/api-client.js';
import { getTranslations } from './utils/i18n.js';
import { getGitBranch } from './utils/git.js';
import { countConfigs } from './utils/config-counter.js';
import { parseTranscript } from './utils/transcript.js';

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
 * Build context section: {god} tag, emoji, model, progress bar, %, tokens, cost
 */
function buildContextSection(
  input: StdinInput,
  t: Translations
): string {
  const parts: string[] = [];

  // {god} tag + random emoji + model name (with version)
  const godTag = getGodTag();
  const emoji = getRandomEmoji();
  const modelName = shortenModelName(input.model.display_name);
  parts.push(`${godTag} ${emoji} ${COLORS.cyan}${modelName}${RESET}`);

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
 * Format session duration (e.g., "5m", "1h23m")
 */
function formatSessionDuration(startTime: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - startTime.getTime();
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Truncate path to last component
 */
function truncatePath(filePath: string, maxLen = 20): string {
  const name = basename(filePath);
  return name.length > maxLen ? name.slice(0, maxLen - 3) + '...' : name;
}

/**
 * Truncate text
 */
function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 3) + '...' : text;
}

/**
 * Build project line: 📁 project git:(branch) | CLAUDE.md | rules | MCPs | hooks | ⏱️ session
 */
function buildProjectLine(
  cwd: string | undefined,
  gitBranch: string | undefined,
  configCounts: ConfigCounts,
  sessionDuration: string | undefined
): string | null {
  if (!cwd) return null;

  const parts: string[] = [];

  // Project name + git branch
  const projectName = basename(cwd) || cwd;
  let projectPart = `📁 ${colorize(projectName, COLORS.yellow)}`;

  if (gitBranch) {
    projectPart += ` ${colorize('git:(', COLORS.magenta)}${colorize(gitBranch, COLORS.cyan)}${colorize(')', COLORS.magenta)}`;
  }
  parts.push(projectPart);

  // Config counts
  if (configCounts.claudeMdCount > 0) {
    parts.push(colorize(`${configCounts.claudeMdCount} CLAUDE.md`, COLORS.dim));
  }
  if (configCounts.rulesCount > 0) {
    parts.push(colorize(`${configCounts.rulesCount} rules`, COLORS.dim));
  }
  if (configCounts.mcpCount > 0) {
    parts.push(colorize(`${configCounts.mcpCount} MCPs`, COLORS.dim));
  }
  if (configCounts.hooksCount > 0) {
    parts.push(colorize(`${configCounts.hooksCount} hooks`, COLORS.dim));
  }

  // Session duration
  if (sessionDuration) {
    parts.push(colorize(`⏱️ ${sessionDuration}`, COLORS.dim));
  }

  return parts.join(SEPARATOR);
}

/**
 * Build tools activity line
 */
function buildToolsLine(tools: ToolEntry[]): string | null {
  if (tools.length === 0) return null;

  const parts: string[] = [];

  // Running tools (max 2)
  const runningTools = tools.filter((t) => t.status === 'running');
  for (const tool of runningTools.slice(-2)) {
    const target = tool.target ? truncatePath(tool.target) : '';
    parts.push(`${colorize('◐', COLORS.yellow)} ${colorize(tool.name, COLORS.cyan)}${target ? colorize(`: ${target}`, COLORS.dim) : ''}`);
  }

  // Completed tools counts
  const completedTools = tools.filter((t) => t.status === 'completed' || t.status === 'error');
  const toolCounts = new Map<string, number>();
  for (const tool of completedTools) {
    const count = toolCounts.get(tool.name) ?? 0;
    toolCounts.set(tool.name, count + 1);
  }

  const sortedTools = Array.from(toolCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  for (const [name, count] of sortedTools) {
    parts.push(`${colorize('✓', COLORS.green)} ${name} ${colorize(`×${count}`, COLORS.dim)}`);
  }

  return parts.length > 0 ? parts.join(' | ') : null;
}

/**
 * Build agents activity line
 */
function buildAgentsLine(agents: AgentEntry[]): string | null {
  const runningAgents = agents.filter((a) => a.status === 'running');
  const recentCompleted = agents.filter((a) => a.status === 'completed').slice(-2);

  const toShow = [...runningAgents, ...recentCompleted].slice(-3);
  if (toShow.length === 0) return null;

  const lines: string[] = [];

  for (const agent of toShow) {
    const statusIcon = agent.status === 'running' ? colorize('◐', COLORS.yellow) : colorize('✓', COLORS.green);
    const type = colorize(agent.type, COLORS.magenta);
    const model = agent.model ? colorize(`[${agent.model}]`, COLORS.dim) : '';
    const desc = agent.description ? colorize(`: ${truncate(agent.description, 40)}`, COLORS.dim) : '';

    // Calculate elapsed
    const now = Date.now();
    const start = agent.startTime.getTime();
    const end = agent.endTime?.getTime() ?? now;
    const ms = end - start;
    let elapsed = '<1s';
    if (ms >= 1000 && ms < 60000) elapsed = `${Math.round(ms / 1000)}s`;
    else if (ms >= 60000) {
      const mins = Math.floor(ms / 60000);
      const secs = Math.round((ms % 60000) / 1000);
      elapsed = `${mins}m${secs}s`;
    }

    lines.push(`${statusIcon} ${type}${model ? ` ${model}` : ''}${desc} ${colorize(`(${elapsed})`, COLORS.dim)}`);
  }

  return lines.join('\n');
}

/**
 * Build todos progress line
 */
function buildTodosLine(todos: TodoEntry[]): string | null {
  if (!todos || todos.length === 0) return null;

  const inProgress = todos.find((t) => t.status === 'in_progress');
  const completed = todos.filter((t) => t.status === 'completed').length;
  const total = todos.length;

  if (!inProgress) {
    if (completed === total && total > 0) {
      return `${colorize('✓', COLORS.green)} All todos complete ${colorize(`(${completed}/${total})`, COLORS.dim)}`;
    }
    return null;
  }

  const content = truncate(inProgress.content, 50);
  const progress = colorize(`(${completed}/${total})`, COLORS.dim);

  return `${colorize('▸', COLORS.yellow)} ${content} ${progress}`;
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

  const cwd = input.cwd || input.workspace?.current_dir;

  // Fetch all data in parallel
  const [limits, gitBranch, configCounts, transcriptData] = await Promise.all([
    fetchUsageLimits(config.cache.ttlSeconds),
    getGitBranch(cwd),
    countConfigs(cwd),
    input.transcript_path ? parseTranscript(input.transcript_path) : Promise.resolve({ tools: [], agents: [], todos: [] } as TranscriptData),
  ]);

  // Calculate session duration
  const sessionDuration = transcriptData.sessionStart
    ? formatSessionDuration(transcriptData.sessionStart)
    : undefined;

  // Build all lines
  const lines: string[] = [];

  // Line 1: Main status line (model, context, rate limits)
  const contextSection = buildContextSection(input, t);
  const rateLimitsSection = buildRateLimitsSection(limits, config, t);
  const mainLine = [contextSection, rateLimitsSection].filter(Boolean).join(SEPARATOR);
  lines.push(mainLine);

  // Line 2: Project info (git branch, config counts, session duration)
  const projectLine = buildProjectLine(cwd, gitBranch, configCounts, sessionDuration);
  if (projectLine) lines.push(projectLine);

  // Line 3: Tools activity
  const toolsLine = buildToolsLine(transcriptData.tools);
  if (toolsLine) lines.push(toolsLine);

  // Line 4: Agents activity
  const agentsLine = buildAgentsLine(transcriptData.agents);
  if (agentsLine) lines.push(agentsLine);

  // Line 5: Todos progress
  const todosLine = buildTodosLine(transcriptData.todos);
  if (todosLine) lines.push(todosLine);

  // Output all lines
  for (const line of lines) {
    console.log(line);
  }
}

// Run
main().catch(() => {
  console.log(colorize('⚠️', COLORS.yellow));
});
