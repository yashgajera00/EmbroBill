import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dashboardAPI from '../services/dashboardAPI';
import customersAPI from '../services/customersAPI';
import settingsAPI from '../services/settingsAPI';
import Rupee from '../utils/Rupee';
import DateInput from '../utils/DateInput';

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

export default function Dashboard() {
  const navigate = useNavigate();
  const [dashboardItems, setDashboardItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'view', 'edit'
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  
  // Plan Expiry Validation States
  const [planExpiryDate, setPlanExpiryDate] = useState(null);
  const [defaultHsnCode, setDefaultHsnCode] = useState('');
  const [showExpiryModal, setShowExpiryModal] = useState(false);
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

    const matched = dashboardItems.filter(item => {
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
      setDashboardItems(data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const data = await customersAPI.list();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await settingsAPI.get();
      if (data && data.plan_expiry_date) {
        setPlanExpiryDate(data.plan_expiry_date);
      }
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
    setShowAddModal(false);
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
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'date' && planExpiryDate && value > planExpiryDate) {
      setShowExpiryModal(true);
    }
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

    if (planExpiryDate && formData.date > planExpiryDate) {
      setShowExpiryModal(true);
      setFormError(`The selected date exceeds your plan expiry date: ${formatDate(planExpiryDate)}`);
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
  const filteredCustomers = customers.filter(c =>
    (c.name || '').toLowerCase().includes((formData.customerName || '').toLowerCase())
  );

  // Map dashboardItems directly for table rendering (main table columns remain unchanged)
  const itemsList = dashboardItems.map((item, index) => ({
    id: item.id,
    serialNo: dashboardItems.length - index,
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
    products: item.products || []
  }));

  // Filter the dashboard items based on the search type and queries
  const filteredItemsList = itemsList.filter(item => {
    if (searchType === 'search') {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      
      const matchCustomer = (item.customerName || '').toLowerCase().includes(q);
      const matchPChNo = (item.pChNo || '').toLowerCase().includes(q);
      const matchDesignParent = (item.design || '').toLowerCase().includes(q);
      const matchDesignProducts = item.products && item.products.some(p => (p.design || '').toLowerCase().includes(q));
      const matchBroker = (item.broker || '').toLowerCase().includes(q);
      
      return matchCustomer || matchPChNo || matchDesignParent || matchDesignProducts || matchBroker;
    } else if (searchType === 'date') {
      const itemDate = item.date; // YYYY-MM-DD
      if (dateFrom && itemDate < dateFrom) return false;
      if (dateTo && itemDate > dateTo) return false;
      return true;
    }
    return true;
  });

  // Inputs are disabled if customer is selected from DB and they are NOT currently in Editing state
  const isInputsDisabled = !!selectedCustomerId && !isEditingCustomer;

  return (
    <div className="container-fluid p-0 d-flex flex-column flex-grow-1" style={{ marginTop: '-10px' }}>
      <div className="flex-grow-1 d-flex flex-column mb-0" style={{ padding: '0 0 24px 0' }}>
        
        {/* Page Header */}
        <div className="card-title mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div className="d-flex align-items-center gap-4 flex-wrap">
            <span className="fs-3 fw-bold">
              <i className="bi bi-speedometer2 me-2 text-primary"></i>
              Dashboard
            </span>

            {/* Inline Search Form */}
            <form onSubmit={(e) => e.preventDefault()} className="d-flex align-items-center gap-2 mb-0 flex-wrap ms-md-2">
              {searchType === 'date' ? (
                <div className="input-group" style={{ width: '600px' }}>
                  <span className="input-group-text bg-white text-muted border-end-0" style={{ fontSize: '14px' }}>From</span>
                  <DateInput
                    className="form-control border-start-0 border-end-0"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    style={{ fontSize: '14px' }}
                  />
                  <span className="input-group-text bg-white text-muted border-start-0 border-end-0 px-2" style={{ fontSize: '14px' }}>To</span>
                  <DateInput
                    className="form-control border-start-0 border-end-0"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    style={{ fontSize: '14px' }}
                  />
                  <div className="dropdown search-type-dropdown-container" style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="btn btn-light dropdown-toggle border-start-0 h-100 fw-semibold text-dark d-flex align-items-center gap-1"
                      style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, backgroundColor: '#f8fafc', fontSize: '14px' }}
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
                          className={`dropdown-item d-flex align-items-center gap-2 ${searchType === 'search' ? 'active' : ''}`}
                          onClick={() => {
                            setSearchType('search');
                            setSearchTypeDropdownOpen(false);
                          }}
                          style={{ fontSize: '14px' }}
                        >
                          <i className="bi bi-search text-primary"></i> Search
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          className={`dropdown-item d-flex align-items-center gap-2 ${searchType === 'date' ? 'active' : ''}`}
                          onClick={() => {
                            setSearchType('date');
                            setSearchTypeDropdownOpen(false);
                          }}
                          style={{ fontSize: '14px' }}
                        >
                          <i className="bi bi-calendar-event text-warning"></i> Date
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="input-group" style={{ width: '380px' }}>
                  <span className="input-group-text bg-white text-muted border-end-0" style={{ fontSize: '14px' }}>
                    <i className="bi bi-search"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0 border-end-0 ps-0"
                    placeholder="Search customer, design, broker or P.Ch.No..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ fontSize: '14px' }}
                  />
                  <div className="dropdown search-type-dropdown-container" style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="btn btn-light dropdown-toggle border-start-0 h-100 fw-semibold text-dark d-flex align-items-center gap-1"
                      style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, backgroundColor: '#f8fafc', fontSize: '14px' }}
                      onClick={() => setSearchTypeDropdownOpen(!searchTypeDropdownOpen)}
                    >
                      <i className="bi bi-search text-primary me-1"></i> Search
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
                          className={`dropdown-item d-flex align-items-center gap-2 ${searchType === 'search' ? 'active' : ''}`}
                          onClick={() => {
                            setSearchType('search');
                            setSearchTypeDropdownOpen(false);
                          }}
                          style={{ fontSize: '14px' }}
                        >
                          <i className="bi bi-search text-primary"></i> Search
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          className={`dropdown-item d-flex align-items-center gap-2 ${searchType === 'date' ? 'active' : ''}`}
                          onClick={() => {
                            setSearchType('date');
                            setSearchTypeDropdownOpen(false);
                          }}
                          style={{ fontSize: '14px' }}
                        >
                          <i className="bi bi-calendar-event text-warning"></i> Date
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </form>
          </div>
          <button
            type="button"
            className="btn btn-dashboard-add d-flex align-items-center gap-2 px-3 py-2 fw-semibold shadow-sm"
            onClick={handleOpenAddModal}
          >
            <i className="bi bi-plus-lg"></i> Add Item
          </button>
        </div>

        {/* Dashboard Items Table */}
        <div className="content-card shadow-sm p-0 overflow-hidden">
          <div className="table-responsive w-100 m-0 p-0" style={{ width: '100%', minWidth: '100%' }}>
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
                    <th className="col-nowrap" style={{ width: '5%' }}>No.</th>
                    <th className="col-nowrap" style={{ width: '8%' }}>P. Ch. No</th>
                    <th className="col-wrap-text" style={{ width: '16%' }}>Customer Name</th>
                    <th className="col-wrap-text" style={{ width: '11%' }}>Broker</th>
                    <th className="col-nowrap" style={{ width: '10%' }}>Date</th>
                    <th className="col-wrap-text" style={{ width: '13%' }}>Design</th>
                    <th className="col-nowrap" style={{ width: '9%' }}>Qty</th>
                    <th className="col-nowrap" style={{ width: '9%' }}>Rate</th>
                    <th className="col-nowrap" style={{ width: '10%' }}>Total</th>
                    <th className="col-nowrap" style={{ width: '9%' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItemsList.length > 0 ? (
                    filteredItemsList.map((item, index) => (
                      <tr key={item.id} onClick={() => handleRowClick(item)} style={{ cursor: 'pointer' }}>
                        <td className="col-nowrap">{item.serialNo}</td>
                        <td className="col-nowrap">{item.pChNo || '-'}</td>
                        <td className="col-wrap-text">{item.customerName}</td>
                        <td className="col-wrap-text">{item.broker || '-'}</td>
                        <td className="col-nowrap">{formatDate(item.date)}</td>
                        <td className="col-wrap-text">
                          {item.products && item.products.length > 0 ? (
                            item.products.map((p, idx) => (
                              <div key={idx} className="multi-product-row">
                                {p.design || '-'}
                              </div>
                            ))
                          ) : (
                            <div className="multi-product-row">{item.design}</div>
                          )}
                        </td>
                        <td className="col-nowrap">
                          {item.products && item.products.length > 0 ? (
                            item.products.map((p, idx) => (
                              <div key={idx} className="multi-product-row">
                                {p.qty}
                              </div>
                            ))
                          ) : (
                            <div className="multi-product-row">{item.qty}</div>
                          )}
                        </td>
                        <td className="col-nowrap">
                          {item.products && item.products.length > 0 ? (
                            item.products.map((p, idx) => (
                              <div key={idx} className="multi-product-row">
                                <Rupee /> {formatAmount(p.rate)}
                              </div>
                            ))
                          ) : (
                            <div className="multi-product-row">
                              <Rupee /> {formatAmount(item.rate)}
                            </div>
                          )}
                        </td>
                        <td className="col-nowrap">
                          {item.products && item.products.length > 0 ? (
                            item.products.map((p, idx) => (
                              <div key={idx} className="multi-product-row">
                                <Rupee /> {formatAmount(parseFloat(p.qty || 0) * parseFloat(p.rate || 0))}
                              </div>
                            ))
                          ) : (
                            <div className="multi-product-row">
                              <Rupee /> {formatAmount(item.total)}
                            </div>
                          )}
                        </td>
                        <td className="col-nowrap">
                          {item.products && item.products.length > 0 ? (
                            item.products.map((p, idx) => (
                              <div key={idx} className="multi-product-row">
                                <span className={`badge ${(p.status || item.status) === 'Done' ? 'bg-success' : 'bg-warning text-dark'}`} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '30px' }}>
                                  {p.status || item.status}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="multi-product-row">
                              <span className={`badge ${item.status === 'Done' ? 'bg-success' : 'bg-warning text-dark'}`} style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '30px' }}>
                                {item.status}
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="text-center py-4 text-muted">
                        No transactions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* Modal for viewing/adding/editing a dashboard item - WIDER layout (modal-lg) */}
      {showAddModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: '90%' }}>
            <div className="modal-content border-0 shadow-lg text-start animate-fade-in" style={{ borderRadius: '16px' }}>
              
              {/* Modal Header */}
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-primary d-flex align-items-center">
                  <i className={`bi ${
                    modalMode === 'view' 
                      ? 'bi-file-earmark-text-fill' 
                      : (modalMode === 'edit' ? 'bi-pencil-square' : 'bi-file-earmark-plus-fill')
                  } me-2 text-primary`}></i>
                  {modalMode === 'view' ? 'Item Details' : (modalMode === 'edit' ? 'Edit Item' : 'Add Item')}
                </h5>
                <button type="button" className="btn-close" onClick={handleCloseModal}></button>
              </div>

              {modalMode === 'view' ? (
                /* --- READ-ONLY DETAILS VIEW --- */
                <div>
                  <div className="modal-body py-3">
                    {formError && (
                      <div className="alert alert-danger py-2 px-3 small mb-3">
                        {formError}
                      </div>
                    )}
                    <div className="row g-3 p-2">
                      {/* Left Column Details */}
                      <div className="col-md-6">
                        <div className="row mb-3 pb-2 border-bottom align-items-center">
                          <div className="col-4 text-muted fw-semibold" style={{ fontSize: '14px' }}>Customer Name:</div>
                          <div className="col-8 fw-bold text-dark" style={{ fontSize: '16px' }}>{formData.customerName}</div>
                        </div>
                        <div className="row mb-3 pb-2 border-bottom align-items-center">
                          <div className="col-4 text-muted fw-semibold" style={{ fontSize: '14px' }}>P.Ch.No:</div>
                          <div className="col-8 fw-bold text-dark" style={{ fontSize: '16px' }}>{formData.pChNo || '-'}</div>
                        </div>
                        <div className="row mb-3 pb-2 border-bottom align-items-center">
                          <div className="col-4 text-muted fw-semibold" style={{ fontSize: '14px' }}>Billing Address:</div>
                          <div className="col-8 fw-bold text-dark" style={{ fontSize: '16px', whiteSpace: 'pre-wrap' }}>{formData.billingAddress || '-'}</div>
                        </div>
                        <div className="row mb-3 pb-2 border-bottom align-items-center">
                          <div className="col-4 text-muted fw-semibold" style={{ fontSize: '14px' }}>Date:</div>
                          <div className="col-8 fw-bold text-dark" style={{ fontSize: '16px' }}>{formatDate(formData.date)}</div>
                        </div>
                      </div>

                      {/* Right Column Details */}
                      <div className="col-md-6">
                        <div className="row mb-3 pb-2 border-bottom align-items-center">
                          <div className="col-4 text-muted fw-semibold" style={{ fontSize: '14px' }}>GST Number:</div>
                          <div className="col-8 fw-bold text-dark" style={{ fontSize: '16px' }}>{formData.gstNumber || '-'}</div>
                        </div>
                        <div className="row mb-3 pb-2 border-bottom align-items-center">
                          <div className="col-4 text-muted fw-semibold" style={{ fontSize: '14px' }}>Broker:</div>
                          <div className="col-8 fw-bold text-dark" style={{ fontSize: '16px' }}>{formData.broker || '-'}</div>
                        </div>
                        <div className="row mb-3 pb-2 border-bottom align-items-center">
                          <div className="col-4 text-muted fw-semibold" style={{ fontSize: '14px' }}>Payment Status:</div>
                          <div className="col-8 d-flex align-items-center">
                            <span className={`badge ${formData.status === 'Done' ? 'bg-success' : 'bg-warning text-dark'}`} style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '30px' }}>
                              {formData.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Full-width Product Items Table */}
                    <div className="px-2 mt-3">
                      <h6 className="fw-bold text-secondary text-uppercase mb-2" style={{ fontSize: '13px', letterSpacing: '0.5px' }}>Product Items</h6>
                      <div className="table-responsive border rounded-3" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        <table className="table table-bordered table-sm align-middle mb-0" style={{ fontSize: '14px', width: '100%', minWidth: '950px' }}>
                          <thead className="table-light text-center small text-uppercase fw-semibold" style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#f8f9fa' }}>
                            <tr>
                              <th style={{ width: '5%' }}>No.</th>
                              <th style={{ width: '25%' }}>Design</th>
                              <th style={{ width: '15%' }}>Lot No</th>
                              <th style={{ width: '13%' }}>Meter</th>
                              <th style={{ width: '13%' }}>Qty</th>
                              <th style={{ width: '13%' }}>Rate</th>
                              <th style={{ width: '15%' }}>HSN Code</th>
                              <th style={{ width: '16%' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {products.map((p, idx) => (
                              <tr key={idx}>
                                <td className="text-center col-nowrap">{idx + 1}</td>
                                <td className="text-center">{p.design || '-'}</td>
                                <td className="text-center col-nowrap">{p.lotNo || '-'}</td>
                                <td className="text-center col-nowrap">{p.meter || '0.00'}</td>
                                <td className="text-center col-nowrap">{p.qty || '0.00'}</td>
                                <td className="text-center col-nowrap"><Rupee /> {formatAmount(p.rate)}</td>
                                <td className="text-center col-nowrap">{p.hsnCode || '-'}</td>
                                <td className="text-center col-nowrap fw-bold"><Rupee /> {formatAmount(parseFloat(p.qty || 0) * parseFloat(p.rate || 0))}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="table-light fw-bold text-center" style={{ position: 'sticky', bottom: 0, zIndex: 1, backgroundColor: '#f8f9fa' }}>
                            <tr>
                              <td colSpan="3" className="text-center">TOTALS</td>
                              <td className="text-center col-nowrap">{products.reduce((acc, p) => acc + (parseFloat(p.meter) || 0), 0).toFixed(2)}</td>
                              <td className="text-center col-nowrap">{products.reduce((acc, p) => acc + (parseFloat(p.qty) || 0), 0).toFixed(2)}</td>
                              <td className="text-center"></td>
                              <td className="text-center"></td>
                              <td className="text-primary text-center col-nowrap">
                                <Rupee /> {formatAmount(products.reduce((acc, p) => acc + (parseFloat(p.qty || 0) * parseFloat(p.rate || 0)), 0))}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Inline Delete Confirmation Alert */}
                  {showDeleteConfirm && (
                    <div className="alert alert-danger mx-3 mb-3 p-3 d-flex align-items-center justify-content-between" style={{ borderRadius: '12px' }}>
                      <span className="fw-semibold small">
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        Delete this item permanently?
                      </span>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-danger btn-sm px-3 fw-bold"
                          onClick={handleDeleteConfirm}
                          disabled={deleting}
                          style={{ borderRadius: '6px' }}
                        >
                          {deleting ? 'Deleting...' : 'Yes, Delete'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm px-3"
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={deleting}
                          style={{ borderRadius: '6px' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Footer with Delete, Close and Edit Actions */}
                  <div className="modal-footer border-0 pt-0 d-flex justify-content-between">
                    <button
                      type="button"
                      className="btn btn-outline-danger px-3 py-2 d-flex align-items-center justify-content-center"
                      onClick={() => (formData.status === 'Done' || products.some(p => p._status === 'Done')) ? setShowInvoiceCreatedModal(true) : setShowDeleteConfirm(true)}
                      style={{ borderRadius: '8px' }}
                      disabled={showDeleteConfirm}
                      title="Delete Item"
                    >
                      <i className="bi bi-trash fs-5"></i>
                    </button>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-dashboard-add px-4 py-2 d-flex align-items-center gap-2"
                        onClick={() => formData.status === 'Done' ? setShowInvoiceCreatedModal(true) : setModalMode('edit')}
                        style={{ borderRadius: '8px' }}
                      >
                        <i className="bi bi-pencil-square"></i> Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-success px-4 py-2 d-flex align-items-center gap-2"
                        onClick={() => formData.status === 'Done' ? setShowInvoiceCreatedModal(true) : handleConvertToInvoice()}
                        style={{ borderRadius: '8px' }}
                      >
                        <i className="bi bi-file-earmark-text"></i> Invoice
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* --- EDITABLE INPUT FORM --- */
                <form onSubmit={handleFormSubmit}>
                  <div style={{ position: 'relative' }}>
                    <div
                      ref={modalBodyRef}
                      className="modal-body py-3"
                      style={{ maxHeight: '80vh', overflowY: 'auto', paddingRight: '24px' }}
                      onScroll={updateScrollbar}
                    >
                    {formError && (
                      <div className="alert alert-danger py-2 px-3 small mb-3">
                        {formError}
                      </div>
                    )}
                    
                    {/* Part 1: Common Details */}
                    <div className="row g-3">
                      {/* Left Column */}
                      <div className="col-md-6">
                        <div className="mb-3 position-relative customer-dropdown-container">
                          <label className="form-label payment-modal-label mb-1">Customer Name *</label>
                          <div className="input-group">
                            <input
                              type="text"
                              className="form-control"
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
                                className="btn btn-outline-danger"
                                onClick={handleDeselectCustomer}
                                disabled={saving}
                                title="Deselect Customer"
                              >
                                <i className="bi bi-x"></i>
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
                                maxHeight: '200px',
                                overflowY: 'auto'
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
                                      <div className="fw-semibold text-truncate">{c.name}</div>
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
                        
                        <div className="mb-3">
                          <label className="form-label payment-modal-label mb-1">Billing Address</label>
                          <textarea
                            className="form-control"
                            name="billingAddress"
                            placeholder="Enter Billing Address"
                            value={formData.billingAddress}
                            onChange={handleInputChange}
                            rows="2"
                            style={{ height: '85px' }}
                            disabled={isInputsDisabled}
                          />
                        </div>
                      </div>

                      {/* Right Column */}
                      <div className="col-md-6">
                        {/* GST Number Field */}
                        <div className="mb-3">
                          <label className="form-label payment-modal-label mb-1">GST Number</label>
                          <div className="input-group">
                            <input
                              type="text"
                              className="form-control"
                              name="gstNumber"
                              placeholder="Enter GST Number"
                              value={formData.gstNumber}
                              onChange={handleInputChange}
                              disabled={isInputsDisabled}
                            />
                            
                            {selectedCustomerId ? (
                              isEditingCustomer ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-success text-white px-2 fw-semibold btn-sm"
                                    onClick={handleUpdateCustomerDirect}
                                    disabled={savingCustomer}
                                    style={{ borderTopRightRadius: '0px', borderBottomRightRadius: '0px' }}
                                  >
                                    {savingCustomer ? '...' : 'Update'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary text-white px-2 fw-semibold btn-sm"
                                    onClick={handleCancelEditCustomer}
                                    style={{ borderTopRightRadius: '8px', borderBottomRightRadius: '8px' }}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-outline-primary px-3 fw-semibold d-flex align-items-center justify-content-center gap-1 btn-sm"
                                  onClick={() => setIsEditingCustomer(true)}
                                  style={{ borderTopRightRadius: '8px', borderBottomRightRadius: '8px' }}
                                >
                                  <i className="bi bi-pencil-square"></i> Edit
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                className="btn btn-outline-primary px-3 fw-semibold d-flex align-items-center justify-content-center gap-1 btn-sm"
                                onClick={handleSaveCustomerDirect}
                                disabled={savingCustomer || !formData.customerName.trim()}
                                style={{ borderTopRightRadius: '8px', borderBottomRightRadius: '8px' }}
                              >
                                {savingCustomer ? (
                                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                ) : (
                                  <>
                                    <i className="bi bi-person-plus-fill"></i> Save
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Broker Field */}
                        <div className="mb-3">
                          <label className="form-label payment-modal-label mb-1">Broker</label>
                          <input
                            type="text"
                            className="form-control"
                            name="broker"
                            placeholder="Enter Broker Name"
                            value={formData.broker}
                            onChange={handleInputChange}
                          />
                        </div>

                        <div className="row g-3">
                          <div className="col-6">
                            <label className="form-label payment-modal-label mb-1">P.Ch.No</label>
                            <input
                              type="text"
                              className="form-control"
                              name="pChNo"
                              placeholder="Enter P.Ch.No"
                              value={formData.pChNo}
                              onChange={handleInputChange}
                            />
                          </div>
                          <div className="col-6">
                            <label className="form-label payment-modal-label mb-1">Date *</label>
                            <DateInput
                              className="form-control"
                              name="date"
                              value={formData.date}
                              onChange={handleInputChange}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <hr className="my-4" />

                    {/* Part 2: Product Items */}
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h6 className="fw-bold text-secondary text-uppercase mb-0" style={{ fontSize: '13px', letterSpacing: '0.5px' }}>Product Items</h6>
                      <span className="badge bg-primary rounded-pill">{products.length} {products.length === 1 ? 'Item' : 'Items'}</span>
                    </div>

                    <div>
                      {products.map((product, index) => (
                        <div key={index} className="card p-3 mb-3 border position-relative" style={{ backgroundColor: '#fdfdfd', borderRadius: '12px' }}>
                          {products.length > 1 && product._status !== 'Done' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger position-absolute border-0"
                              style={{ top: '8px', right: '8px', padding: '2px 6px' }}
                              onClick={() => handleRemoveProduct(index)}
                              title="Remove Product"
                            >
                              <i className="bi bi-trash fs-6"></i>
                            </button>
                          )}
                          <div className="fw-bold text-secondary mb-2 small text-uppercase">
                            Item #{index + 1}
                            {product._status === 'Done' && (
                              <span className="badge bg-success ms-2" style={{ fontSize: '10px' }}>Invoiced (Done)</span>
                            )}
                          </div>
                          <div className="row g-2">
                            <div className="col-md-4 position-relative design-dropdown-container">
                              <label className="form-label mb-1 small fw-semibold">Design</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
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
                                      maxHeight: '150px',
                                      overflowY: 'auto'
                                    }}
                                  >
                                    {filtered.map((design, dIdx) => (
                                      <li
                                        key={dIdx}
                                        className="px-3 py-1 border-bottom border-light-subtle text-black small"
                                        style={{ cursor: 'pointer', transition: 'background-color 0.15s ease-in-out' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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
                            <div className="col-md-4">
                              <label className="form-label mb-1 small fw-semibold">Lot No</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Lot No"
                                value={product.lotNo}
                                onChange={(e) => handleProductInputChange(index, 'lotNo', e.target.value)}
                                disabled={product._status === 'Done'}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label mb-1 small fw-semibold">HSN Code</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="HSN Code"
                                value={product.hsnCode}
                                onChange={(e) => handleProductInputChange(index, 'hsnCode', e.target.value)}
                                disabled={product._status === 'Done'}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label mb-1 small fw-semibold">Meter</label>
                              <input
                                type="number"
                                step="0.01"
                                className="form-control form-control-sm"
                                placeholder="Meter"
                                value={product.meter}
                                onChange={(e) => handleProductInputChange(index, 'meter', e.target.value)}
                                disabled={product._status === 'Done'}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label mb-1 small fw-semibold">Qty *</label>
                              <input
                                type="number"
                                step="0.01"
                                className="form-control form-control-sm"
                                placeholder="Qty"
                                value={product.qty}
                                onChange={(e) => handleProductInputChange(index, 'qty', e.target.value)}
                                required
                                disabled={product._status === 'Done'}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label mb-1 small fw-semibold">Rate *</label>
                              <input
                                type="number"
                                step="0.01"
                                className="form-control form-control-sm"
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
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm mt-1 w-100 fw-semibold"
                      onClick={handleAddProduct}
                      style={{ borderStyle: 'dashed', borderRadius: '8px', padding: '8px' }}
                    >
                      <i className="bi bi-plus-lg me-1"></i> Add Product Item
                    </button>
                    </div>
                    {/* Custom Scrollbar */}
                    <div style={{
                      position: 'absolute',
                      right: '6px',
                      top: '12px',
                      bottom: '12px',
                      width: '6px',
                      background: '#e5e7eb',
                      borderRadius: '3px',
                      zIndex: 10
                    }}>
                      {scrollThumb.visible && (
                        <div style={{
                          position: 'absolute',
                          top: `${scrollThumb.top}%`,
                          width: '100%',
                          height: `${scrollThumb.height}%`,
                          background: '#9ca3af',
                          borderRadius: '3px',
                          minHeight: '20px',
                          transition: 'top 0.05s ease'
                        }} />
                      )}
                    </div>
                  </div>
                  <div className="modal-footer border-0 pt-0">
                    <button
                      type="button"
                      className="btn btn-secondary px-4 py-2"
                      onClick={handleCloseModal}
                      disabled={saving}
                      style={{ borderRadius: '8px' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary px-4 py-2"
                      disabled={saving}
                      style={{ borderRadius: '8px' }}
                    >
                      {saving ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Saving...
                        </>
                      ) : (
                        modalMode === 'edit' ? 'Save Changes' : 'Add Item'
                      )}
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
      )}
      {/* Modal overlay popup for Invoice Already Created */}
      {showInvoiceCreatedModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg text-start" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-primary">Invoice Status</h5>
                <button type="button" className="btn-close" onClick={() => setShowInvoiceCreatedModal(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body py-3">
                <p className="mb-0 text-dark fw-medium fs-5">Invoice already created for this dashboard item.</p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  className="btn btn-secondary px-4 py-2"
                  onClick={() => setShowInvoiceCreatedModal(false)}
                  style={{ borderRadius: '8px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal overlay popup for Plan Expiry */}
      {showExpiryModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg text-start" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-danger">License Expired!</h5>
                <button type="button" className="btn-close" onClick={() => setShowExpiryModal(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body py-3">
                <p className="mb-2">Your software license has expired or the selected date exceeds your license validity period.</p>
                <p className="mb-0 text-muted">
                  Expiry Date: <strong>{formatDate(planExpiryDate)}</strong>
                </p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  className="btn btn-secondary px-4 py-2"
                  onClick={() => setShowExpiryModal(false)}
                  style={{ borderRadius: '8px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay popup for Confirm Delete Customer */}
      {customerToDelete !== null && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg text-start" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title text-danger fw-bold d-flex align-items-center">
                  <i className="bi bi-exclamation-triangle-fill me-2 text-danger"></i> Delete Customer
                </h5>
                <button type="button" className="btn-close" onClick={() => setCustomerToDelete(null)} aria-label="Close"></button>
              </div>
              <div className="modal-body py-3">
                <p className="mb-0 text-black">
                  Are you sure you want to delete customer <strong>{customerToDelete.name}</strong>? This will remove them from the list, but will not delete their past invoices.
                </p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  onClick={() => setCustomerToDelete(null)}
                  className="btn btn-light border btn-sm px-3"
                  style={{ borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCustomer}
                  className="btn btn-danger btn-sm px-3"
                  style={{ borderRadius: '8px' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
