import fs from 'fs';
import type { UsageLimits, CacheEntry } from '../types.js';
import { getCredentials } from './credentials.js';

const API_TIMEOUT_MS = 5000;
const CACHE_FILE = '/tmp/claude-dashboard-cache.json';

/**
 * In-memory cache for API responses
 */
let usageCache: CacheEntry<UsageLimits> | null = null;

/**
 * Check if cache is still valid
 */
function isCacheValid(ttlSeconds: number): boolean {
  if (!usageCache) return false;
  const ageSeconds = (Date.now() - usageCache.timestamp) / 1000;
  return ageSeconds < ttlSeconds;
}

/**
 * Fetch usage limits from Anthropic API
 *
 * @param ttlSeconds - Cache TTL in seconds (default: 60)
 * @returns Usage limits or null if failed
 */
export async function fetchUsageLimits(ttlSeconds: number = 60): Promise<UsageLimits | null> {
  // Check cache first
  if (isCacheValid(ttlSeconds) && usageCache) {
    return usageCache.data;
  }

  // Try to load from file cache (for persistence across calls)
  const fileCache = await loadFileCache(ttlSeconds);
  if (fileCache) {
    usageCache = { data: fileCache, timestamp: Date.now() };
    return fileCache;
  }

  // Fetch from API
  const token = await getCredentials();
  if (!token) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const response = await fetch('https://api.anthropic.com/api/oauth/usage', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'claude-dashboard/1.0.0',
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    const limits: UsageLimits = {
      five_hour: data.five_hour ?? null,
      seven_day: data.seven_day ?? null,
      seven_day_sonnet: data.seven_day_sonnet ?? null,
    };

    // Update caches
    usageCache = { data: limits, timestamp: Date.now() };
    await saveFileCache(limits);

    return limits;
  } catch {
    return null;
  }
}

/**
 * Load cache from file
 */
async function loadFileCache(ttlSeconds: number): Promise<UsageLimits | null> {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;

    const content = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    const ageSeconds = (Date.now() - content.timestamp) / 1000;

    if (ageSeconds < ttlSeconds) {
      return content.data as UsageLimits;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save cache to file
 */
async function saveFileCache(data: UsageLimits): Promise<void> {
  try {
    fs.writeFileSync(
      CACHE_FILE,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Clear cache (useful for testing)
 */
export function clearCache(): void {
  usageCache = null;
}
