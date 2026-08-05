import 'server-only';

import { env } from '@/lib/env';

/**
 * Email abstraction.
 *
 * The default `console` provider writes messages to the server log so
 * notification flows are fully exercisable in development. Adding a real
 * provider means implementing `EmailProvider` and registering it below — no
 * caller changes.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body. HTML is generated from this by the providers. */
  text: string;
  /** Optional single call-to-action. */
  action?: { label: string; url: string };
}

export interface EmailProvider {
  readonly name: string;
  readonly deliversRealEmail: boolean;
  send(message: EmailMessage): Promise<{ ok: boolean; detail?: string }>;
}

function renderHtml(message: EmailMessage): string {
  const paragraphs = message.text
    .split('\n\n')
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;color:#3A4353">${escapeHtml(p)}</p>`)
    .join('');

  const button = message.action
    ? `<a href="${escapeHtml(message.action.url)}" style="display:inline-block;background:#0B806E;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px">${escapeHtml(
        message.action.label
      )}</a>`
    : '';

  return `<!doctype html><html><body style="margin:0;background:#F7F8FA;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="font-weight:700;font-size:17px;color:#0B1017;margin-bottom:24px">AuditReady</div>
    <div style="background:#fff;border:1px solid #E2E6EC;border-radius:14px;padding:28px">
      <h1 style="margin:0 0 18px;font-size:19px;color:#151B26">${escapeHtml(message.subject)}</h1>
      ${paragraphs}
      ${button}
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:#6B7788;line-height:1.6">
      You are receiving this because you are a member of an organization on AuditReady.
      AuditReady is a preparedness tool and does not constitute certification, legal advice or a compliance determination.
    </p>
  </div></body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';
  readonly deliversRealEmail = false;

  async send(message: EmailMessage) {
    console.info(
      `\n──── EMAIL (console provider — not delivered) ────\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}${
        message.action ? `\n\n${message.action.label}: ${message.action.url}` : ''
      }\n─────────────────────────────────────────────────\n`
    );
    return { ok: true, detail: 'Logged to the server console.' };
  }
}

/**
 * Generic HTTP provider: works with Resend, Postmark and any service that
 * accepts a JSON POST. Configure EMAIL_API_URL, EMAIL_API_KEY and optionally
 * EMAIL_PAYLOAD_STYLE (`resend` | `postmark`).
 */
class HttpEmailProvider implements EmailProvider {
  readonly name = 'http';
  readonly deliversRealEmail = true;

  async send(message: EmailMessage) {
    const url = process.env.EMAIL_API_URL;
    const key = process.env.EMAIL_API_KEY;
    if (!url || !key) {
      return { ok: false, detail: 'EMAIL_API_URL and EMAIL_API_KEY must be set for the http provider.' };
    }

    const style = process.env.EMAIL_PAYLOAD_STYLE ?? 'resend';
    const html = renderHtml(message);
    const body =
      style === 'postmark'
        ? { From: env.emailFrom, To: message.to, Subject: message.subject, TextBody: message.text, HtmlBody: html }
        : { from: env.emailFrom, to: message.to, subject: message.subject, text: message.text, html };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (style === 'postmark') headers['X-Postmark-Server-Token'] = key;
    else headers.Authorization = `Bearer ${key}`;

    try {
      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!response.ok) {
        return { ok: false, detail: `Provider returned ${response.status}: ${await response.text()}` };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, detail: (error as Error).message };
    }
  }
}

let providerInstance: EmailProvider | null = null;

export function email(): EmailProvider {
  if (providerInstance) return providerInstance;
  providerInstance = env.emailProvider === 'http' ? new HttpEmailProvider() : new ConsoleEmailProvider();
  return providerInstance;
}

export async function sendEmail(message: EmailMessage) {
  const result = await email().send(message);
  if (!result.ok) console.error('[email] delivery failed:', result.detail);
  return result;
}
