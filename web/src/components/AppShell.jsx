import { NavLink, Outlet, Link } from 'react-router-dom';
import { BellIcon, BookmarkIcon, HomeIcon, UserIcon } from './Icons.jsx';
import { useNotifications } from '../context/NotificationsContext.jsx';

const NAV = [
  { to: '/', label: 'Search', Icon: HomeIcon, end: true },
  { to: '/watchlist', label: 'Watchlist', Icon: BookmarkIcon },
  { to: '/alerts', label: 'Alerts', Icon: BellIcon, badge: true },
  { to: '/account', label: 'Account', Icon: UserIcon },
];

function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="absolute -top-1 -right-2 min-w-4 rounded-full bg-critical px-1 text-[10px] leading-4 font-bold text-white">
      {count > 9 ? '9+' : count}
    </span>
  );
}

/**
 * Mobile-first chrome: a bottom tab bar on phones, a top bar from `md` up.
 */
export function AppShell() {
  const { unreadCount } = useNotifications();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-plane/85 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src="/icon-192.png" alt="" className="h-7 w-7 rounded-lg" />
            <span className="text-lg font-bold tracking-tight text-ink">PriceScout</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map(({ to, label, Icon, end, badge }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:text-ink'
                  }`
                }
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {badge && <Badge count={unreadCount} />}
                </span>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-28 md:pb-10">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-plane/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Main"
      >
        <ul className="mx-auto flex max-w-4xl">
          {NAV.map(({ to, label, Icon, end, badge }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                    isActive ? 'text-brand' : 'text-ink-2'
                  }`
                }
              >
                <span className="relative">
                  <Icon className="h-6 w-6" />
                  {badge && <Badge count={unreadCount} />}
                </span>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
