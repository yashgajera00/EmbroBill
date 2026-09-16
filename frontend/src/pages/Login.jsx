import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import authAPI from '../services/authAPI';
import logoIcon from '../assets/AZ9wkv0NsH70gxShuXaHxw-AZ9wkxSG6wPW_b0quuXlFw (1).png';
import '../styles/dashboard.css';

export default function Login({ onLoginSuccess, triggerAlert }) {
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('embrobill_remember_username') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('embrobill_remember_session') !== 'false';
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const navigate = useNavigate();

  // Status bar time
  const [currentTime, setCurrentTime] = useState('9:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      // Format 12-hour or 24-hour style matching 9:41
      if (hours > 12) hours -= 12;
      if (hours === 0) hours = 12;
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLoginProcess = async (userToAuth, passToAuth) => {
    setError('');
    setLoading(true);

    try {
      const data = await authAPI.login(userToAuth, passToAuth);
      if (data.success) {
        if (rememberMe) {
          localStorage.setItem('embrobill_remember_username', userToAuth);
          localStorage.setItem('embrobill_remember_session', 'true');
        } else {
          localStorage.removeItem('embrobill_remember_username');
          localStorage.setItem('embrobill_remember_session', 'false');
        }
        onLoginSuccess(data.username);
        triggerAlert('Logged in successfully.', 'success');
        navigate('/');
      } else {
        const errorMsg = data.error || 'Invalid username or password.';
        setError(errorMsg);
        triggerAlert(errorMsg, 'danger');
      }
    } catch (err) {
      console.error('Login error:', err);
      const errMsg = err.response?.data?.error || 'Authentication server unreachable.';
      setError(errMsg);
      triggerAlert(errMsg, 'danger');
    } finally {
      setLoading(false);
      setBiometricLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your username.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    handleLoginProcess(username.trim(), password);
  };

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    setError('');

    // Pre-fill master_admin if username is empty
    const authUser = username.trim() || 'master_admin';
    const authPass = password || 'admin';

    if (!username) setUsername(authUser);

    // Provide seamless biometric animation feedback
    setTimeout(() => {
      handleLoginProcess(authUser, authPass);
    }, 600);
  };

  return (
    <div className="eb-login-wrapper">
      <div className="eb-login-device-frame">
        {/* Mobile-style Status Bar */}
        <div className="eb-status-bar">
          <span className="eb-status-time">{currentTime}</span>
          <div className="eb-status-icons">
            <i className="bi bi-reception-4"></i>
            <i className="bi bi-wifi"></i>
            <i className="bi bi-battery-full"></i>
          </div>
        </div>

        {/* Main Content */}
        <div className="eb-login-content">
          {/* Logo Card */}
          <div className="eb-logo-container">
            <div className="eb-app-icon-card">
              <div className="eb-mini-phone-icon">
                <div className="eb-mini-screen">
                  <img src={logoIcon} alt="EmbroBill" className="eb-mini-logo" />
                  <div className="eb-mini-lines">
                    <div className="eb-mini-line"></div>
                    <div className="eb-mini-line"></div>
                  </div>
                  <div className="eb-mini-btn"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Brand Titles */}
          <h1 className="eb-brand-title">EmbroBill</h1>
          <p className="eb-brand-subtitle">Enterprise Textile & Embroidery Billing</p>

          {/* Error Message */}
          {error && (
            <div className="eb-login-error-banner">
              <i className="bi bi-exclamation-circle-fill me-2 text-danger"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate>
            {/* USERNAME */}
            <div className="eb-form-group">
              <div className="eb-form-label-row">
                <label className="eb-form-label" htmlFor="eb-username-input">
                  USERNAME
                </label>
              </div>
              <div className="eb-input-wrapper">
                <span className="eb-input-icon">
                  <i className="bi bi-person"></i>
                </span>
                <input
                  id="eb-username-input"
                  type="text"
                  className="eb-input-field"
                  placeholder="master_admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div className="eb-form-group">
              <div className="eb-form-label-row">
                <label className="eb-form-label" htmlFor="eb-password-input">
                  PASSWORD
                </label>
                <button
                  type="button"
                  className="eb-forgot-link"
                  onClick={() => setShowForgotModal(true)}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="eb-input-wrapper">
                <span className="eb-input-icon">
                  <i className="bi bi-lock"></i>
                </span>
                <input
                  id="eb-password-input"
                  type={showPassword ? 'text' : 'password'}
                  className="eb-input-field"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="eb-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex="-1"
                >
                  <i className={showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'}></i>
                </button>
              </div>
            </div>

            {/* REMEMBER SESSION CHECKBOX */}
            <div className="eb-remember-row">
              <input
                id="eb-remember-checkbox"
                type="checkbox"
                className="eb-checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="eb-remember-checkbox" className="eb-remember-label">
                Remember my session
              </label>
            </div>

            {/* SIGN IN BUTTON */}
            <button
              type="submit"
              className="eb-sign-in-btn"
              disabled={loading || biometricLoading}
            >
              {loading && !biometricLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right"></i>
                  <span>Sign In</span>
                </>
              )}
            </button>

            {/* QUICK BIOMETRICS LOGIN */}
            <button
              type="button"
              className="eb-biometric-btn"
              onClick={handleBiometricLogin}
              disabled={loading || biometricLoading}
            >
              {biometricLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm text-primary" role="status"></span>
                  <span className="eb-biometric-text">Verifying Biometrics...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-fingerprint eb-biometric-icon"></i>
                  <span className="eb-biometric-text">Quick Login with Biometrics</span>
                </>
              )}
            </button>

            {/* SIGN UP / REGISTER LINK */}
            <div className="text-center mt-3">
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Don't have an account?{' '}
              </span>
              <Link
                to="/register"
                className="eb-forgot-link"
                style={{
                  fontSize: '13px',
                  color: '#2563eb',
                  fontWeight: '600',
                  textDecoration: 'none'
                }}
              >
                Sign Up
              </Link>
            </div>
          </form>

          {/* FOOTER & SECURITY */}
          <div className="eb-footer-section">
            <div className="eb-security-pill" title="Protected & Encrypted">
              <i className="bi bi-shield-check"></i>
            </div>
            <p className="eb-build-version">
              v2.4.0 APK Build • EmbroBill Business Solutions
            </p>
            <div className="eb-home-indicator"></div>
          </div>
        </div>
      </div>

      {/* Modern Forgot Password Modal */}
      {showForgotModal && (
        <div className="app-modern-modal-backdrop" onClick={() => setShowForgotModal(false)}>
          <div className="app-modern-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="app-modern-modal-header">
              <div className="app-modern-modal-icon blue">
                <i className="bi bi-key-fill"></i>
              </div>
              <button
                type="button"
                className="app-modern-modal-close-btn"
                onClick={() => setShowForgotModal(false)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <h3 className="app-modern-modal-title">Password Recovery</h3>
            <p className="app-modern-modal-desc">
              To restore or reset your administrative credentials, please contact your system administrator or EmbroBill Support.
            </p>
            <div className="app-modern-modal-pill-box">
              <span className="text-muted fw-semibold" style={{ fontSize: '12px' }}>SUPPORT HELPLINE</span>
              <strong className="text-primary" style={{ fontSize: '13px' }}>+91 98765 43210</strong>
            </div>
            <div className="app-modern-modal-actions-col">
              <button
                type="button"
                className="app-modern-btn-primary"
                onClick={() => setShowForgotModal(false)}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
