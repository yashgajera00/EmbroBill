import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import invoiceAPI from '../services/invoiceAPI';
import Rupee from '../utils/Rupee';
import DateInput from '../utils/DateInput';

const formatAmount = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return '0.00';
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};

export default function InvoiceHistory({ triggerAlert }) {
  const [invoices, setInvoices] = useState([]);
  const [filters, setFilters] = useState({
    q_bill: '',
    q_cust: '',
    date_from: '',
    date_to: ''
  });
  const [loading, setLoading] = useState(true);
  const [searchType, setSearchType] = useState('bill');
  const [searchTypeDropdownOpen, setSearchTypeDropdownOpen] = useState(false);
  const [showDocType, setShowDocType] = useState('invoices'); // 'invoices', 'challans'

  // State for confirm delete view
  const [deleteInvoice, setDeleteInvoice] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [previewInvoiceId, setPreviewInvoiceId] = useState(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [openDropdownRowId, setOpenDropdownRowId] = useState(null);

  // States for Edit Payment modal workflow
  const [editingPayment, setEditingPayment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});


  const navigate = useNavigate();

  const fetchInvoices = async (params = {}) => {
    setLoading(true);
    try {
      const data = await invoiceAPI.list(params);
      setInvoices(data);
    } catch (err) {
      console.error('Failed to load invoices:', err);
      triggerAlert('Failed to load invoice history.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchInvoices(filters);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [filters]);

  useEffect(() => {
    setSelectedInvoiceIds([]);
  }, [invoices, showDocType]);

  const filteredInvoices = invoices.filter(inv => {
    if (showDocType === 'invoices') return !inv.is_challan;
    if (showDocType === 'challans') return inv.is_challan;
    return true;
  });

  useEffect(() => {
    if (openDropdownRowId === null) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.dropdown-actions-container')) {
        setOpenDropdownRowId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [openDropdownRowId]);

  useEffect(() => {
    if (!searchTypeDropdownOpen) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.search-type-dropdown-container')) {
        setSearchTypeDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [searchTypeDropdownOpen]);

  const handleSelectInvoice = (id) => {
    setSelectedInvoiceIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedInvoiceIds.length === filteredInvoices.length) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(filteredInvoices.map(inv => inv.id));
    }
  };

  const handleDownloadSelectedPdf = async () => {
    if (selectedInvoiceIds.length === 0) return;
    try {
      triggerAlert(`Generating combined PDF for ${selectedInvoiceIds.length} invoices...`, 'info');
      const blob = await invoiceAPI.getBulkPdfBlob(selectedInvoiceIds);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Invoices_Bulk.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      triggerAlert('Bulk PDF downloaded successfully.', 'success');
    } catch (err) {
      console.error('Failed to download bulk PDF:', err);
      triggerAlert('Error downloading bulk PDF file.', 'danger');
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSearchQueryChange = (e) => {
    const { value } = e.target;
    setFilters(prev => ({
      ...prev,
      q_bill: searchType === 'bill' ? value : '',
      q_cust: searchType === 'cust' ? value : ''
    }));
  };

  const handleSearchTypeChange = (newType) => {
    setSearchType(newType);
    setFilters(prev => {
      const currentQuery = searchType === 'bill' ? prev.q_bill : prev.q_cust;
      return {
        ...prev,
        q_bill: newType === 'bill' ? (currentQuery || '') : '',
        q_cust: newType === 'cust' ? (currentQuery || '') : '',
        date_from: newType === 'date' ? prev.date_from : '',
        date_to: newType === 'date' ? prev.date_to : ''
      };
    });
  };

  const handleClearFilters = () => {
    const cleared = {
      q_bill: '',
      q_cust: '',
      date_from: '',
      date_to: ''
    };
    setFilters(cleared);
  };

  const handleDeleteSubmit = async () => {
    if (!deleteInvoice) return;
    setDeleting(true);
    try {
      await invoiceAPI.delete(deleteInvoice.id);
      triggerAlert(`Invoice ${deleteInvoice.bill_number || '-'} deleted successfully.`, 'success');
      setDeleteInvoice(null);
      fetchInvoices(filters);
    } catch (err) {
      console.error('Failed to delete invoice:', err);
      triggerAlert(err.response?.data?.error || 'Failed to delete invoice.', 'danger');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadPdf = async (invoiceId, billNumber) => {
    try {
      const blob = await invoiceAPI.getPdfBlob(invoiceId);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const filename = `Invoice_${billNumber.replace(/\//g, '_')}.pdf`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download PDF:', err);
      triggerAlert('Error downloading PDF file.', 'danger');
    }
  };

  const handleDuplicate = (invoiceId) => {
    navigate(`/create-invoice?duplicate_id=${invoiceId}`);
  };



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
  };

  const handlePaymentChange = (field, value) => {
    setEditingPayment(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear validation error for this field as the user types
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
      triggerAlert('Please fix the validation errors before saving.', 'danger');
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

      // Update only the updated invoice row locally
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

      triggerAlert('Payment details saved successfully.', 'success');
      setEditingPayment(null);
      setValidationErrors({});
    } catch (err) {
      console.error('Failed to update payment details:', err);
      triggerAlert(err.response?.data?.error || 'Failed to update payment details.', 'danger');
    } finally {
      setSaving(false);
    }
  };


  // Fetch PDF as blob when previewInvoiceId changes (fixes Electron app:// protocol PDF rendering)
  useEffect(() => {
    if (!previewInvoiceId) {
      // Clean up previous blob URL
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }
      return;
    }

    const isElectron = window.electron && window.electron.isElectron;
    if (!isElectron) {
      // Browser environment: load the PDF URL directly to preserve Content-Disposition filename
      setPreviewBlobUrl(`/api/invoices/pdf/${previewInvoiceId}/`);
      setPreviewLoading(false);
      return;
    }

    // Electron environment: fetch as blob to bypass CORS/mixed content iframe restrictions
    let cancelled = false;
    setPreviewLoading(true);
    invoiceAPI.getPdfBlob(previewInvoiceId)
      .then(blob => {
        if (!cancelled) {
          const selected = invoices.find(inv => inv.id === previewInvoiceId);
          const cleanBillNo = (selected?.bill_number || 'Preview').replace(/\//g, '_');
          const prefix = selected?.is_challan ? 'Challan' : 'Invoice';
          const filename = `${prefix}_${cleanBillNo}.pdf`;
          
          // Set filename for Electron download dialog
          if (window.electron && window.electron.setPreviewFilename) {
            window.electron.setPreviewFilename(filename);
          }

          // Use File object to set default download filename inside chromium PDF viewer
          const file = new File([blob], filename, { type: 'application/pdf' });
          const url = URL.createObjectURL(file);
          setPreviewBlobUrl(url);
        }
      })
      .catch(err => {
        console.error('Failed to load PDF preview:', err);
        if (!cancelled) {
          triggerAlert('Failed to load PDF preview.', 'danger');
          setPreviewInvoiceId(null);
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => { cancelled = true; };
  }, [previewInvoiceId, invoices]);

  const handleDownloadPreviewPdf = () => {
    if (!previewBlobUrl) return;
    const selected = invoices.find(inv => inv.id === previewInvoiceId);
    const cleanBillNo = (selected?.bill_number || 'Preview').replace(/\//g, '_');
    const prefix = selected?.is_challan ? 'Challan' : 'Invoice';
    const link = document.createElement('a');
    link.href = previewBlobUrl;
    link.setAttribute('download', `${prefix}_${cleanBillNo}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Escape key listener to close modal safely
  useEffect(() => {
    if (!editingPayment) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleModalCloseRequest();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingPayment, saving]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const hasActiveFilters = filters.q_bill || filters.q_cust || filters.date_from || filters.date_to;

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

   return (
    <div className="container-fluid w-100 p-0 d-flex flex-column flex-grow-1" style={{ marginTop: '-10px', width: '100%', minWidth: '100%' }}>
      <div className="flex-grow-1 w-100 d-flex flex-column mb-0" style={{ padding: '0 0 24px 0', width: '100%', minWidth: '100%' }}>
        <div className="card-title mb-4 d-flex align-items-start flex-nowrap gap-3 w-100">
          <div className="d-flex align-items-center gap-4 flex-wrap" style={{ paddingTop: '10px' }}>
            <span className="fs-3 fw-bold"><i className="bi bi-file-earmark-text me-2 text-primary"></i> Invoice History</span>

            {/* Inline Search Form */}
            <form onSubmit={(e) => e.preventDefault()} className="d-flex align-items-center gap-2 mb-0 flex-wrap ms-md-2">
              {searchType === 'date' ? (
                <div className="input-group" style={{ width: '760px' }}>
                  <span className="input-group-text bg-white text-muted border-end-0">From</span>
                  <DateInput
                    name="date_from"
                    className="form-control border-start-0 border-end-0"
                    value={filters.date_from}
                    onChange={handleFilterChange}
                  />
                  <span className="input-group-text bg-white text-muted border-start-0 border-end-0 px-2">To</span>
                  <DateInput
                    name="date_to"
                    className="form-control border-start-0 border-end-0"
                    value={filters.date_to}
                    onChange={handleFilterChange}
                  />
                  <div className="dropdown search-type-dropdown-container" style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="btn btn-light dropdown-toggle border-start-0 h-100 fw-semibold text-dark d-flex align-items-center gap-1"
                      style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, backgroundColor: '#f8fafc' }}
                      onClick={() => setSearchTypeDropdownOpen(!searchTypeDropdownOpen)}
                    >
                      <i className="bi bi-calendar-event text-warning me-1"></i> Date
                    </button>
                    <ul
                      className={`dropdown-menu dropdown-menu-end shadow-sm ${searchTypeDropdownOpen ? 'show' : ''}`}
                      style={{
                        display: searchTypeDropdownOpen ? 'block' : 'none',
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        zIndex: 1000,
                        minWidth: '150px'
                      }}
                    >
                      <li>
                        <button
                          type="button"
                          className={`dropdown-item d-flex align-items-center gap-2 ${searchType === 'bill' ? 'active' : ''}`}
                          onClick={() => {
                            handleSearchTypeChange('bill');
                            setSearchTypeDropdownOpen(false);
                          }}
                        >
                          <i className="bi bi-receipt text-primary"></i> Bill No
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          className={`dropdown-item d-flex align-items-center gap-2 ${searchType === 'cust' ? 'active' : ''}`}
                          onClick={() => {
                            handleSearchTypeChange('cust');
                            setSearchTypeDropdownOpen(false);
                          }}
                        >
                          <i className="bi bi-person text-success"></i> Customer
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          className={`dropdown-item d-flex align-items-center gap-2 ${searchType === 'date' ? 'active' : ''}`}
                          onClick={() => {
                            handleSearchTypeChange('date');
                            setSearchTypeDropdownOpen(false);
                          }}
                        >
                          <i className="bi bi-calendar-event text-warning"></i> Date
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="input-group" style={{ width: '380px' }}>
                  <span className="input-group-text bg-white text-muted border-end-0">
                    <i className="bi bi-search"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0 border-end-0 ps-0"
                    placeholder={searchType === 'bill' ? "Search bill no..." : "Search customer..."}
                    value={searchType === 'bill' ? filters.q_bill : filters.q_cust}
                    onChange={handleSearchQueryChange}
                  />
                  <div className="dropdown search-type-dropdown-container" style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="btn btn-light dropdown-toggle border-start-0 h-100 fw-semibold text-dark d-flex align-items-center gap-1"
                      style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, backgroundColor: '#f8fafc' }}
                      onClick={() => setSearchTypeDropdownOpen(!searchTypeDropdownOpen)}
                    >
                      {searchType === 'bill' ? (
                        <><i className="bi bi-receipt text-primary me-1"></i> Bill No</>
                      ) : (
                        <><i className="bi bi-person text-success me-1"></i> Customer</>
                      )}
                    </button>
                    <ul
                      className={`dropdown-menu dropdown-menu-end shadow-sm ${searchTypeDropdownOpen ? 'show' : ''}`}
                      style={{
                        display: searchTypeDropdownOpen ? 'block' : 'none',
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        zIndex: 1000,
                        minWidth: '150px'
                      }}
                    >
                      <li>
                        <button
                          type="button"
                          className={`dropdown-item d-flex align-items-center gap-2 ${searchType === 'bill' ? 'active' : ''}`}
                          onClick={() => {
                            handleSearchTypeChange('bill');
                            setSearchTypeDropdownOpen(false);
                          }}
                        >
                          <i className="bi bi-receipt text-primary"></i> Bill No
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          className={`dropdown-item d-flex align-items-center gap-2 ${searchType === 'cust' ? 'active' : ''}`}
                          onClick={() => {
                            handleSearchTypeChange('cust');
                            setSearchTypeDropdownOpen(false);
                          }}
                        >
                          <i className="bi bi-person text-success"></i> Customer
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          className={`dropdown-item d-flex align-items-center gap-2 ${searchType === 'date' ? 'active' : ''}`}
                          onClick={() => {
                            handleSearchTypeChange('date');
                            setSearchTypeDropdownOpen(false);
                          }}
                        >
                          <i className="bi bi-calendar-event text-warning"></i> Date
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="btn btn-outline-danger d-flex align-items-center justify-content-center gap-1"
                >
                  <i className="bi bi-x-circle"></i> Clear
                </button>
              )}
            </form>
          </div>

          {/* Toggle pill + Action buttons */}
          <div className="d-flex align-items-start gap-3 ms-auto" style={{ marginTop: '-20px', marginRight: '-30px' }}>
            <div className="history-toggle-pill">
              <div 
                className="toggle-backdrop" 
                style={{
                  transform: showDocType === 'challans' ? 'translateX(100%)' : 'translateX(0%)',
                }}
              />
              <button
                type="button"
                className={`history-toggle-button ${showDocType === 'invoices' ? 'active' : ''}`}
                onClick={() => setShowDocType('invoices')}
              >
                <i className="bi bi-receipt"></i> Invoices
              </button>
              <button
                type="button"
                className={`history-toggle-button ${showDocType === 'challans' ? 'active' : ''}`}
                onClick={() => setShowDocType('challans')}
              >
                <i className="bi bi-truck"></i> Delivery Challans
              </button>
            </div>

            {selectedInvoiceIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadSelectedPdf}
                  className="btn btn-success d-flex align-items-center gap-1"
                >
                  <i className="bi bi-download"></i> Download Selected ({selectedInvoiceIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceIds([])}
                  className="btn btn-outline-secondary d-flex align-items-center gap-1"
                >
                  <i className="bi bi-x-circle"></i> Clear Selection
                </button>
              </>
            )}
          </div>
        </div>

        {/* Invoices List Table */}
        <div className="content-card shadow-sm p-0">
          <div className="w-100 m-0 p-0" style={{ width: '100%', minWidth: '100%' }}>
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <table className="table table-hover align-middle w-100 m-0 dashboard-table" style={{ width: '100%', minWidth: '100%', tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th className="col-nowrap" style={{ width: '40px', borderTopLeftRadius: '16px' }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={filteredInvoices.length > 0 && selectedInvoiceIds.length === filteredInvoices.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th style={{ width: '8%' }}>Bill<br />No</th>
                  <th className="col-wrap-text" style={{ width: '15%' }}>Customer</th>
                  <th className="col-nowrap" style={{ width: '8%' }}>Bill Date</th>
                  <th className="col-nowrap" style={{ width: '8%' }}>Amount</th>
                  <th style={{ width: '12%' }}>Debited Note /<br />Credited Note</th>
                  <th className="col-wrap-text" style={{ width: '12%' }}>Bank Name</th>
                  <th className="col-nowrap" style={{ width: '8%' }}>Check No.</th>
                  <th className="col-nowrap" style={{ width: '8%' }}>Check Date</th>
                  <th className="col-nowrap" style={{ width: '6%' }}>TDS</th>
                  <th className="col-nowrap" style={{ width: '9%' }}>Total<br />Amount</th>
                  <th className="text-center col-nowrap" style={{ width: '80px', borderTopRightRadius: '16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length > 0 ? (
                  filteredInvoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="col-nowrap">
                        <div className="d-flex align-items-center gap-2">
                          <input
                            type="checkbox"
                            className="form-check-input m-0"
                            checked={selectedInvoiceIds.includes(inv.id)}
                            onChange={() => handleSelectInvoice(inv.id)}
                          />
                          {selectedInvoiceIds.includes(inv.id) && (
                            <span className="badge bg-success rounded-circle d-flex align-items-center justify-content-center font-monospace" style={{ width: '18px', height: '18px', fontSize: '10px', padding: 0 }}>
                              {selectedInvoiceIds.indexOf(inv.id) + 1}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="col-nowrap" onClick={() => setPreviewInvoiceId(inv.id)} style={{ cursor: 'pointer' }}>
                        <div className="d-flex flex-column align-items-center">
                          <strong>{inv.bill_number}</strong>
                        </div>
                      </td>
                      <td className="col-wrap-text" onClick={() => setPreviewInvoiceId(inv.id)} style={{ cursor: 'pointer' }}>{inv.customer_name || inv.customer?.name}</td>
                      <td className="col-nowrap" onClick={() => setPreviewInvoiceId(inv.id)} style={{ cursor: 'pointer' }}>{formatDate(inv.bill_date)}</td>
                      <td className="col-nowrap" onClick={() => setPreviewInvoiceId(inv.id)} style={{ cursor: 'pointer' }}><strong><Rupee /> {formatAmount(inv.amount)}</strong></td>
                      <td className="col-nowrap">
                        {inv.note_type ? (
                          <div className="d-flex flex-column align-items-center" style={{ gap: '2px' }}>
                            <span className="text-muted text-uppercase fw-semibold" style={{ fontSize: '9.5px', letterSpacing: '0.3px' }}>
                              {inv.note_type === 'credit' ? 'credited note' : 'debited note'}
                            </span>
                            <span className="fw-semibold text-dark">
                              <Rupee /> {formatAmount(inv.note_amount)}
                            </span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="col-wrap-text">
                        {inv.bank_name || '-'}
                      </td>
                      <td className="col-nowrap">
                        {inv.check_no || '-'}
                      </td>
                      <td className="col-nowrap">
                        {inv.check_date ? formatDate(inv.check_date) : '-'}
                      </td>
                      <td className="col-nowrap">
                        {inv.tds ? <><Rupee /> {formatAmount(inv.tds)}</> : '-'}
                      </td>
                      <td className="col-nowrap" onClick={() => setPreviewInvoiceId(inv.id)} style={{ cursor: 'pointer' }}>
                        {(() => {
                          const amount = Number(inv.amount) || 0;
                          const tds = Number(inv.tds) || 0;
                          const noteAmount = Number(inv.note_amount) || 0;
                          let total = amount - tds;
                          if (inv.note_type === 'debit') {
                            total -= noteAmount;
                          } else if (inv.note_type === 'credit') {
                            total += noteAmount;
                          }
                          return <strong><Rupee /> {formatAmount(total)}</strong>;
                        })()}
                      </td>
                      <td className="text-center col-nowrap">
                        <div className="btn-group dropdown-actions-container" style={{ position: 'relative' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownRowId(openDropdownRowId === inv.id ? null : inv.id);
                            }}
                            title="Actions"
                          >
                            <i className="bi bi-three-dots-vertical"></i>
                          </button>
                          <ul
                            className={`dropdown-menu dropdown-menu-end shadow-sm ${openDropdownRowId === inv.id ? 'show' : ''}`}
                            style={{
                              display: openDropdownRowId === inv.id ? 'block' : 'none',
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              zIndex: 1000
                            }}
                          >
                            <li>
                              <button
                                type="button"
                                onClick={() => {
                                  handleEditPaymentClick(inv);
                                  setOpenDropdownRowId(null);
                                }}
                                className="dropdown-item d-flex align-items-center gap-2"
                              >
                                <i className="bi bi-pencil-square text-success"></i> Edit Payment
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewInvoiceId(inv.id);
                                  setOpenDropdownRowId(null);
                                }}
                                className="dropdown-item d-flex align-items-center gap-2"
                              >
                                <i className="bi bi-eye text-info"></i> {inv.is_challan ? 'View Delivery Challan' : 'View Invoice'}
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                onClick={() => {
                                  handleDownloadPdf(inv.id, inv.bill_number);
                                  setOpenDropdownRowId(null);
                                }}
                                className="dropdown-item d-flex align-items-center gap-2"
                              >
                                <i className="bi bi-file-pdf text-primary"></i> Download PDF
                              </button>
                            </li>

                            <li>
                              <button
                                type="button"
                                onClick={() => {
                                  navigate(`/create-challan?duplicate_id=${inv.id}`);
                                  setOpenDropdownRowId(null);
                                }}
                                className="dropdown-item d-flex align-items-center gap-2"
                              >
                                <i className="bi bi-truck text-success"></i> Copy as Delivery Challan
                              </button>
                            </li>
                            <li>
                              <Link
                                to={inv.is_challan ? `/challans/edit/${inv.id}` : `/invoices/edit/${inv.id}`}
                                className="dropdown-item d-flex align-items-center gap-2"
                                onClick={() => setOpenDropdownRowId(null)}
                              >
                                <i className="bi bi-pencil text-warning"></i> {inv.is_challan ? 'Edit Delivery Challan' : 'Edit Invoice'}
                              </Link>
                            </li>
                            <li><hr className="dropdown-divider" /></li>
                            <li>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteInvoice(inv);
                                  setOpenDropdownRowId(null);
                                }}
                                className="dropdown-item d-flex align-items-center gap-2 text-danger"
                              >
                                <i className="bi bi-trash text-danger"></i> Delete
                              </button>
                            </li>
                          </ul>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="11" className="text-center text-muted py-4">
                      {showDocType === 'invoices'
                        ? 'No invoices found matching search filters.'
                        : 'No delivery challans found matching search filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredInvoices.length > 0 && (
                <tfoot>
                  <tr className="totals-row">
                    <td></td>
                    <td>Total</td>
                    <td></td>
                    <td></td>
                    <td><Rupee /> {formatAmount(totals.amount)}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td>{totals.tds > 0 ? <><Rupee /> {formatAmount(totals.tds)}</> : '-'}</td>
                    <td><Rupee /> {formatAmount(totals.totalAmount)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
        </div>
      </div>

      {/* Modal overlay popup for Confirm Delete Invoice */}
      {deleteInvoice && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title text-danger fw-bold d-flex align-items-center">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i> Confirm Delete {deleteInvoice.is_challan ? 'Delivery Challan' : 'Invoice'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setDeleteInvoice(null)} aria-label="Close"></button>
              </div>
              <div className="modal-body py-3">
                <p className="mb-0">
                  Are you sure you want to delete {deleteInvoice.is_challan ? 'delivery challan' : 'invoice'} number <strong>"{deleteInvoice.bill_number || '-'}"</strong>? This action cannot be undone. All database records associated with this billing transaction will be permanently removed.
                </p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  onClick={() => setDeleteInvoice(null)}
                  className="btn btn-light border btn-sm px-3"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSubmit}
                  className="btn btn-danger btn-sm px-3"
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : `Delete ${deleteInvoice.is_challan ? 'Delivery Challan' : 'Invoice'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay popup for Live PDF Invoice Preview */}
      {previewInvoiceId && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-xl modal-dialog-centered" style={{ maxWidth: '90%', height: '90vh' }}>
            <div className="modal-content h-100 border-0 shadow-lg d-flex flex-column">
              <div className="modal-header bg-dark text-white border-0 py-2">
                <h5 className="modal-title fw-bold d-flex align-items-center small text-uppercase font-monospace">
                  <i className="bi bi-file-earmark-pdf-fill me-2 text-danger"></i> {invoices.find(inv => inv.id === previewInvoiceId)?.is_challan ? 'Delivery Challan' : 'Invoice'} PDF Live Preview
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setPreviewInvoiceId(null)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body p-0 bg-secondary flex-grow-1 d-flex align-items-center justify-content-center">
                {previewLoading || !previewBlobUrl ? (
                  <div className="text-center text-white">
                    <div className="spinner-border text-light mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mb-0 fw-semibold">Loading PDF Preview...</p>
                  </div>
                ) : (
                  <iframe
                    src={`${previewBlobUrl}#zoom=125`}
                    title="Invoice PDF"
                    width="100%"
                    height="100%"
                    className="border-0"
                  ></iframe>
                )}
              </div>
              <div className="modal-footer border-0 py-2 d-flex justify-content-end gap-2 w-100">
                <button
                  type="button"
                  onClick={() => setPreviewInvoiceId(null)}
                  className="btn btn-secondary btn-sm px-4"
                  style={{ minWidth: '150px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPreviewPdf}
                  className="btn btn-primary btn-sm px-4"
                  disabled={!previewBlobUrl}
                  style={{ minWidth: '150px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <i className="bi bi-download me-1"></i> Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay popup for Edit Payment */}
      {editingPayment && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleModalCloseRequest();
            }
          }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '650px' }}>
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px', overflow: 'hidden' }}>

              {/* Header */}
              <div className="modal-header border-bottom-0 pb-0 d-flex align-items-center">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center">
                  <i className="bi bi-credit-card-fill text-primary me-2"></i> Edit Payment
                </h5>
                <span className="text-muted ms-auto me-3 font-monospace small bg-light px-2 py-1 rounded">
                  Invoice: {editingPayment.bill_number}
                </span>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleModalCloseRequest}
                  aria-label="Close"
                  disabled={saving}
                ></button>
              </div>

              {/* Body */}
              <div className="modal-body py-3">

                {/* Read-only reference box */}
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <div className="bg-light p-2 rounded-3 border border-light-subtle h-100">
                      <div className="fw-bold mb-0 text-uppercase" style={{ fontSize: '13px', color: '#198754' }}>BILL NO</div>
                      <div className="fw-bold text-dark text-truncate" style={{ fontSize: '15px' }}>{editingPayment.bill_number}</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="bg-light p-2 rounded-3 border border-light-subtle h-100">
                      <div className="fw-bold mb-0 text-uppercase" style={{ fontSize: '13px', color: '#198754' }}>BILL DATE</div>
                      <div className="fw-semibold text-dark text-truncate" style={{ fontSize: '15px' }}>{formatDate(editingPayment.bill_date)}</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="bg-light p-2 rounded-3 border border-light-subtle h-100">
                      <div className="fw-bold mb-0 text-uppercase" style={{ fontSize: '13px', color: '#198754' }}>CUSTOMER NAME</div>
                      <div className="fw-semibold text-dark text-truncate" style={{ fontSize: '15px' }} title={editingPayment.customer_name}>
                        {editingPayment.customer_name}
                      </div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="bg-light p-2 rounded-3 border border-light-subtle h-100">
                      <div className="fw-bold mb-0 text-uppercase" style={{ fontSize: '13px', color: '#198754' }}>TOTAL AMOUNT</div>
                      <div className="fw-bold text-primary text-truncate" style={{ fontSize: '15px' }}><Rupee /> {formatAmount(editingPayment.amount)}</div>
                    </div>
                  </div>
                </div>

                {/* Editable payment form */}
                <form onSubmit={(e) => e.preventDefault()} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}>
                  <div className="row g-3">

                    {/* Left Column */}
                    <div className="col-md-6 d-flex flex-column gap-3">
                      <div>
                        <label className="form-label fw-semibold payment-modal-label mb-1">Bank Name</label>
                        <input
                          type="text"
                          className={`form-control payment-modal-input ${validationErrors.bank_name ? 'is-invalid' : ''}`}
                          value={editingPayment.bank_name}
                          onChange={(e) => handlePaymentChange('bank_name', e.target.value)}
                          placeholder="Enter Bank Name"
                          disabled={saving}
                        />
                        {validationErrors.bank_name && (
                          <div className="invalid-feedback">{validationErrors.bank_name}</div>
                        )}
                      </div>

                      <div>
                        <label className="form-label fw-semibold payment-modal-label mb-1">Check No.</label>
                        <input
                          type="text"
                          className={`form-control payment-modal-input ${validationErrors.check_no ? 'is-invalid' : ''}`}
                          value={editingPayment.check_no}
                          onChange={(e) => handlePaymentChange('check_no', e.target.value)}
                          placeholder="Enter Check No."
                          disabled={saving}
                        />
                        {validationErrors.check_no && (
                          <div className="invalid-feedback">{validationErrors.check_no}</div>
                        )}
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="col-md-6 d-flex flex-column gap-3">
                      <div>
                        <label className="form-label fw-semibold payment-modal-label mb-1">TDS</label>
                        <div className="input-group">
                          <span className="input-group-text bg-white border-end-0 text-black" style={{ fontSize: '18.5px' }}><Rupee /></span>
                          <input
                            type="number"
                            step="0.01"
                            className={`form-control border-start-0 ps-1 payment-modal-input ${validationErrors.tds ? 'is-invalid' : ''}`}
                            value={editingPayment.tds}
                            onChange={(e) => handlePaymentChange('tds', e.target.value)}
                            placeholder="0.00"
                            disabled={saving}
                          />
                          {validationErrors.tds && (
                            <div className="invalid-feedback">{validationErrors.tds}</div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="form-label fw-semibold payment-modal-label mb-1">Check Date</label>
                        <DateInput
                          name="check_date"
                          className={`form-control payment-modal-input ${validationErrors.check_date ? 'is-invalid' : ''}`}
                          value={editingPayment.check_date}
                          onChange={(e) => handlePaymentChange('check_date', e.target.value)}
                          disabled={saving}
                        />
                        {validationErrors.check_date && (
                          <div className="invalid-feedback">{validationErrors.check_date}</div>
                        )}
                      </div>
                    </div>

                    {/* Note Type & Amount Section (at the bottom) */}
                    <div className="col-12 mt-3 pt-3 border-top border-light-subtle">
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label fw-semibold payment-modal-label mb-1">Note Type (Optional)</label>
                          <select
                            className="form-select payment-modal-input"
                            value={editingPayment.note_type || ''}
                            onChange={(e) => handlePaymentChange('note_type', e.target.value)}
                            disabled={saving}
                          >
                            <option value="">None</option>
                            <option value="debit">Debit Note</option>
                            <option value="credit">Credit Note</option>
                          </select>
                        </div>
                        <div className="col-md-6">
                          {editingPayment.note_type && (
                            <div>
                              <label className="form-label fw-semibold payment-modal-label mb-1">
                                {editingPayment.note_type === 'credit' ? 'Credit Note Amount' : 'Debit Note Amount'}
                              </label>
                              <div className="input-group">
                                <span className="input-group-text bg-white border-end-0 text-black" style={{ fontSize: '18.5px' }}><Rupee /></span>
                                <input
                                  type="number"
                                  step="0.01"
                                  className={`form-control border-start-0 ps-1 payment-modal-input ${validationErrors.note_amount ? 'is-invalid' : ''}`}
                                  value={editingPayment.note_amount}
                                  onChange={(e) => handlePaymentChange('note_amount', e.target.value)}
                                  placeholder="0.00"
                                  disabled={saving}
                                />
                                {validationErrors.note_amount && (
                                  <div className="invalid-feedback">{validationErrors.note_amount}</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                </form>

              </div>

              {/* Footer */}
              <div className="modal-footer border-top-0 pt-0 pb-3">
                <button
                  type="button"
                  onClick={handleModalCloseRequest}
                  className="btn btn-sm btn-outline-secondary px-3"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePaymentDetails}
                  className="btn btn-sm btn-primary px-3 d-flex align-items-center gap-2"
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
        </div>
      )}
    </div>
  );
}
