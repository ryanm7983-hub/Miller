const formatters = new Map();

function formatter(currency) {
  if (!formatters.has(currency)) {
    formatters.set(
      currency,
      new Intl.NumberFormat('en-US', { style: 'currency', currency }),
    );
  }
  return formatters.get(currency);
}

export function money(cents, currency = 'USD') {
  if (cents == null || Number.isNaN(cents)) return '—';
  return formatter(currency).format(cents / 100);
}

/** Compact axis form: $310, $1.3k */
export function moneyShort(cents) {
  if (cents == null) return '';
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(dollars >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(dollars)}`;
}

export function parseMoneyToCents(input) {
  const match = String(input ?? '').replace(/[, ]/g, '').match(/\d+(\.\d+)?/);
  if (!match) return null;
  return Math.round(Number.parseFloat(match[0]) * 100);
}

export function shortDate(value) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function longDate(value) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function relativeTime(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return longDate(iso);
}
