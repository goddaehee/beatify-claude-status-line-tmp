#!/usr/bin/env node

// scripts/statusline.ts
import { readFile as readFile2 } from "fs/promises";
import { join as join3, basename } from "path";
import { homedir as homedir3 } from "os";

// scripts/types.ts
var DEFAULT_CONFIG = {
  language: "auto",
  plan: "max",
  cache: {
    ttlSeconds: 60
  }
};

// scripts/utils/colors.ts
var COLORS = {
  // Reset
  reset: "\x1B[0m",
  // Styles
  dim: "\x1B[2m",
  bold: "\x1B[1m",
  // Foreground colors
  red: "\x1B[31m",
  green: "\x1B[32m",
  yellow: "\x1B[33m",
  blue: "\x1B[34m",
  magenta: "\x1B[35m",
  cyan: "\x1B[36m",
  white: "\x1B[37m",
  gray: "\x1B[90m",
  // Bright variants
  brightRed: "\x1B[91m",
  brightGreen: "\x1B[92m",
  brightYellow: "\x1B[93m",
  brightCyan: "\x1B[96m",
  // Background colors
  bgWhite: "\x1B[47m",
  black: "\x1B[30m"
};
var RESET = COLORS.reset;
function getColorForPercent(percent) {
  if (percent <= 50) return COLORS.green;
  if (percent <= 80) return COLORS.yellow;
  return COLORS.red;
}
function colorize(text, color) {
  return `${color}${text}${RESET}`;
}

// scripts/utils/formatters.ts
function formatTokens(tokens) {
  if (tokens >= 1e6) {
    const value = tokens / 1e6;
    return value >= 10 ? `${Math.round(value)}M` : `${value.toFixed(1)}M`;
  }
  if (tokens >= 1e3) {
    const value = tokens / 1e3;
    return value >= 10 ? `${Math.round(value)}K` : `${value.toFixed(1)}K`;
  }
  return String(tokens);
}
function formatCost(cost) {
  return `$${cost.toFixed(2)}`;
}
function shortenModelName(displayName) {
  const lower = displayName.toLowerCase();
  const versionMatch = displayName.match(/(\d+\.?\d*)/);
  const version = versionMatch ? versionMatch[1] : "";
  if (lower.includes("opus")) return version ? `Opus ${version}` : "Opus";
  if (lower.includes("sonnet")) return version ? `Sonnet ${version}` : "Sonnet";
  if (lower.includes("haiku")) return version ? `Haiku ${version}` : "Haiku";
  const parts = displayName.split(/\s+/);
  if (parts.length > 1 && parts[0].toLowerCase() === "claude") {
    return parts[1];
  }
  return displayName;
}
function calculatePercent(current, total) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round(current / total * 100));
}

// scripts/utils/progress-bar.ts
var DEFAULT_PROGRESS_BAR_CONFIG = {
  width: 10,
  filledChar: "\u2588",
  // █ (full block)
  emptyChar: "\u2591"
  // ░ (light shade)
};
function renderProgressBar(percent, config = DEFAULT_PROGRESS_BAR_CONFIG) {
  const { width, filledChar, emptyChar } = config;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const filled = Math.round(clampedPercent / 100 * width);
  const empty = width - filled;
  const bar = filledChar.repeat(filled) + emptyChar.repeat(empty);
  const color = getColorForPercent(clampedPercent);
  return `${color}${bar}${RESET}`;
}

// scripts/utils/api-client.ts
import fs from "fs";

