import { Link } from 'react-router-dom';
import { Bell, BellOff, Check, ExternalLink, TrendingDown } from 'lucide-react';
import { Card, Badge, EmptyState, Skeleton } from '../components/ui/Primitives.jsx';
import { Button, ButtonLink } from '../components/ui/Button.jsx';
import { money, relativeTime } from '../lib/format.js';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';

const TYPES = {
  target_hit: { label: 'Target reached', tone: 'success', icon: Check },
  all_time_low: { label: 'All-time low', tone: 'success', icon: TrendingDown },
  below_average: { label: 'Below average', tone: 'primary', icon: TrendingDown },
  price_drop: { label: 'Price drop', tone: 'primary', icon: TrendingDown },
};

export function AlertsPage() {
  const { user, ready } = useAuth();
  const { items, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const toast = useToast();

  if (!ready) return <AlertsSkeleton />;

  if (!user) {
    return (
      <Card>
        <EmptyState
          icon={Bell}
          title="Alerts need an account"
          description="Sign in so we can tell you when a tracked product hits your target price."
          action={
            <Link to="/account" className="no-underline">
              <Button variant="primary">Sign in</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title text-ink">Alerts</h1>
          <p className="text-help mt-0.5 text-ink-3">
            {unreadCount > 0
              ? `${unreadCount} unread of ${items.length}`
              : `${items.length} ${items.length === 1 ? 'alert' : 'alerts'}`}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              markAllRead();
              toast.success('All alerts marked read');
            }}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Mark all read
          </Button>
        )}
      </header>

      {loading && items.length === 0 && <AlertsSkeleton bare />}

      {!loading && items.length === 0 && (
        <Card>
          <EmptyState
            icon={BellOff}
            title="No alerts yet"
            description="Track a product and set a target price. The moment any retailer drops to it, you'll hear about it here."
            action={
              <Link to="/watchlist" className="no-underline">
                <Button variant="primary">Go to watchlist</Button>
              </Link>
            }
          />
        </Card>
      )}

      <ul className="space-y-2.5">
        {items.map((notification, index) => {
          const type = TYPES[notification.type] ?? { label: notification.type, tone: 'neutral' };
          return (
            <li
              key={notification.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(index * 35, 180)}ms` }}
            >
              <Card className={`p-4 ${notification.read ? '' : 'ring-2 ring-primary/30'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {!notification.read && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-primary"
                          aria-label="Unread"
                        />
                      )}
                      <h2 className="text-[14px] font-semibold text-ink">{notification.title}</h2>
                      <Badge tone={type.tone} icon={type.icon}>
                        {type.label}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
                      {notification.body}
                    </p>
                    <p className="text-help mt-1.5 text-muted">
                      {relativeTime(notification.createdAt)}
                      {notification.emailed ? ' · emailed' : ''}
                    </p>
                  </div>
                  <p className="tabular shrink-0 text-[16px] font-bold text-ink">
                    {money(notification.priceCents)}
                  </p>
                </div>

                <div className="mt-3.5 flex flex-wrap gap-2">
                  {notification.productId && (
                    <Link to={`/product/${notification.productId}`} className="no-underline">
                      <Button variant="secondary" size="sm">
                        View product
                      </Button>
                    </Link>
                  )}
                  {notification.url && (
                    <ButtonLink
                      href={notification.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      variant="primary"
                      size="sm"
                    >
                      Buy at {notification.retailer}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </ButtonLink>
                  )}
                  {!notification.read && (
                    <Button variant="ghost" size="sm" onClick={() => markRead(notification.id)}>
                      Mark read
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AlertsSkeleton({ bare = false }) {
  const list = (
    <ul className="space-y-2.5">
      {Array.from({ length: 3 }).map((_, index) => (
        <li key={index}>
          <Card className="p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2.5 h-3 w-full" />
            <Skeleton className="mt-1.5 h-3 w-2/3" />
            <Skeleton className="mt-4 h-8 w-32 rounded-lg" />
          </Card>
        </li>
      ))}
    </ul>
  );

  if (bare) return list;

  return (
    <div className="space-y-5">
      <Skeleton className="h-7 w-28" />
      {list}
    </div>
  );
}
