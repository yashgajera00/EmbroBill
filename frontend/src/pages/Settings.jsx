import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import settingsAPI from '../services/settingsAPI';
import authAPI from '../services/authAPI';
import '../styles/appHome.css';

export default function Settings({ user, onLogout, triggerAlert }) {
  const [formData, setFormData] = useState({
    company_name: '',
    phone: '',
    address: '',
    gst_number: '',
    state_code: '24-GJ',
    pan_number: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    terms_conditions: '',
    plan_expiry_date: '',
    user_id: '',
    bill_no_prefix: '',
    bill_no_start_number: 1,
    default_hsn_code: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: ''
  });
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Close more menu on click outside
  useEffect(() => {
    if (!moreMenuOpen) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.settings-more-dropdown-container')) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [moreMenuOpen]);

  const [isBillFormatLocked, setIsBillFormatLocked] = useState(true);
  const [isHsnLocked, setIsHsnLocked] = useState(true);
  const [unlockTarget, setUnlockTarget] = useState(null); // 'bill' or 'hsn'
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const currentUsername = user?.username || formData.user_id || localStorage.getItem('embrobill_remember_username') || '';

  // App Lock State
  const [appLockEnabled, setAppLockEnabled] = useState(() => {
    if (typeof window !== 'undefined' && window.AndroidAppLock && currentUsername) {
      try {
        return window.AndroidAppLock.isAppLockEnabled(currentUsername);
      } catch (e) {
        console.error('Error reading native app lock:', e);
      }
    }
    const saved = localStorage.getItem(`embrobill_app_lock_${currentUsername || 'default'}`);
    return saved === 'true';
  });

  const [appLockLoading, setAppLockLoading] = useState(false);

  // Sync state with native AndroidAppLock if available
  useEffect(() => {
    if (!currentUsername) return;
    if (typeof window !== 'undefined' && window.AndroidAppLock) {
      try {
        window.AndroidAppLock.setActiveUser(currentUsername);
        const nativeStatus = window.AndroidAppLock.isAppLockEnabled(currentUsername);
        setAppLockEnabled(nativeStatus);
        localStorage.setItem(`embrobill_app_lock_${currentUsername}`, String(nativeStatus));
      } catch (e) {
        console.error('Error syncing app lock:', e);
      }
    } else {
      const saved = localStorage.getItem(`embrobill_app_lock_${currentUsername}`);
      setAppLockEnabled(saved === 'true');
    }
  }, [currentUsername]);

  // Handle native biometric verification result callback
  useEffect(() => {
    window.onAppLockVerified = (success, message) => {
      setAppLockLoading(false);
      if (success) {
        setAppLockEnabled(true);
        if (currentUsername) {
          localStorage.setItem(`embrobill_app_lock_${currentUsername}`, 'true');
        }
        triggerAlert(message || 'App Lock enabled successfully.', 'success');
      } else {
        setAppLockEnabled(false);
        triggerAlert(message || 'App Lock setup cancelled or failed.', 'danger');
      }
    };
    return () => {
      delete window.onAppLockVerified;
    };
  }, [currentUsername, triggerAlert]);

  const handleAppLockToggle = (e) => {
    const willEnable = e.target.checked;
    
    if (typeof window !== 'undefined' && window.AndroidAppLock) {
      if (willEnable) {
        setAppLockLoading(true);
        triggerAlert('Waiting for Fingerprint or Phone PIN verification...', 'info', 20000);
        setTimeout(() => setAppLockLoading(false), 20000);
        window.AndroidAppLock.verifyAndEnableAppLock(currentUsername);
      } else {
        window.AndroidAppLock.setAppLockEnabled(currentUsername, false);
        setAppLockEnabled(false);
        if (currentUsername) {
          localStorage.setItem(`embrobill_app_lock_${currentUsername}`, 'false');
        }
        triggerAlert('App Lock has been disabled.', 'info');
      }
    } else {
      setAppLockEnabled(willEnable);
      if (currentUsername) {
        localStorage.setItem(`embrobill_app_lock_${currentUsername}`, String(willEnable));
      }
      if (willEnable) {
        triggerAlert('App Lock preference saved. Device authentication will be required when accessing via the EmbroBill Android App.', 'info');
      } else {
        triggerAlert('App Lock disabled.', 'info');
      }
    }
  };

  // Accordion state for Policies section
  const [openPolicy, setOpenPolicy] = useState(null);

  const togglePolicy = (key) => {
    setOpenPolicy(prev => prev === key ? null : key);
  };

  const handleUnlockClick = async () => {
    if (!isBillFormatLocked) {
      setIsBillFormatLocked(true);
      setSaving(true);
      try {
        await settingsAPI.save(formData);
        triggerAlert('Bill format settings locked and saved successfully.', 'success');
      } catch (err) {
        console.error('Failed to save settings:', err);
        triggerAlert(err.response?.data?.error || 'Error saving settings.', 'danger');
      } finally {
        setSaving(false);
      }
    } else {
      setUnlockTarget('bill');
      setShowUnlockModal(true);
    }
  };

  const handleHsnUnlockClick = async () => {
    if (!isHsnLocked) {
      setIsHsnLocked(true);
      setSaving(true);
      try {
        await settingsAPI.save(formData);
        triggerAlert('Default HSN Code settings locked and saved successfully.', 'success');
      } catch (err) {
        console.error('Failed to save settings:', err);
        triggerAlert(err.response?.data?.error || 'Error saving settings.', 'danger');
      } finally {
        setSaving(false);
      }
    } else {
      setUnlockTarget('hsn');
      setShowUnlockModal(true);
    }
  };

  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    setUnlockError('');
    try {
      const response = await authAPI.verifyPassword(unlockPassword);
      if (response && response.success) {
        if (unlockTarget === 'bill') {
          setIsBillFormatLocked(false);
          triggerAlert('Bill format settings unlocked for editing.', 'success');
        } else if (unlockTarget === 'hsn') {
          setIsHsnLocked(false);
          triggerAlert('Default HSN Code settings unlocked for editing.', 'success');
        }
        setShowUnlockModal(false);
        setUnlockPassword('');
        setUnlockTarget(null);
      } else {
        const msg = 'Verification failed. Invalid password.';
        setUnlockError(msg);
        triggerAlert(msg, 'danger');
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Incorrect password.';
      setUnlockError(msg);
      triggerAlert(msg, 'danger');
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await settingsAPI.get();
      if (data) {
        setFormData({
          company_name: data.company_name || '',
          phone: data.phone || '',
          address: data.address || '',
          gst_number: data.gst_number || '',
          state_code: data.state_code || '24-GJ',
          pan_number: data.pan_number || '',
          bank_name: data.bank_name || '',
          account_number: data.account_number || '',
          ifsc_code: data.ifsc_code || '',
          terms_conditions: data.terms_conditions || '',
          plan_expiry_date: data.plan_expiry_date || '',
          user_id: data.user_id || '',
          bill_no_prefix: data.bill_no_prefix || '',
          bill_no_start_number: data.bill_no_start_number !== undefined ? data.bill_no_start_number : 1,
          default_hsn_code: data.default_hsn_code || ''
        });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      triggerAlert('Error loading settings from server.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsAPI.save(formData);
      triggerAlert('Company settings saved successfully.', 'success');
    } catch (err) {
      console.error('Failed to save settings:', err);
      triggerAlert(err.response?.data?.error || 'Error saving settings.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    fetchSettings();
    triggerAlert('Changes reset to previous saved state.', 'info');
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordSaving(true);
    try {
      const res = await authAPI.changePassword(passwordData.old_password, passwordData.new_password);
      triggerAlert(res.message || 'Password changed successfully.', 'success');
      setPasswordData({ old_password: '', new_password: '' });
    } catch (err) {
      console.error('Failed to change password:', err);
      triggerAlert(err.response?.data?.error || 'Failed to change password.', 'danger');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirmModal(true);
  };

  const executeLogout = async () => {
    try {
      if (typeof window !== 'undefined' && window.AndroidAppLock && currentUsername) {
        try {
          window.AndroidAppLock.onUserLogout(currentUsername);
        } catch (e) {
          console.error('AndroidAppLock logout error:', e);
        }
      }
      await authAPI.logout();
      if (onLogout) {
        onLogout();
      }
      setShowLogoutConfirmModal(false);
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
      triggerAlert('Logout failed.', 'danger');
      setShowLogoutConfirmModal(false);
    }
  };

  const formatDisplayDate = (isoStr) => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return isoStr;
  };

  if (loading) {
    return (
      <div className="app-home-wrapper">
        <div className="app-home-container d-flex align-items-center justify-content-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-home-wrapper">
      <div className="app-home-container">
        
        {/* Top Header matching Create Invoice style */}
        <header className="create-invoice-header justify-content-between">
          <div className="d-flex align-items-center gap-3">
            <button
              type="button"
              className="create-invoice-back-btn"
              onClick={() => navigate('/')}
              title="Go back to Home"
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <h1 className="create-invoice-header-title">
              Settings
            </h1>
          </div>

          <div className="settings-header-actions">
            <div className="settings-more-dropdown-container position-relative">
              <button
                type="button"
                className={`settings-more-btn ${moreMenuOpen ? 'active' : ''}`}
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                title="More options"
                aria-label="More options"
              >
                <i className="bi bi-three-dots-vertical"></i>
              </button>

              {moreMenuOpen && (
                <ul
                  className="dropdown-menu dropdown-menu-end show shadow"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 6px)',
                    zIndex: 1050,
                    minWidth: '150px',
                    borderRadius: '12px',
                    padding: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <li>
                    <button
                      type="button"
                      className="dropdown-item d-flex align-items-center gap-2 py-2 px-3 rounded-2 text-danger"
                      style={{ fontSize: '13px', fontWeight: 500 }}
                      onClick={() => {
                        setMoreMenuOpen(false);
                        handleLogout();
                      }}
                    >
                      <i className="bi bi-box-arrow-right" style={{ fontSize: '15px' }}></i>
                      <span>Logout</span>
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content (Middle Part) */}
        <main className="settings-scroll-container">
          
          {/* Customer ID Bar at top of middle part */}
          <div className="settings-card d-flex flex-row align-items-center justify-content-between py-2.5 px-3 mb-1">
            <div className="d-flex align-items-center gap-2">
              <div className="settings-icon-badge blue" style={{ width: '28px', height: '28px', fontSize: '13px' }}>
                <i className="bi bi-person-badge"></i>
              </div>
              <span className="fw-bold text-dark" style={{ fontSize: '13px' }}>Customer ID</span>
            </div>
            <div className="settings-id-pill m-0" title="Customer ID">
              <i className="bi bi-at"></i>
              <span>{formData.user_id || user?.username || '246130'}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} id="settingsCompanyForm">
            
            {/* 1. Company Identity Card */}
            <div className="settings-card mb-3">
              <div className="settings-card-header">
                <div className="settings-card-header-left">
                  <div className="settings-icon-badge blue">
                    <i className="bi bi-building"></i>
                  </div>
                  <h6 className="settings-card-title blue">Company Identity</h6>
                </div>
                <span className="settings-badge-pill gray">CORE INFO</span>
              </div>

              <div className="settings-field-group">
                <label className="settings-field-label">Company Name</label>
                <input
                  type="text"
                  name="company_name"
                  className="settings-input-control"
                  placeholder="Enter company name"
                  value={formData.company_name}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

              <div className="settings-field-group">
                <label className="settings-field-label">Phone Number</label>
                <div className="settings-phone-wrapper">
                  <span className="settings-phone-prefix">+91</span>
                  <input
                    type="tel"
                    name="phone"
                    className="settings-phone-input"
                    placeholder="Enter contact phone"
                    value={formData.phone?.startsWith('+91') ? formData.phone.replace(/^\+91\s*/, '') : formData.phone}
                    onChange={(e) => {
                      const cleanVal = e.target.value;
                      setFormData(prev => ({ ...prev, phone: cleanVal ? `+91 ${cleanVal.replace(/^\+91\s*/, '')}` : '' }));
                    }}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="settings-field-group">
                <label className="settings-field-label">Plan Expiry Date</label>
                <div className="position-relative">
                  <input
                    type="text"
                    className="settings-input-control"
                    value={formatDisplayDate(formData.plan_expiry_date)}
                    disabled
                  />
                  <i
                    className="bi bi-calendar4 position-absolute text-muted"
                    style={{ right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                  ></i>
                </div>
              </div>

              <div className="settings-field-group">
                <label className="settings-field-label">Address</label>
                <textarea
                  name="address"
                  className="settings-input-control"
                  rows="3"
                  placeholder="Enter full address, plot no, street, city..."
                  value={formData.address}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

              <div className="settings-field-group">
                <label className="settings-field-label">Bill Format (Prefix &amp; Start No.)</label>
                <div className="d-flex align-items-center gap-2">
                  <input
                    type="text"
                    name="bill_no_prefix"
                    className="settings-input-control center-text flex-grow-1"
                    placeholder="Prefix"
                    value={formData.bill_no_prefix}
                    onChange={handleChange}
                    disabled={saving || isBillFormatLocked}
                  />
                  <input
                    type="number"
                    name="bill_no_start_number"
                    className="settings-input-control center-text no-spinner flex-grow-1"
                    placeholder="1"
                    value={formData.bill_no_start_number}
                    onChange={handleChange}
                    disabled={saving || isBillFormatLocked}
                    min="1"
                  />
                  <button
                    type="button"
                    className={`settings-unlock-btn ${!isBillFormatLocked ? 'unlocked' : ''}`}
                    onClick={handleUnlockClick}
                    disabled={saving}
                    title={isBillFormatLocked ? "Unlock fields to edit" : "Lock fields"}
                  >
                    <i className={`bi ${isBillFormatLocked ? 'bi-lock' : 'bi-unlock'}`}></i>
                    <span>{isBillFormatLocked ? 'Unlock' : 'Lock'}</span>
                  </button>
                </div>
              </div>

              <div className="settings-field-group mb-0">
                <label className="settings-field-label">Default HSN Code</label>
                <div className="d-flex align-items-center gap-2">
                  <input
                    type="text"
                    name="default_hsn_code"
                    className="settings-input-control flex-grow-1"
                    placeholder="e.g. 5810"
                    value={formData.default_hsn_code}
                    onChange={handleChange}
                    disabled={saving || isHsnLocked}
                  />
                  <button
                    type="button"
                    className={`settings-unlock-btn ${!isHsnLocked ? 'unlocked' : ''}`}
                    onClick={handleHsnUnlockClick}
                    disabled={saving}
                    title={isHsnLocked ? "Unlock Default HSN Code to edit" : "Lock Default HSN Code"}
                  >
                    <i className={`bi ${isHsnLocked ? 'bi-lock' : 'bi-unlock'}`}></i>
                    <span>{isHsnLocked ? 'Unlock' : 'Lock'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. GST & Tax Identifiers Card */}
            <div className="settings-card mb-3">
              <div className="settings-card-header">
                <div className="settings-card-header-left">
                  <div className="settings-icon-badge blue">
                    <i className="bi bi-receipt"></i>
                  </div>
                  <h6 className="settings-card-title blue">GST &amp; Tax Identifiers</h6>
                </div>
              </div>

              <div className="settings-field-group">
                <label className="settings-field-label">GST Number</label>
                <input
                  type="text"
                  name="gst_number"
                  className="settings-input-control monospace"
                  placeholder="Enter GST number"
                  value={formData.gst_number}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

              <div className="row g-2 mb-0">
                <div className="col-6">
                  <label className="settings-field-label">State Code</label>
                  <input
                    type="text"
                    name="state_code"
                    className="settings-input-control center-text"
                    placeholder="e.g. 24-GJ"
                    value={formData.state_code}
                    onChange={handleChange}
                    disabled={saving}
                  />
                </div>
                <div className="col-6">
                  <label className="settings-field-label">PAN Number</label>
                  <input
                    type="text"
                    name="pan_number"
                    className="settings-input-control center-text monospace"
                    placeholder="Enter PAN number"
                    value={formData.pan_number}
                    onChange={handleChange}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            {/* 3. Banking Information Card */}
            <div className="settings-card mb-3">
              <div className="settings-card-header">
                <div className="settings-card-header-left">
                  <div className="settings-icon-badge teal">
                    <i className="bi bi-bank2"></i>
                  </div>
                  <h6 className="settings-card-title blue">Banking Information</h6>
                </div>
              </div>

              <div className="settings-field-group">
                <label className="settings-field-label">Bank Name</label>
                <input
                  type="text"
                  name="bank_name"
                  className="settings-input-control"
                  placeholder="e.g. State Bank of India"
                  value={formData.bank_name}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

              <div className="settings-field-group">
                <label className="settings-field-label">Account Number</label>
                <input
                  type="text"
                  name="account_number"
                  className="settings-input-control"
                  placeholder="Enter bank account number"
                  value={formData.account_number}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

              <div className="settings-field-group mb-0">
                <label className="settings-field-label">IFSC Code</label>
                <input
                  type="text"
                  name="ifsc_code"
                  className="settings-input-control monospace"
                  placeholder="SBIN0001234"
                  value={formData.ifsc_code}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>
            </div>

            {/* 4. Terms & Conditions Card */}
            <div className="settings-card mb-3">
              <div className="settings-card-header">
                <div className="settings-card-header-left">
                  <div className="settings-icon-badge blue">
                    <i className="bi bi-pencil-square"></i>
                  </div>
                  <h6 className="settings-card-title blue">Terms &amp; Conditions</h6>
                </div>
                <span className="settings-badge-text">Invoice Footer</span>
              </div>

              <div className="settings-field-group mb-2">
                <label className="settings-field-label">Terms &amp; Conditions (One Per Line)</label>
                <textarea
                  name="terms_conditions"
                  className="settings-input-control"
                  rows="6"
                  placeholder="1) Goods Once Sold will not be taken back.&#10;2) Goods are delivered at owner's risk and insurance option.&#10;3) Please Check The RF Within 5 Days Otherwise We Are Not Responsible.&#10;4) Interest will be charged @ 24% p.a.&#10;5) Subject to SURAT Jurisdiction."
                  value={formData.terms_conditions}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

              <div className="settings-footer-actions">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="settings-cancel-btn"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="settings-save-btn"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-floppy"></i>
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </form>

          {/* Security: App Lock Section */}
          <div className="settings-card mb-3">
            <div className="settings-card-header">
              <div className="settings-card-header-left">
                <div className="settings-icon-badge blue">
                  <i className="bi bi-shield-check"></i>
                </div>
                <h6 className="settings-card-title blue">Security</h6>
              </div>
              <span className={`settings-badge-pill ${appLockEnabled ? 'green' : 'gray'}`}>
                {appLockEnabled ? 'ACTIVE' : 'OFF'}
              </span>
            </div>

            <p className="settings-card-desc">
              Protect your account by requiring Android device authentication (Fingerprint, Face, or Phone PIN/Pattern) before accessing EmbroBill.
            </p>

            <div className="settings-app-lock-row d-flex align-items-center justify-content-between p-3 rounded-3" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: appLockEnabled ? '#dbeafe' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: appLockEnabled ? '#1e40af' : '#64748b', fontSize: '20px' }}>
                  <i className={`bi ${appLockEnabled ? 'bi-fingerprint' : 'bi-shield-lock'}`}></i>
                </div>
                <div>
                  <div className="fw-bold text-dark" style={{ fontSize: '15px' }}>App Lock</div>
                  <div className="text-muted" style={{ fontSize: '12px' }}>
                    {appLockEnabled
                      ? 'Protected by phone screen lock / biometrics'
                      : 'Disabled — opens without device authentication'}
                  </div>
                </div>
              </div>

              <div className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="appLockSwitch"
                  checked={appLockEnabled}
                  onChange={handleAppLockToggle}
                  disabled={appLockLoading}
                  style={{ width: '48px', height: '24px', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          {/* 5. Change Password Card */}
          <div className="settings-card settings-card-security mb-3">
            <div className="settings-card-header">
              <div className="settings-card-header-left">
                <div className="settings-icon-badge red">
                  <i className="bi bi-shield-lock-fill"></i>
                </div>
                <h6 className="settings-card-title red">Change Password</h6>
              </div>
              <span className="settings-badge-pill red">Security</span>
            </div>

            <p className="settings-card-desc">
              Update your account login password. You will need to enter your current password to authorize this update.
            </p>

            <form onSubmit={handlePasswordSubmit} autoComplete="off">
              <div className="settings-field-group">
                <label className="settings-field-label">Current Password</label>
                <input
                  type="password"
                  name="old_password"
                  className="settings-input-control"
                  placeholder="Enter current password"
                  value={passwordData.old_password}
                  onChange={handlePasswordChange}
                  autoComplete="new-password"
                  required
                  disabled={passwordSaving}
                />
              </div>

              <div className="settings-field-group">
                <label className="settings-field-label">New Password</label>
                <input
                  type="password"
                  name="new_password"
                  className="settings-input-control"
                  placeholder="Enter new password"
                  value={passwordData.new_password}
                  onChange={handlePasswordChange}
                  autoComplete="new-password"
                  required
                  disabled={passwordSaving}
                />
              </div>

              <button
                type="submit"
                className="settings-update-pw-btn"
                disabled={passwordSaving}
              >
                {passwordSaving ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-key-fill"></i>
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* 6. Terms, Policies & Compliance Card */}
          <div className="settings-card mb-3">
            <div className="settings-card-header">
              <div className="settings-card-header-left">
                <div className="settings-icon-badge blue">
                  <i className="bi bi-file-earmark-ruled-fill"></i>
                </div>
                <h6 className="settings-card-title blue">Terms, Policies &amp; Compliance</h6>
              </div>
            </div>

            <p className="settings-card-desc">
              Review the software usage terms, privacy guidelines, refund policies, and developer contact details.
            </p>

            <div className="settings-accordion-list">
              
              {/* Accordion 1: Terms & Conditions */}
              <div className="settings-accordion-item">
                <button
                  type="button"
                  className="settings-accordion-header-btn"
                  onClick={() => togglePolicy('terms')}
                >
                  <div className="settings-accordion-header-left">
                    <i className="bi bi-file-earmark-text-fill" style={{ color: '#2563eb' }}></i>
                    <span>Terms &amp; Conditions</span>
                  </div>
                  <i className={`bi bi-chevron-down settings-accordion-chevron ${openPolicy === 'terms' ? 'open' : ''}`}></i>
                </button>
                {openPolicy === 'terms' && (
                  <div className="settings-accordion-body">
                    <p className="fw-medium text-dark mb-2">Welcome to <strong>EmbroBill</strong>. By installing, accessing, or using this software, you agree to the following terms and conditions.</p>
                    <ol className="ps-3 mb-0">
                      <li className="mb-2"><strong>License:</strong> This software is licensed, not sold. The purchaser receives a non-transferable license to use the software for their business operations.</li>
                      <li className="mb-2"><strong>Permitted Use:</strong> The software may be used only for lawful business purposes, including invoice generation, customer management, and sales record maintenance.</li>
                      <li className="mb-2">
                        <strong>Restrictions:</strong> Users may not copy, reverse engineer, or redistribute the software without written authorization.
                      </li>
                      <li className="mb-2">
                        <strong>User Responsibility:</strong> The user is solely responsible for invoice data accuracy, GST compliance, and local backups.
                      </li>
                      <li className="mb-2"><strong>Software License Validity &amp; Renewal:</strong> The purchased software license is valid for 1 year from activation. Renewal is required to maintain uninterrupted access.</li>
                      <li className="mb-0"><strong>Acceptance:</strong> By using this software, the user agrees to all terms and conditions stated above.</li>
                    </ol>
                  </div>
                )}
              </div>

              {/* Accordion 2: Privacy Policy */}
              <div className="settings-accordion-item">
                <button
                  type="button"
                  className="settings-accordion-header-btn"
                  onClick={() => togglePolicy('privacy')}
                >
                  <div className="settings-accordion-header-left">
                    <i className="bi bi-shield-fill-check" style={{ color: '#10b981' }}></i>
                    <span>Privacy Policy</span>
                  </div>
                  <i className={`bi bi-chevron-down settings-accordion-chevron ${openPolicy === 'privacy' ? 'open' : ''}`}></i>
                </button>
                {openPolicy === 'privacy' && (
                  <div className="settings-accordion-body">
                    <ol className="ps-3 mb-0">
                      <li className="mb-2"><strong>Information Stored:</strong> Customer information, invoice records, and business profile details are stored locally.</li>
                      <li className="mb-2"><strong>Data Ownership:</strong> All business data entered into the software remains the complete property of the user.</li>
                      <li className="mb-2"><strong>Data Privacy:</strong> The software does not sell, rent, or share user data with third parties.</li>
                      <li className="mb-0"><strong>Backups:</strong> Users are responsible for maintaining regular backups of their data directory.</li>
                    </ol>
                  </div>
                )}
              </div>

              {/* Accordion 3: Disclaimer */}
              <div className="settings-accordion-item">
                <button
                  type="button"
                  className="settings-accordion-header-btn"
                  onClick={() => togglePolicy('disclaimer')}
                >
                  <div className="settings-accordion-header-left">
                    <i className="bi bi-exclamation-circle-fill" style={{ color: '#f59e0b' }}></i>
                    <span>Disclaimer</span>
                  </div>
                  <i className={`bi bi-chevron-down settings-accordion-chevron ${openPolicy === 'disclaimer' ? 'open' : ''}`}></i>
                </button>
                {openPolicy === 'disclaimer' && (
                  <div className="settings-accordion-body">
                    <p className="mb-2"><strong>Notice:</strong> This software is provided on an &quot;as is&quot; basis.</p>
                    <ul className="ps-3 mb-2">
                      <li className="mb-1">Users must independently verify GST calculations, tax filings, and invoice totals.</li>
                      <li className="mb-1">The developer shall not be liable for business interruption, data loss, or tax errors.</li>
                    </ul>
                    <p className="text-muted small mb-0">Please verify all printouts before submitting to customers or tax departments.</p>
                  </div>
                )}
              </div>

              {/* Accordion 4: Refund Policy */}
              <div className="settings-accordion-item">
                <button
                  type="button"
                  className="settings-accordion-header-btn"
                  onClick={() => togglePolicy('refund')}
                >
                  <div className="settings-accordion-header-left">
                    <i className="bi bi-currency-dollar" style={{ color: '#0d9488' }}></i>
                    <span>Refund Policy</span>
                  </div>
                  <i className={`bi bi-chevron-down settings-accordion-chevron ${openPolicy === 'refund' ? 'open' : ''}`}></i>
                </button>
                {openPolicy === 'refund' && (
                  <div className="settings-accordion-body">
                    <ul className="ps-3 mb-0">
                      <li className="mb-2">Once the software license key has been activated, payments are generally <strong>non-refundable</strong>.</li>
                      <li className="mb-2">Refund requests may be considered only if the software cannot be activated due to developer technical issues.</li>
                      <li className="mb-0">All refund decisions are made solely by the developer.</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Accordion 5: Contact Information */}
              <div className="settings-accordion-item">
                <button
                  type="button"
                  className="settings-accordion-header-btn"
                  onClick={() => togglePolicy('contact')}
                >
                  <div className="settings-accordion-header-left">
                    <i className="bi bi-telephone-fill" style={{ color: '#2563eb' }}></i>
                    <span>Contact Information</span>
                  </div>
                  <i className={`bi bi-chevron-down settings-accordion-chevron ${openPolicy === 'contact' ? 'open' : ''}`}></i>
                </button>
                {openPolicy === 'contact' && (
                  <div className="settings-accordion-body">
                    <div className="d-flex flex-column gap-2">
                      <div>
                        <span className="text-muted small text-uppercase fw-semibold d-block">Developer</span>
                        <strong className="text-dark">Yash Gajera</strong>
                      </div>
                      <div>
                        <span className="text-muted small text-uppercase fw-semibold d-block">Email Support</span>
                        <a href="mailto:gajerayash999@gmail.com" className="text-primary text-decoration-none fw-semibold">gajerayash999@gmail.com</a>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

        </main>

        {/* Bottom Navigation Bar */}
        <nav className="app-home-bottom-nav">
          <button 
            type="button" 
            className="app-home-bottom-tab"
            onClick={() => navigate('/')}
            title="Home"
          >
            <i className="bi bi-house-door-fill"></i>
            <span>Home</span>
          </button>

          <button 
            type="button" 
            className="app-home-bottom-tab"
            onClick={() => navigate('/dashboard')}
            title="Dashboard"
          >
            <i className="bi bi-grid-fill"></i>
            <span>Dashboard</span>
          </button>
          
          <button 
            type="button" 
            className="app-home-bottom-tab"
            onClick={() => navigate('/create-invoice')}
            title="Invoices"
          >
            <i className="bi bi-receipt"></i>
            <span>Invoices</span>
          </button>

          <button 
            type="button" 
            className="app-home-bottom-tab"
            onClick={() => navigate('/invoice-history')}
            title="History"
          >
            <i className="bi bi-clock-history"></i>
            <span>History</span>
          </button>
        </nav>

        {/* Modal: Confirm Logout */}
        {showLogoutConfirmModal && (
          <div className="app-modern-modal-backdrop" onClick={() => setShowLogoutConfirmModal(false)}>
            <div className="app-modern-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="app-modern-modal-header">
                <div className="app-modern-modal-icon red">
                  <i className="bi bi-box-arrow-right"></i>
                </div>
                <button
                  type="button"
                  className="app-modern-modal-close-btn"
                  onClick={() => setShowLogoutConfirmModal(false)}
                  aria-label="Close"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <h3 className="app-modern-modal-title">Confirm Logout</h3>
              <p className="app-modern-modal-desc">
                Are you sure you want to log out of your account? This will end your current session.
              </p>
              <div className="app-modern-modal-actions-row">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirmModal(false)}
                  className="app-modern-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeLogout}
                  className="app-modern-btn-danger"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Security Verification (Unlock Bill Format / HSN) */}
        {showUnlockModal && (
          <div
            className="app-modern-modal-backdrop"
            onClick={() => { setShowUnlockModal(false); setUnlockPassword(''); setUnlockError(''); }}
          >
            <div className="app-modern-modal-card wide" onClick={(e) => e.stopPropagation()}>
              <div className="app-modern-modal-header">
                <div className="app-modern-modal-icon red">
                  <i className="bi bi-shield-lock-fill"></i>
                </div>
                <button
                  type="button"
                  className="app-modern-modal-close-btn"
                  onClick={() => { setShowUnlockModal(false); setUnlockPassword(''); setUnlockError(''); }}
                  aria-label="Close"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <h3 className="app-modern-modal-title">Security Verification</h3>
              <p className="app-modern-modal-desc">
                To edit the {unlockTarget === 'bill' ? 'Bill Prefix or Starting Number sequence' : 'Default HSN Code'}, please enter your account password.
              </p>
              <form onSubmit={handleUnlockSubmit}>
                <div className="mb-3">
                  <label className="form-label fw-semibold small mb-1">Account Password</label>
                  <input
                    type="password"
                    className="app-modern-modal-input"
                    value={unlockPassword}
                    onChange={(e) => setUnlockPassword(e.target.value)}
                    required
                    autoFocus
                    placeholder="Enter password"
                  />
                </div>
                <div className="app-modern-modal-actions-row">
                  <button
                    type="button"
                    onClick={() => { setShowUnlockModal(false); setUnlockPassword(''); setUnlockError(''); }}
                    className="app-modern-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="app-modern-btn-danger"
                  >
                    Verify & Unlock
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
