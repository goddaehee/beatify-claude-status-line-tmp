/**
 * ANSI color codes for terminal output
 */
export const COLORS = {
  // Reset
  reset: '\x1b[0m',

  // Styles
  dim: '\x1b[2m',
  bold: '\x1b[1m',

  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Bright variants
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightCyan: '\x1b[96m',

  // Background colors
  bgWhite: '\x1b[47m',
  black: '\x1b[30m',
} as const;

export const RESET = COLORS.reset;

/**
 * Get color based on percentage (for progress bar and rate limits)
 * 0-50%: green (safe)
 * 51-80%: yellow (warning)
 * 81-100%: red (danger)
 */
export function getColorForPercent(percent: number): string {
  if (percent <= 50) return COLORS.green;
  if (percent <= 80) return COLORS.yellow;
  return COLORS.red;
}

/**
 * Wrap text with color and auto-reset
 */
export function colorize(text: string, color: string): string {
  return `${color}${text}${RESET}`;
}
