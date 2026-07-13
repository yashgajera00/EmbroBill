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
import thumbnail from './assets/thumbnail.jpg';

// Protected Route wrapper component
function ProtectedRoute({ user, loading }) {
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
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

  // Manage splash screen timer based on sessionStorage cache
  useEffect(() => {
    const hasShown = sessionStorage.getItem('hasShownSplash');
    const delay = hasShown ? 0 : 2000;

    const timer = setTimeout(() => {
      setTimerDone(true);
    }, delay);

    return () => clearTimeout(timer);
  }, []);

  // Handle fading out of the splash screen once both timer and auth check are complete
  useEffect(() => {
    if (timerDone && !loading) {
      setFadeOut(true);
      const fadeTimer = setTimeout(() => {
        setShowSplash(false);
        sessionStorage.setItem('hasShownSplash', 'true');
      }, 500); // 500ms matches the transition duration in CSS
      return () => clearTimeout(fadeTimer);
    }
  }, [timerDone, loading]);

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

  const triggerAlert = (message, type = 'success') => {
    setAlert({ message, type });
    // Auto-dismiss alert after 5 seconds
    setTimeout(() => {
      setAlert(null);
    }, 5000);
  };

  const clearAlert = () => {
    setAlert(null);
  };

  if (showSplash) {
    return (
      <div className={`splash-screen ${fadeOut ? 'fade-out' : ''}`}>
        <img src={thumbnail} alt="EmbroBill Splash" className="splash-img" />
      </div>
    );
  }

  if (activationSuccessData) {
    return (
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
  }

  if (!usersExist) {
    return (
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
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public login route */}
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/create-invoice" replace />
            ) : (
              <Login onLoginSuccess={(username) => setUser({ username })} triggerAlert={triggerAlert} />
            )
          }
        />

        {/* Protected routes wrapped in main Layout */}
        <Route element={<ProtectedRoute user={user} loading={loading} />}>
          <Route element={<MainLayout user={user} onLogout={() => setUser(null)} alert={alert} clearAlert={clearAlert} />}>
            {/* Index redirection */}
            <Route path="/" element={<Navigate to="/create-invoice" replace />} />

            {/* Settings route */}
            <Route path="/settings" element={<Settings user={user} onLogout={() => setUser(null)} triggerAlert={triggerAlert} />} />

            {/* Invoice routes */}
            <Route path="/invoice-history" element={<InvoiceHistory triggerAlert={triggerAlert} />} />
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
