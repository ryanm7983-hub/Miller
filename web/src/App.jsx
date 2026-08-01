import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell.jsx';
import { SearchPage } from './pages/SearchPage.jsx';
import { ProductPage } from './pages/ProductPage.jsx';
import { WatchlistPage } from './pages/WatchlistPage.jsx';
import { AlertsPage } from './pages/AlertsPage.jsx';
import { AccountPage } from './pages/AccountPage.jsx';

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<SearchPage />} />
        <Route path="product/:id" element={<ProductPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
