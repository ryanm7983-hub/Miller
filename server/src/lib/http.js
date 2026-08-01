import { ProviderError } from '../providers/PriceProvider.js';

/**
 * fetch + JSON + timeout, with upstream failures normalized into ProviderError
 * so the provider registry can degrade gracefully.
 *
 * @param {string} url
 * @param {{ timeoutMs?: number, provider?: string, headers?: Record<string,string> }} [opts]
 */
export async function fetchJson(url, opts = {}) {
  const { timeoutMs = 12000, provider = 'unknown', headers = {} } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json', ...headers },
    });
  } catch (cause) {
    const aborted = cause?.name === 'AbortError';
    throw new ProviderError(
      aborted ? `${provider} request timed out after ${timeoutMs}ms` : `${provider} request failed`,
      { provider, retryable: true, cause },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ProviderError(
      `${provider} responded ${response.status}: ${body.slice(0, 300)}`,
      { provider, status: response.status, retryable: response.status >= 500 || response.status === 429 },
    );
  }

  try {
    return await response.json();
  } catch (cause) {
    throw new ProviderError(`${provider} returned malformed JSON`, { provider, cause });
  }
}
