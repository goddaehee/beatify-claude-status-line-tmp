import { execFileSync } from 'child_process';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Get OAuth access token from Claude Code credentials
 *
 * On macOS: Reads from Keychain
 * On Linux/Windows: Reads from ~/.claude/.credentials.json
 *
 * @returns Access token or null if not found
 */
export async function getCredentials(): Promise<string | null> {
  try {
    if (process.platform === 'darwin') {
      return await getCredentialsFromKeychain();
    }
    return await getCredentialsFromFile();
  } catch {
    return null;
  }
}

/**
 * Get credentials from macOS Keychain
 */
async function getCredentialsFromKeychain(): Promise<string | null> {
  try {
    const result = execFileSync(
      'security',
      ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    const creds = JSON.parse(result);
    return creds?.claudeAiOauth?.accessToken ?? null;
  } catch {
    // Fallback to file if Keychain fails
    return await getCredentialsFromFile();
  }
}

/**
 * Get credentials from file (~/.claude/.credentials.json)
 */
async function getCredentialsFromFile(): Promise<string | null> {
  try {
    const credPath = join(homedir(), '.claude', '.credentials.json');
    const content = await readFile(credPath, 'utf-8');
    const creds = JSON.parse(content);
    return creds?.claudeAiOauth?.accessToken ?? null;
  } catch {
    return null;
  }
}
