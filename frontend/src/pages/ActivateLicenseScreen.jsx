import React, { useState, useEffect } from 'react';
import settingsAPI from '../services/settingsAPI';
import logoIcon from '../assets/AZ9wkv0NsH70gxShuXaHxw-AZ9wkxSG6wPW_b0quuXlFw (1).png';
import '../styles/dashboard.css';

export default function ActivateLicenseScreen({
  onActivationSuccess,
  onGoToLogin,
  activationSuccessData,
  onProceedToLogin
}) {
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
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

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      setError('Please enter your license key.');
      return;
    }
    setError('');
    setActivating(true);

    try {
      const data = await settingsAPI.activateLicense(licenseKey.trim());
      if (data && data.success) {
        onActivationSuccess(data);
      } else {
        setError(data?.error || 'Failed to activate license.');
      }
    } catch (err) {
      console.error('License activation error:', err);
      let errorMsg = err.response?.data?.error || '';
      if (!err.response || err.code === 'ERR_NETWORK' || err.response.status === 503) {
        errorMsg = 'Unable to connect to the License Server. Please check your internet connection.';
      } else if (errorMsg === 'Invalid License') {
        errorMsg = 'Invalid License Key. Please check and try again.';
      } else if (errorMsg === 'License Disabled') {
        errorMsg = 'This license has been disabled.';
      } else if (errorMsg === 'License Expired') {
        errorMsg = 'Your license has expired. Please contact support.';
      } else if (!errorMsg) {
        errorMsg = 'Failed to activate license. Please try again.';
      }
      setError(errorMsg);
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="eb-login-wrapper">
      <div className="eb-login-device-frame">
        {/* Mobile Status Bar */}
        <div className="eb-status-bar">
          <span className="eb-status-time">{currentTime}</span>
          <div className="eb-status-icons">
            <i className="bi bi-reception-4"></i>
            <i className="bi bi-wifi"></i>
            <i className="bi bi-battery-full"></i>
          </div>
        </div>

        {/* Content Section */}
        <div className="eb-login-content">
          {activationSuccessData ? (
            /* SUCCESS VIEW: SHOW LOGIN DETAILS AND LOGIN OPTION */
            <div>
              <div
                style={{
                  width: '74px',
                  height: '74px',
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '14px auto 18px auto',
                  boxShadow: '0 8px 24px rgba(34, 197, 94, 0.22)'
                }}
              >
                <i className="bi bi-patch-check-fill" style={{ fontSize: '38px', color: '#16a34a' }}></i>
              </div>

              <h1 className="eb-brand-title" style={{ fontSize: '21px' }}>License Activated</h1>
              <p className="eb-brand-subtitle" style={{ marginBottom: '22px' }}>
                Your account is ready. Proceed to login below.
              </p>

              {/* Login Details Card */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '18px',
                  padding: '16px 18px',
                  marginBottom: '18px',
                  textAlign: 'left'
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    letterSpacing: '0.8px',
                    color: '#64748b',
                    textTransform: 'uppercase',
                    marginBottom: '12px'
                  }}
                >
                  YOUR LOGIN DETAILS
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px'
                  }}
                >
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Username / ID:</span>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                    {activationSuccessData.customer_name || 'master_admin'}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: activationSuccessData.company_name ? '10px' : '2px'
                  }}
                >
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Default Password:</span>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: '700',
                      color: '#0f172a',
                      background: '#e2e8f0',
                      padding: '2px 10px',
                      borderRadius: '6px',
                      letterSpacing: '1px'
                    }}
                  >
                    1234
                  </span>
                </div>

                {activationSuccessData.company_name && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '8px',
                      borderTop: '1px dashed #e2e8f0'
                    }}
                  >
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>Company:</span>
                    <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#475569' }}>
                      {activationSuccessData.company_name}
                    </span>
                  </div>
                )}
              </div>

              {/* Helpful Hint */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  marginBottom: '22px',
                  padding: '10px 14px',
                  background: '#eff6ff',
                  borderRadius: '12px',
                  border: '1px solid #dbeafe',
                  textAlign: 'left'
                }}
              >
                <i className="bi bi-info-circle-fill" style={{ color: '#2563eb', fontSize: '16px', marginTop: '1px' }}></i>
                <span style={{ fontSize: '12px', color: '#1e40af', lineHeight: '1.4' }}>
                  Use password <strong>1234</strong> to sign in. You can change your password anytime from Settings.
                </span>
              </div>

              {/* Login Action Button */}
              <button
                type="button"
                className="eb-sign-in-btn"
                style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }}
                onClick={onProceedToLogin}
              >
                <i className="bi bi-box-arrow-in-right"></i>
                <span>Login to Account</span>
              </button>
            </div>
          ) : (
            /* ACTIVATION VIEW: ADD LICENSE KEY */
            <div>
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
              <p className="eb-brand-subtitle">Enter License Key to get started</p>

              {/* Error Banner */}
              {error && (
                <div className="eb-login-error-banner">
                  <i className="bi bi-exclamation-circle-fill me-2 text-danger"></i>
                  <span>{error}</span>
                </div>
              )}

              {/* Activation Form */}
              <form onSubmit={handleActivate} noValidate>
                <div className="eb-form-group">
                  <div className="eb-form-label-row">
                    <label className="eb-form-label" htmlFor="eb-first-license-key">
                      LICENSE KEY
                    </label>
                  </div>
                  <div className="eb-input-wrapper">
                    <span className="eb-input-icon">
                      <i className="bi bi-key"></i>
                    </span>
                    <input
                      id="eb-first-license-key"
                      type="text"
                      className="eb-input-field"
                      placeholder="Enter your license key"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      disabled={activating}
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="eb-sign-in-btn"
                  disabled={activating}
                >
                  {activating ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      <span>Activating License...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check2-circle"></i>
                      <span>Activate License</span>
                    </>
                  )}
                </button>
              </form>

              {/* Skip to Login option */}
              <div className="text-center mt-3">
                <button
                  type="button"
                  className="eb-forgot-link"
                  style={{ fontSize: '13px', background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer' }}
                  onClick={onGoToLogin}
                >
                  Already set up? Go to Login <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
          )}

          {/* Footer & Security */}
          <div className="eb-footer-section" style={{ marginTop: 'auto', paddingTop: '24px' }}>
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