// scripts/utils/credentials.ts
import { execFileSync } from "child_process";
import { readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
async function getCredentials() {
  try {
    if (process.platform === "darwin") {
      return await getCredentialsFromKeychain();
    }
    return await getCredentialsFromFile();
  } catch {
    return null;
  }
}
async function getCredentialsFromKeychain() {
  try {
    const result = execFileSync(
      "security",
      ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
    const creds = JSON.parse(result);
    return creds?.claudeAiOauth?.accessToken ?? null;
  } catch {
    return await getCredentialsFromFile();
  }
}
async function getCredentialsFromFile() {
  try {
    const credPath = join(homedir(), ".claude", ".credentials.json");
    const content = await readFile(credPath, "utf-8");
    const creds = JSON.parse(content);
    return creds?.claudeAiOauth?.accessToken ?? null;
  } catch {
    return null;
  }
}

// scripts/utils/api-client.ts
var API_TIMEOUT_MS = 5e3;
var CACHE_FILE = "/tmp/claude-dashboard-cache.json";
var usageCache = null;
function isCacheValid(ttlSeconds) {
  if (!usageCache) return false;
  const ageSeconds = (Date.now() - usageCache.timestamp) / 1e3;
  return ageSeconds < ttlSeconds;
}
async function fetchUsageLimits(ttlSeconds = 60) {
  if (isCacheValid(ttlSeconds) && usageCache) {
    return usageCache.data;
  }
  const fileCache = await loadFileCache(ttlSeconds);
  if (fileCache) {
    usageCache = { data: fileCache, timestamp: Date.now() };
    return fileCache;
  }
  const token = await getCredentials();
  if (!token) {
    return null;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const response = await fetch("https://api.anthropic.com/api/oauth/usage", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "claude-dashboard/1.0.0",
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20"
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const limits = {
      five_hour: data.five_hour ?? null,
      seven_day: data.seven_day ?? null,
      seven_day_sonnet: data.seven_day_sonnet ?? null
    };
    usageCache = { data: limits, timestamp: Date.now() };
    await saveFileCache(limits);
    return limits;
  } catch {
    return null;
  }
}
async function loadFileCache(ttlSeconds) {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const content = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    const ageSeconds = (Date.now() - content.timestamp) / 1e3;
    if (ageSeconds < ttlSeconds) {
      return content.data;
    }
    return null;
  } catch {
    return null;
  }
}
async function saveFileCache(data) {
  try {
    fs.writeFileSync(
      CACHE_FILE,
      JSON.stringify({
        data,
        timestamp: Date.now()
      })
    );
  } catch {
  }
}

// locales/en.json
var en_default = {
  model: {
    opus: "Opus",
    sonnet: "Sonnet",
    haiku: "Haiku"
  },
  labels: {
    "5h": "5h",
    "7d": "7d",
    "7d_all": "7d",
    "7d_sonnet": "7d-S"
  },
  time: {
    hours: "h",
    minutes: "m"
  },
  errors: {
    no_context: "No context yet"
  }
};

// locales/ko.json
var ko_default = {
  model: {
    opus: "Opus",
    sonnet: "Sonnet",
    haiku: "Haiku"
  },
  labels: {
    "5h": "5\uC2DC\uAC04",
    "7d": "7\uC77C",
    "7d_all": "7\uC77C",
    "7d_sonnet": "7\uC77C-S"
  },
  time: {
    hours: "\uC2DC\uAC04",
    minutes: "\uBD84"
  },
  errors: {
    no_context: "\uCEE8\uD14D\uC2A4\uD2B8 \uC5C6\uC74C"
  }
};

// scripts/utils/i18n.ts
var LOCALES = {
  en: en_default,
  ko: ko_default
};
function detectSystemLanguage() {
  const lang = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || "";
  if (lang.toLowerCase().startsWith("ko")) {
    return "ko";
  }
  return "en";
}
function getTranslations(config) {
  let lang;
  if (config.language === "auto") {
    lang = detectSystemLanguage();
  } else {
    lang = config.language;
  }
  return LOCALES[lang] || LOCALES.en;
}

// scripts/utils/git.ts
import { execFileSync as execFileSync2 } from "child_process";
async function getGitBranch(cwd) {
  if (!cwd) return void 0;
  try {
    const result = execFileSync2("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    return result || void 0;
  } catch {
    return void 0;
  }
}

// scripts/utils/config-counter.ts
import * as fs2 from "fs";
import * as path from "path";
import * as os from "os";
function getMcpServerNames(filePath) {
  if (!fs2.existsSync(filePath)) return /* @__PURE__ */ new Set();
  try {
    const content = fs2.readFileSync(filePath, "utf8");
    const config = JSON.parse(content);
    if (config.mcpServers && typeof config.mcpServers === "object") {
      return new Set(Object.keys(config.mcpServers));
    }
  } catch {
  }
  return /* @__PURE__ */ new Set();
}
function countMcpServersInFile(filePath, excludeFrom) {
  const servers = getMcpServerNames(filePath);
  if (excludeFrom) {
    const exclude = getMcpServerNames(excludeFrom);
    for (const name of exclude) servers.delete(name);
  }
  return servers.size;
}
function countHooksInFile(filePath) {
  if (!fs2.existsSync(filePath)) return 0;
  try {
    const content = fs2.readFileSync(filePath, "utf8");
    const config = JSON.parse(content);
    if (config.hooks && typeof config.hooks === "object") {
      return Object.keys(config.hooks).length;
    }
  } catch {
  }
  return 0;
}
function countRulesInDir(rulesDir) {
  if (!fs2.existsSync(rulesDir)) return 0;
  let count = 0;
  try {
    const entries = fs2.readdirSync(rulesDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(rulesDir, entry.name);
      if (entry.isDirectory()) {
        count += countRulesInDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        count++;
      }
    }
  } catch {
  }
  return count;
}
async function countConfigs(cwd) {
  let claudeMdCount = 0;
  let rulesCount = 0;
  let mcpCount = 0;
  let hooksCount = 0;
  const homeDir = os.homedir();
  const claudeDir = path.join(homeDir, ".claude");
  if (fs2.existsSync(path.join(claudeDir, "CLAUDE.md"))) claudeMdCount++;
  rulesCount += countRulesInDir(path.join(claudeDir, "rules"));
  const userSettings = path.join(claudeDir, "settings.json");
  mcpCount += countMcpServersInFile(userSettings);
  hooksCount += countHooksInFile(userSettings);
  const userClaudeJson = path.join(homeDir, ".claude.json");
  mcpCount += countMcpServersInFile(userClaudeJson, userSettings);
  if (cwd) {
    if (fs2.existsSync(path.join(cwd, "CLAUDE.md"))) claudeMdCount++;
    if (fs2.existsSync(path.join(cwd, "CLAUDE.local.md"))) claudeMdCount++;
    if (fs2.existsSync(path.join(cwd, ".claude", "CLAUDE.md"))) claudeMdCount++;
    if (fs2.existsSync(path.join(cwd, ".claude", "CLAUDE.local.md"))) claudeMdCount++;
    rulesCount += countRulesInDir(path.join(cwd, ".claude", "rules"));
    mcpCount += countMcpServersInFile(path.join(cwd, ".mcp.json"));
    const projectSettings = path.join(cwd, ".claude", "settings.json");
    mcpCount += countMcpServersInFile(projectSettings);
    hooksCount += countHooksInFile(projectSettings);
    const localSettings = path.join(cwd, ".claude", "settings.local.json");
    mcpCount += countMcpServersInFile(localSettings);
    hooksCount += countHooksInFile(localSettings);
  }
  return { claudeMdCount, rulesCount, mcpCount, hooksCount };
}

// scripts/utils/transcript.ts
import * as fs3 from "fs";
import * as readline from "readline";
async function parseTranscript(transcriptPath) {
  const result = {
    tools: [],
    agents: [],
    todos: []
  };
  if (!transcriptPath || !fs3.existsSync(transcriptPath)) {
    return result;
  }
  const toolMap = /* @__PURE__ */ new Map();
  const agentMap = /* @__PURE__ */ new Map();
  let latestTodos = [];
  try {
    const fileStream = fs3.createReadStream(transcriptPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        processEntry(entry, toolMap, agentMap, latestTodos, result);
      } catch {
      }
    }
  } catch {
  }
  result.tools = Array.from(toolMap.values()).slice(-20);
  result.agents = Array.from(agentMap.values()).slice(-10);
  result.todos = latestTodos;
  return result;
}
function processEntry(entry, toolMap, agentMap, latestTodos, result) {
  const timestamp = entry.timestamp ? new Date(entry.timestamp) : /* @__PURE__ */ new Date();
  if (!result.sessionStart && entry.timestamp) {
    result.sessionStart = timestamp;
  }
  const content = entry.message?.content;
  if (!content || !Array.isArray(content)) return;
  for (const block of content) {
    if (block.type === "tool_use" && block.id && block.name) {
      const toolEntry = {
        name: block.name,
        target: extractTarget(block.name, block.input),
        status: "running",
        startTime: timestamp
      };
      if (block.name === "Task") {
        const input = block.input;
        const agentEntry = {
          type: input?.subagent_type ?? "unknown",
          model: input?.model ?? void 0,
          description: input?.description ?? void 0,
          status: "running",
          startTime: timestamp
        };
        agentMap.set(block.id, agentEntry);
      } else if (block.name === "TodoWrite") {
        const input = block.input;
        if (input?.todos && Array.isArray(input.todos)) {
          latestTodos.length = 0;
          latestTodos.push(...input.todos);
        }
      } else {
        toolMap.set(block.id, toolEntry);
      }
    }
    if (block.type === "tool_result" && block.tool_use_id) {
      const tool = toolMap.get(block.tool_use_id);
      if (tool) {
        tool.status = block.is_error ? "error" : "completed";
        tool.endTime = timestamp;
      }
      const agent = agentMap.get(block.tool_use_id);
      if (agent) {
        agent.status = "completed";
        agent.endTime = timestamp;
      }
    }
  }
}
function extractTarget(toolName, input) {
  if (!input) return void 0;
  switch (toolName) {
    case "Read":
    case "Write":
    case "Edit":
      return input.file_path ?? input.path;
    case "Glob":
    case "Grep":
      return input.pattern;
    case "Bash": {
      const cmd = input.command;
      return cmd?.slice(0, 30) + (cmd?.length > 30 ? "..." : "");
    }
  }
  return void 0;
}

// scripts/statusline.ts
var CONFIG_PATH = join3(homedir3(), ".claude", "claude-dashboard.local.json");
var SEPARATOR = ` ${COLORS.dim}\u2502${RESET} `;
var EMOJIS = ["\u26A1\uFE0F", "\u{1F525}", "\u{1F451}", "\u{1F60E}", "\u{1F438}", "\u{1F984}", "\u{1F308}", "\u{1F680}", "\u{1F4A1}", "\u{1F389}", "\u{1F511}", "\u{1F319}"];
function getRandomEmoji() {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}
function getGodTag() {
  return `${COLORS.black}${COLORS.bgWhite}{god}${RESET}`;
}
async function readStdin() {
  try {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    const content = Buffer.concat(chunks).toString("utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
async function loadConfig() {
  try {
    const content = await readFile2(CONFIG_PATH, "utf-8");
    const userConfig = JSON.parse(content);
    return { ...DEFAULT_CONFIG, ...userConfig };
  } catch {
    return DEFAULT_CONFIG;
  }
}
function buildContextSection(input, t) {
  const parts = [];
  const godTag = getGodTag();
  const emoji = getRandomEmoji();
  const modelName = shortenModelName(input.model.display_name);
  parts.push(`${godTag} ${emoji} ${COLORS.cyan}${modelName}${RESET}`);
  const usage = input.context_window.current_usage;
  if (!usage) {
    parts.push(colorize(t.errors.no_context, COLORS.dim));
    return parts.join(SEPARATOR);
  }
  const currentTokens = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
  const totalTokens = input.context_window.context_window_size;
  const percent = calculatePercent(currentTokens, totalTokens);
  parts.push(renderProgressBar(percent));
  const percentColor = getColorForPercent(percent);
  parts.push(colorize(`${percent}%`, percentColor));
  parts.push(`${formatTokens(currentTokens)}/${formatTokens(totalTokens)}`);
  parts.push(colorize(formatCost(input.cost.total_cost_usd), COLORS.yellow));
  return parts.join(SEPARATOR);
}
function formatTimeCompact(resetAt) {
  const reset = typeof resetAt === "string" ? new Date(resetAt) : resetAt;
  const now = /* @__PURE__ */ new Date();
  const diffMs = reset.getTime() - now.getTime();
  if (diffMs <= 0) return "0m";
  const totalMinutes = Math.floor(diffMs / (1e3 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h${minutes}m`;
  }
  return `${minutes}m`;
}
function buildRateLimitsSection(limits, config, _t) {
  if (!limits) {
    return colorize("\u26A0\uFE0F", COLORS.yellow);
  }
  const parts = [];
  if (limits.five_hour) {
    const pct = Math.round(limits.five_hour.utilization);
    const color = getColorForPercent(pct);
    let text = `5h:${colorize(`${pct}%`, color)}`;
    if (limits.five_hour.resets_at) {
      const remaining = formatTimeCompact(limits.five_hour.resets_at);
      text += `(${remaining})`;
    }
    parts.push(text);
  }
  if (config.plan === "max") {
    if (limits.seven_day) {
      const pct = Math.round(limits.seven_day.utilization);
      const color = getColorForPercent(pct);
      parts.push(`7d:${colorize(`${pct}%`, color)}`);
    }
    if (limits.seven_day_sonnet) {
      const pct = Math.round(limits.seven_day_sonnet.utilization);
      const color = getColorForPercent(pct);
      parts.push(`7d-S:${colorize(`${pct}%`, color)}`);
    }
  }
  return parts.join(" ");
}
function formatSessionDuration(startTime) {
  const now = /* @__PURE__ */ new Date();
  const diffMs = now.getTime() - startTime.getTime();
  const totalMinutes = Math.floor(diffMs / (1e3 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h${minutes}m`;
  }
  return `${minutes}m`;
}
function truncatePath(filePath, maxLen = 20) {
  const name = basename(filePath);
  return name.length > maxLen ? name.slice(0, maxLen - 3) + "..." : name;
}
function truncate(text, maxLen) {
  return text.length > maxLen ? text.slice(0, maxLen - 3) + "..." : text;
}
function buildProjectLine(cwd, gitBranch, configCounts, sessionDuration) {
  if (!cwd) return null;
  const parts = [];
  const projectName = basename(cwd) || cwd;
  let projectPart = `\u{1F4C1} ${colorize(projectName, COLORS.yellow)}`;
  if (gitBranch) {
    projectPart += ` ${colorize("git:(", COLORS.magenta)}${colorize(gitBranch, COLORS.cyan)}${colorize(")", COLORS.magenta)}`;
  }
  parts.push(projectPart);
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
  if (sessionDuration) {
    parts.push(colorize(`\u23F1\uFE0F ${sessionDuration}`, COLORS.dim));
  }
  return parts.join(SEPARATOR);
}
function buildToolsLine(tools) {
  if (tools.length === 0) return null;
  const parts = [];
  const runningTools = tools.filter((t) => t.status === "running");
  for (const tool of runningTools.slice(-2)) {
    const target = tool.target ? truncatePath(tool.target) : "";
    parts.push(`${colorize("\u25D0", COLORS.yellow)} ${colorize(tool.name, COLORS.cyan)}${target ? colorize(`: ${target}`, COLORS.dim) : ""}`);
  }
  const completedTools = tools.filter((t) => t.status === "completed" || t.status === "error");
  const toolCounts = /* @__PURE__ */ new Map();
  for (const tool of completedTools) {
    const count = toolCounts.get(tool.name) ?? 0;
    toolCounts.set(tool.name, count + 1);
  }
  const sortedTools = Array.from(toolCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  for (const [name, count] of sortedTools) {
    parts.push(`${colorize("\u2713", COLORS.green)} ${name} ${colorize(`\xD7${count}`, COLORS.dim)}`);
  }
  return parts.length > 0 ? parts.join(" | ") : null;
}
function buildAgentsLine(agents) {
  const runningAgents = agents.filter((a) => a.status === "running");
  const recentCompleted = agents.filter((a) => a.status === "completed").slice(-2);
  const toShow = [...runningAgents, ...recentCompleted].slice(-3);
  if (toShow.length === 0) return null;
  const lines = [];
  for (const agent of toShow) {
    const statusIcon = agent.status === "running" ? colorize("\u25D0", COLORS.yellow) : colorize("\u2713", COLORS.green);
    const type = colorize(agent.type, COLORS.magenta);
    const model = agent.model ? colorize(`[${agent.model}]`, COLORS.dim) : "";
    const desc = agent.description ? colorize(`: ${truncate(agent.description, 40)}`, COLORS.dim) : "";
    const now = Date.now();
    const start = agent.startTime.getTime();
    const end = agent.endTime?.getTime() ?? now;
    const ms = end - start;
    let elapsed = "<1s";
    if (ms >= 1e3 && ms < 6e4) elapsed = `${Math.round(ms / 1e3)}s`;
    else if (ms >= 6e4) {
      const mins = Math.floor(ms / 6e4);
      const secs = Math.round(ms % 6e4 / 1e3);
      elapsed = `${mins}m${secs}s`;
    }
    lines.push(`${statusIcon} ${type}${model ? ` ${model}` : ""}${desc} ${colorize(`(${elapsed})`, COLORS.dim)}`);
  }
  return lines.join("\n");
}
function buildTodosLine(todos) {
  if (!todos || todos.length === 0) return null;
  const inProgress = todos.find((t) => t.status === "in_progress");
  const completed = todos.filter((t) => t.status === "completed").length;
  const total = todos.length;
  if (!inProgress) {
    if (completed === total && total > 0) {
      return `${colorize("\u2713", COLORS.green)} All todos complete ${colorize(`(${completed}/${total})`, COLORS.dim)}`;
    }
    return null;
  }
  const content = truncate(inProgress.content, 50);
  const progress = colorize(`(${completed}/${total})`, COLORS.dim);
  return `${colorize("\u25B8", COLORS.yellow)} ${content} ${progress}`;
}
async function main() {
  const config = await loadConfig();
  const t = getTranslations(config);
  const input = await readStdin();
  if (!input) {
    console.log(colorize("\u26A0\uFE0F", COLORS.yellow));
    return;
  }
  const cwd = input.cwd || input.workspace?.current_dir;
  const [limits, gitBranch, configCounts, transcriptData] = await Promise.all([
    fetchUsageLimits(config.cache.ttlSeconds),
    getGitBranch(cwd),
    countConfigs(cwd),
    input.transcript_path ? parseTranscript(input.transcript_path) : Promise.resolve({ tools: [], agents: [], todos: [] })
  ]);
  const sessionDuration = transcriptData.sessionStart ? formatSessionDuration(transcriptData.sessionStart) : void 0;
  const lines = [];
  const contextSection = buildContextSection(input, t);
  const rateLimitsSection = buildRateLimitsSection(limits, config, t);
  const mainLine = [contextSection, rateLimitsSection].filter(Boolean).join(SEPARATOR);
  lines.push(mainLine);
  const projectLine = buildProjectLine(cwd, gitBranch, configCounts, sessionDuration);
  if (projectLine) lines.push(projectLine);
  const toolsLine = buildToolsLine(transcriptData.tools);
  if (toolsLine) lines.push(toolsLine);
  const agentsLine = buildAgentsLine(transcriptData.agents);
  if (agentsLine) lines.push(agentsLine);
  const todosLine = buildTodosLine(transcriptData.todos);
  if (todosLine) lines.push(todosLine);
  for (const line of lines) {
    console.log(line);
  }
}
main().catch(() => {
  console.log(colorize("\u26A0\uFE0F", COLORS.yellow));
});
