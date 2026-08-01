import { config } from '../config.js';

/**
 * Email delivery via Resend. Entirely optional: without `RESEND_API_KEY` we log
 * and return false, and alerts still land in the in-app notification centre.
 *
 * Swap the fetch below for SendGrid/Postmark/SES by changing this one function.
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!config.mail.resendApiKey) {
    console.log(`[mail] (not configured) would email ${to}: ${subject}`);
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.mail.resendApiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: config.mail.from,
        to: [to],
        subject,
        html,
        text,
      }),
    });
    if (!response.ok) {
      console.warn(`[mail] Resend responded ${response.status}: ${await response.text()}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[mail] send failed:', error.message);
    return false;
  }
}

export function priceAlertEmail({ productTitle, productId, retailer, priceText, reason }) {
  const url = `${config.mail.appUrl.replace(/\/$/, '')}/product/${productId}`;
  const text = `${productTitle}\n${reason}\nNow ${priceText} at ${retailer}\n\n${url}`;
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px">
      <h2 style="margin:0 0 4px">${escapeHtml(productTitle)}</h2>
      <p style="color:#475569;margin:0 0 16px">${escapeHtml(reason)}</p>
      <p style="font-size:28px;font-weight:700;margin:0">${escapeHtml(priceText)}</p>
      <p style="color:#475569;margin:4px 0 20px">at ${escapeHtml(retailer)} (total incl. shipping)</p>
      <a href="${url}" style="background:#0f766e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">View in PriceScout</a>
    </div>`;
  return { text, html };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
