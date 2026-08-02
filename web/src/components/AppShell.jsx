import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Bookmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Search,
  Settings,
  Sun,
  TrendingDown,
  User,
  X,
} from 'lucide-react';
import { Button } from './ui/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationsContext.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/watchlist', label: 'Watchlist', icon: Bookmark },
  { to: '/alerts', label: 'Alerts', icon: Bell, badge: true },
  { to: '/account', label: 'Settings', icon: Settings },
];

const THEME_KEY = 'pricescout.theme';
const THEMES = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) ?? 'system';
    } catch {
      return 'system';
    }
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* private mode — the choice just won't persist */
    }
  }, [theme]);

  return [theme, setTheme];
}

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-lg">
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-primary text-white shadow-[var(--ps-shadow-primary)]">
        <TrendingDown className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden="true" />
      </span>
      <span className="text-[17px] font-bold tracking-tight text-ink">PriceScout</span>
    </Link>
  );
}

function NavBadge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white tabular">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function SidebarLinks({ unreadCount, onNavigate }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV.map(({ to, label, icon: Icon, end, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors duration-150 ${
              isActive
                ? 'bg-primary-wash text-primary'
                : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-primary' : 'text-muted group-hover:text-ink-2'}`}
                aria-hidden="true"
              />
              {label}
              {badge && <NavBadge count={unreadCount} />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function ThemeToggle({ theme, setTheme }) {
  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="flex items-center gap-0.5 rounded-xl bg-surface-2 p-1"
    >
      {THEMES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          title={label}
          className={`grid h-7 flex-1 place-items-center rounded-lg transition-all duration-150 ${
            theme === value
              ? 'bg-surface text-ink shadow-xs ring-1 ring-border'
              : 'text-muted hover:text-ink'
          }`}
        >
          <Icon className="h-[15px] w-[15px]" aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}

function UserMenu({ user, logout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!ref.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!user) {
    return (
      <Link to="/account" className="no-underline">
        <Button variant="primary" size="sm">
          Sign in
        </Button>
      </Link>
    );
  }

  const initial = user.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors hover:bg-surface-2"
      >
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-[13px] font-bold text-white">
          {initial}
        </span>
        <span className="hidden max-w-32 truncate text-[13px] font-medium text-ink-2 lg:block">
          {user.email}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="animate-scale-in absolute right-0 z-40 mt-2 w-56 origin-top-right rounded-2xl bg-elevated p-1.5 shadow-lg ring-1 ring-border"
        >
          <div className="px-3 py-2">
            <p className="text-label text-muted">Signed in as</p>
            <p className="truncate text-[13px] font-semibold text-ink">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link
            to="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-ink-2 no-underline transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <User className="h-4 w-4" aria-hidden="true" />
            Account settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-danger-text transition-colors hover:bg-danger-wash"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * App chrome: a persistent sidebar from `lg`, a sticky top bar with global
 * search everywhere, and a tab bar on phones. The drawer and the tab bar are
 * the same nav, so nothing is reachable on one breakpoint and not the other.
 */
export function AppShell() {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [theme, setTheme] = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  function submitSearch(event) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    setQuery('');
    event.target.querySelector('input')?.blur();
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface px-4 py-5 lg:flex">
        <div className="px-1">
          <Wordmark />
        </div>

        <div className="mt-7 flex-1">
          <p className="text-label mb-2 px-3 text-muted">Menu</p>
          <SidebarLinks unreadCount={unreadCount} />
        </div>

        <div className="flex flex-col gap-3">
          <ThemeToggle theme={theme} setTheme={setTheme} />
          {!user && (
            <Link to="/account" className="no-underline">
              <Button variant="primary" size="md" className="w-full">
                Sign in
              </Button>
            </Link>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border bg-surface">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="lg:hidden">
              <Wordmark />
            </div>

            <form onSubmit={submitSearch} role="search" className="relative ml-auto hidden flex-1 sm:block lg:ml-0">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products, paste a link…"
                aria-label="Search products"
                className="h-10 w-full max-w-md rounded-xl bg-surface-2 pr-3.5 pl-10 text-[13.5px] text-ink outline-none transition-shadow duration-150 placeholder:text-muted focus:bg-surface focus:ring-2 focus:ring-primary"
              />
            </form>

            <div className="ml-auto flex items-center gap-1 sm:ml-0">
              <Link
                to="/alerts"
                aria-label={unreadCount ? `Alerts, ${unreadCount} unread` : 'Alerts'}
                className="relative grid h-10 w-10 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white tabular">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <UserMenu user={user} logout={logout} />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:pb-12">
          <Outlet />
        </main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
          />
          <div className="animate-scale-in absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-surface px-4 py-5 shadow-lg">
            <div className="flex items-center justify-between">
              <Wordmark />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="grid h-9 w-9 place-items-center rounded-xl text-ink-2 hover:bg-surface-2"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-7 flex-1">
              <SidebarLinks unreadCount={unreadCount} onNavigate={() => setDrawerOpen(false)} />
            </div>
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        </div>
      )}

      {/* Mobile tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 transform-gpu border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Main"
      >
        <ul className="mx-auto flex max-w-lg">
          {NAV.filter((item) => item.to !== '/account').map(({ to, label, icon: Icon, end, badge }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold transition-colors ${
                    isActive ? 'text-primary' : 'text-ink-3'
                  }`
                }
              >
                <span className="relative">
                  <Icon className="h-[21px] w-[21px]" aria-hidden="true" />
                  {badge && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white tabular">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
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
