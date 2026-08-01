import { Link } from 'react-router-dom';
import { BellIcon, ExternalIcon, Spinner } from '../components/Icons.jsx';
import { money, relativeTime } from '../lib/format.js';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const TYPE_LABELS = {
  target_hit: 'Target reached',
  all_time_low: 'All-time low',
  below_average: 'Below average',
  price_drop: 'Price drop',
};

export function AlertsPage() {
  const { user, ready } = useAuth();
  const { items, unreadCount, loading, markRead, markAllRead } = useNotifications();

  if (!ready) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
        <Spinner /> Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="card p-6 text-center">
        <h1 className="text-lg font-bold text-ink">Alerts</h1>
        <p className="mt-1 text-sm text-ink-2">
          Sign in to get notified when a tracked product hits your target price.
        </p>
        <Link to="/account" className="btn-primary mt-4">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-ink">
          Alerts
          {unreadCount > 0 && <span className="ml-2 text-sm font-medium text-brand">{unreadCount} new</span>}
        </h1>
        {unreadCount > 0 && (
          <button type="button" onClick={markAllRead} className="btn-ghost px-3 py-1.5 text-xs">
            Mark all read
          </button>
        )}
      </div>

      {loading && items.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
          <Spinner /> Loading alerts…
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="card p-6 text-center">
          <BellIcon className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-2 text-sm text-ink-2">
            No alerts yet. Set a target price on a tracked product and we'll tell you the moment it
            drops.
          </p>
          <Link to="/watchlist" className="btn-secondary mt-4">
            View watchlist
          </Link>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((notification) => (
          <li
            key={notification.id}
            className={`card p-4 ${notification.read ? '' : 'ring-2 ring-brand/40'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                  {notification.title}
                  <span className="chip bg-surface-2 text-[11px] text-ink-2">
                    {TYPE_LABELS[notification.type] ?? notification.type}
                  </span>
                </p>
                <p className="mt-1 text-sm text-ink-2">{notification.body}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {relativeTime(notification.createdAt)}
                  {notification.emailed ? ' · emailed' : ''}
                </p>
              </div>
              <p className="tabular shrink-0 text-right text-base font-bold text-ink">
                {money(notification.priceCents)}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {notification.productId && (
                <Link
                  to={`/product/${notification.productId}`}
                  className="btn-secondary px-3 py-1.5 text-xs"
                >
                  View product
                </Link>
              )}
              {notification.url && (
                <a
                  href={notification.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="btn-secondary px-3 py-1.5 text-xs"
                >
                  Buy at {notification.retailer}
                  <ExternalIcon className="h-3.5 w-3.5" />
                </a>
              )}
              {!notification.read && (
                <button
                  type="button"
                  onClick={() => markRead(notification.id)}
                  className="btn-ghost px-3 py-1.5 text-xs"
                >
                  Mark read
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
