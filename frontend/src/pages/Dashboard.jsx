import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dashboardAPI from '../services/dashboardAPI';
import customersAPI from '../services/customersAPI';
import settingsAPI from '../services/settingsAPI';
import Rupee from '../utils/Rupee';
import DateInput from '../utils/DateInput';
import '../styles/appHome.css';

const formatAmount = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return '0.00';
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

export default function Dashboard({ user, onLogout, triggerAlert }) {
  const navigate = useNavigate();
  const [dashboardItems, setDashboardItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Pending', 'Done'
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'view', 'edit'
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formError, _setFormError] = useState('');
  const setFormError = (msg) => {
    _setFormError(msg);
    if (msg && triggerAlert) {
      triggerAlert(msg, 'danger');
    }
  };
  
  const [defaultHsnCode, setDefaultHsnCode] = useState('');
  const [showInvoiceCreatedModal, setShowInvoiceCreatedModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);

  // Selected Customer States
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [originalCustomerData, setOriginalCustomerData] = useState({ gstNumber: '', billingAddress: '' });

  // Search & Filter States
  const [searchType, setSearchType] = useState('search'); // 'search' or 'date'
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTypeDropdownOpen, setSearchTypeDropdownOpen] = useState(false);

  const [formData, setFormData] = useState({
    customerName: '',
    date: new Date().toISOString().substring(0, 10),
    status: 'Pending',
    pChNo: '',
    gstNumber: '',
    billingAddress: '',
    broker: ''
  });

  const [products, setProducts] = useState([
    { design: '', meter: '', lotNo: '', qty: '', rate: '', hsnCode: '' }
  ]);

  // Custom scrollbar state
  const modalBodyRef = useRef(null);
  const [scrollThumb, setScrollThumb] = useState({ top: 0, height: 100, visible: false });

  const updateScrollbar = useCallback(() => {
    const el = modalBodyRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight) {
      setScrollThumb({ top: 0, height: 100, visible: false });
    } else {
      const thumbHeight = Math.max((clientHeight / scrollHeight) * 100, 15);
      const thumbTop = (scrollTop / (scrollHeight - clientHeight)) * (100 - thumbHeight);
      setScrollThumb({ top: thumbTop, height: thumbHeight, visible: true });
    }
  }, []);

  useEffect(() => {
    if (showAddModal && modalMode !== 'view') {
      setTimeout(updateScrollbar, 100);
    }
  }, [showAddModal, modalMode, products, updateScrollbar]);

  // Design autocomplete dropdown state
  const [activeDesignDropdownIndex, setActiveDesignDropdownIndex] = useState(null);

  // Get design suggestions based on customer name and broker name match
  const designSuggestions = useMemo(() => {
    if (!formData.customerName || !formData.customerName.trim()) return [];
    const customerLower = formData.customerName.trim().toLowerCase();
    const brokerLower = (formData.broker || '').trim().toLowerCase();
    const safeItems = Array.isArray(dashboardItems) ? dashboardItems : [];

    const matched = safeItems.filter(item => {
      const matchCust = (item.customer_name || '').trim().toLowerCase() === customerLower;
      const matchBroker = (item.broker || '').trim().toLowerCase() === brokerLower;
      return matchCust && matchBroker;
    });

    const designs = new Set();
    matched.forEach(item => {
      if (item.products && item.products.length > 0) {
        item.products.forEach(p => {
          if (p.design && p.design.trim()) {
            designs.add(p.design.trim());
          }
        });
      } else if (item.design && item.design.trim()) {
        designs.add(item.design.trim());
      }
    });

    return Array.from(designs).sort();
  }, [dashboardItems, formData.customerName, formData.broker]);

  // Close design suggestions dropdown on click outside
  useEffect(() => {
    if (activeDesignDropdownIndex === null) return;
    const closeDesignDropdown = (e) => {
      if (!e.target.closest('.design-dropdown-container')) {
        setActiveDesignDropdownIndex(null);
      }
    };
    document.addEventListener('click', closeDesignDropdown);
    return () => document.removeEventListener('click', closeDesignDropdown);
  }, [activeDesignDropdownIndex]);

  const fetchDashboardItems = async () => {
    try {
      const data = await dashboardAPI.list();
      setDashboardItems(Array.isArray(data) ? data : (data?.results || []));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setDashboardItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const data = await customersAPI.list();
      setCustomers(Array.isArray(data) ? data : (data?.results || []));
    } catch (err) {
      console.error('Failed to load customers:', err);
      setCustomers([]);
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await settingsAPI.get();
      if (data && data.default_hsn_code) {
        setDefaultHsnCode(data.default_hsn_code);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  useEffect(() => {
    fetchDashboardItems();
    fetchCustomers();
    fetchSettings();
  }, []);

  // Close suggestions dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const closeDropdown = (e) => {
      if (!e.target.closest('.customer-dropdown-container')) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('click', closeDropdown);
    return () => document.removeEventListener('click', closeDropdown);
  }, [dropdownOpen]);

  // Close search type dropdown on click outside
  useEffect(() => {
    if (!searchTypeDropdownOpen) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.search-type-dropdown-container')) {
        setSearchTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [searchTypeDropdownOpen]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setModalMode('add');
    setFormData({
      customerName: '',
      date: new Date().toISOString().substring(0, 10),
      status: 'Pending',
      pChNo: '',
      gstNumber: '',
      billingAddress: '',
      broker: ''
    });
    setProducts([
      { design: '', meter: '', lotNo: '', qty: '', rate: '', hsnCode: defaultHsnCode || '' }
    ]);
    setFormError('');
    setShowDeleteConfirm(false);
    setDropdownOpen(false);
    setSavingCustomer(false);
    setSelectedCustomerId(null);
    setIsEditingCustomer(false);
    setOriginalCustomerData({ gstNumber: '', billingAddress: '' });
    setShowAddModal(true);
  };

  const handleRowClick = (item) => {
    setEditingItem(item);
    setModalMode('view');
    setFormData({
      customerName: item.customerName,
      date: item.date,
      status: item.status,
      pChNo: item.pChNo || '',
      gstNumber: item.gstNumber || '',
      billingAddress: item.billingAddress || '',
      broker: item.broker || ''
    });
    if (item.products && item.products.length > 0) {
      setProducts(item.products.map(p => ({
        design: p.design || '',
        meter: p.meter || '',
        lotNo: p.lot_no || '',
        qty: p.qty || '',
        rate: p.rate || '',
        hsnCode: p.hsn_code || '',
        _status: p.status || '',
        _invoice_id: p.invoice_id || null
      })));
    } else {
      setProducts([
        {
          design: item.design === '-' ? '' : item.design,
          meter: item.meter || '',
          lotNo: item.lotNo || '',
          qty: item.qty || '',
          rate: item.rate || '',
          hsnCode: item.hsnCode || '',
          _status: item.status || ''
        }
      ]);
    }
    setFormError('');
    setShowDeleteConfirm(false);
    setDropdownOpen(false);
    setSavingCustomer(false);

    // Identify if the row customer matches a record in the database
    const matchingCustomer = customers.find(c => (c.name || '').trim().toLowerCase() === (item.customerName || '').trim().toLowerCase());
    if (matchingCustomer) {
      setSelectedCustomerId(matchingCustomer.id);
      setOriginalCustomerData({
        gstNumber: matchingCustomer.gst_number || '',
        billingAddress: matchingCustomer.address || ''
      });
    } else {
      setSelectedCustomerId(null);
      setOriginalCustomerData({ gstNumber: '', billingAddress: '' });
    }
    setIsEditingCustomer(false);

    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    if (saving) return;
    setModalClosing(true);
    setTimeout(() => {
      setShowAddModal(false);
      setModalClosing(false);
      setEditingItem(null);
      setModalMode('add');
      setShowDeleteConfirm(false);
      setDropdownOpen(false);
      setActiveDesignDropdownIndex(null);
      setShowInvoiceCreatedModal(false);
      setSavingCustomer(false);
      setSelectedCustomerId(null);
      setIsEditingCustomer(false);
      setOriginalCustomerData({ gstNumber: '', billingAddress: '' });
      setFormData({
        customerName: '',
        date: new Date().toISOString().substring(0, 10),
        status: 'Pending',
        pChNo: '',
        gstNumber: '',
        billingAddress: '',
        broker: ''
      });
      setProducts([
        { design: '', meter: '', lotNo: '', qty: '', rate: '', hsnCode: defaultHsnCode || '' }
      ]);
      setFormError('');
    }, 220);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProductInputChange = (index, field, value) => {
    setProducts(prev => prev.map((p, idx) => {
      if (idx === index) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const handleAddProduct = () => {
    setProducts(prev => [
      ...prev,
      { design: '', meter: '', lotNo: '', qty: '', rate: '', hsnCode: defaultHsnCode || '' }
    ]);
  };

  const handleRemoveProduct = (index) => {
    if (products.length > 1) {
      setProducts(prev => prev.filter((_, idx) => idx !== index));
    }
  };

  const handleCustomerSelect = (customer) => {
    setFormData(prev => ({
      ...prev,
      customerName: customer.name || '',
      gstNumber: customer.gst_number || '',
      billingAddress: customer.address || ''
    }));
    setSelectedCustomerId(customer.id);
    setOriginalCustomerData({
      gstNumber: customer.gst_number || '',
      billingAddress: customer.address || ''
    });
    setIsEditingCustomer(false);
    setDropdownOpen(false);
  };

  const handleDeselectCustomer = () => {
    setSelectedCustomerId(null);
    setIsEditingCustomer(false);
    setFormData(prev => ({
      ...prev,
      customerName: '',
      gstNumber: '',
      billingAddress: ''
    }));
    setOriginalCustomerData({ gstNumber: '', billingAddress: '' });
  };

  const handleCancelEditCustomer = () => {
    setIsEditingCustomer(false);
    setFormData(prev => ({
      ...prev,
      gstNumber: originalCustomerData.gstNumber,
      billingAddress: originalCustomerData.billingAddress
    }));
  };

  const handleSaveCustomerDirect = async () => {
    if (!formData.customerName.trim()) {
      setFormError('Please enter Customer Name first.');
      return;
    }
    setSavingCustomer(true);
    setFormError('');
    try {
      const trimmedName = formData.customerName.trim();
      const trimmedGst = formData.gstNumber.trim();
      const trimmedAddress = formData.billingAddress.trim();

      const newCust = await customersAPI.add({
        name: trimmedName,
        gst_number: trimmedGst,
        address: trimmedAddress
      });

      setCustomers(prev => [...prev, newCust].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCustomerId(newCust.id);
      setOriginalCustomerData({ gstNumber: trimmedGst, billingAddress: trimmedAddress });
      setIsEditingCustomer(false);
    } catch (err) {
      console.error('Failed to save customer details:', err);
      setFormError('Failed to save customer details.');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleUpdateCustomerDirect = async () => {
    if (!selectedCustomerId) return;
    setSavingCustomer(true);
    setFormError('');
    try {
      const trimmedGst = formData.gstNumber.trim();
      const trimmedAddress = formData.billingAddress.trim();
      const selected = customers.find(c => c.id === selectedCustomerId);
      if (selected) {
        const updated = await customersAPI.edit(selectedCustomerId, {
          name: selected.name,
          gst_number: trimmedGst,
          address: trimmedAddress
        });
        // Update customer list
        setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
        setOriginalCustomerData({ gstNumber: trimmedGst, billingAddress: trimmedAddress });
        setIsEditingCustomer(false);
      }
    } catch (err) {
      console.error('Failed to update customer details:', err);
      setFormError('Failed to update customer details.');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleStartEditCustomerDropdown = (e, customer) => {
    e.stopPropagation();
    setSelectedCustomerId(customer.id);
    setIsEditingCustomer(true);
    setFormData(prev => ({
      ...prev,
      customerName: customer.name || '',
      gstNumber: customer.gst_number || '',
      billingAddress: customer.address || ''
    }));
    setOriginalCustomerData({
      gstNumber: customer.gst_number || '',
      billingAddress: customer.address || ''
    });
    setDropdownOpen(false);
  };

  const handleDeleteCustomerDropdown = (e, customer) => {
    e.stopPropagation();
    setCustomerToDelete(customer);
    setDropdownOpen(false);
  };

  const handleConfirmDeleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
      await customersAPI.delete(customerToDelete.id);
      // Refresh customer list
      await fetchCustomers();
      // If the deleted customer was currently selected in our form, deselect them
      if (selectedCustomerId === customerToDelete.id) {
        handleDeselectCustomer();
      }
      setCustomerToDelete(null);
    } catch (err) {
      console.error('Failed to delete customer:', err);
      setFormError('Failed to delete customer.');
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customerName || !formData.date) {
      setFormError('Please fill in all required fields (Customer Name and Date).');
      return;
    }

    if (!products || products.length === 0) {
      setFormError('Please add at least one product item.');
      return;
    }

    // Check if any product is missing Qty or Rate
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p.qty || !p.rate) {
        setFormError(`Please fill in Qty and Rate for product item #${i + 1}.`);
        return;
      }
    }

    setSaving(true);
    setFormError('');

    try {
      const formattedProducts = products.map(p => {
        const prod = {
          design: (p.design || '').trim(),
          lot_no: (p.lotNo || '').trim(),
          meter: parseFloat(p.meter) || 0,
          qty: parseFloat(p.qty) || 0,
          rate: parseFloat(p.rate) || 0,
          hsn_code: (p.hsnCode || '').trim()
        };
        // Preserve per-product status and invoice linkage
        if (p._status) prod.status = p._status;
        if (p._invoice_id) prod.invoice_id = p._invoice_id;
        return prod;
      });

      const payload = {
        customer_name: formData.customerName.trim(),
        date: formData.date,
        status: formData.status,
        p_ch_no: formData.pChNo.trim(),
        gst_number: formData.gstNumber.trim(),
        billing_address: formData.billingAddress.trim(),
        broker: formData.broker.trim(),
        products: formattedProducts
      };

      if (editingItem) {
        await dashboardAPI.edit(editingItem.id, payload);
      } else {
        await dashboardAPI.add(payload);
      }

      await fetchDashboardItems();
      handleCloseModal();
    } catch (err) {
      console.error('Failed to save dashboard item:', err);
      setFormError(err.response?.data?.error || 'Failed to save dashboard item.');
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToInvoice = () => {
    navigate(`/create-invoice?dashboard_item_id=${editingItem?.id || ''}`, {
      state: {
        prefillData: {
          id: editingItem?.id,
          date: formData.date,
          customerName: formData.customerName,
          billingAddress: formData.billingAddress,
          gstNumber: formData.gstNumber,
          broker: formData.broker,
          pChNo: formData.pChNo,
          products: products.map(p => ({
            design: p.design,
            lotNo: p.lotNo,
            meter: p.meter,
            qty: p.qty,
            rate: p.rate,
            hsnCode: p.hsnCode
          }))
        }
      }
    });
  };

  const handleViewExistingInvoice = () => {
    const targetBill = editingItem?.invoiceBillNumber || '';
    const targetId = editingItem?.invoiceId || null;
    setShowInvoiceCreatedModal(false);
    handleCloseModal();
    navigate('/invoice-history', {
      state: {
        searchBill: targetBill,
        highlightInvoiceId: targetId
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!editingItem) return;
    setDeleting(true);
    setFormError('');

    try {
      await dashboardAPI.delete(editingItem.id);
      await fetchDashboardItems();
      handleCloseModal();
    } catch (err) {
      console.error('Failed to delete item:', err);
      setFormError('Failed to delete dashboard item.');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered customer list based on search value
  const safeCustomersList = Array.isArray(customers) ? customers : [];
  const filteredCustomers = safeCustomersList.filter(c =>
    (c.name || '').toLowerCase().includes((formData.customerName || '').toLowerCase())
  );

  // Map dashboardItems directly for table rendering (main table columns remain unchanged)
  const safeDashboardList = Array.isArray(dashboardItems) ? dashboardItems : [];
  const itemsList = safeDashboardList.map((item, index) => ({
    id: item.id,
    serialNo: safeDashboardList.length - index,
    customerName: item.customer_name,
    date: item.date,
    design: item.design || '-',
    qty: item.qty,
    rate: item.rate,
    meter: item.meter,
    total: item.total,
    status: item.status,
    pChNo: item.p_ch_no,
    lotNo: item.lot_no,
    gstNumber: item.gst_number,
    billingAddress: item.billing_address,
    hsnCode: item.hsn_code,
    broker: item.broker,
    products: item.products || [],
    invoiceId: item.invoice_id || null,
    invoiceBillNumber: item.invoice_bill_number || '',
    invoiceAmount: item.invoice_amount || item.total
  }));

  const username = user?.username || 'Yash';
  const initial = username.charAt(0).toUpperCase();

  const allCount = itemsList.length;
  const pendingCount = itemsList.filter(i => (i.status || 'Pending').toLowerCase() === 'pending').length;
  const doneCount = itemsList.filter(i => (i.status || '').toLowerCase() === 'done').length;

  // Filter the dashboard items based on the search query, date filter, and status pills
  const filteredItemsList = itemsList.filter(item => {
    // Status Filter
    if (statusFilter === 'Pending' && (item.status || 'Pending').toLowerCase() !== 'pending') {
      return false;
    }
    if (statusFilter === 'Done' && (item.status || '').toLowerCase() !== 'done') {
      return false;
    }

    // Text search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchCustomer = (item.customerName || '').toLowerCase().includes(q);
      const matchPChNo = (item.pChNo || '').toLowerCase().includes(q);
      const matchDesignParent = (item.design || '').toLowerCase().includes(q);
      const matchDesignProducts = item.products && item.products.some(p => (p.design || '').toLowerCase().includes(q));
      const matchBroker = (item.broker || '').toLowerCase().includes(q);
      
      if (!(matchCustomer || matchPChNo || matchDesignParent || matchDesignProducts || matchBroker)) {
        return false;
      }
    }

    // Date range filter
    const itemDate = item.date; // YYYY-MM-DD
    if (dateFrom && itemDate < dateFrom) return false;
    if (dateTo && itemDate > dateTo) return false;

    return true;
  });

  // Inputs are disabled if customer is selected from DB and they are NOT currently in Editing state
  const isInputsDisabled = !!selectedCustomerId && !isEditingCustomer;

  return (
    <div className="dashboard-mobile-wrapper">
      <div className="dashboard-mobile-container">
        
        {/* Top Header matching Create Invoice / Challan style */}
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
            Dashboard
          </h1>
        </header>

        {/* Detailed Records Card List matching user mockup */}
        <main className="dashboard-mobile-body">
          {/* Controls in Middle Part (without card): Search, Filter, Status Pills & Add Item */}
          {/* Search bar with filter toggle */}
          <div className="dashboard-mobile-search-row">
            <i className="bi bi-search text-muted ms-1 me-1" style={{ fontSize: '13px' }}></i>
            <input 
              type="text"
              className="dashboard-mobile-search-input"
              placeholder="Search customer, design, broker..."
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

          {/* Status Pills & Add Item Button Row */}
          <div className="dashboard-mobile-actions-row">
            <div className="dashboard-status-pills">
              <button 
                type="button" 
                className={`dashboard-status-pill ${statusFilter === 'All' ? 'active' : ''}`}
                onClick={() => setStatusFilter('All')}
              >
                All ({allCount})
              </button>
              <button 
                type="button" 
                className={`dashboard-status-pill ${statusFilter === 'Pending' ? 'active' : ''}`}
                onClick={() => setStatusFilter('Pending')}
              >
                Pending ({pendingCount})
              </button>
              <button 
                type="button" 
                className={`dashboard-status-pill ${statusFilter === 'Done' ? 'active' : ''}`}
                onClick={() => setStatusFilter('Done')}
              >
                Done ({doneCount})
              </button>
            </div>

            <button 
              type="button" 
              className="dashboard-mobile-add-btn"
              onClick={handleOpenAddModal}
            >
              <i className="bi bi-plus-lg"></i> Add Item
            </button>
          </div>
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : filteredItemsList.length > 0 ? (
            filteredItemsList.map((item) => {
              const itemProducts = item.products && item.products.length > 0
                ? item.products
                : [{ design: item.design, qty: item.qty, rate: item.rate }];
              
              const isDone = (item.status || '').toLowerCase() === 'done';
              const itemTotal = itemProducts.reduce((acc, p) => acc + (parseFloat(p.qty || 0) * parseFloat(p.rate || 0)), 0);

              let footerTag = null;
              if (isDone) {
                footerTag = (
                  <span className="dashboard-record-footer-tag settled">
                    <i className="bi bi-check-circle"></i> Settled
                  </span>
                );
              } else if (item.pChNo && item.pChNo !== '-' && item.pChNo !== '') {
                footerTag = (
                  <span className="dashboard-record-footer-tag part">
                    Part Challan Linked
                  </span>
                );
              } else if (itemProducts.length > 1) {
                footerTag = (
                  <span className="dashboard-record-footer-tag order">
                    <i className="bi bi-receipt"></i> Challan Bill
                  </span>
                );
              } else {
                footerTag = (
                  <span className="dashboard-record-footer-tag part">
                    Single Item Order
                  </span>
                );
              }

              return (
                <div 
                  key={item.id} 
                  className="dashboard-record-card"
                  onClick={() => handleRowClick(item)}
                  role="button"
                  tabIndex={0}
                >
                  {/* Card Header */}
                  <div className="dashboard-record-header">
                    <div className="dashboard-record-header-left">
                      <div className="dashboard-record-badge-num">{item.serialNo}</div>
                      <div className="dashboard-record-cust-info">
                        <div className="dashboard-record-cust-name-row">
                          <h2 className="dashboard-record-cust-name">{item.customerName}</h2>
                          <span className="dashboard-record-pch-badge">P.Ch: {item.pChNo || '-'}</span>
                        </div>
                        <div className="dashboard-record-meta-line">
                          Broker: <span>{item.broker || '-'}</span> • {formatDate(item.date)}
                        </div>
                      </div>
                    </div>
                    <span 
                      className={`dashboard-record-status-badge ${isDone ? 'done' : 'pending'}`}
                      onClick={(e) => {
                        if (isDone) {
                          e.stopPropagation();
                          setEditingItem(item);
                          setShowInvoiceCreatedModal(true);
                        }
                      }}
                      style={isDone ? { cursor: 'pointer' } : {}}
                      title={isDone ? 'Click to view Invoice Status' : ''}
                    >
                      {item.status || 'Pending'}
                    </span>
                  </div>

                  {/* Product Rows */}
                  <div className="dashboard-record-products">
                    {itemProducts.map((prod, pIdx) => (
                      <div key={pIdx} className="dashboard-record-prod-row">
                        <div className="dashboard-record-prod-left">
                          <span className="dashboard-record-prod-badge">{prod.design && prod.design !== '-' ? prod.design : '-'}</span>
                          <span className="dashboard-record-prod-qty">{prod.qty ? `${prod.qty} pcs` : '-'}</span>
                        </div>
                        <div className="dashboard-record-prod-right">
                          <span className="dashboard-record-prod-rate">@ ₹ {formatAmount(prod.rate)}</span>
                          <span className="dashboard-record-prod-total">₹ {formatAmount(parseFloat(prod.qty || 0) * parseFloat(prod.rate || 0))}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Card Footer */}
                  <div className="dashboard-record-footer">
                    {footerTag}
                    <div className="dashboard-record-footer-total-col">
                      <span className="dashboard-record-footer-label">{isDone ? 'Total Paid' : 'Order Total'}</span>
                      <span className={`dashboard-record-footer-amount ${isDone ? 'settled' : 'order'}`}>
                        ₹ {formatAmount(itemTotal || item.total)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>
              <p className="fw-semibold mb-1">No transactions found</p>
              <small>Try clearing your search or status filter</small>
            </div>
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
            className="app-home-bottom-tab active"
            onClick={() => {}}
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

      </div>

      {/* Modal for viewing/adding/editing a dashboard item matching mobile mockup */}
      {showAddModal && (
        <div
          className={`dashboard-add-modal-backdrop ${modalClosing ? 'closing' : ''}`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) handleCloseModal();
          }}
        >
          <div className={`dashboard-add-modal-container ${modalClosing ? 'closing' : ''}`}>
            
            {/* Bottom sheet drag handle indicator */}
            <div className="dashboard-bottom-sheet-handle-row">
              <div className="dashboard-bottom-sheet-handle"></div>
            </div>

            {/* Modal Header */}
            <div className="dashboard-add-modal-header">
              <div className="dashboard-add-modal-title-box">
                <div className="dashboard-add-modal-icon-badge">
                  <i className={`bi ${modalMode === 'view' ? 'bi-file-earmark-text' : (modalMode === 'edit' ? 'bi-pencil-square' : 'bi-card-text')}`}></i>
                </div>
                <h5 className="dashboard-add-modal-title">
                  {modalMode === 'view' ? 'Item Details' : (modalMode === 'edit' ? 'Edit Item' : 'Add Item')}
                </h5>
              </div>
              <button
                type="button"
                className="dashboard-add-modal-close-btn"
                onClick={handleCloseModal}
                disabled={saving}
                title="Close"
              >
                <i className="bi bi-x-lg" style={{ fontSize: '14px' }}></i>
              </button>
            </div>

            {modalMode === 'view' ? (
              /* --- READ-ONLY DETAILS VIEW --- */
              <div className="d-flex flex-column" style={{ overflow: 'hidden', flex: 1 }}>
                <div className="dashboard-add-modal-body">
                  {/* Customer and General Details Card */}
                  <div className="bg-light p-3 rounded-3 border" style={{ fontSize: '13px' }}>
                    <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                      <span className="text-muted fw-semibold">Customer Name:</span>
                      <span className="fw-bold text-dark">{formData.customerName}</span>
                    </div>
                    <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                      <span className="text-muted fw-semibold">P.Ch.No:</span>
                      <span className="fw-bold text-dark">{formData.pChNo || '-'}</span>
                    </div>
                    <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                      <span className="text-muted fw-semibold">Date:</span>
                      <span className="fw-bold text-dark">{formatDate(formData.date)}</span>
                    </div>
                    <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                      <span className="text-muted fw-semibold">GST Number:</span>
                      <span className="fw-bold text-dark">{formData.gstNumber || '-'}</span>
                    </div>
                    <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                      <span className="text-muted fw-semibold">Broker:</span>
                      <span className="fw-bold text-dark">{formData.broker || '-'}</span>
                    </div>
                    <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                      <span className="text-muted fw-semibold">Status:</span>
                      <span className={`badge ${formData.status === 'Done' ? 'bg-success' : 'bg-warning text-dark'}`} style={{ borderRadius: '20px', padding: '3px 10px' }}>
                        {formData.status}
                      </span>
                    </div>
                    <div className="d-flex align-items-start justify-content-between">
                      <span className="text-muted fw-semibold">Billing Address:</span>
                      <span className="fw-bold text-dark text-end" style={{ maxWidth: '65%', whiteSpace: 'pre-wrap' }}>{formData.billingAddress || '-'}</span>
                    </div>
                  </div>

                  {/* Product Items Header */}
                  <div className="dashboard-modal-products-header">
                    <span className="dashboard-modal-products-title">PRODUCT ITEMS</span>
                    <span className="dashboard-modal-products-badge">{products.length} {products.length === 1 ? 'Item' : 'Items'}</span>
                  </div>

                  {/* Product Items List */}
                  {products.map((p, idx) => (
                    <div key={idx} className="dashboard-modal-product-card">
                      <div className="dashboard-modal-product-header">
                        <div className="dashboard-modal-product-tag">
                          <span className="dashboard-modal-product-dot"></span>
                          <span>ITEM #{idx + 1}: {p.design || 'Untitled'}</span>
                        </div>
                        <span className="fw-bold text-primary" style={{ fontSize: '13px' }}>
                          <Rupee /> {formatAmount(parseFloat(p.qty || 0) * parseFloat(p.rate || 0))}
                        </span>
                      </div>
                      <div className="dashboard-modal-product-grid" style={{ fontSize: '12px' }}>
                        <div><span className="text-muted">Lot:</span> <strong className="text-dark">{p.lotNo || '-'}</strong></div>
                        <div><span className="text-muted">Meter:</span> <strong className="text-dark">{p.meter || '0.00'}</strong></div>
                        <div><span className="text-muted">HSN:</span> <strong className="text-dark">{p.hsnCode || '-'}</strong></div>
                        <div><span className="text-muted">Qty:</span> <strong className="text-dark">{p.qty || '0.00'}</strong></div>
                        <div><span className="text-muted">Rate:</span> <strong className="text-dark"><Rupee />{formatAmount(p.rate)}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer Actions */}
                <div className="dashboard-add-modal-footer d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm px-3 py-2 d-flex align-items-center justify-content-center"
                    onClick={() => (formData.status === 'Done' || products.some(p => p._status === 'Done')) ? setShowInvoiceCreatedModal(true) : setShowDeleteConfirm(true)}
                    style={{ borderRadius: '10px' }}
                    disabled={showDeleteConfirm}
                    title="Delete Item"
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="dashboard-modal-cancel-btn py-2 px-3"
                      onClick={() => formData.status === 'Done' ? setShowInvoiceCreatedModal(true) : setModalMode('edit')}
                    >
                      <i className="bi bi-pencil-square me-1"></i> Edit
                    </button>
                    <button
                      type="button"
                      className="dashboard-modal-submit-btn py-2 px-3"
                      onClick={() => formData.status === 'Done' ? setShowInvoiceCreatedModal(true) : handleConvertToInvoice()}
                    >
                      <i className="bi bi-file-earmark-text me-1"></i> Invoice
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* --- EDITABLE INPUT FORM (Add / Edit Mode matching mockup) --- */
              <form onSubmit={handleFormSubmit} className="d-flex flex-column" style={{ overflow: 'hidden', flex: 1 }}>
                <div className="dashboard-add-modal-body">
                  {/* 1. Customer Name */}
                  <div className="dashboard-modal-field customer-dropdown-container">
                    <label className="dashboard-modal-label">Customer Name <span className="req">*</span></label>
                    <div className="position-relative">
                      <input
                        type="text"
                        className="dashboard-modal-input"
                        name="customerName"
                        placeholder="Enter Customer Name"
                        value={formData.customerName}
                        onChange={(e) => {
                          handleInputChange(e);
                          setDropdownOpen(true);
                        }}
                        onFocus={() => setDropdownOpen(true)}
                        required
                        autoComplete="off"
                        disabled={!!selectedCustomerId}
                      />
                      {selectedCustomerId && (
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-danger position-absolute end-0 top-50 translate-middle-y me-2 p-0 text-decoration-none"
                          onClick={handleDeselectCustomer}
                          disabled={saving}
                          title="Deselect Customer"
                        >
                          <i className="bi bi-x-circle-fill"></i>
                        </button>
                      )}
                    </div>
                    {dropdownOpen && !selectedCustomerId && (
                      <ul
                        className="dropdown-menu show w-100 shadow-lg border border-light-subtle py-1"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          zIndex: 1050,
                          display: 'block',
                          maxHeight: '180px',
                          overflowY: 'auto',
                          borderRadius: '10px'
                        }}
                      >
                        {filteredCustomers.length === 0 ? (
                          <li className="px-3 py-2 text-muted small">No matching customers found</li>
                        ) : (
                          filteredCustomers.map(c => (
                            <li
                              key={c.id}
                              className="d-flex align-items-center justify-content-between px-3 py-1 border-bottom border-light-subtle text-black"
                              style={{ cursor: 'pointer', transition: 'background-color 0.15s ease-in-out' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              onClick={() => handleCustomerSelect(c)}
                            >
                              <div className="flex-grow-1 py-1" style={{ overflow: 'hidden' }}>
                                <div className="fw-semibold text-truncate small">{c.name}</div>
                              </div>
                              <div className="d-flex gap-1">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary border-0 p-1"
                                  title="Edit Customer"
                                  onClick={(e) => handleStartEditCustomerDropdown(e, c)}
                                >
                                  <i className="bi bi-pencil-square"></i>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger border-0 p-1"
                                  title="Delete Customer"
                                  onClick={(e) => handleDeleteCustomerDropdown(e, c)}
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </div>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>

                  {/* 2. GST Number with + Save button */}
                  <div className="dashboard-modal-field">
                    <label className="dashboard-modal-label">GST Number</label>
                    <div className="dashboard-modal-gst-row">
                      <input
                        type="text"
                        className="dashboard-modal-input text-uppercase"
                        name="gstNumber"
                        placeholder="ENTER GST NUMBER"
                        value={formData.gstNumber}
                        onChange={handleInputChange}
                        disabled={isInputsDisabled}
                      />
                      {selectedCustomerId ? (
                        isEditingCustomer ? (
                          <div className="d-flex gap-1">
                            <button
                              type="button"
                              className="dashboard-modal-gst-save-btn text-success"
                              onClick={handleUpdateCustomerDirect}
                              disabled={savingCustomer}
                            >
                              {savingCustomer ? '...' : 'Update'}
                            </button>
                            <button
                              type="button"
                              className="dashboard-modal-gst-save-btn text-muted"
                              onClick={handleCancelEditCustomer}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="dashboard-modal-gst-save-btn"
                            onClick={() => setIsEditingCustomer(true)}
                          >
                            <i className="bi bi-pencil-square"></i> Edit
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          className="dashboard-modal-gst-save-btn"
                          onClick={handleSaveCustomerDirect}
                          disabled={savingCustomer || !formData.customerName.trim()}
                        >
                          {savingCustomer ? (
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          ) : (
                            <>+ Save</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 3. Billing Address */}
                  <div className="dashboard-modal-field">
                    <label className="dashboard-modal-label">Billing Address</label>
                    <input
                      type="text"
                      className="dashboard-modal-input"
                      name="billingAddress"
                      placeholder="Enter Billing Address"
                      value={formData.billingAddress}
                      onChange={handleInputChange}
                      disabled={isInputsDisabled}
                    />
                  </div>

                  {/* 4. Broker */}
                  <div className="dashboard-modal-field">
                    <label className="dashboard-modal-label">Broker</label>
                    <input
                      type="text"
                      className="dashboard-modal-input"
                      name="broker"
                      placeholder="Enter Broker Name"
                      value={formData.broker}
                      onChange={handleInputChange}
                    />
                  </div>

                  {/* 5. Two Columns: P.Ch.No & Date */}
                  <div className="dashboard-modal-two-col">
                    <div className="dashboard-modal-field">
                      <label className="dashboard-modal-label">P.Ch.No</label>
                      <input
                        type="text"
                        className="dashboard-modal-input"
                        name="pChNo"
                        placeholder="Enter P.Ch.No"
                        value={formData.pChNo}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="dashboard-modal-field">
                      <label className="dashboard-modal-label">Date <span className="req">*</span></label>
                      <DateInput
                        className="dashboard-modal-input"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  {/* 6. Product Items Section */}
                  <div className="dashboard-modal-products-header">
                    <span className="dashboard-modal-products-title">PRODUCT ITEMS</span>
                    <span className="dashboard-modal-products-badge">{products.length} {products.length === 1 ? 'Item' : 'Items'}</span>
                  </div>

                  {/* Product Cards List */}
                  {products.map((product, index) => (
                    <div key={index} className="dashboard-modal-product-card">
                      <div className="dashboard-modal-product-header">
                        <div className="dashboard-modal-product-tag">
                          <span className="dashboard-modal-product-dot"></span>
                          <span>ITEM #{index + 1}</span>
                          {product._status === 'Done' && (
                            <span className="badge bg-success ms-1" style={{ fontSize: '10px' }}>Invoiced (Done)</span>
                          )}
                        </div>
                        {products.length > 1 && product._status !== 'Done' && (
                          <button
                            type="button"
                            className="dashboard-modal-product-del-btn"
                            onClick={() => handleRemoveProduct(index)}
                            title="Remove Item"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        )}
                      </div>

                      {/* Row 1: Design, Lot No, HSN Code */}
                      <div className="dashboard-modal-product-grid">
                        <div className="dashboard-modal-sub-field design-dropdown-container">
                          <label className="dashboard-modal-sub-label">Design</label>
                          <input
                            type="text"
                            className="dashboard-modal-sub-input"
                            placeholder="Design Name"
                            value={product.design}
                            onChange={(e) => {
                              handleProductInputChange(index, 'design', e.target.value);
                              setActiveDesignDropdownIndex(index);
                            }}
                            onFocus={() => product._status !== 'Done' && setActiveDesignDropdownIndex(index)}
                            autoComplete="off"
                            disabled={product._status === 'Done'}
                          />
                          {activeDesignDropdownIndex === index && (() => {
                            const filtered = designSuggestions.filter(d => (d || '').toLowerCase().includes((product.design || '').toLowerCase()));
                            if (filtered.length === 0) return null;
                            return (
                              <ul
                                className="dropdown-menu show w-100 shadow-lg border border-light-subtle py-1"
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  zIndex: 1060,
                                  display: 'block',
                                  maxHeight: '140px',
                                  overflowY: 'auto',
                                  borderRadius: '8px'
                                }}
                              >
                                {filtered.map((design, dIdx) => (
                                  <li
                                    key={dIdx}
                                    className="px-3 py-1 border-bottom border-light-subtle text-black small"
                                    style={{ cursor: 'pointer' }}
                                    onMouseDown={() => {
                                      handleProductInputChange(index, 'design', design);
                                      setActiveDesignDropdownIndex(null);
                                    }}
                                  >
                                    {design}
                                  </li>
                                ))}
                              </ul>
                            );
                          })()}
                        </div>

                        <div className="dashboard-modal-sub-field">
                          <label className="dashboard-modal-sub-label">Lot No</label>
                          <input
                            type="text"
                            className="dashboard-modal-sub-input"
                            placeholder="Lot No"
                            value={product.lotNo}
                            onChange={(e) => handleProductInputChange(index, 'lotNo', e.target.value)}
                            disabled={product._status === 'Done'}
                          />
                        </div>

                        <div className="dashboard-modal-sub-field">
                          <label className="dashboard-modal-sub-label">HSN Code</label>
                          <input
                            type="text"
                            className="dashboard-modal-sub-input"
                            placeholder="HSN Code"
                            value={product.hsnCode}
                            onChange={(e) => handleProductInputChange(index, 'hsnCode', e.target.value)}
                            disabled={product._status === 'Done'}
                          />
                        </div>
                      </div>

                      {/* Row 2: Meter, Qty, Rate */}
                      <div className="dashboard-modal-product-grid">
                        <div className="dashboard-modal-sub-field">
                          <label className="dashboard-modal-sub-label">Meter</label>
                          <input
                            type="number"
                            step="0.01"
                            className="dashboard-modal-sub-input"
                            placeholder="Meter"
                            value={product.meter}
                            onChange={(e) => handleProductInputChange(index, 'meter', e.target.value)}
                            disabled={product._status === 'Done'}
                          />
                        </div>

                        <div className="dashboard-modal-sub-field">
                          <label className="dashboard-modal-sub-label">Qty <span className="req">*</span></label>
                          <input
                            type="number"
                            step="0.01"
                            className="dashboard-modal-sub-input"
                            placeholder="Qty"
                            value={product.qty}
                            onChange={(e) => handleProductInputChange(index, 'qty', e.target.value)}
                            required
                            disabled={product._status === 'Done'}
                          />
                        </div>

                        <div className="dashboard-modal-sub-field">
                          <label className="dashboard-modal-sub-label">Rate <span className="req">*</span></label>
                          <input
                            type="number"
                            step="0.01"
                            className="dashboard-modal-sub-input"
                            placeholder="Rate"
                            value={product.rate}
                            onChange={(e) => handleProductInputChange(index, 'rate', e.target.value)}
                            required
                            disabled={product._status === 'Done'}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* + Add Product Item button */}
                  <button
                    type="button"
                    className="dashboard-modal-add-product-btn"
                    onClick={handleAddProduct}
                  >
                    <i className="bi bi-plus-lg"></i> Add Product Item
                  </button>
                </div>

                {/* Modal Footer matching screenshot */}
                <div className="dashboard-add-modal-footer">
                  <button
                    type="button"
                    className="dashboard-modal-cancel-btn"
                    onClick={handleCloseModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="dashboard-modal-submit-btn"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2" style={{ fontSize: '17px', strokeWidth: '1.5' }}></i>
                        <span>{modalMode === 'edit' ? 'Update Item' : 'Add Item'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
      {/* Modal overlay popup for Invoice Already Created (matching user mockup) */}
      {showInvoiceCreatedModal && (
        <div 
          className="dashboard-invoice-status-backdrop"
          onClick={() => setShowInvoiceCreatedModal(false)}
        >
          <div 
            className="dashboard-invoice-status-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with info icon & circular close button */}
            <div className="dashboard-invoice-status-header">
              <div className="dashboard-invoice-status-icon-box">
                <i className="bi bi-info-circle"></i>
              </div>
              <button 
                type="button" 
                className="dashboard-invoice-status-close-btn"
                onClick={() => setShowInvoiceCreatedModal(false)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            {/* Title & Description */}
            <h3 className="dashboard-invoice-status-title">Invoice Status</h3>
            <p className="dashboard-invoice-status-desc">
              Invoice already created for this dashboard item.
            </p>

            {/* Details Row: Pill Badge, Invoice Number, Amount */}
            <div className="dashboard-invoice-status-pill-box">
              <span className="dashboard-invoice-status-badge">
                {editingItem?.pChNo 
                  ? (editingItem.pChNo.toUpperCase().startsWith('ORD') ? editingItem.pChNo : `${editingItem.pChNo}`)
                  : (editingItem?.id ? `ORD-${editingItem.id}` : 'ORD-7842')}
              </span>
              <span className="dashboard-invoice-status-inv-no">
                {editingItem?.invoiceBillNumber || (editingItem?.id ? `INV-2024-${String(editingItem.id).padStart(3, '0')}` : 'INV-2024-098')}
              </span>
              <span className="dashboard-invoice-status-amount">
                ₹{formatAmount(editingItem?.invoiceAmount || editingItem?.total || 4800)}
              </span>
            </div>

            {/* Action Button matching screenshot */}
            <div className="dashboard-invoice-status-btn-outer">
              <button
                type="button"
                className="dashboard-invoice-status-btn"
                onClick={handleViewExistingInvoice}
              >
                <i className="bi bi-file-earmark-text"></i>
                <span>View Existing Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal overlay popup for Confirm Delete Dashboard Item (modern style) */}
      {showDeleteConfirm && (
        <div 
          className="app-modern-modal-backdrop"
          onClick={() => setShowDeleteConfirm(false)}
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
                onClick={() => setShowDeleteConfirm(false)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <h3 className="app-modern-modal-title">Delete Item</h3>
            <p className="app-modern-modal-desc">
              Are you sure you want to permanently delete this dashboard record? This action cannot be undone.
            </p>
            <div className="app-modern-modal-pill-box">
              <span className="app-modern-modal-badge" style={{ backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '8px' }}>
                {editingItem?.pChNo || `ITEM #${editingItem?.id || ''}`}
              </span>
              <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                {editingItem?.customerName}
              </span>
              <strong style={{ fontSize: '13.5px' }}>
                ₹{formatAmount(editingItem?.total || 0)}
              </strong>
            </div>
            <div className="app-modern-modal-actions-row">
              <button
                type="button"
                className="app-modern-btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="app-modern-btn-danger"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Item'}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Modal overlay popup for Confirm Delete Customer (modern style) */}
      {customerToDelete !== null && (
        <div 
          className="app-modern-modal-backdrop"
          onClick={() => setCustomerToDelete(null)}
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
                onClick={() => setCustomerToDelete(null)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <h3 className="app-modern-modal-title">Delete Customer</h3>
            <p className="app-modern-modal-desc">
              Are you sure you want to delete customer <strong>"{customerToDelete.name}"</strong>? This will remove them from the list, but will not delete their past invoices.
            </p>
            <div className="app-modern-modal-actions-row">
              <button
                type="button"
                className="app-modern-btn-secondary"
                onClick={() => setCustomerToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="app-modern-btn-danger"
                onClick={handleConfirmDeleteCustomer}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
