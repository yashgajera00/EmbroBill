import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import authAPI from '../services/authAPI';
import useUsernameCheck from '../hooks/useUsernameCheck';
import logoIcon from '../assets/AZ9wkv0NsH70gxShuXaHxw-AZ9wkxSG6wPW_b0quuXlFw (1).png';
import '../styles/dashboard.css';

export default function Register({ onRegisterSuccess, triggerAlert }) {
  const [username, setUsername] = useState('');
  const { status: usernameStatus, isAvailable, isTaken, isInvalid, isChecking, message: usernameMessage } = useUsernameCheck(username);
  const hasUsernameError = isTaken || isInvalid || /\s/.test(username);
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [showAdditional, setShowAdditional] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Status bar time matching Login screen
  const [currentTime, setCurrentTime] = useState('9:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      if (hours > 12) hours -= 12;
      if (hours === 0) hours = 12;
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please enter a username.');
      return;
    }
    if (/\s/.test(username) || isInvalid) {
      setError('Username cannot contain spaces.');
      return;
    }
    if (isTaken) {
      setError('Username is already taken. Please choose another username.');
      return;
    }
    if (!companyName.trim()) {
      setError('Please enter your company or business name.');
      return;
    }
    if (!password) {
      setError('Please enter a password.');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-check.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        username: username.trim().replace(/\s+/g, ''),
        password,
        company_name: companyName.trim(),
        gst_number: gstNumber.trim(),
        phone: phone.trim()
      };

      const data = await authAPI.register(payload);

      if (data.success) {
        localStorage.setItem('embrobill_remember_username', data.username || username.trim());
        if (onRegisterSuccess) {
          onRegisterSuccess(data.username || username.trim());
        }
        triggerAlert('Account created successfully! Welcome to EmbroBill.', 'success');
        navigate('/');
      } else {
        const errorMsg = data.error || 'Registration failed. Please try again.';
        setError(errorMsg);
        triggerAlert(errorMsg, 'danger');
      }
    } catch (err) {
      console.error('Registration error:', err);
      const errMsg = err.response?.data?.error || 'Registration server unreachable. Please try again.';
      setError(errMsg);
      triggerAlert(errMsg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="eb-login-wrapper">
      <div className="eb-login-device-frame" style={{ minHeight: '760px' }}>
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
        <div className="eb-login-content" style={{ paddingBottom: '24px' }}>
          {/* Logo Card */}
          <div className="eb-logo-container" style={{ marginBottom: '14px', marginTop: '6px' }}>
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
          <h1 className="eb-brand-title">Create Account</h1>
          <p className="eb-brand-subtitle">Set up your business profile & credentials</p>

          {/* Error Message */}
          {error && (
            <div className="eb-login-error-banner">
              <i className="bi bi-exclamation-circle-fill me-2 text-danger"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} noValidate>
            {/* USERNAME */}
            <div className="eb-form-group">
              <div className="eb-form-label-row">
                <label className="eb-form-label" htmlFor="eb-reg-username">
                  USERNAME
                </label>
                {isAvailable && (
                  <span
                    style={{
                      fontSize: '11.5px',
                      color: '#16a34a',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <i className="bi bi-check-circle-fill" style={{ fontSize: '12px' }}></i>
                    Available
                  </span>
                )}
                {hasUsernameError && (
                  <span
                    style={{
                      fontSize: '11.5px',
                      color: '#dc2626',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <i className="bi bi-exclamation-circle-fill" style={{ fontSize: '12px' }}></i>
                    {isInvalid || /\s/.test(username) ? 'No Spaces Allowed' : 'Already Taken'}
                  </span>
                )}
              </div>
              <div
                className="eb-input-wrapper"
                style={{
                  borderColor: hasUsernameError ? '#ef4444' : isAvailable ? '#10b981' : undefined,
                  boxShadow: hasUsernameError
                    ? '0 0 0 3px rgba(239, 68, 68, 0.15)'
                    : isAvailable
                    ? '0 0 0 3px rgba(16, 185, 129, 0.15)'
                    : undefined,
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
              >
                <span className="eb-input-icon">
                  <i
                    className="bi bi-person"
                    style={{
                      color: hasUsernameError ? '#ef4444' : isAvailable ? '#10b981' : undefined
                    }}
                  ></i>
                </span>
                <input
                  id="eb-reg-username"
                  type="text"
                  className="eb-input-field"
                  placeholder="e.g. admin or yourname"
                  value={username}
                  onKeyDown={(e) => {
                    if (e.key === ' ') {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    const noSpaces = e.target.value.replace(/\s+/g, '');
                    setUsername(noSpaces);
                  }}
                  autoComplete="username"
                  disabled={loading}
                  required
                />
                {isChecking && (
                  <span
                    className="spinner-border spinner-border-sm text-muted me-2"
                    style={{ width: '15px', height: '15px' }}
                    title="Checking availability..."
                  ></span>
                )}
                {hasUsernameError && (
                  <i className="bi bi-x-circle-fill text-danger me-2" style={{ fontSize: '16px' }}></i>
                )}
                {isAvailable && (
                  <i className="bi bi-check-circle-fill text-success me-2" style={{ fontSize: '16px' }}></i>
                )}
              </div>

              {/* Bottom Warning / Availability Feedback Line */}
              {usernameMessage && (
                <div
                  className="eb-username-warning-line"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '6px',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    fontSize: '12.5px',
                    lineHeight: '1.4',
                    fontWeight: '500',
                    backgroundColor: hasUsernameError ? '#fef2f2' : isAvailable ? '#f0fdf4' : '#f8fafc',
                    color: hasUsernameError ? '#991b1b' : isAvailable ? '#166534' : '#64748b',
                    border: `1px solid ${hasUsernameError ? '#fecaca' : isAvailable ? '#bbf7d0' : '#e2e8f0'}`,
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  <i
                    className={`bi ${
                      hasUsernameError
                        ? 'bi-exclamation-circle-fill'
                        : isAvailable
                        ? 'bi-check-circle-fill'
                        : 'bi-info-circle'
                    }`}
                    style={{
                      fontSize: '15px',
                      color: hasUsernameError ? '#dc2626' : isAvailable ? '#16a34a' : '#64748b',
                      flexShrink: 0
                    }}
                  ></i>
                  <span>{usernameMessage}</span>
                </div>
              )}
            </div>

            {/* COMPANY NAME */}
            <div className="eb-form-group">
              <div className="eb-form-label-row">
                <label className="eb-form-label" htmlFor="eb-reg-company">
                  COMPANY / FIRM NAME
                </label>
              </div>
              <div className="eb-input-wrapper">
                <span className="eb-input-icon">
                  <i className="bi bi-building"></i>
                </span>
                <input
                  id="eb-reg-company"
                  type="text"
                  className="eb-input-field"
                  placeholder="e.g. Aastha Creation"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div className="eb-form-group">
              <div className="eb-form-label-row">
                <label className="eb-form-label" htmlFor="eb-reg-password">
                  PASSWORD
                </label>
              </div>
              <div className="eb-input-wrapper">
                <span className="eb-input-icon">
                  <i className="bi bi-lock"></i>
                </span>
                <input
                  id="eb-reg-password"
                  type={showPassword ? 'text' : 'password'}
                  className="eb-input-field"
                  placeholder="Create a secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                  required
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

            {/* CONFIRM PASSWORD */}
            <div className="eb-form-group">
              <div className="eb-form-label-row">
                <label className="eb-form-label" htmlFor="eb-reg-confirm-password">
                  CONFIRM PASSWORD
                </label>
              </div>
              <div className="eb-input-wrapper">
                <span className="eb-input-icon">
                  <i className="bi bi-shield-lock"></i>
                </span>
                <input
                  id="eb-reg-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="eb-input-field"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="eb-password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  tabIndex="-1"
                >
                  <i className={showConfirmPassword ? 'bi bi-eye-slash' : 'bi bi-eye'}></i>
                </button>
              </div>
            </div>

            {/* TOGGLE OPTIONAL DETAILS */}
            <div style={{ marginBottom: '14px' }}>
              <button
                type="button"
                className="eb-forgot-link"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  color: '#6366f1',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onClick={() => setShowAdditional(!showAdditional)}
              >
                <i className={`bi bi-chevron-${showAdditional ? 'up' : 'down'}`}></i>
                <span>{showAdditional ? 'Hide' : 'Add'} Optional GST & Phone</span>
              </button>
            </div>

            {showAdditional && (
              <>
                {/* GST NUMBER */}
                <div className="eb-form-group">
                  <div className="eb-form-label-row">
                    <label className="eb-form-label" htmlFor="eb-reg-gst">
                      GST NUMBER (OPTIONAL)
                    </label>
                  </div>
                  <div className="eb-input-wrapper">
                    <span className="eb-input-icon">
                      <i className="bi bi-receipt"></i>
                    </span>
                    <input
                      id="eb-reg-gst"
                      type="text"
                      className="eb-input-field"
                      placeholder="e.g. 24AAAAA0000A1Z5"
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* PHONE */}
                <div className="eb-form-group">
                  <div className="eb-form-label-row">
                    <label className="eb-form-label" htmlFor="eb-reg-phone">
                      PHONE NUMBER (OPTIONAL)
                    </label>
                  </div>
                  <div className="eb-input-wrapper">
                    <span className="eb-input-icon">
                      <i className="bi bi-telephone"></i>
                    </span>
                    <input
                      id="eb-reg-phone"
                      type="tel"
                      className="eb-input-field"
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
              </>
            )}

            {/* REGISTER BUTTON */}
            <button
              type="submit"
              className="eb-sign-in-btn"
              disabled={loading}
              style={{ marginTop: '8px' }}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-person-check-fill"></i>
                  <span>Create Account</span>
                </>
              )}
            </button>

            {/* LINK TO SIGN IN */}
            <div className="text-center mt-3">
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Already have an account?{' '}
              </span>
              <Link
                to="/login"
                className="eb-forgot-link"
                style={{
                  fontSize: '13px',
                  color: '#2563eb',
                  fontWeight: '600',
                  textDecoration: 'none'
                }}
              >
                Sign In
              </Link>
            </div>
          </form>

          {/* FOOTER & SECURITY */}
          <div className="eb-footer-section" style={{ marginTop: 'auto', paddingTop: '20px' }}>
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
    </div>
  );
}
