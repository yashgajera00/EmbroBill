import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import authAPI from './services/authAPI';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Settings from './pages/Settings';
import InvoiceHistory from './pages/InvoiceHistory';
import CreateInvoice from './pages/CreateInvoice';
import CreateChallan from './pages/CreateChallan';
import Dashboard from './pages/Dashboard';
import AppHome from './pages/AppHome';
import PillToast from './components/PillToast';
import ErrorBoundary from './components/ErrorBoundary';
import logoIcon from './assets/AZ9wkv0NsH70gxShuXaHxw-AZ9wkxSG6wPW_b0quuXlFw (1).png';
import logoText from './assets/EmbroBill.png';

// Protected Route wrapper component
function ProtectedRoute({ user, loading }) {
  if (loading) {
    return (
      <div style={{ backgroundColor: '#0b1120', minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '480px', minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function Splash({ fadeOut }) {
  const taglineWords = ["Unique", "Billing", "&", "Embroidery", "Solutions"];

  return (
    <div className={`splash-wrapper ${fadeOut ? 'fade-out' : ''}`}>
      <div className="splash-container">
        <div className="splash-content">
          <img src={logoIcon} className="splash-logo-icon" alt="Logo Icon" />
          <img src={logoText} className="splash-logo-text" alt="EmbroBill" />
          <div className="splash-tagline">
            {taglineWords.map((word, index) => (
              <span
                key={index}
                className="tagline-word"
                style={{ animationDelay: `${0.5 + index * 0.08}s` }}
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [timerDone, setTimerDone] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  // Manage splash screen timer
  useEffect(() => {
    const delay = 1500;
    const timer = setTimeout(() => {
      setTimerDone(true);
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  // Handle fading out of the splash screen once timer is complete
  useEffect(() => {
    if (timerDone) {
      setFadeOut(true);
      const fadeTimer = setTimeout(() => {
        setShowSplash(false);
      }, 300);
      return () => clearTimeout(fadeTimer);
    }
  }, [timerDone]);

  // Load active session status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await authAPI.status();
        if (data.isAuthenticated) {
          if (window.AndroidAppLock) {
            try {
              window.AndroidAppLock.setActiveUser(data.username);
            } catch (e) {
              console.error('AndroidAppLock sync error:', e);
            }
          }
          setUser({ username: data.username });
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Auth verification failed:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const alertTimerRef = React.useRef(null);

  const triggerAlert = (message, type = 'success', autoDismissMs = 4500) => {
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
    }
    setAlert({ message, type });
    if (autoDismissMs && autoDismissMs > 0) {
      alertTimerRef.current = setTimeout(() => {
        setAlert(null);
      }, autoDismissMs);
    }
  };

  const clearAlert = () => {
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
    }
    setAlert(null);
  };

  // Expose global triggerAlert so injected scripts or external events can show pill toasts
  useEffect(() => {
    window.triggerAlert = triggerAlert;
    window.clearAlert = clearAlert;
    return () => {
      delete window.triggerAlert;
      delete window.clearAlert;
    };
  }, []);

  const handleUserLogout = () => {
    if (window.AndroidAppLock && user?.username) {
      try {
        window.AndroidAppLock.onUserLogout(user.username);
      } catch (e) {
        console.error('AndroidAppLock logout error:', e);
      }
    }
    setUser(null);
  };

  const mainContent = (
    <BrowserRouter>
      <Routes>
        {/* Public login route */}
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <Login
                onLoginSuccess={(username) => {
                  if (window.AndroidAppLock) {
                    try {
                      window.AndroidAppLock.setActiveUser(username);
                    } catch (e) {
                      console.error('AndroidAppLock sync error:', e);
                    }
                  }
                  setUser({ username });
                }}
                triggerAlert={triggerAlert}
              />
            )
          }
        />

        {/* Public registration route */}
        <Route
          path="/register"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <Register
                onRegisterSuccess={(username) => {
                  if (window.AndroidAppLock) {
                    try {
                      window.AndroidAppLock.setActiveUser(username);
                    } catch (e) {
                      console.error('AndroidAppLock sync error:', e);
                    }
                  }
                  setUser({ username });
                }}
                triggerAlert={triggerAlert}
              />
            )
          }
        />

        {/* Protected routes wrapped in main Layout */}
        <Route element={<ProtectedRoute user={user} loading={loading} />}>
          <Route element={<MainLayout user={user} onLogout={handleUserLogout} alert={alert} clearAlert={clearAlert} />}>
            {/* Index & Home route */}
            <Route path="/" element={<AppHome user={user} onLogout={handleUserLogout} triggerAlert={triggerAlert} />} />
            <Route path="/home" element={<AppHome user={user} onLogout={handleUserLogout} triggerAlert={triggerAlert} />} />

            {/* Dashboard route */}
            <Route path="/dashboard" element={<Dashboard user={user} onLogout={handleUserLogout} triggerAlert={triggerAlert} />} />

            {/* Settings route */}
            <Route path="/settings" element={<Settings user={user} onLogout={handleUserLogout} triggerAlert={triggerAlert} />} />

            {/* Invoice routes */}
            <Route path="/invoice-history" element={<InvoiceHistory user={user} onLogout={handleUserLogout} triggerAlert={triggerAlert} />} />
            <Route path="/create-invoice" element={<CreateInvoice triggerAlert={triggerAlert} mode="Add" />} />
            <Route path="/create-challan" element={<CreateChallan triggerAlert={triggerAlert} mode="Add" />} />
            <Route path="/invoices/edit/:id" element={<CreateInvoice triggerAlert={triggerAlert} mode="Edit" />} />
            <Route path="/challans/edit/:id" element={<CreateChallan triggerAlert={triggerAlert} mode="Edit" />} />
          </Route>
        </Route>

        {/* Catch-all redirection */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );

  if (showSplash) {
    return <Splash fadeOut={fadeOut} />;
  }

  return (
    <ErrorBoundary>
      <PillToast alert={alert} onClear={clearAlert} />
      {mainContent}
    </ErrorBoundary>
  );
}
