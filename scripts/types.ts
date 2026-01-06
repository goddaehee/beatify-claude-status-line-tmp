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
