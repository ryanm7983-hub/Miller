import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { App } from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { NotificationsProvider } from './context/NotificationsContext.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';

// Apply the saved theme before first paint so there is no flash of the wrong one.
try {
  const theme = localStorage.getItem('pricescout.theme');
  if (theme && theme !== 'system') document.documentElement.setAttribute('data-theme', theme);
} catch {
  /* private mode */
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <NotificationsProvider>
            <App />
          </NotificationsProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
