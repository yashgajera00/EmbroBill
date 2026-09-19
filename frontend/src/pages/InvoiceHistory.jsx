import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import invoiceAPI from '../services/invoiceAPI';
import Rupee from '../utils/Rupee';
import DateInput from '../utils/DateInput';
import { isAndroidApp, downloadPdfBlob, previewPdfBlob } from '../utils/pdfHelper';
import '../styles/appHome.css';

const formatAmount = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export default function InvoiceHistory({ user, onLogout, triggerAlert }) {
  const navigate = useNavigate();
  const location = useLocation();
  const initialBill = location.state?.searchBill || '';
  const [invoices, setInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState(initialBill);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDocType, setShowDocType] = useState('all'); // 'all', 'invoices', 'challans'
  const [openCardActionId, setOpenCardActionId] = useState(null);

  // Modal states
  const [deleteInvoice, setDeleteInvoice] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [previewInvoiceId, setPreviewInvoiceId] = useState(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Edit Payment modal state
  const [editingPayment, setEditingPayment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const fetchInvoices = async (params = {}) => {
    setLoading(true);
    try {
      const data = await invoiceAPI.list(params);
      setInvoices(data || []);
    } catch (err) {
      console.error('Failed to load invoices:', err);
      if (triggerAlert) triggerAlert('Failed to load invoice history.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchInvoices({
        q: searchQuery,
        date_from: dateFrom,
        date_to: dateTo
      });
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, dateFrom, dateTo]);

  // Close card action menu on outside click
  useEffect(() => {
    if (openCardActionId === null) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.history-card-actions-container')) {
        setOpenCardActionId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [openCardActionId]);

  const allCount = invoices.length;
  const invoicesCount = invoices.filter(inv => !inv.is_challan).length;
  const challansCount = invoices.filter(inv => !!inv.is_challan).length;

  const filteredInvoices = invoices.filter(inv => {
    if (showDocType === 'invoices' && inv.is_challan) return false;
    if (showDocType === 'challans' && !inv.is_challan) return false;
    if (!searchQuery) return true;
    const qLower = searchQuery.toLowerCase();
    return (
      (inv.bill_number || '').toLowerCase().includes(qLower) ||
      (inv.customer_name || '').toLowerCase().includes(qLower) ||
      (inv.broker || '').toLowerCase().includes(qLower)
    );
  });

  const hasActiveFilters = Boolean(searchQuery || dateFrom || dateTo);

  const handleClearFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  };

  // Totals calculation
  const calculateTotals = () => {
    return filteredInvoices.reduce((acc, inv) => {
      const amount = Number(inv.amount) || 0;
      const tds = Number(inv.tds) || 0;
      const noteAmount = Number(inv.note_amount) || 0;

      let finalAmount = amount - tds;
      if (inv.note_type === 'debit') {
        finalAmount -= noteAmount;
      } else if (inv.note_type === 'credit') {
        finalAmount += noteAmount;
      }

      acc.amount += amount;
      acc.tds += tds;
      acc.totalAmount += finalAmount;
      return acc;
    }, { amount: 0, tds: 0, totalAmount: 0 });
  };
  const totals = calculateTotals();

  // Financial year calculation
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const fyStart = currentMonth >= 4 ? currentYear : currentYear - 1;
  const fyEnd = fyStart + 1;
  const fyText = `FY ${fyStart}–${String(fyEnd).slice(-2)} Ledgers`;

  // Delete handler
  const handleDeleteSubmit = async () => {
    if (!deleteInvoice) return;
    setDeleting(true);
    try {
      await invoiceAPI.delete(deleteInvoice.id);
      if (triggerAlert) {
        triggerAlert(`${deleteInvoice.is_challan ? 'Challan' : 'Invoice'} ${deleteInvoice.bill_number || '-'} deleted successfully.`, 'success');
      }
      setDeleteInvoice(null);
      fetchInvoices({
        q: searchQuery,
        date_from: dateFrom,
        date_to: dateTo
      });
    } catch (err) {
      console.error('Failed to delete invoice:', err);
      if (triggerAlert) {
        triggerAlert(err.response?.data?.error || 'Failed to delete record.', 'danger');
      }
    } finally {
      setDeleting(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = async (invoiceId, billNumber) => {
    try {
      const blob = await invoiceAPI.getPdfBlob(invoiceId);
      const prefix = showDocType === 'challans' ? 'Challan' : 'Invoice';
      const cleanBillNo = (billNumber || 'Bill').replace(/\//g, '_');
      const filename = `${prefix}_${cleanBillNo}.pdf`;
      await downloadPdfBlob(blob, filename, triggerAlert);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      if (triggerAlert) triggerAlert('Error downloading PDF file.', 'danger');
    }
  };

  const handleDuplicate = (invoiceId) => {
    navigate(`/create-invoice?duplicate_id=${invoiceId}`);
  };

  // Edit Payment Handlers
  const handleEditPaymentClick = (inv) => {
    const paymentData = {
      id: inv.id,
      bill_number: inv.bill_number || '-',
      customer_name: inv.customer_name || inv.customer?.name || '-',
      bill_date: inv.bill_date || '',
      amount: inv.amount || 0,
      note_type: inv.note_type || '',
      note_amount: (inv.note_amount !== null && inv.note_amount !== undefined && Number(inv.note_amount) !== 0) ? inv.note_amount : '',
      bank_name: inv.bank_name || '',
      check_no: inv.check_no || '',
      check_date: inv.check_date || '',
      tds: (inv.tds !== null && inv.tds !== undefined && Number(inv.tds) !== 0) ? inv.tds : ''
    };
    setEditingPayment(paymentData);
    setValidationErrors({});
    setOpenCardActionId(null);
  };

  const handlePaymentChange = (field, value) => {
    setEditingPayment(prev => ({
      ...prev,
      [field]: value
    }));
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const handleModalCloseRequest = () => {
    if (saving) return;
    setEditingPayment(null);
    setValidationErrors({});
  };

  const validate = () => {
    const errors = {};
    const tdsVal = parseFloat(editingPayment.tds);
    if (editingPayment.tds !== '' && (isNaN(tdsVal) || tdsVal < 0)) {
      errors.tds = "TDS must be greater than or equal to 0.";
    }
    if (editingPayment.note_type) {
      const amt = parseFloat(editingPayment.note_amount);
      if (editingPayment.note_amount === '' || isNaN(amt) || amt < 0) {
        errors.note_amount = "Note Amount must be greater than or equal to 0.";
      }
    }
    if (editingPayment.check_date) {
      const parsedDate = new Date(editingPayment.check_date);
      if (isNaN(parsedDate.getTime())) {
        errors.check_date = "Check Date is invalid.";
      }
    }
    return errors;
  };

  const handleSavePaymentDetails = async () => {
    if (!editingPayment) return;
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      if (triggerAlert) triggerAlert('Please fix the validation errors before saving.', 'danger');
      return;
    }
    setSaving(true);
    try {
      const updatedInvoice = await invoiceAPI.updatePayment(editingPayment.id, {
        note_type: editingPayment.note_type || '',
        note_amount: editingPayment.note_type ? (editingPayment.note_amount === '' ? null : parseFloat(editingPayment.note_amount)) : null,
        bank_name: editingPayment.bank_name.trim(),
        check_no: editingPayment.check_no.trim(),
        check_date: editingPayment.check_date || null,
        tds: editingPayment.tds === '' ? null : parseFloat(editingPayment.tds)
      });

      setInvoices(prev => prev.map(inv =>
        inv.id === updatedInvoice.id
          ? {
            ...inv,
            note_type: updatedInvoice.note_type,
            note_amount: updatedInvoice.note_amount,
            bank_name: updatedInvoice.bank_name,
            check_no: updatedInvoice.check_no,
            check_date: updatedInvoice.check_date,
            tds: updatedInvoice.tds
          }
          : inv
      ));

      if (triggerAlert) triggerAlert('Payment details saved successfully.', 'success');
      setEditingPayment(null);
      setValidationErrors({});
    } catch (err) {
      console.error('Failed to update payment details:', err);
      if (triggerAlert) triggerAlert(err.response?.data?.error || 'Failed to update payment details.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  // PDF Preview Handling
  useEffect(() => {
    if (!previewInvoiceId) {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }
      setPreviewBlob(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    invoiceAPI.getPdfBlob(previewInvoiceId)
      .then(async (blob) => {
        if (!cancelled) {
          setPreviewBlob(blob);
          const selected = invoices.find(inv => inv.id === previewInvoiceId);
          const cleanBillNo = (selected?.bill_number || 'Preview').replace(/\//g, '_');
          const prefix = selected?.is_challan ? 'Challan' : 'Invoice';
          const filename = `${prefix}_${cleanBillNo}.pdf`;
          
          if (window.electron && window.electron.setPreviewFilename) {
            window.electron.setPreviewFilename(filename);
          }

          const file = new File([blob], filename, { type: 'application/pdf' });
          const url = URL.createObjectURL(file);
          setPreviewBlobUrl(url);

          // If in Android APK, automatically open system PDF viewer
          if (isAndroidApp()) {
            await previewPdfBlob(blob, filename);
          }
        }
      })
      .catch(err => {
        console.error('Failed to load PDF preview:', err);
        if (!cancelled) {
          setPreviewInvoiceId(null);
        }
        if (triggerAlert) triggerAlert('Failed to load PDF preview.', 'danger');
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => { cancelled = true; };
  }, [previewInvoiceId]);

  const handleDownloadPreviewPdf = async () => {
    if (!previewBlob) return;
    const selected = invoices.find(inv => inv.id === previewInvoiceId);
    const cleanBillNo = (selected?.bill_number || 'Preview').replace(/\//g, '_');
    const prefix = selected?.is_challan ? 'Challan' : 'Invoice';
    const filename = `${prefix}_${cleanBillNo}.pdf`;
    await downloadPdfBlob(previewBlob, filename, triggerAlert);
  };

  return (
    <div className="invoice-history-wrapper">
      <div className="invoice-history-container">
        
        {/* Top Header matching Dashboard / Create Invoice style */}
        <header className="create-invoice-header">
          <button
            type="button"
            className="create-invoice-back-btn"
            onClick={() => navigate('/')}
            title="Go back to Home"
          >
            <i className="bi bi-chevron-left"></i>
          </button>
          <h1 className="create-invoice-header-title">
            Invoice History
          </h1>
        </header>

        {/* Scrollable Middle Body */}
        <main className="invoice-history-body">
          {/* Search bar with filter toggle */}
          <div className="dashboard-mobile-search-row">
            <i className="bi bi-search text-muted ms-1 me-1" style={{ fontSize: '13px' }}></i>
            <input
              type="text"
              className="dashboard-mobile-search-input"
              placeholder="Search bill no, customer, broker..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              type="button"
              className={`dashboard-mobile-filter-btn ${showFilterDrawer ? 'active' : ''}`}
              onClick={() => setShowFilterDrawer(!showFilterDrawer)}
              title="Filter by Date Range"
            >
              <i className="bi bi-sliders"></i> Filter
            </button>
          </div>

          {/* Date Filter Drawer */}
          {showFilterDrawer && (
            <div className="dashboard-mobile-filter-drawer">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-dark small fw-bold">Date Range Filter</span>
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    className="btn btn-link text-primary p-0 text-decoration-none small fw-semibold"
                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="row g-2">
                <div className="col-6">
                  <label className="text-muted small mb-1" style={{ fontSize: '11px', fontWeight: 600 }}>From</label>
                  <DateInput
                    className="form-control form-control-sm bg-white text-dark border"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="col-6">
                  <label className="text-muted small mb-1" style={{ fontSize: '11px', fontWeight: 600 }}>To</label>
                  <DateInput
                    className="form-control form-control-sm bg-white text-dark border"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Status / DocType Pills & Add Bill Button Row */}
          <div className="dashboard-mobile-actions-row">
            <div className="dashboard-status-pills">
              <button
                type="button"
                className={`dashboard-status-pill ${showDocType === 'all' ? 'active' : ''}`}
                onClick={() => setShowDocType('all')}
              >
                All ({allCount})
              </button>
              <button
                type="button"
                className={`dashboard-status-pill ${showDocType === 'invoices' ? 'active' : ''}`}
                onClick={() => setShowDocType('invoices')}
              >
                Invoices ({invoicesCount})
              </button>
              <button
                type="button"
                className={`dashboard-status-pill ${showDocType === 'challans' ? 'active' : ''}`}
                onClick={() => setShowDocType('challans')}
              >
                Challans ({challansCount})
              </button>
            </div>

            <button
              type="button"
              className="dashboard-mobile-add-btn"
              onClick={() => navigate(showDocType === 'challans' ? '/create-challan' : '/create-invoice')}
            >
              <i className="bi bi-plus-lg"></i> Add Bill
            </button>
          </div>

          {/* Summary Card matching screenshot */}
          <div className="invoice-history-summary-card">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span className="fw-bold text-uppercase" style={{ fontSize: '12px', letterSpacing: '0.4px', color: '#475569' }}>
                  TOTAL {showDocType === 'challans' ? 'CHALLANS' : showDocType === 'invoices' ? 'INVOICED' : 'AMOUNT'}
                </span>
                <span
                  className="badge"
                  style={{
                    backgroundColor: '#ede9fe',
                    color: '#6d28d9',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    padding: '3px 8px'
                  }}
                >
                  {filteredInvoices.length}
                </span>
              </div>
              <span className="text-muted" style={{ fontSize: '12px' }}>
                {fyText}
              </span>
            </div>

            <div className="text-end">
              <div className="fw-bold" style={{ fontSize: '19px', color: '#0f172a', letterSpacing: '-0.3px' }}>
                <Rupee /> {formatAmount(totals.totalAmount)}
              </div>
              <div className="text-success small fw-semibold d-flex align-items-center justify-content-end gap-1 mt-0.5" style={{ fontSize: '11px' }}>
                <i className="bi bi-check-circle-fill"></i> Reconciled
              </div>
            </div>
          </div>

          {/* Loading Spinner */}
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            /* Empty State */
            <div className="text-center py-5 my-4 bg-white rounded-4 border p-4 shadow-sm">
              <div className="mb-3 text-muted" style={{ fontSize: '40px' }}>
                <i className="bi bi-inbox"></i>
              </div>
              <h6 className="fw-bold text-dark mb-1">No records found</h6>
              <p className="text-muted small mb-3">
                {hasActiveFilters ? 'Try changing your search filters.' : `You haven't created any ${showDocType === 'challans' ? 'delivery challans' : showDocType === 'invoices' ? 'invoices' : 'bills or challans'} yet.`}
              </p>
              <button
                type="button"
                onClick={() => navigate(showDocType === 'challans' ? '/create-challan' : '/create-invoice')}
                className="btn btn-primary btn-sm px-3 rounded-pill"
              >
                <i className="bi bi-plus-lg me-1"></i> Create {showDocType === 'challans' ? 'Challan' : 'Invoice'}
              </button>
            </div>
          ) : (
            /* Card List matching user screenshot */
            filteredInvoices.map((inv, index) => {
              const serialNo = filteredInvoices.length - index;
              const customerName = inv.customer_name || inv.customer?.name || '-';
              
              // Calculate item total amount
              const amount = Number(inv.amount) || 0;
              const tds = Number(inv.tds) || 0;
              const noteAmount = Number(inv.note_amount) || 0;
              let itemTotal = amount - tds;
              if (inv.note_type === 'debit') {
                itemTotal -= noteAmount;
              } else if (inv.note_type === 'credit') {
                itemTotal += noteAmount;
              }

              const isChallan = inv.is_challan;
              const editRoute = isChallan ? `/challans/edit/${inv.id}` : `/invoices/edit/${inv.id}`;
              const hasPayment = Boolean(inv.check_no || inv.bank_name || inv.note_type);

              return (
                <div key={inv.id} className="invoice-history-item-card">
                  
                  {/* Card Header Row */}
                  <div className="d-flex align-items-start justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <div className="history-card-serial">
                        {serialNo}
                      </div>
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-bold text-dark" style={{ fontSize: '15px' }}>
                            {customerName}
                          </span>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: '#ede9fe',
                              color: '#6d28d9',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '6px'
                            }}
                          >
                            Bill: #{inv.bill_number}
                          </span>
                        </div>
                        <div className="text-muted" style={{ fontSize: '11.5px', marginTop: '1px' }}>
                          Date: <strong className="text-dark">{formatDate(inv.bill_date)}</strong>
                          <span className="mx-1">•</span>
                          TDS: {inv.tds && Number(inv.tds) !== 0 ? <><Rupee />{formatAmount(inv.tds)}</> : (inv.tds === 0 || inv.tds === '0' || inv.tds === '0.0' ? '0.0%' : '-')}
                        </div>
                      </div>
                    </div>

                    {/* 3-Dots Quick Actions Menu */}
                    <div className="history-card-actions-container position-relative">
                      <button
                        type="button"
                        className="btn btn-light btn-sm text-muted rounded-circle p-0 d-flex align-items-center justify-content-center"
                        style={{ width: '28px', height: '28px', border: '1px solid #e2e8f0' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenCardActionId(openCardActionId === inv.id ? null : inv.id);
                        }}
                        title="Options"
                      >
                        <i className="bi bi-three-dots-vertical"></i>
                      </button>

                      {openCardActionId === inv.id && (
                        <ul
                          className="dropdown-menu dropdown-menu-end show shadow"
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            zIndex: 1050,
                            minWidth: '160px',
                            borderRadius: '10px'
                          }}
                        >
                          <li>
                            <button
                              type="button"
                              className="dropdown-item d-flex align-items-center gap-2 small py-2"
                              onClick={() => {
                                setOpenCardActionId(null);
                                setPreviewInvoiceId(inv.id);
                              }}
                            >
                              <i className="bi bi-file-earmark-pdf text-danger"></i> View Bill (PDF)
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              className="dropdown-item d-flex align-items-center gap-2 small py-2"
                              onClick={() => handleEditPaymentClick(inv)}
                            >
                              <i className="bi bi-credit-card text-primary"></i> Edit Payment
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              className="dropdown-item d-flex align-items-center gap-2 small py-2"
                              onClick={() => {
                                setOpenCardActionId(null);
                                navigate(editRoute);
                              }}
                            >
                              <i className="bi bi-pencil-square text-success"></i> Edit Details
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              className="dropdown-item d-flex align-items-center gap-2 small py-2"
                              onClick={() => {
                                setOpenCardActionId(null);
                                handleDownloadPdf(inv.id, inv.bill_number);
                              }}
                            >
                              <i className="bi bi-download text-info"></i> Download PDF
                            </button>
                          </li>
                          {!isChallan && (
                            <li>
                              <button
                                type="button"
                                className="dropdown-item d-flex align-items-center gap-2 small py-2"
                                onClick={() => {
                                  setOpenCardActionId(null);
                                  handleDuplicate(inv.id);
                                }}
                              >
                                <i className="bi bi-files text-secondary"></i> Duplicate
                              </button>
                            </li>
                          )}
                          <li><hr className="dropdown-divider my-1" /></li>
                          <li>
                            <button
                              type="button"
                              className="dropdown-item d-flex align-items-center gap-2 small text-danger py-2"
                              onClick={() => {
                                setOpenCardActionId(null);
                                setDeleteInvoice(inv);
                              }}
                            >
                              <i className="bi bi-trash"></i> Delete
                            </button>
                          </li>
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Block 1: Debited/Credited Container */}
                  <div className="history-card-pill-box">
                    <div className="d-flex align-items-center gap-1 text-truncate">
                      {hasPayment && <span className="history-card-tag">INV</span>}
                      <span className="text-muted text-truncate" style={{ fontSize: '12px' }}>
                        Debited/Credited: {inv.note_type ? `${inv.note_type === 'credit' ? 'Credited' : 'Debited'}` : '-'}
                        {inv.bank_name ? ` @ ${inv.bank_name}` : ''}
                      </span>
                      {!inv.bank_name && (
                        <span className="text-muted text-truncate ms-2" style={{ fontSize: '12px' }}>
                          Bank: -
                        </span>
                      )}
                    </div>
                    <span className="fw-bold text-dark text-nowrap ms-2" style={{ fontSize: '13px' }}>
                      <Rupee /> {formatAmount(inv.amount)}
                    </span>
                  </div>

                  {/* Block 2: Check No / Bank Container */}
                  <div className="history-card-pill-box">
                    <div className="d-flex align-items-center gap-1 text-truncate">
                      {hasPayment && <span className="history-card-tag">CHQ</span>}
                      <span className="text-muted text-truncate" style={{ fontSize: '12px' }}>
                        {inv.check_no
                          ? ((inv.check_no.toUpperCase().startsWith('NEFT') || inv.check_no.toUpperCase().startsWith('RTGS'))
                              ? `Ref: ${inv.check_no}`
                              : `Check No: ${inv.check_no}`)
                          : 'Check No: -'}
                      </span>
                      <span className="text-muted text-truncate ms-2" style={{ fontSize: '12px' }}>
                        {inv.bank_name ? `Bank: ${inv.bank_name}` : (inv.check_date ? `Date: ${formatDate(inv.check_date)}` : 'Date: -')}
                      </span>
                    </div>
                    <span
                      className={`text-nowrap ms-2 fw-bold ${inv.check_no ? 'text-dark' : 'text-muted'}`}
                      style={{ fontSize: '12px' }}
                    >
                      {inv.check_no ? (inv.check_date ? 'Cleared' : 'Pending') : '-'}
                    </span>
                  </div>

                  {/* Card Bottom Row: View Bill & Total Amount */}
                  <div className="d-flex align-items-center justify-content-between pt-1">
                    <button
                      type="button"
                      className="history-card-view-btn"
                      onClick={() => setPreviewInvoiceId(inv.id)}
                    >
                      <i className="bi bi-file-earmark-text"></i> View Bill
                    </button>

                    <div className="text-end">
                      <div className="text-muted" style={{ fontSize: '11px', lineHeight: 1 }}>
                        Total Amount
                      </div>
                      <div className="fw-bold" style={{ color: '#4f46e5', fontSize: '16.5px', lineHeight: 1.3 }}>
                        <Rupee /> {formatAmount(itemTotal)}
                      </div>
                    </div>
                  </div>

                </div>
              );
            })
          )}
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
            className="app-home-bottom-tab active"
            onClick={() => {}}
            title="History"
          >
            <i className="bi bi-clock-history"></i>
            <span>History</span>
          </button>
        </nav>

      </div>

      {/* Modal overlay popup for Confirm Delete Invoice (modern style) */}
      {deleteInvoice && (
        <div 
          className="app-modern-modal-backdrop"
          onClick={() => setDeleteInvoice(null)}
        >
          <div 
            className="app-modern-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="app-modern-modal-header">
              <div className="app-modern-modal-icon red">
                <i className="bi bi-trash3"></i>
              </div>
              <button 
                type="button" 
                className="app-modern-modal-close-btn"
                onClick={() => setDeleteInvoice(null)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <h3 className="app-modern-modal-title">
              Delete {deleteInvoice.is_challan ? 'Delivery Challan' : 'Invoice'}
            </h3>
            <p className="app-modern-modal-desc">
              Are you sure you want to delete this record? This action cannot be undone and will permanently remove it from the system.
            </p>
            <div className="app-modern-modal-pill-box">
              <span className="app-modern-modal-badge" style={{ backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '8px' }}>
                {deleteInvoice.is_challan ? 'CHALLAN' : 'INVOICE'}
              </span>
              <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                {deleteInvoice.bill_number || '-'}
              </span>
              <strong style={{ fontSize: '13.5px' }}>
                ₹{formatAmount(deleteInvoice.amount)}
              </strong>
            </div>
            <div className="app-modern-modal-actions-row">
              <button
                type="button"
                className="app-modern-btn-secondary"
                onClick={() => setDeleteInvoice(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="app-modern-btn-danger"
                onClick={handleDeleteSubmit}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : `Delete ${deleteInvoice.is_challan ? 'Challan' : 'Invoice'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay popup for Live PDF Invoice Preview */}
      {previewInvoiceId && (
        <div className="app-modern-modal-backdrop" onClick={() => setPreviewInvoiceId(null)}>
          <div className="app-modern-modal-card preview-pdf" onClick={(e) => e.stopPropagation()}>
            <div className="app-modern-modal-header" style={{ marginBottom: '12px' }}>
              <div className="d-flex align-items-center gap-3">
                <div className="app-modern-modal-icon red" style={{ width: '38px', height: '38px', fontSize: '18px' }}>
                  <i className="bi bi-file-earmark-pdf-fill"></i>
                </div>
                <div>
                  <h4 className="app-modern-modal-title" style={{ fontSize: '17px', margin: 0 }}>
                    {invoices.find(inv => inv.id === previewInvoiceId)?.is_challan ? 'Delivery Challan' : 'Invoice'} Preview
                  </h4>
                  <span className="text-muted small">
                    Bill #{invoices.find(inv => inv.id === previewInvoiceId)?.bill_number || previewInvoiceId}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="app-modern-modal-close-btn"
                onClick={() => setPreviewInvoiceId(null)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            
            <div style={{ flex: '1 1 auto', backgroundColor: '#f1f5f9', borderRadius: '14px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
              {previewLoading || !previewBlobUrl ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary mb-3" role="status" style={{ width: '2.5rem', height: '2.5rem' }}>
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mb-0 fw-semibold text-muted">Loading PDF Preview...</p>
                </div>
              ) : isAndroidApp() ? (
                <div className="text-center p-4 d-flex flex-column align-items-center justify-content-center" style={{ width: '100%', height: '100%' }}>
                  <div style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '18px',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '34px',
                    marginBottom: '16px',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.15)'
                  }}>
                    <i className="bi bi-file-earmark-pdf-fill"></i>
                  </div>
                  <h5 className="fw-bold text-dark mb-1" style={{ fontSize: '16px' }}>
                    {invoices.find(inv => inv.id === previewInvoiceId)?.is_challan ? 'Delivery Challan' : 'Tax Invoice'} Preview
                  </h5>
                  <p className="text-muted small mb-3">
                    Bill #{invoices.find(inv => inv.id === previewInvoiceId)?.bill_number || previewInvoiceId}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary d-flex align-items-center gap-2 px-4 py-2 mb-2"
                    style={{ borderRadius: '10px', fontWeight: 600, fontSize: '14px' }}
                    onClick={() => {
                      if (previewBlob) {
                        const selected = invoices.find(inv => inv.id === previewInvoiceId);
                        const cleanBillNo = (selected?.bill_number || 'Preview').replace(/\//g, '_');
                        const prefix = selected?.is_challan ? 'Challan' : 'Invoice';
                        previewPdfBlob(previewBlob, `${prefix}_${cleanBillNo}.pdf`);
                      }
                    }}
                  >
                    <i className="bi bi-eye-fill"></i> Open in PDF Viewer
                  </button>
                  <span className="text-muted" style={{ fontSize: '11px' }}>
                    Tap to open full page with zoom, print & share
                  </span>
                </div>
              ) : (
                <iframe
                  src={`${previewBlobUrl}#zoom=100`}
                  title="Invoice PDF"
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                ></iframe>
              )}
            </div>

            <div className="app-modern-modal-actions-row" style={{ marginTop: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="app-modern-btn-secondary"
                onClick={() => setPreviewInvoiceId(null)}
                style={{ maxWidth: '140px' }}
              >
                Close
              </button>
              <button
                type="button"
                className="app-modern-btn-primary"
                onClick={handleDownloadPreviewPdf}
                disabled={!previewBlobUrl}
                style={{ maxWidth: '180px' }}
              >
                <i className="bi bi-download"></i> Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay popup for Edit Payment */}
      {editingPayment && (
        <div
          className="app-modern-modal-backdrop"
          onClick={handleModalCloseRequest}
        >
          <div
            className="app-modern-modal-card wide"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="app-modern-modal-header">
              <div className="app-modern-modal-icon blue">
                <i className="bi bi-credit-card-fill"></i>
              </div>
              <button
                type="button"
                className="app-modern-modal-close-btn"
                onClick={handleModalCloseRequest}
                aria-label="Close"
                disabled={saving}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <h3 className="app-modern-modal-title">Edit Payment</h3>
            <p className="app-modern-modal-desc">
              Update bank, cheque, TDS, or credit/debit note information.
            </p>

            {/* Reference pill box */}
            <div className="app-modern-modal-pill-box" style={{ marginBottom: '16px' }}>
              <div>
                <span className="text-muted fw-semibold d-block" style={{ fontSize: '11px', textTransform: 'uppercase' }}>CUSTOMER</span>
                <strong className="text-dark" style={{ fontSize: '13.5px' }}>{editingPayment.customer_name}</strong>
              </div>
              <div className="text-end">
                <span className="text-muted fw-semibold d-block" style={{ fontSize: '11px', textTransform: 'uppercase' }}>BILL #{editingPayment.bill_number}</span>
                <strong className="text-primary" style={{ fontSize: '14px' }}>
                  <Rupee /> {formatAmount(editingPayment.amount)}
                </strong>
              </div>
            </div>

            {/* Editable payment form */}
            <form onSubmit={(e) => e.preventDefault()} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}>
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label fw-semibold small mb-1">Bank Name</label>
                  <input
                    type="text"
                    className={`form-control form-control-sm ${validationErrors.bank_name ? 'is-invalid' : ''}`}
                    style={{ borderRadius: '10px' }}
                    value={editingPayment.bank_name}
                    onChange={(e) => handlePaymentChange('bank_name', e.target.value)}
                    placeholder="Enter Bank Name"
                    disabled={saving}
                  />
                  {validationErrors.bank_name && (
                    <div className="invalid-feedback small">{validationErrors.bank_name}</div>
                  )}
                </div>

                <div className="col-6">
                  <label className="form-label fw-semibold small mb-1">Check No.</label>
                  <input
                    type="text"
                    className={`form-control form-control-sm ${validationErrors.check_no ? 'is-invalid' : ''}`}
                    style={{ borderRadius: '10px' }}
                    value={editingPayment.check_no}
                    onChange={(e) => handlePaymentChange('check_no', e.target.value)}
                    placeholder="Enter Check No."
                    disabled={saving}
                  />
                  {validationErrors.check_no && (
                    <div className="invalid-feedback small">{validationErrors.check_no}</div>
                  )}
                </div>

                <div className="col-6">
                  <label className="form-label fw-semibold small mb-1">Check Date</label>
                  <DateInput
                    name="check_date"
                    className={`form-control form-control-sm ${validationErrors.check_date ? 'is-invalid' : ''}`}
                    value={editingPayment.check_date}
                    onChange={(e) => handlePaymentChange('check_date', e.target.value)}
                    disabled={saving}
                  />
                  {validationErrors.check_date && (
                    <div className="invalid-feedback small">{validationErrors.check_date}</div>
                  )}
                </div>

                <div className="col-6">
                  <label className="form-label fw-semibold small mb-1">TDS Amount</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-light border-end-0 text-dark"><Rupee /></span>
                    <input
                      type="number"
                      step="0.01"
                      className={`form-control form-control-sm border-start-0 ps-1 ${validationErrors.tds ? 'is-invalid' : ''}`}
                      style={{ borderTopRightRadius: '10px', borderBottomRightRadius: '10px' }}
                      value={editingPayment.tds}
                      onChange={(e) => handlePaymentChange('tds', e.target.value)}
                      placeholder="0.00"
                      disabled={saving}
                    />
                  </div>
                  {validationErrors.tds && (
                    <div className="invalid-feedback small">{validationErrors.tds}</div>
                  )}
                </div>

                <div className="col-6 mt-2">
                  <label className="form-label fw-semibold small mb-1">Note Type (Optional)</label>
                  <select
                    className="form-select form-select-sm"
                    style={{ borderRadius: '10px' }}
                    value={editingPayment.note_type || ''}
                    onChange={(e) => handlePaymentChange('note_type', e.target.value)}
                    disabled={saving}
                  >
                    <option value="">None</option>
                    <option value="debit">Debit Note</option>
                    <option value="credit">Credit Note</option>
                  </select>
                </div>

                <div className="col-6 mt-2">
                  {editingPayment.note_type && (
                    <div>
                      <label className="form-label fw-semibold small mb-1">
                        {editingPayment.note_type === 'credit' ? 'Credit Note Amount' : 'Debit Note Amount'}
                      </label>
                      <div className="input-group input-group-sm">
                        <span className="input-group-text bg-light border-end-0 text-dark"><Rupee /></span>
                        <input
                          type="number"
                          step="0.01"
                          className={`form-control form-control-sm border-start-0 ps-1 ${validationErrors.note_amount ? 'is-invalid' : ''}`}
                          style={{ borderTopRightRadius: '10px', borderBottomRightRadius: '10px' }}
                          value={editingPayment.note_amount}
                          onChange={(e) => handlePaymentChange('note_amount', e.target.value)}
                          placeholder="0.00"
                          disabled={saving}
                        />
                      </div>
                      {validationErrors.note_amount && (
                        <div className="invalid-feedback small">{validationErrors.note_amount}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </form>

            {/* Actions */}
            <div className="app-modern-modal-actions-row">
              <button
                type="button"
                onClick={handleModalCloseRequest}
                className="app-modern-btn-secondary"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePaymentDetails}
                className="app-modern-btn-primary"
                disabled={saving}
              >
                {saving && (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                )}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
