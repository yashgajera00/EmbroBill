import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import authAPI from './services/authAPI';
import settingsAPI from './services/settingsAPI';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Settings from './pages/Settings';
import InvoiceHistory from './pages/InvoiceHistory';
import CreateInvoice from './pages/CreateInvoice';
import CreateChallan from './pages/CreateChallan';
import Dashboard from './pages/Dashboard';
import AppHome from './pages/AppHome';
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
  
  const [usersExist, setUsersExist] = useState(true);
  const [firstLicenseKey, setFirstLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [activationSuccessData, setActivationSuccessData] = useState(null);

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
      }, 300); // 300ms matches the transition duration in CSS
      return () => clearTimeout(fadeTimer);
    }
  }, [timerDone]);

  // Load active session status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await authAPI.status();
        setUsersExist(data.users_exist !== false);
        if (data.isAuthenticated) {
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

  const handleFirstLaunchActivate = async (e) => {
    e.preventDefault();
    if (!firstLicenseKey.trim()) {
      triggerAlert('License Key cannot be empty.', 'warning');
      return;
    }
    setActivating(true);
    setAlert(null);
    try {
      const data = await settingsAPI.activateLicense(firstLicenseKey.trim());
      setActivationSuccessData(data);
    } catch (err) {
      console.error('Failed to activate license:', err);
      let errorMsg = err.response?.data?.error || '';
      if (!err.response || err.code === 'ERR_NETWORK' || err.response.status === 503) {
        errorMsg = 'Unable to connect to the License Server. Please check your internet connection.';
      } else if (errorMsg === 'Invalid License') {
        errorMsg = 'Invalid License Key';
      } else if (errorMsg === 'License Disabled') {
        errorMsg = 'This license has been disabled.';
      } else if (errorMsg === 'License Expired') {
        errorMsg = 'Your license has expired. Please contact support.';
      } else if (!errorMsg) {
        errorMsg = 'Failed to activate license.';
      }
      setAlert({ message: errorMsg, type: 'danger' });
    } finally {
      setActivating(false);
    }
  };

  const alertTimerRef = React.useRef(null);

  const triggerAlert = (message, type = 'success') => {
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
    }
    setAlert({ message, type });
    alertTimerRef.current = setTimeout(() => {
      setAlert(null);
    }, 4500);
  };

  const clearAlert = () => {
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
    }
    setAlert(null);
  };

  let mainContent;

  if (activationSuccessData) {
    mainContent = (
      <div className="d-flex justify-content-center align-items-center bg-light animate-fade-in" style={{ minHeight: '100vh', padding: '20px' }}>
        <div className="content-card shadow-lg text-start" style={{ maxWidth: '500px', width: '100%', borderRadius: '16px', padding: '30px' }}>
          <h4 className="fw-bold text-success text-center mb-4 d-flex align-items-center justify-content-center">
            <i className="bi bi-check-circle-fill me-2 text-success"></i> License Activated Successfully
          </h4>
          
          <div className="alert alert-success border-0 bg-success-light p-3 mb-4">
            <h5 className="fw-bold text-success mb-2">Your Login Details</h5>
            <div className="mb-2">
              <span className="text-muted d-block" style={{ fontSize: '12px' }}>User ID:</span>
              <strong className="fs-5 text-dark">{activationSuccessData.customer_name}</strong>
            </div>
            <div>
              <span className="text-muted d-block" style={{ fontSize: '12px' }}>Default Password:</span>
              <strong className="fs-5 text-dark">1234</strong>
            </div>
          </div>

          <div className="alert alert-warning border-0 bg-warning-light p-3 mb-4 d-flex align-items-start">
            <i className="bi bi-info-circle-fill me-2 mt-0.5 text-warning fs-5"></i>
            <div>
              <strong className="text-dark">IMPORTANT:</strong> For your security, please change your password after your first login.
            </div>
          </div>

          <button 
            type="button" 
            onClick={() => {
              setUsersExist(true);
              setActivationSuccessData(null);
            }} 
            className="btn btn-success w-100 py-2 fw-bold animate-pulse"
          >
            Continue
          </button>
        </div>
      </div>
    );
  } else if (!usersExist) {
    mainContent = (
      <div className="d-flex justify-content-center align-items-center bg-light" style={{ minHeight: '100vh', padding: '20px' }}>
        <div className="content-card shadow-lg text-center" style={{ maxWidth: '500px', width: '100%', borderRadius: '16px', padding: '30px' }}>
          <h4 className="fw-bold text-primary mb-4 d-flex align-items-center justify-content-center">
            <i className="bi bi-key-fill me-2 text-primary"></i> License Activation
          </h4>
          <p className="text-muted text-start mb-4">
            EmbroBill is not activated. Please enter your license key to activate the software and get started.
          </p>
          <form onSubmit={handleFirstLaunchActivate}>
            <div className="mb-4 text-start">
              <label className="form-label text-uppercase fw-bold invoice-form-label">License Key</label>
              <input
                type="text"
                className="form-control form-control-lg"
                placeholder="Enter license key"
                value={firstLicenseKey}
                onChange={(e) => setFirstLicenseKey(e.target.value)}
                disabled={activating}
                required
              />
            </div>
            
            {alert && (
              <div className={`alert alert-${alert.type} d-flex align-items-start mb-4 text-start`} style={{ fontSize: '14px' }}>
                <i className="bi bi-info-circle-fill me-2 mt-0.5"></i>
                <div>{alert.message}</div>
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-primary w-100 py-2 fw-bold"
              disabled={activating}
            >
              {activating ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Activating...
                </>
              ) : (
                'Activate License'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  } else {
    mainContent = (
      <BrowserRouter>
        <Routes>
          {/* Public login route */}
          <Route
            path="/login"
            element={
              user ? (
                <Navigate to="/" replace />
              ) : (
                <Login onLoginSuccess={(username) => setUser({ username })} triggerAlert={triggerAlert} />
              )
            }
          />

          {/* Protected routes wrapped in main Layout */}
          <Route element={<ProtectedRoute user={user} loading={loading} />}>
            <Route element={<MainLayout user={user} onLogout={() => setUser(null)} alert={alert} clearAlert={clearAlert} />}>
              {/* Index & Home route */}
              <Route path="/" element={<AppHome user={user} onLogout={() => setUser(null)} triggerAlert={triggerAlert} />} />
              <Route path="/home" element={<AppHome user={user} onLogout={() => setUser(null)} triggerAlert={triggerAlert} />} />

              {/* Dashboard route */}
              <Route path="/dashboard" element={<Dashboard user={user} onLogout={() => setUser(null)} triggerAlert={triggerAlert} />} />

              {/* Settings route */}
              <Route path="/settings" element={<Settings user={user} onLogout={() => setUser(null)} triggerAlert={triggerAlert} />} />

              {/* Invoice routes */}
              <Route path="/invoice-history" element={<InvoiceHistory user={user} onLogout={() => setUser(null)} triggerAlert={triggerAlert} />} />
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
  }

  if (showSplash) {
    return <Splash fadeOut={fadeOut} />;
  }

  return mainContent;
}
