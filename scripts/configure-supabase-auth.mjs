import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';

export const siteUrl = 'https://newyorkcity-kappa.vercel.app';

export function authSettings(current) {
  const redirects = String(current.uri_allow_list || '').split(',').map(s => s.trim()).filter(Boolean);
  return {
    site_url: siteUrl,
    uri_allow_list: [...new Set([...redirects, siteUrl, `${siteUrl}/auth/callback`])].join(','),
  };
}

async function main() {
  const env = {};
  for (const file of ['.env.local', '.env.production', '.env.supabase-admin']) {
    try {
      for (const [key, value] of Object.entries(parseEnv(await readFile(file, 'utf8'))))
        if (value) env[key] = value;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const token = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('Save SUPABASE_ACCESS_TOKEN in the ignored .env.supabase-admin file.');
  const projectUrl = process.env.SUPABASE_URL || env.SUPABASE_URL;
  if (!projectUrl) throw new Error('Set SUPABASE_URL to the project used by the live website.');
  const project = new URL(projectUrl).hostname.split('.')[0];
  if (!/^[a-z0-9]{20}$/.test(project)) throw new Error('Expected a hosted Supabase project URL.');
  const endpoint = `https://api.supabase.com/v1/projects/${project}/config/auth`;
  async function request(method = 'GET', body) {
    const response = await fetch(endpoint, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      const message = JSON.stringify(detail.message || detail.error || 'No details provided').replaceAll(token, '[redacted]');
      throw new Error(`Supabase Auth configuration ${method} failed (${response.status}): ${message.slice(0, 1500)}`);
    }
    return response.json();
  }
  const current = await request();
  const desired = authSettings(current);
  const update = desired;
  if (process.argv.includes('--apply')) {
    await mkdir('.data', { recursive: true });
    // Save only the settings being changed; the full response can contain SMTP secrets.
    await writeFile(`.data/supabase-auth-before-${Date.now()}.json`, JSON.stringify(
      Object.fromEntries(Object.keys(update).map(key => [key, current[key]])), null, 2));
    await request('PATCH', update);
  }
  const actual = await request();
  const checks = Object.fromEntries(Object.entries(desired).map(([key, value]) => [key, actual[key] === value]));
  const report = { checkedAt: new Date().toISOString(), siteUrl: actual.site_url, checks,
    googleEnabled: !!actual.external_google_enabled,
    googleClientConfigured: !!actual.external_google_client_id && !!actual.external_google_secret,
    customSmtp: !!actual.smtp_host, emailRateLimit: actual.rate_limit_email_sent,
    magicLinkTemplate: /\{\{\s*\.ConfirmationURL\s*\}\}/.test(actual.mailer_templates_magic_link_content || ''),
    signupLinkTemplate: /\{\{\s*\.ConfirmationURL\s*\}\}/.test(actual.mailer_templates_confirmation_content || '') };
  await mkdir('artifacts/audit', { recursive: true });
  await writeFile('artifacts/audit/supabase-auth-config.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (Object.keys(update).some(key => !checks[key])) throw new Error('Supabase email configuration does not match the requested settings.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
