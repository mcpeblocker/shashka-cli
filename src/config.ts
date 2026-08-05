import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface ShashkaConfig {
  token?: string;
  name?: string;
  serverUrl: string;
}

const CONFIG_DIR = join(homedir(), '.shashka');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULT_URL = process.env['SHASHKA_SERVER_URL'] ?? 'https://shashka.uz';

export function loadConfig(): ShashkaConfig {
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ShashkaConfig>;
    return { serverUrl: DEFAULT_URL, ...parsed };
  } catch {
    return { serverUrl: DEFAULT_URL };
  }
}

export function saveConfig(config: ShashkaConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

export function clearAuth(config: ShashkaConfig): ShashkaConfig {
  const next = { ...config };
  delete next.token;
  delete next.name;
  return next;
}
