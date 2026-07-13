import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import settingsAPI from '../services/settingsAPI';
import authAPI from '../services/authAPI';
import DateInput from '../utils/DateInput';

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
    user_id: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: ''
  });
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const navigate = useNavigate();

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
          user_id: data.user_id || ''
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

  const handleActivateLicense = async (e) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      triggerAlert('License Key cannot be empty.', 'warning');
      return;
    }
    setActivating(true);
    try {
      await settingsAPI.activateLicense(licenseKey.trim());
      triggerAlert('License activated successfully.', 'success');
      setShowLicenseModal(false);
      setLicenseKey('');
      await fetchSettings();
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
      triggerAlert(errorMsg, 'danger');
    } finally {
      setActivating(false);
    }
  };

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
      navigate('/create-invoice');
    } catch (err) {
      console.error('Failed to save settings:', err);
      triggerAlert(err.response?.data?.error || 'Error saving settings.', 'danger');
    } finally {
      setSaving(false);
    }
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

  if (loading) {
    return (
      <div className="container-fluid p-0">
        <div className="content-card text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-0 d-flex flex-column flex-grow-1">
      <div className="content-card flex-grow-1 d-flex flex-column">
        <div className="card-title mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
          <span className="fs-4 fw-bold">
            <i className="bi bi-gear-fill me-2 text-primary"></i> Company Settings
          </span>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-pill d-flex align-items-center gap-1"
              style={{ pointerEvents: 'none' }}
            >
              <i className="bi bi-person-circle"></i>
              ID: {formData.user_id || user?.username}
            </button>
            <button
              type="button"
              onClick={() => setShowLicenseModal(true)}
              className="btn btn-outline-primary btn-sm d-flex align-items-center"
            >
              <i className="bi bi-key-fill me-1"></i> License Manager
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-outline-danger btn-sm d-flex align-items-center"
            >
              <i className="bi bi-box-arrow-right me-1"></i> Logout
            </button>
          </div>
        </div>
        <p className="text-muted">Configure your company identity, banking details, and default billing terms here. This information will appear on all generated invoices.</p>

        <form onSubmit={handleSubmit} className="mt-4">
          <h5 className="border-bottom pb-2 mb-3 text-primary">Company Identity</h5>
          <div className="row g-3 mb-4">
            <div className="col-md-4 col-12">
              <label className="form-label text-uppercase fw-bold invoice-form-label">Company Name</label>
              <input
                type="text"
                name="company_name"
                className="form-control"
                value={formData.company_name}
                onChange={handleChange}
                disabled={true}
              />
            </div>
            <div className="col-md-4 col-12">
              <label className="form-label text-uppercase fw-bold invoice-form-label">Phone Number</label>
              <input
                type="text"
                name="phone"
                className="form-control"
                value={formData.phone}
                onChange={handleChange}
                disabled={saving}
              />
            </div>
            <div className="col-md-4 col-12">
              <label className="form-label text-uppercase fw-bold invoice-form-label">Plan Expiry Date</label>
              <DateInput
                name="plan_expiry_date"
                className="form-control"
                value={formData.plan_expiry_date}
                onChange={handleChange}
                disabled={true}
              />
            </div>
            <div className="col-12">
              <label className="form-label text-uppercase fw-bold invoice-form-label">Address</label>
              <textarea
                name="address"
                className="form-control"
                rows="3"
                value={formData.address}
                onChange={handleChange}
                disabled={saving}
              />
            </div>
          </div>

          <h5 className="border-bottom pb-2 mb-3 text-primary">GST & Tax Identifiers</h5>
          <div className="row g-3 mb-4">
            <div className="col-md-4 col-12">
              <label className="form-label text-uppercase fw-bold invoice-form-label">GST Number</label>
              <input
                type="text"
                name="gst_number"
                className="form-control"
                value={formData.gst_number}
                onChange={handleChange}
                maxLength="15"
                disabled={true}
              />
            </div>
            <div className="col-md-4 col-12">
              <label className="form-label text-uppercase fw-bold invoice-form-label">State Code</label>
              <input
                type="text"
                name="state_code"
                className="form-control"
                value={formData.state_code}
                onChange={handleChange}
                disabled={saving}
              />
            </div>
            <div className="col-md-4 col-12">
              <label className="form-label text-uppercase fw-bold invoice-form-label">PAN Number</label>
              <input
                type="text"
                name="pan_number"
                className="form-control"
                value={formData.pan_number}
                onChange={handleChange}
                maxLength="10"
                disabled={true}
              />
            </div>
          </div>

          <h5 className="border-bottom pb-2 mb-3 text-primary">Banking Information</h5>
          <div className="row g-3 mb-4">
            <div className="col-md-4 col-12">
              <label className="form-label text-uppercase fw-bold invoice-form-label">Bank Name</label>
              <input
                type="text"
                name="bank_name"
                className="form-control"
                value={formData.bank_name}
                onChange={handleChange}
                disabled={saving}
              />
            </div>
            <div className="col-md-4 col-12">
              <label className="form-label text-uppercase fw-bold invoice-form-label">Account Number</label>
              <input
                type="text"
                name="account_number"
                className="form-control"
                value={formData.account_number}
                onChange={handleChange}
                disabled={saving}
              />
            </div>
            <div className="col-md-4 col-12">
              <label className="form-label text-uppercase fw-bold invoice-form-label">IFSC Code</label>
              <input
                type="text"
                name="ifsc_code"
                className="form-control"
                value={formData.ifsc_code}
                onChange={handleChange}
                disabled={saving}
              />
            </div>
          </div>

          <h5 className="border-bottom pb-2 mb-3 text-primary">Terms & Conditions</h5>
          <div className="row g-3 mb-4">
            <div className="col-12">
              <label className="form-label text-uppercase fw-bold invoice-form-label">Terms & Conditions (One per line)</label>
              <textarea
                name="terms_conditions"
                className="form-control"
                rows="5"
                value={formData.terms_conditions}
                onChange={handleChange}
                disabled={saving}
              />
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2">
            <button
              type="button"
              onClick={() => navigate('/create-invoice')}
              className="btn btn-light border"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Saving Changes...
                </>
              ) : (
                <>
                  <i className="bi bi-save me-1"></i> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password Section */}
      <div className="content-card mt-4">
        <h4 className="card-title text-danger">
          <i className="bi bi-shield-lock-fill me-2"></i> Change Password
        </h4>
        <p className="text-muted">Update your account login password. You will need to enter your current password to authorize this update.</p>

        <form onSubmit={handlePasswordSubmit} className="mt-3">
          <div className="row g-3 align-items-end">
            <div className="col-md-4 col-12">
              <label className="form-label text-uppercase fw-bold invoice-form-label">Current Password</label>
              <input
                type="password"
                name="old_password"
                className="form-control"
                placeholder="Enter current password"
                value={passwordData.old_password}
                onChange={handlePasswordChange}
                required
                disabled={passwordSaving}
              />
            </div>
            <div className="col-md-4 col-12">
              <label className="form-label text-uppercase fw-bold invoice-form-label">New Password</label>
              <input
                type="password"
                name="new_password"
                className="form-control"
                placeholder="Enter new password"
                value={passwordData.new_password}
                onChange={handlePasswordChange}
                required
                disabled={passwordSaving}
              />
            </div>
            <div className="col-md-4 col-12">
              <button
                type="submit"
                className="btn btn-danger w-100"
                disabled={passwordSaving}
                style={{ height: '38px' }}
              >
                {passwordSaving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Updating...
                  </>
                ) : (
                  <>
                    <i className="bi bi-key-fill me-1"></i> Update Password
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Legal & Policies Accordion Card */}
      <div className="content-card mt-4 mb-4">
        <h4 className="card-title text-primary mb-3">
          <i className="bi bi-file-earmark-ruled-fill me-2"></i> Terms, Policies & Compliance
        </h4>
        <p className="text-muted text-start mb-4">Review the software usage terms, privacy guidelines, refund policies, and developer contact details.</p>

        <div className="accordion mt-3" id="legalAccordion" style={{ borderRadius: '12px', overflow: 'hidden' }}>

          {/* Terms & Conditions */}
          <div className="accordion-item border-0 mb-2 shadow-sm" style={{ borderRadius: '12px' }}>
            <h2 className="accordion-header" id="headingTerms">
              <button
                className="accordion-button collapsed fw-bold text-dark bg-white"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapseTerms"
                aria-expanded="false"
                aria-controls="collapseTerms"
                style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
              >
                <i className="bi bi-file-earmark-text-fill me-2 text-primary"></i> Terms & Conditions
              </button>
            </h2>
            <div id="collapseTerms" className="accordion-collapse collapse" aria-labelledby="headingTerms" data-bs-parent="#legalAccordion">
              <div className="accordion-body bg-white text-black border-top-0 text-start" style={{ border: '1px solid #e2e8f0', borderTop: 0, borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                <p className="fw-medium text-dark">Welcome to <strong>EmbroBill</strong>. By installing, accessing, or using this software, you agree to the following terms and conditions.</p>
                <ol className="ps-3 mt-3">
                  <li className="mb-2"><strong>License:</strong> This software is licensed, not sold. The purchaser receives a non-transferable license to use the software for their business operations.</li>
                  <li className="mb-2"><strong>Permitted Use:</strong> The software may be used only for lawful business purposes, including invoice generation, customer management, and sales record maintenance.</li>
                  <li className="mb-3">
                    <strong>Restrictions:</strong> Users may not:
                    <ul className="list-unstyled ps-3 mt-1">
                      <li className="mb-1"><i className="bi bi-x-circle-fill text-danger me-1"></i> Copy, modify, or redistribute the software without permission.</li>
                      <li className="mb-1"><i className="bi bi-x-circle-fill text-danger me-1"></i> Reverse engineer, decompile, or attempt to extract source code.</li>
                      <li className="mb-1"><i className="bi bi-x-circle-fill text-danger me-1"></i> Resell or sublicense the software without written authorization.</li>
                    </ul>
                  </li>
                  <li className="mb-3">
                    <strong>User Responsibility:</strong> The user is solely responsible for:
                    <ul className="list-unstyled ps-3 mt-1">
                      <li className="mb-1"><i className="bi bi-check-circle-fill text-success me-1"></i> Accuracy of invoices and billing data.</li>
                      <li className="mb-1"><i className="bi bi-check-circle-fill text-success me-1"></i> GST, tax, and legal compliance.</li>
                      <li className="mb-1"><i className="bi bi-check-circle-fill text-success me-1"></i> Maintaining backups of important business records.</li>
                    </ul>
                  </li>
                  <li className="mb-2"><strong>Software Updates:</strong> The developer may provide updates, bug fixes, and improvements at their discretion.</li>
                  <li className="mb-3">
                    <strong>Limitation of Liability:</strong> The developer shall not be liable for:
                    <ul className="list-unstyled ps-3 mt-1">
                      <li className="mb-1"><i className="bi bi-exclamation-circle-fill text-warning me-1"></i> Loss of business data.</li>
                      <li className="mb-1"><i className="bi bi-exclamation-circle-fill text-warning me-1"></i> Financial losses.</li>
                      <li className="mb-1"><i className="bi bi-exclamation-circle-fill text-warning me-1"></i> Tax calculation errors.</li>
                      <li className="mb-1"><i className="bi bi-exclamation-circle-fill text-warning me-1"></i> Business interruptions caused by hardware, software, or third-party failures.</li>
                    </ul>
                  </li>
                  <li className="mb-2"><strong>Termination:</strong> The license may be terminated if the user violates these terms.</li>
                  <li className="mb-3">
                    <strong>Software License Validity & Renewal:</strong> The purchased software license is valid for a period of one (1) year from the date of activation. Upon expiration of the license period, access to the software may be restricted or disabled. To continue using the software after the license expiry date, the user must contact the developer through the Contact Us section for license renewal and further activation. Renewal fees, if applicable, will be communicated at the time of renewal.
                    <br />
                    <span className="text-dark fw-medium">The user is responsible for renewing the license before the expiry date to ensure uninterrupted access to the software.</span>
                  </li>
                  <li className="mb-2"><strong>Acceptance:</strong> By using this software, the user agrees to all terms and conditions stated above.</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Privacy Policy */}
          <div className="accordion-item border-0 mb-2 shadow-sm" style={{ borderRadius: '12px' }}>
            <h2 className="accordion-header" id="headingPrivacy">
              <button
                className="accordion-button collapsed fw-bold text-dark bg-white"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapsePrivacy"
                aria-expanded="false"
                aria-controls="collapsePrivacy"
                style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
              >
                <i className="bi bi-shield-fill-check me-2 text-success"></i> Privacy Policy
              </button>
            </h2>
            <div id="collapsePrivacy" className="accordion-collapse collapse" aria-labelledby="headingPrivacy" data-bs-parent="#legalAccordion">
              <div className="accordion-body bg-white text-black border-top-0 text-start" style={{ border: '1px solid #e2e8f0', borderTop: 0, borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                <ol className="ps-3 mt-2">
                  <li className="mb-3">
                    <strong>Information Stored:</strong> This software may store:
                    <ul className="list-unstyled ps-3 mt-1">
                      <li className="mb-1"><i className="bi bi-dot me-1 text-primary"></i> Customer information</li>
                      <li className="mb-1"><i className="bi bi-dot me-1 text-primary"></i> Invoice records</li>
                      <li className="mb-1"><i className="bi bi-dot me-1 text-primary"></i> Product information</li>
                      <li className="mb-1"><i className="bi bi-dot me-1 text-primary"></i> Business information entered by the user</li>
                    </ul>
                  </li>
                  <li className="mb-2"><strong>Data Ownership:</strong> All business data entered into the software remains the property of the user.</li>
                  <li className="mb-2"><strong>Data Storage:</strong> Data is stored locally on the user's computer and/or authorized backup locations selected by the user.</li>
                  <li className="mb-2"><strong>Data Sharing:</strong> The software does not sell, rent, or share user data with third parties unless required by law.</li>
                  <li className="mb-2"><strong>Security:</strong> Reasonable measures are taken to protect data; however, absolute security cannot be guaranteed.</li>
                  <li className="mb-2"><strong>Backup Responsibility:</strong> Users are responsible for maintaining regular backups of their data.</li>
                  <li className="mb-2"><strong>Data Deletion:</strong> Users may delete their records at any time. Deleted data may not be recoverable.</li>
                  <li className="mb-2"><strong>Changes to Policy:</strong> The developer may update this Privacy Policy from time to time.</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="accordion-item border-0 mb-2 shadow-sm" style={{ borderRadius: '12px' }}>
            <h2 className="accordion-header" id="headingDisclaimer">
              <button
                className="accordion-button collapsed fw-bold text-dark bg-white"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapseDisclaimer"
                aria-expanded="false"
                aria-controls="collapseDisclaimer"
                style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
              >
                <i className="bi bi-exclamation-octagon-fill me-2 text-warning"></i> Disclaimer
              </button>
            </h2>
            <div id="collapseDisclaimer" className="accordion-collapse collapse" aria-labelledby="headingDisclaimer" data-bs-parent="#legalAccordion">
              <div className="accordion-body bg-white text-black border-top-0 text-start" style={{ border: '1px solid #e2e8f0', borderTop: 0, borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                <div className="alert alert-warning border-0 bg-warning-light p-3 mb-3 d-flex align-items-start text-start">
                  <i className="bi bi-info-circle-fill me-2 mt-0.5 text-warning fs-5"></i>
                  <div>
                    <strong className="text-dark">Important Notice:</strong> This software is provided on an "as is" basis.
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <p className="fw-bold text-dark mb-2">The developer does not guarantee:</p>
                    <ul className="list-unstyled ps-2">
                      <li className="mb-1"><i className="bi bi-x-circle text-danger me-1"></i> Accuracy of tax calculations.</li>
                      <li className="mb-1"><i className="bi bi-x-circle text-danger me-1"></i> Compliance with future government regulations.</li>
                      <li className="mb-1"><i className="bi bi-x-circle text-danger me-1"></i> Continuous uninterrupted operation.</li>
                    </ul>
                  </div>
                  <div className="col-md-6">
                    <p className="fw-bold text-dark mb-2">Users must independently verify:</p>
                    <ul className="list-unstyled ps-2">
                      <li className="mb-1"><i className="bi bi-check-square text-success me-1"></i> GST calculations</li>
                      <li className="mb-1"><i className="bi bi-check-square text-success me-1"></i> Tax filings</li>
                      <li className="mb-1"><i className="bi bi-check-square text-success me-1"></i> Invoice details</li>
                      <li className="mb-1"><i className="bi bi-check-square text-success me-1"></i> Customer information</li>
                    </ul>
                  </div>
                </div>
                <p className="mt-3 mb-0 pt-3 border-top text-dark fw-medium text-center text-md-start">
                  The developer shall not be responsible for any direct or indirect loss arising from the use of this software.
                </p>
              </div>
            </div>
          </div>

          {/* Refund Policy */}
          <div className="accordion-item border-0 mb-2 shadow-sm" style={{ borderRadius: '12px' }}>
            <h2 className="accordion-header" id="headingRefund">
              <button
                className="accordion-button collapsed fw-bold text-dark bg-white"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapseRefund"
                aria-expanded="false"
                aria-controls="collapseRefund"
                style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
              >
                <i className="bi bi-currency-dollar me-2 text-info"></i> Refund Policy
              </button>
            </h2>
            <div id="collapseRefund" className="accordion-collapse collapse" aria-labelledby="headingRefund" data-bs-parent="#legalAccordion">
              <div className="accordion-body bg-white text-black border-top-0 text-start" style={{ border: '1px solid #e2e8f0', borderTop: 0, borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                <p className="fw-semibold text-dark mb-2">Software License Purchase</p>
                <ul className="ps-3 mb-0">
                  <li className="mb-2">Once the software license has been activated, payments are generally <strong>non-refundable</strong>.</li>
                  <li className="mb-2">Refund requests may be considered only in cases where the software cannot be activated due to technical issues caused by the developer.</li>
                  <li className="mb-0">Refund decisions are made solely by the developer.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="accordion-item border-0 mb-2 shadow-sm" style={{ borderRadius: '12px' }}>
            <h2 className="accordion-header" id="headingContact">
              <button
                className="accordion-button collapsed fw-bold text-dark bg-white"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapseContact"
                aria-expanded="false"
                aria-controls="collapseContact"
                style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
              >
                <i className="bi bi-telephone-fill me-2 text-primary"></i> Contact Information
              </button>
            </h2>
            <div id="collapseContact" className="accordion-collapse collapse" aria-labelledby="headingContact" data-bs-parent="#legalAccordion">
              <div className="accordion-body bg-white text-secondary border-top-0 text-start" style={{ border: '1px solid #e2e8f0', borderTop: 0, borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                <div className="row g-3">
                  <div className="col-sm-6">
                    <div className="p-3 bg-light rounded-3 d-flex align-items-center">
                      <i className="bi bi-person-fill fs-3 text-primary me-3"></i>
                      <div>
                        <small className="text-muted d-block text-uppercase font-monospace">Developer</small>
                        <strong className="text-dark fs-5">Yash Gajera</strong>
                      </div>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="p-3 bg-light rounded-3 d-flex align-items-center">
                      <i className="bi bi-envelope-fill fs-3 text-success me-3"></i>
                      <div>
                        <small className="text-muted d-block text-uppercase font-monospace">Email</small>
                        <a href="mailto:gajerayash999@gmail.com" className="text-dark fw-bold fs-5 text-decoration-none">gajerayash999@gmail.com</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Modal overlay popup for Confirm Logout */}
      {showLogoutConfirmModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title text-danger fw-bold d-flex align-items-center">
                  <i className="bi bi-exclamation-triangle-fill me-2 text-danger"></i> Confirm Logout
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowLogoutConfirmModal(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body py-3">
                <p className="mb-0 text-start">
                  Are you sure you want to log out of your account? This will end your current session.
                </p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirmModal(false)}
                  className="btn btn-light border btn-sm px-3"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeLogout}
                  className="btn btn-danger btn-sm px-3"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* License Manager Modal */}
      {showLicenseModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <form onSubmit={handleActivateLicense}>
                <div className="modal-header border-0 pb-0">
                  <h5 className="modal-title text-primary fw-bold d-flex align-items-center">
                    <i className="bi bi-key-fill me-2 text-primary"></i> License Manager
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowLicenseModal(false)}
                    aria-label="Close"
                    disabled={activating}
                  ></button>
                </div>
                <div className="modal-body py-3">
                  <div className="mb-3 text-start">
                    <label className="form-label text-uppercase fw-bold invoice-form-label">License Key</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter license key"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      disabled={activating}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button
                    type="button"
                    onClick={() => setShowLicenseModal(false)}
                    className="btn btn-light border btn-sm px-3"
                    disabled={activating}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm px-3"
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
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
