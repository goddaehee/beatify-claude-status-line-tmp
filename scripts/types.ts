/**
 * Stdin JSON input from Claude Code
 */
export interface StdinInput {
  model: {
    id: string;
    display_name: string;
  };
  workspace: {
    current_dir: string;
  };
  context_window: {
    total_input_tokens: number;
    total_output_tokens: number;
    context_window_size: number;
    current_usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    } | null;
  };
  cost: {
    total_cost_usd: number;
  };
  cwd?: string;
  transcript_path?: string;
}

/**
 * User configuration stored in ~/.claude/claude-dashboard.local.json
 */
export interface Config {
  language: 'en' | 'ko' | 'auto';
  plan: 'pro' | 'max';
  cache: {
    ttlSeconds: number;
  };
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: Config = {
  language: 'auto',
  plan: 'max',
  cache: {
    ttlSeconds: 60,
  },
};

/**
 * Translations interface
 */
export interface Translations {
  model: {
    opus: string;
    sonnet: string;
    haiku: string;
  };
  labels: {
    '5h': string;
    '7d': string;
    '7d_all': string;
    '7d_sonnet': string;
  };
  time: {
    hours: string;
    minutes: string;
  };
  errors: {
    no_context: string;
  };
}

/**
 * API Rate Limits from oauth/usage endpoint
 */
export interface UsageLimits {
  five_hour: {
    utilization: number;
    resets_at: string | null;
  } | null;
  seven_day: {
    utilization: number;
    resets_at: string | null;
  } | null;
  seven_day_sonnet: {
    utilization: number;
    resets_at: string | null;
  } | null;
}

/**
 * Cache entry for API responses
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Config counts for project info line
 */
export interface ConfigCounts {
  claudeMdCount: number;
  rulesCount: number;
  mcpCount: number;
  hooksCount: number;
}

/**
 * Tool entry from transcript
 */
export interface ToolEntry {
  name: string;
  target?: string;
  status: 'running' | 'completed' | 'error';
  startTime: Date;
  endTime?: Date;
}

/**
 * Agent entry from transcript
 */
export interface AgentEntry {
  type: string;
  model?: string;
  description?: string;
  status: 'running' | 'completed';
  startTime: Date;
  endTime?: Date;
}

/**
 * Todo entry from transcript
 */
export interface TodoEntry {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

/**
 * Parsed transcript data
 */
export interface TranscriptData {
  sessionStart?: Date;
  tools: ToolEntry[];
  agents: AgentEntry[];
  todos: TodoEntry[];
}
