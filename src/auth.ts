import { execFile } from 'node:child_process';
import { platform } from 'node:os';
import https from 'node:https';
import http from 'node:http';

function openBrowser(url: string): void {
  const os = platform();
  if (os === 'win32') {
    execFile('cmd', ['/c', 'start', '', url], () => {});
  } else if (os === 'darwin') {
    execFile('open', [url], () => {});
  } else {
    execFile('xdg-open', [url], () => {});
  }
}

export function fetchJSON<T>(
  url: string,
  options: { method?: string; body?: string; token?: string } = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const headers: Record<string, string | number> = {};
    if (options.body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(options.body);
    }
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || undefined,
        path: u.pathname + u.search,
        method: options.method ?? 'GET',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as T);
          } catch (e) {
            reject(new Error(`Invalid JSON from ${url}: ${data.slice(0, 200)}`));
          }
        });
      },
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

export async function login(serverUrl: string): Promise<{ name: string; token: string }> {
  const { sessionId, verificationUrl } = await fetchJSON<{
    sessionId: string;
    verificationUrl: string;
  }>(`${serverUrl}/api/auth/session`, { method: 'POST', body: '{}' });

  console.log(`\nOpen this URL in your browser to log in:\n\n  ${verificationUrl}\n`);
  console.log('Waiting for browser confirmation', { end: '' });

  openBrowser(verificationUrl);

  // Poll every 2 s, max 5 min (150 attempts)
  for (let i = 0; i < 150; i++) {
    await new Promise<void>((r) => setTimeout(r, 2000));
    process.stdout.write('.');
    try {
      const { status, token, name } = await fetchJSON<{
        status: string;
        token?: string;
        name?: string;
      }>(`${serverUrl}/api/auth/poll/${sessionId}`);
      if (status === 'approved' && token && name) {
        process.stdout.write('\n');
        return { name, token };
      }
    } catch {
      // ignore transient network errors while polling
    }
  }
  process.stdout.write('\n');
  throw new Error('Login timed out (5 minutes). Try again.');
}

export async function logout(serverUrl: string, token: string): Promise<void> {
  try {
    await fetchJSON(`${serverUrl}/api/auth/token/${token}`, { method: 'DELETE', token });
  } catch {
    // best-effort
  }
}
