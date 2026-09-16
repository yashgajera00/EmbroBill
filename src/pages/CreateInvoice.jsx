import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import customersAPI from '../services/customersAPI';
import invoiceAPI from '../services/invoiceAPI';
import settingsAPI from '../services/settingsAPI';
import dashboardAPI from '../services/dashboardAPI';
import { convertNumberToWords } from '../utils/numberToWords';
import Rupee from '../utils/Rupee';
import DateInput from '../utils/DateInput';

const formatAmount = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return '0.00';
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};

const formatDateDDMMYYYY = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

const InlineEditInput = ({
  value,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  step,
  type,
  extraClasses,
  disabled
}) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();

      // Prevent scroll wheel from changing number input values while focused
      const preventWheel = (e) => {
        e.preventDefault();
      };
      const element = inputRef.current;
      element.addEventListener('wheel', preventWheel, { passive: false });
      return () => {
        element.removeEventListener('wheel', preventWheel);
      };
    }
  }, []);

  const getTextAlign = (classes) => {
    if (classes.includes('text-end')) return 'right';
    if (classes.includes('text-center')) return 'center';
    return 'left';
  };

  const inputStyle = {
    width: '100%',
    height: '100%',
    border: '2px solid #2563eb', // 2px blue border focus highlight
    borderRadius: '0',
    outline: 'none',
    boxSizing: 'border-box',
    padding: '6px 8px',
    margin: 0,
    backgroundColor: '#fff',
    minHeight: 'unset',
    lineHeight: '1.4',
    boxShadow: 'none',
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    fontWeight: 'normal',
    color: 'inherit',
    textAlign: getTextAlign(extraClasses)
  };

  if (type === 'text') {
    return (
      <textarea
        ref={inputRef}
        className={`inline-edit-input ${extraClasses}`}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        disabled={disabled}
        style={{
          ...inputStyle,
          resize: 'none',
          overflow: 'hidden',
          whiteSpace: 'pre-wrap'
        }}
      />
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      step={step}
      className={`inline-edit-input ${extraClasses}`}
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      disabled={disabled}
      style={inputStyle}
    />
  );
};

export default function CreateInvoice({ triggerAlert, mode }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  // Search parameters for duplication check and dashboard item link
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const duplicateId = queryParams.get('duplicate_id');
  const dashboardItemId = queryParams.get('dashboard_item_id');

  // Load state
  const [customers, setCustomers] = useState([]);
  const [pendingDashboardItems, setPendingDashboardItems] = useState([]);
  const [allDesigns, setAllDesigns] = useState([]);
  const [selectedPendingItemId, setSelectedPendingItemId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [rowToDelete, setRowToDelete] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState(null);
  const [previewBillNumber, setPreviewBillNumber] = useState('');
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [planExpiryDate, setPlanExpiryDate] = useState(null);
  const [dashboardItemDate, setDashboardItemDate] = useState(null);
  const [defaultHsnCode, setDefaultHsnCode] = useState('');
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [showDateErrorModal, setShowDateErrorModal] = useState(false);
  const [showDifferentBrokerModal, setShowDifferentBrokerModal] = useState(false);
  const [showDifferentHsnModal, setShowDifferentHsnModal] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { rowIndex: number, field: string }
  const [showExtraChargesModal, setShowExtraChargesModal] = useState(false);
  const [showDesignsModal, setShowDesignsModal] = useState(false);
  const [modalProducts, setModalProducts] = useState([]);
  const amountInputRef = useRef(null);
  const [extraChargesList, setExtraChargesList] = useState([]);
  const [chargeToDelete, setChargeToDelete] = useState(null);
  const [extraChargesInput, setExtraChargesInput] = useState({
    amount: '0.00',
    type: '',
    reason: ''
  });

  // Form fields state
  const [invoiceForm, setInvoiceForm] = useState({
    customer: '',
    bill_number: '',
    bill_date: new Date().toISOString().substr(0, 10), // Default to current date YYYY-MM-DD
    challan_no: '',
    hsn_code: '',
    broker: '',
    discount_percent: '0.00',
    blouse_charge: '0.00',
    extra_charges: '0.00',
    extra_charges_type: 'add',
    extra_charges_reason: '',
    sgst_percent: '2.50',
    cgst_percent: '2.50',
    is_challan: false
  });

  // Customer fields state
  const [customerForm, setCustomerForm] = useState({
    name: '',
    address: '',
    gst_number: ''
  });

  const isLinkedToDashboard = !!selectedPendingItemId;
  const isFormFieldsDisabled = mode === 'Add' && !selectedPendingItemId;

  const handleDeselectPendingItem = () => {
    handleCustomerSelectionChange("");
    setSelectedPendingItemId(null);
    setDashboardItemDate(null);
    setInvoiceForm(prev => ({
      ...prev,
      hsn_code: defaultHsnCode || '',
      broker: ''
    }));
    setItems([
      {
        p_ch_no: '',
        lot_no: '',
        design: '',
        meter: '',
        t_qty: '',
        p_qty: '',
        s_qty: '',
        qty: '',
        rate: ''
      }
    ]);
  };

  // Filtered customers list for autocomplete search dropdown
  const filteredCustomers = useMemo(() => {
    return customers.filter(c =>
      c.name.toLowerCase().includes((customerForm.name || '').toLowerCase())
    );
  }, [customers, customerForm.name]);

  // Table items state
  const [items, setItems] = useState([
    { p_ch_no: '', lot_no: '', design: '', meter: '', t_qty: '', p_qty: '', s_qty: '', qty: '', rate: '' }
  ]);

  // Ref and Effect for auto-expanding Billing Address textarea
  const addressRef = useRef(null);
  useEffect(() => {
    if (addressRef.current) {
      addressRef.current.style.height = 'auto';
      addressRef.current.style.height = `${addressRef.current.scrollHeight}px`;
    }
  }, [customerForm.address]);

  const fetchPendingDashboardItems = async () => {
    try {
      const list = await dashboardAPI.list();
      const pending = (list || []).filter(item => {
        // Include items where the overall status is Pending, OR where at least one product is still Pending
        if (item.status === 'Pending') return true;
        if (item.products && item.products.length > 0) {
          return item.products.some(p => (p.status || 'Pending') !== 'Done');
        }
        return false;
      });
      setPendingDashboardItems(pending);
      
      // Extract unique design names from previous dashboard transactions
      const designsSet = new Set();
      (list || []).forEach(item => {
        if (item.products && item.products.length > 0) {
          item.products.forEach(p => {
            if (p.design && p.design.trim()) {
              designsSet.add(p.design.trim());
            }
          });
        } else if (item.design && item.design.trim()) {
          designsSet.add(item.design.trim());
        }
      });
      setAllDesigns(Array.from(designsSet).sort());
      
      return list;
    } catch (err) {
      console.error('Failed to load pending items:', err);
      return [];
    }
  };
  
  const openDesignsModalForCustomer = (customerName, pendingItems = pendingDashboardItems) => {
    if (!customerName || !customerName.trim()) return;
    const nameLower = customerName.trim().toLowerCase();
    
    // Find all matching pending items
    const matches = pendingItems.filter(item => 
      (item.customer_name || '').trim().toLowerCase() === nameLower
    );

    if (matches.length === 0) return;

    // Flatten to list of products
    const list = [];
    matches.forEach(item => {
      if (item.products && item.products.length > 0) {
        item.products.forEach((p, pIdx) => {
          // Skip products that are already Done
          if ((p.status || 'Pending') === 'Done') return;
          list.push({
            id: `${item.id}-${pIdx}`,
            itemId: item.id,
            productIndex: pIdx,
            pChNo: item.p_ch_no || '',
            date: item.date || '',
            design: p.design || '',
            lotNo: p.lot_no || '',
            meter: parseFloat(p.meter) || 0,
            qty: parseFloat(p.qty) || 0,
            rate: parseFloat(p.rate) || 0,
            checked: true,
            broker: item.broker || '',
            hsn_code: item.hsn_code || ''
          });
        });
      } else {
        list.push({
          id: `${item.id}-0`,
          itemId: item.id,
          productIndex: 0,
          pChNo: item.p_ch_no || '',
          date: item.date || '',
          design: item.design || '',
          lotNo: item.lot_no || '',
          meter: parseFloat(item.meter) || 0,
          qty: parseFloat(item.qty) || 0,
          rate: parseFloat(item.rate) || 0,
          checked: true,
          broker: item.broker || '',
          hsn_code: item.hsn_code || ''
        });
      }
    });

    // If there is only one option, select it by default; if there are multiple options, none are selected.
    const isSingleOption = list.length === 1;
    list.forEach(p => {
      p.checked = isSingleOption;
    });

    setModalProducts(list);
    setShowDesignsModal(true);
  };

  const handleConfirmSelectedDesigns = () => {
    const selectedProds = modalProducts.filter(p => p.checked);
    if (selectedProds.length === 0) {
      triggerAlert('Please select at least one design to add.', 'warning');
      return;
    }

    // Check if selected products have different broker names
    const brokers = selectedProds.map(p => (p.broker || '').trim());
    const uniqueBrokers = Array.from(new Set(brokers));
    if (uniqueBrokers.length > 1) {
      setShowDifferentBrokerModal(true);
      return;
    }

    // Check if selected products have different HSN codes
    const hsnCodes = selectedProds.map(p => (p.hsn_code || '').trim());
    const uniqueHsnCodes = Array.from(new Set(hsnCodes));
    if (uniqueHsnCodes.length > 1) {
      setShowDifferentHsnModal(true);
      return;
    }

    setItems(selectedProds.map(prod => ({
      p_ch_no: prod.pChNo || '',
      lot_no: prod.lotNo || '',
      design: prod.design || '',
      meter: prod.meter > 0 ? prod.meter.toFixed(2) : '',
      t_qty: prod.qty > 0 ? String(Math.round(prod.qty)) : '',
      p_qty: '',
      s_qty: '',
      qty: prod.qty > 0 ? prod.qty.toFixed(2) : '',
      rate: prod.rate > 0 ? prod.rate.toFixed(2) : '',
      _dashboard_item_id: prod.itemId || null,
      _product_index: prod.productIndex !== undefined ? prod.productIndex : null
    })));

    // Link first selected pending item ID to header
    const firstSelected = selectedProds[0];
    if (firstSelected) {
      if (firstSelected.itemId) {
        setSelectedPendingItemId(firstSelected.itemId);
        setDashboardItemDate(firstSelected.date);
      }
      setInvoiceForm(prev => ({
        ...prev,
        broker: firstSelected.broker || '',
        hsn_code: firstSelected.hsn_code || defaultHsnCode || ''
      }));
    }

    setShowDesignsModal(false);
  };

  const handleCancelDesignsModal = () => {
    handleDeselectPendingItem();
    setShowDesignsModal(false);
  };

  // Combine fetched design names with any designs currently entered in table rows
  const uniqueDesignsList = useMemo(() => {
    const designsSet = new Set(allDesigns);
    (items || []).forEach(item => {
      if (item.design && item.design.trim()) {
        designsSet.add(item.design.trim());
      }
    });
    return Array.from(designsSet).sort();
  }, [allDesigns, items]);

  // Extract all product lists from pending dashboard items that match current customer
  const availableDashboardProducts = useMemo(() => {
    const selectedCustomer = customers.find(c => String(c.id) === String(invoiceForm.customer));
    const customerName = selectedCustomer ? selectedCustomer.name : customerForm.name;
    if (!customerName || !customerName.trim()) return [];

    const customerLower = customerName.trim().toLowerCase();
    // Filter pending dashboard items by BOTH customer and broker
    const brokerLower = (invoiceForm.broker || '').trim().toLowerCase();
    const matchedItems = pendingDashboardItems.filter(item => {
      const matchCust = (item.customer_name || '').trim().toLowerCase() === customerLower;
      const matchBroker = (item.broker || '').trim().toLowerCase() === brokerLower;
      return matchCust && matchBroker;
    });

    // Extract all products from these matched items
    const productsList = [];
    matchedItems.forEach(item => {
      if (item.products && item.products.length > 0) {
        item.products.forEach((p, pIdx) => {
          productsList.push({
            itemId: item.id,
            productIndex: pIdx,
            pChNo: item.p_ch_no || '',
            date: item.date || '',
            design: p.design || '',
            lotNo: p.lot_no || '',
            meter: parseFloat(p.meter) || 0,
            qty: parseFloat(p.qty) || 0,
            rate: parseFloat(p.rate) || 0,
            hsnCode: p.hsn_code || '',
            status: p.status || item.status || 'Pending'
          });
        });
      } else {
        productsList.push({
          itemId: item.id,
          productIndex: 0,
          pChNo: item.p_ch_no || '',
          date: item.date || '',
          design: item.design || '',
          lotNo: item.lot_no || '',
          meter: parseFloat(item.meter) || 0,
          qty: parseFloat(item.qty) || 0,
          rate: parseFloat(item.rate) || 0,
          hsnCode: item.hsn_code || '',
          status: item.status || 'Pending'
        });
      }
    });

    return productsList;
  }, [pendingDashboardItems, invoiceForm.customer, customerForm.name, customers]);

  const handleSelectDashboardProduct = (rowIndex, prod) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx === rowIndex) {
        return {
          ...item,
          p_ch_no: prod.pChNo || '',
          lot_no: prod.lotNo || '',
          design: prod.design || '',
          meter: prod.meter > 0 ? prod.meter.toFixed(2) : '',
          t_qty: prod.qty > 0 ? String(Math.round(prod.qty)) : '',
          qty: prod.qty > 0 ? prod.qty.toFixed(2) : '',
          rate: prod.rate > 0 ? prod.rate.toFixed(2) : ''
        };
      }
      return item;
    }));

    // Auto link the pending dashboard item id if not already selected
    if (!selectedPendingItemId && prod.itemId) {
      setSelectedPendingItemId(prod.itemId);
      setDashboardItemDate(prod.date);
    }
  };

  // Initial load
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      // Reset all form/item/linked states to avoid dirty data when changing routes/modes
      setInvoiceForm({
        customer: '',
        bill_number: '',
        bill_date: new Date().toISOString().substr(0, 10),
        challan_no: '',
        hsn_code: '',
        broker: '',
        discount_percent: '0.00',
        blouse_charge: '0.00',
        extra_charges: '0.00',
        extra_charges_type: 'add',
        extra_charges_reason: '',
        sgst_percent: '2.50',
        cgst_percent: '2.50',
        is_challan: false
      });
      setCustomerForm({
        name: '',
        address: '',
        gst_number: ''
      });
      setSelectedPendingItemId(null);
      setDashboardItemDate(null);
      setItems([
        { p_ch_no: '', lot_no: '', design: '', meter: '', t_qty: '', p_qty: '', s_qty: '', qty: '', rate: '' }
      ]);
      setIsEditingCustomer(false);

      try {
        // Load customers dropdown options
        const customersList = await customersAPI.list();
        setCustomers(customersList);

        // Fetch pending dashboard items
        const dashboardList = await fetchPendingDashboardItems();

        let defaultHsnCode = '';
        try {
          const settings = await settingsAPI.get();
          if (settings && settings.plan_expiry_date) {
            setPlanExpiryDate(settings.plan_expiry_date);
          }
          if (settings && settings.default_hsn_code) {
            defaultHsnCode = settings.default_hsn_code;
            setDefaultHsnCode(settings.default_hsn_code);
          }
        } catch (settingsErr) {
          console.error('Failed to load company settings:', settingsErr);
        }

        let nextBillNo = '';
        if (mode === 'Add') {
          try {
            const nextBillData = await invoiceAPI.getNextBillNumber();
            if (nextBillData && nextBillData.next_bill_number) {
              nextBillNo = nextBillData.next_bill_number;
            }
          } catch (nextBillErr) {
            console.error('Failed to load next bill number:', nextBillErr);
          }
        }

        if (mode === 'Edit' && id) {
          // Edit Mode
          const invoiceData = await invoiceAPI.get(id);
          setInvoiceForm({
            customer: invoiceData.customer?.id || '',
            bill_number: invoiceData.bill_number || '',
            bill_date: invoiceData.bill_date || '',
            challan_no: invoiceData.challan_no || '',
            hsn_code: invoiceData.hsn_code || '',
            broker: invoiceData.broker || '',
            discount_percent: parseFloat(invoiceData.discount_percent).toFixed(2),
            blouse_charge: parseFloat(invoiceData.blouse_charge).toFixed(2),
            extra_charges: parseFloat(invoiceData.extra_charges || 0).toFixed(2),
            extra_charges_type: invoiceData.extra_charges_type || 'add',
            extra_charges_reason: invoiceData.extra_charges_reason || '',
            sgst_percent: parseFloat(invoiceData.sgst_percent).toFixed(2),
            cgst_percent: parseFloat(invoiceData.cgst_percent).toFixed(2),
            is_challan: false
          });
          setCustomerForm({
            name: invoiceData.customer?.name || '',
            address: invoiceData.customer?.address || '',
            gst_number: invoiceData.customer?.gst_number || ''
          });
          if (invoiceData.dashboard_item_id) {
            setSelectedPendingItemId(invoiceData.dashboard_item_id);
          }
          if (invoiceData.dashboard_item_date) {
            setDashboardItemDate(invoiceData.dashboard_item_date);
          }
          if (invoiceData.items && invoiceData.items.length > 0) {
            setItems(invoiceData.items.map(item => ({
              p_ch_no: item.p_ch_no || '',
              lot_no: item.lot_no || '',
              design: item.design || '',
              meter: parseFloat(item.meter) === 0 ? '' : parseFloat(item.meter).toFixed(2),
              t_qty: parseFloat(item.t_qty) === 0 ? '' : String(parseInt(item.t_qty)),
              p_qty: parseFloat(item.p_qty) === 0 ? '' : parseFloat(item.p_qty).toFixed(2),
              s_qty: parseFloat(item.s_qty) === 0 ? '' : parseFloat(item.s_qty).toFixed(2),
              qty: parseFloat(item.qty) === 0 ? '' : parseFloat(item.qty).toFixed(2),
              rate: parseFloat(item.rate) === 0 ? '' : parseFloat(item.rate).toFixed(2)
            })));
          }
        } else if (mode === 'Add' && duplicateId) {
          // Duplication mode (Add from Duplicate ID)
          const invoiceData = await invoiceAPI.get(duplicateId);
          setInvoiceForm({
            customer: invoiceData.customer?.id || '',
            bill_number: nextBillNo,
            bill_date: new Date().toISOString().substr(0, 10), // Defaults to today's date
            challan_no: invoiceData.challan_no || '',
            hsn_code: invoiceData.hsn_code || '',
            broker: invoiceData.broker || '',
            discount_percent: parseFloat(invoiceData.discount_percent).toFixed(2),
            blouse_charge: parseFloat(invoiceData.blouse_charge).toFixed(2),
            extra_charges: parseFloat(invoiceData.extra_charges || 0).toFixed(2),
            extra_charges_type: invoiceData.extra_charges_type || 'add',
            extra_charges_reason: invoiceData.extra_charges_reason || '',
            sgst_percent: parseFloat(invoiceData.sgst_percent).toFixed(2),
            cgst_percent: parseFloat(invoiceData.cgst_percent).toFixed(2),
            is_challan: false
          });
          setCustomerForm({
            name: invoiceData.customer?.name || '',
            address: invoiceData.customer?.address || '',
            gst_number: invoiceData.customer?.gst_number || ''
          });
          if (invoiceData.items && invoiceData.items.length > 0) {
            setItems(invoiceData.items.map(item => ({
              p_ch_no: item.p_ch_no || '',
              lot_no: item.lot_no || '',
              design: item.design || '',
              meter: parseFloat(item.meter) === 0 ? '' : parseFloat(item.meter).toFixed(2),
              t_qty: parseFloat(item.t_qty) === 0 ? '' : String(parseInt(item.t_qty)),
              p_qty: parseFloat(item.p_qty) === 0 ? '' : parseFloat(item.p_qty).toFixed(2),
              s_qty: parseFloat(item.s_qty) === 0 ? '' : parseFloat(item.s_qty).toFixed(2),
              qty: parseFloat(item.qty) === 0 ? '' : parseFloat(item.qty).toFixed(2),
              rate: parseFloat(item.rate) === 0 ? '' : parseFloat(item.rate).toFixed(2)
            })));
          }
        } else if (mode === 'Add') {
          // Normal Add Mode
          let prefill = location.state?.prefillData;
          if (!prefill && dashboardItemId) {
            const dbItem = (dashboardList || []).find(item => String(item.id) === String(dashboardItemId));
            if (dbItem) {
              prefill = {
                id: dbItem.id,
                date: dbItem.date,
                customerName: dbItem.customer_name,
                billingAddress: dbItem.billing_address,
                gstNumber: dbItem.gst_number,
                hsnCode: dbItem.hsn_code,
                broker: dbItem.broker,
                pChNo: dbItem.p_ch_no,
                lotNo: dbItem.lot_no,
                design: dbItem.design,
                qty: dbItem.qty,
                rate: dbItem.rate,
                meter: dbItem.meter
              };
            }
          }

          if (prefill) {
            const matchingCust = customersList.find(c => (c.name || '').trim().toLowerCase() === (prefill.customerName || '').trim().toLowerCase());
            setInvoiceForm(prev => ({
              ...prev,
              bill_number: nextBillNo,
              customer: matchingCust ? matchingCust.id : '',
              hsn_code: prefill.hsnCode || defaultHsnCode || '',
              broker: prefill.broker || ''
            }));
            setCustomerForm({
              name: prefill.customerName || '',
              address: prefill.billingAddress || '',
              gst_number: prefill.gstNumber || ''
            });
            setIsEditingCustomer(false);
            setSelectedPendingItemId(prefill.id || null);
            if (prefill.date) {
              setDashboardItemDate(prefill.date);
            }

            // Set items with qty mapped to Total Qty (t_qty)
            if (prefill.products && prefill.products.length > 0) {
              setItems(prefill.products.map(p => {
                const parsedQty = parseFloat(p.qty) || 0;
                const parsedRate = parseFloat(p.rate) || 0;
                const parsedMeter = parseFloat(p.meter) || 0;
                return {
                  p_ch_no: prefill.pChNo || '',
                  lot_no: p.lotNo || '',
                  design: p.design || '',
                  meter: parsedMeter > 0 ? parsedMeter.toFixed(2) : '',
                  t_qty: parsedQty > 0 ? String(Math.round(parsedQty)) : '',
                  p_qty: '',
                  s_qty: '',
                  qty: parsedQty > 0 ? parsedQty.toFixed(2) : '',
                  rate: parsedRate > 0 ? parsedRate.toFixed(2) : ''
                };
              }));
            } else {
              const parsedQty = parseFloat(prefill.qty) || 0;
              const parsedRate = parseFloat(prefill.rate) || 0;
              const parsedMeter = parseFloat(prefill.meter) || 0;
              setItems([
                {
                  p_ch_no: prefill.pChNo || '',
                  lot_no: prefill.lotNo || '',
                  design: prefill.design || '',
                  meter: parsedMeter > 0 ? parsedMeter.toFixed(2) : '',
                  t_qty: parsedQty > 0 ? String(Math.round(parsedQty)) : '',
                  p_qty: '',
                  s_qty: '',
                  qty: parsedQty > 0 ? parsedQty.toFixed(2) : '',
                  rate: parsedRate > 0 ? parsedRate.toFixed(2) : ''
                }
              ]);
            }
          } else {
            setInvoiceForm(prev => ({
              ...prev,
              bill_number: nextBillNo,
              hsn_code: defaultHsnCode || ''
            }));
          }
        }
      } catch (err) {
        console.error('Failed to initialize invoice form:', err);
        triggerAlert('Error loading data.', 'danger');
      } finally {
        setLoading(false);
      }
    };
    initializeData();
  }, [mode, id, duplicateId]);

  // Form field updates
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    if (name === 'bill_date') {
      if (planExpiryDate && value > planExpiryDate) {
        setShowExpiryModal(true);
        return;
      }
      if (dashboardItemDate && value < dashboardItemDate) {
        setShowDateErrorModal(true);
        return;
      }
    }
    setInvoiceForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle click outside dropdown to close it
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

  const handleCustomerSelectionChange = (custId) => {
    setInvoiceForm(prev => ({
      ...prev,
      customer: custId
    }));
    setIsEditingCustomer(false);

    if (custId) {
      const selected = customers.find(c => String(c.id) === String(custId));
      if (selected) {
        setCustomerForm({
          name: selected.name || '',
          address: selected.address || '',
          gst_number: selected.gst_number || ''
        });
        
        // Reset items to a single empty row
        setItems([
          { p_ch_no: '', lot_no: '', design: '', meter: '', t_qty: '', p_qty: '', s_qty: '', qty: '', rate: '' }
        ]);

        // Open designs modal for this customer
        openDesignsModalForCustomer(selected.name);
      }
    } else {
      setCustomerForm({
        name: '',
        address: '',
        gst_number: ''
      });
    }
  };

  const handleCustomerFormChange = (e) => {
    const { name, value } = e.target;
    if (name === 'name') {
      setSelectedPendingItemId(null);
    }
    setCustomerForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectPendingItem = (item) => {
    const matchingCust = customers.find(c => (c.name || '').trim().toLowerCase() === (item.customer_name || '').trim().toLowerCase());
    
    setInvoiceForm(prev => ({
      ...prev,
      customer: matchingCust ? matchingCust.id : '',
      hsn_code: item.hsn_code || defaultHsnCode || '',
      broker: item.broker || ''
    }));
    
    setCustomerForm({
      name: item.customer_name || '',
      address: item.billing_address || '',
      gst_number: item.gst_number || ''
    });
    
    setIsEditingCustomer(false);
    setSelectedPendingItemId(item.id);
    setDashboardItemDate(item.date);

    // Do NOT fetch table details! Keep a single empty row
    setItems([
      { p_ch_no: '', lot_no: '', design: '', meter: '', t_qty: '', p_qty: '', s_qty: '', qty: '', rate: '' }
    ]);

    setDropdownOpen(false);

    // Open the designs selection modal
    openDesignsModalForCustomer(item.customer_name);
  };

  const filteredPendingItems = useMemo(() => {
    const query = (customerForm.name || '').trim().toLowerCase();
    
    // Group pending items by customer name to ensure unique customers
    const customerGroups = {};
    pendingDashboardItems.forEach(item => {
      const cName = (item.customer_name || '').trim();
      if (!cName) return;
      const cNameKey = cName.toLowerCase();
      
      let itemPendingCount = 0;
      if (item.products && item.products.length > 0) {
        itemPendingCount = item.products.filter(p => (p.status || 'Pending') !== 'Done').length;
      } else {
        itemPendingCount = 1;
      }

      if (!customerGroups[cNameKey]) {
        customerGroups[cNameKey] = {
          ...item,
          itemsCount: 0
        };
      }
      customerGroups[cNameKey].itemsCount += itemPendingCount;
    });

    const list = Object.values(customerGroups);

    if (!query) return list;
    return list.filter(item => 
      (item.customer_name || '').toLowerCase().includes(query)
    );
  }, [pendingDashboardItems, customerForm.name]);

  const handleSaveCustomer = async () => {
    if (!customerForm.name) {
      triggerAlert('Please enter the customer name.', 'danger');
      return;
    }
    setSavingCustomer(true);
    try {
      const newCust = await customersAPI.add(customerForm);
      // Update dropdown list
      setCustomers(prev => [...prev, newCust].sort((a, b) => a.name.localeCompare(b.name)));
      // Select the new customer
      setInvoiceForm(prev => ({
        ...prev,
        customer: newCust.id
      }));
      // Display success alert
      triggerAlert('Customer added successfully.', 'success');
    } catch (err) {
      console.error('Failed to save customer:', err);
      let errMsg = 'Failed to save customer.';
      if (err.response?.data) {
        if (err.response.data.details) {
          const details = err.response.data.details;
          const messages = Object.keys(details).map(key => `${key.replace('_', ' ')}: ${details[key].join(', ')}`);
          errMsg = messages.join(' | ');
        } else if (err.response.data.error) {
          errMsg = err.response.data.error;
        }
      }
      triggerAlert(errMsg, 'danger');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleStartEditCustomer = (c) => {
    setInvoiceForm(prev => ({
      ...prev,
      customer: c.id
    }));
    setCustomerForm({
      name: c.name || '',
      address: c.address || '',
      gst_number: c.gst_number || ''
    });
    setIsEditingCustomer(true);
  };

  const handleCancelEditCustomer = () => {
    setIsEditingCustomer(false);
    const selected = customers.find(c => String(c.id) === String(invoiceForm.customer));
    if (selected) {
      setCustomerForm({
        name: selected.name || '',
        address: selected.address || '',
        gst_number: selected.gst_number || ''
      });
    }
  };

  const handleUpdateCustomer = async () => {
    if (!customerForm.name) {
      triggerAlert('Please enter the customer name.', 'danger');
      return;
    }
    setSavingCustomer(true);
    try {
      const updatedCust = await customersAPI.edit(invoiceForm.customer, customerForm);
      setCustomers(prev => prev.map(c => c.id === updatedCust.id ? updatedCust : c).sort((a, b) => a.name.localeCompare(b.name)));
      triggerAlert('Customer updated successfully.', 'success');
      setIsEditingCustomer(false);
    } catch (err) {
      console.error('Failed to update customer:', err);
      let errMsg = 'Failed to update customer.';
      if (err.response?.data) {
        if (err.response.data.details) {
          const details = err.response.data.details;
          const messages = Object.keys(details).map(key => `${key.replace('_', ' ')}: ${details[key].join(', ')}`);
          errMsg = messages.join(' | ');
        } else if (err.response.data.error) {
          errMsg = err.response.data.error;
        }
      }
      triggerAlert(errMsg, 'danger');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    const custId = customerToDelete.id;
    try {
      await customersAPI.delete(custId);
      setCustomers(prev => prev.filter(c => c.id !== custId));
      if (String(invoiceForm.customer) === String(custId)) {
        setInvoiceForm(prev => ({
          ...prev,
          customer: ''
        }));
        setCustomerForm({
          name: '',
          address: '',
          gst_number: ''
        });
        setIsEditingCustomer(false);
      }
      triggerAlert('Customer deleted successfully.', 'success');
    } catch (err) {
      console.error('Failed to delete customer:', err);
      triggerAlert(err.response?.data?.error || 'Failed to delete customer.', 'danger');
    } finally {
      setCustomerToDelete(null);
    }
  };

  // Item field changes in grid
  const handleItemChange = (index, field, value) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      newItems[index] = {
        ...newItems[index],
        [field]: value
      };

      // Automatically calculate qty = t_qty - p_qty - s_qty
      const t = parseFloat(newItems[index].t_qty) || 0;
      const p = parseFloat(newItems[index].p_qty) || 0;
      const s = parseFloat(newItems[index].s_qty) || 0;
      const calcQty = t - p - s;

      if (calcQty === 0) {
        newItems[index].qty = '';
      } else {
        newItems[index].qty = calcQty.toFixed(2);
      }

      return newItems;
    });
  };

  // Add dynamic row
  const addRow = () => {
    setItems(prev => [
      ...prev,
      { p_ch_no: '', lot_no: '', design: '', meter: '', t_qty: '', p_qty: '', s_qty: '', qty: '', rate: '' }
    ]);
  };

  // Delete dynamic row confirmation execution
  const confirmDeleteRow = () => {
    if (rowToDelete !== null) {
      if (items.length === 1) {
        // Clear out the only row instead of deleting
        setItems([{ p_ch_no: '', lot_no: '', design: '', meter: '', t_qty: '', p_qty: '', s_qty: '', qty: '', rate: '' }]);
      } else {
        setItems(prev => prev.filter((_, i) => i !== rowToDelete));
      }
      setRowToDelete(null);
    }
  };

  // Clear numeric value if it is 0 on focus so the user doesn't have to backspace
  const handleNumericFocus = (index, field) => {
    const val = items[index][field];
    if (parseFloat(val) === 0 || val === '0' || val === '0.00') {
      handleItemChange(index, field, '');
    }
  };

  // Format numeric value on blur
  const handleNumericBlur = (index, field) => {
    const val = items[index][field];
    if (val !== '' && !isNaN(val)) {
      const num = parseFloat(val);
      if (num === 0) {
        handleItemChange(index, field, '');
      } else {
        if (field === 't_qty') {
          handleItemChange(index, field, String(Math.round(num)));
        } else {
          handleItemChange(index, field, num.toFixed(2));
        }
      }
    }
  };

  // Inline edit field definitions and helper handlers
  const EDITABLE_FIELDS = ['p_ch_no', 'lot_no', 'design', 'meter', 't_qty', 'p_qty', 's_qty', 'rate'];

  const navigateCell = (rowIndex, field, direction) => {
    const fieldIndex = EDITABLE_FIELDS.indexOf(field);
    let nextRowIndex = rowIndex;
    let nextFieldIndex = fieldIndex;

    if (direction === 'next') {
      if (fieldIndex < EDITABLE_FIELDS.length - 1) {
        nextFieldIndex = fieldIndex + 1;
      } else {
        if (rowIndex < items.length - 1) {
          nextRowIndex = rowIndex + 1;
          nextFieldIndex = 0;
        } else {
          // Last cell of last row: save and exit edit mode
          setEditingCell(null);
          return;
        }
      }
    } else if (direction === 'prev') {
      if (fieldIndex > 0) {
        nextFieldIndex = fieldIndex - 1;
      } else {
        if (rowIndex > 0) {
          nextRowIndex = rowIndex - 1;
          nextFieldIndex = EDITABLE_FIELDS.length - 1;
        } else {
          setEditingCell(null);
          return;
        }
      }
    } else if (direction === 'up') {
      if (rowIndex > 0) {
        nextRowIndex = rowIndex - 1;
      }
    } else if (direction === 'down') {
      if (rowIndex < items.length - 1) {
        nextRowIndex = rowIndex + 1;
      }
    } else if (direction === 'left') {
      if (fieldIndex > 0) {
        nextFieldIndex = fieldIndex - 1;
      } else if (rowIndex > 0) {
        nextRowIndex = rowIndex - 1;
        nextFieldIndex = EDITABLE_FIELDS.length - 1;
      }
    } else if (direction === 'right') {
      if (fieldIndex < EDITABLE_FIELDS.length - 1) {
        nextFieldIndex = fieldIndex + 1;
      } else if (rowIndex < items.length - 1) {
        nextRowIndex = rowIndex + 1;
        nextFieldIndex = 0;
      }
    }

    setEditingCell({ rowIndex: nextRowIndex, field: EDITABLE_FIELDS[nextFieldIndex] });
  };

  const handleCellBlur = (rowIndex, field) => {
    handleNumericBlur(rowIndex, field);
    setTimeout(() => {
      setEditingCell(prev => {
        if (prev && prev.rowIndex === rowIndex && prev.field === field) {
          return null;
        }
        return prev;
      });
    }, 150);
  };

  const handleKeyDown = (e, index, field) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      navigateCell(index, field, e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      navigateCell(index, field, e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateCell(index, field, 'up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateCell(index, field, 'down');
    } else if (e.key === 'ArrowLeft') {
      const isNumberInput = ['meter', 't_qty', 'p_qty', 's_qty', 'qty', 'rate'].includes(field);
      const isStart = e.target.selectionStart === 0;
      if (isNumberInput || isStart) {
        e.preventDefault();
        navigateCell(index, field, 'left');
      }
    } else if (e.key === 'ArrowRight') {
      const isNumberInput = ['meter', 't_qty', 'p_qty', 's_qty', 'qty', 'rate'].includes(field);
      const isEnd = e.target.selectionEnd === e.target.value.length;
      if (isNumberInput || isEnd) {
        e.preventDefault();
        navigateCell(index, field, 'right');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null);
    }
  };

  const renderEditableCell = (index, field, type, extraClasses = '') => {
    const isCellDisabled = (() => {
      if (field === 'qty') return true;

      const item = items[index];
      const isRowLinked = !!(item && item._dashboard_item_id);

      if (isRowLinked) {
        if (['p_qty', 's_qty'].includes(field)) {
          return false;
        }
        return true;
      }

      // If not linked to dashboard (e.g. manually added row)
      if (field === 'p_ch_no') return true;

      if (mode === 'Add') {
        if (isFormFieldsDisabled) return true;
        return false;
      }
      return false;
    })();

    const isEditing = !isCellDisabled && editingCell && editingCell.rowIndex === index && editingCell.field === field;
    const item = items[index];
    const isText = type === 'text';

    // Set custom bounds on text columns to restrict horizontal growth
    let widthStyle = {};
    if (field === 'p_ch_no' || field === 'lot_no') {
      widthStyle = { minWidth: '90px', maxWidth: '120px' };
    } else if (field === 'design') {
      widthStyle = { minWidth: '150px', maxWidth: '190px' };
    }

    const getTextAlign = (classes) => {
      if (classes.includes('text-end')) return 'right';
      if (classes.includes('text-center')) return 'center';
      return 'left';
    };

    const getJustifyContent = (classes) => {
      if (classes.includes('text-end')) return 'flex-end';
      if (classes.includes('text-center')) return 'center';
      return 'flex-start';
    };

    return (
      <td
        className="p-0"
        style={{
          cursor: isCellDisabled ? 'default' : 'pointer',
          height: '38px',
          verticalAlign: 'middle',
          position: 'relative', // relative context for overlay positioning
          ...widthStyle
        }}
        onClick={() => !saving && !isCellDisabled && setEditingCell({ rowIndex: index, field })}
      >
        {/* Normal Flow Content: Always rendered to calculate layout width and height stably */}
        <div
          style={{
            width: '100%',
            height: '100%',
            border: '2px solid transparent',
            borderRadius: '0',
            outline: 'none',
            boxSizing: 'border-box',
            padding: '6px 8px',
            margin: 0,
            backgroundColor: isCellDisabled ? '#e9ecef' : 'transparent',
            minHeight: 'unset',
            lineHeight: '1.4',
            fontFamily: 'inherit',
            fontSize: '0.85rem',
            fontWeight: 'normal',
            color: 'inherit',
            textAlign: getTextAlign(extraClasses),
            visibility: isEditing ? 'hidden' : 'visible', // hide text layout while editing but keep it in flow
            whiteSpace: isText ? 'pre-wrap' : 'nowrap', // wrap text exactly like textarea, keep numbers on single line
            wordBreak: 'normal',
            overflowWrap: 'normal',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: getJustifyContent(extraClasses),
            ...widthStyle
          }}
          className={extraClasses}
        >
          <span style={{ width: '100%' }}>
            {item[field] || '\u00A0'}
          </span>
        </div>

        {/* Absolute Input Overlay: Rendered in place of the cell view */}
        {isEditing && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 10,
              backgroundColor: '#fff',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {field === 'design' ? (
              <div className="position-relative w-100 h-100 design-dropdown-container">
                <input
                  type="text"
                  className="form-control form-control-sm inline-edit-input"
                  value={item[field] || ''}
                  onChange={(e) => handleItemChange(index, field, e.target.value)}
                  onFocus={(e) => {
                    try { e.target.select(); } catch (err) { }
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setEditingCell(prev => {
                        if (prev && prev.rowIndex === index && prev.field === field) {
                          return null;
                        }
                        return prev;
                      });
                    }, 250);
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 0,
                    border: '2px solid #2563eb',
                    outline: 'none',
                    fontSize: '0.85rem',
                    padding: '2px 8px',
                    boxSizing: 'border-box'
                  }}
                />
                {(() => {
                  const filteredProds = availableDashboardProducts.filter(p => 
                    (p.design || '').toLowerCase().includes((item[field] || '').toLowerCase())
                  );
                  if (filteredProds.length === 0) return null;
                  return (
                    <ul
                      className="dropdown-menu show shadow-lg border border-light-subtle py-1"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        zIndex: 1050,
                        display: 'block',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        width: '320px'
                      }}
                    >
                      {filteredProds.map((prod, pIdx) => (
                        <li
                          key={pIdx}
                          className="d-flex flex-column px-3 py-2 border-bottom border-light-subtle text-black"
                          style={{ cursor: 'pointer', transition: 'background-color 0.15s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          onMouseDown={() => {
                            handleSelectDashboardProduct(index, prod);
                            setEditingCell(null);
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="fw-bold text-dark">{prod.design}</span>
                            <span className={`badge ${prod.status === 'Done' ? 'bg-success' : 'bg-warning text-dark'} small`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                              {prod.status}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between text-muted" style={{ fontSize: '10px' }}>
                            <span>Lot: {prod.lotNo || '-'} {prod.pChNo ? `| Ch: ${prod.pChNo}` : ''}</span>
                            <span>Qty: {prod.qty} | Rate: ₹{prod.rate}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            ) : (
              <InlineEditInput
                type={type}
                step={field === 't_qty' ? '1' : (type === 'number' ? '0.01' : undefined)}
                extraClasses={extraClasses}
                value={item[field]}
                onChange={(e) => handleItemChange(index, field, e.target.value)}
                onFocus={(e) => {
                  handleNumericFocus(index, field);
                  try { e.target.select(); } catch (err) { }
                }}
                onBlur={() => handleCellBlur(index, field)}
                onKeyDown={(e) => handleKeyDown(e, index, field)}
                disabled={saving}
              />
            )}
          </div>
        )}
      </td>
    );
  };

  // Reset form fields to their empty/default values
  const executeClearForm = () => {
    setInvoiceForm({
      customer: '',
      bill_number: '',
      bill_date: new Date().toISOString().substr(0, 10),
      challan_no: '',
      hsn_code: '',
      broker: '',
      discount_percent: '0.00',
      blouse_charge: '0.00',
      extra_charges: '0.00',
      extra_charges_type: 'add',
      extra_charges_reason: '',
      sgst_percent: '2.50',
      cgst_percent: '2.50'
    });
    setCustomerForm({
      name: '',
      address: '',
      gst_number: ''
    });
    setItems([
      { p_ch_no: '', lot_no: '', design: '', meter: '', t_qty: '', p_qty: '', s_qty: '', qty: '', rate: '' }
    ]);
    setIsEditingCustomer(false);
  };

  const handleClearForm = () => {
    setShowClearConfirmModal(true);
  };

  // Extra Charges Modal handlers
  const handleOpenExtraChargesModal = () => {
    let list = [];
    const reasonStr = invoiceForm.extra_charges_reason || '';
    const summaryAmt = parseFloat(invoiceForm.extra_charges) || 0;
    
    if (reasonStr.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(reasonStr);
        if (Array.isArray(parsed)) {
          list = parsed;
        }
      } catch (e) {
        console.error('Failed to parse extra charges JSON:', e);
      }
    } else if (summaryAmt > 0) {
      list = [{
        amount: invoiceForm.extra_charges,
        type: invoiceForm.extra_charges_type || 'add',
        reason: reasonStr
      }];
    }
    
    setExtraChargesList(list);
    setExtraChargesInput({
      amount: '0.00',
      type: '',
      reason: ''
    });
    setShowExtraChargesModal(true);
  };

  const handleSelectExtraChargesType = (typeVal) => {
    setExtraChargesInput(prev => ({ ...prev, type: typeVal }));
    setTimeout(() => {
      if (amountInputRef.current) {
        amountInputRef.current.focus();
        amountInputRef.current.select();
      }
    }, 50);
  };

  const handleAddChargeToList = () => {
    const amt = parseFloat(extraChargesInput.amount) || 0;
    if (amt <= 0) {
      triggerAlert('Please enter a valid amount greater than 0.', 'warning');
      return;
    }
    if (!extraChargesInput.type) {
      triggerAlert('Please select a type (Add or Cut).', 'warning');
      return;
    }
    const newCharge = {
      amount: amt.toFixed(2),
      type: extraChargesInput.type,
      reason: extraChargesInput.reason.trim()
    };
    setExtraChargesList(prev => [...prev, newCharge]);
    setExtraChargesInput({
      amount: '0.00',
      type: '',
      reason: ''
    });
  };

  const handleRemoveChargeFromList = (index) => {
    setChargeToDelete(index);
  };

  const handleConfirmDeleteCharge = () => {
    if (chargeToDelete !== null) {
      setExtraChargesList(prev => prev.filter((_, idx) => idx !== chargeToDelete));
      setChargeToDelete(null);
    }
  };

  const handleApplyExtraCharges = () => {
    let netTotal = 0;
    extraChargesList.forEach(item => {
      const val = parseFloat(item.amount) || 0;
      if (item.type === 'cut') {
        netTotal -= val;
      } else {
        netTotal += val;
      }
    });

    const isCut = netTotal < 0;
    const finalAmount = Math.abs(netTotal).toFixed(2);
    const finalType = isCut ? 'cut' : 'add';
    const finalReason = JSON.stringify(extraChargesList);

    setInvoiceForm(prev => ({
      ...prev,
      extra_charges: finalAmount,
      extra_charges_type: finalType,
      extra_charges_reason: finalReason
    }));
    setShowExtraChargesModal(false);
  };

  const handleClearExtraCharges = () => {
    setInvoiceForm(prev => ({
      ...prev,
      extra_charges: '0.00',
      extra_charges_type: 'add',
      extra_charges_reason: ''
    }));
    setShowExtraChargesModal(false);
  };

  // Dynamic calculations via useMemo for live updates
  const calculations = useMemo(() => {
    let gross_amount = 0;
    let total_meter = 0;
    let total_tqty = 0;
    let total_pqty = 0;
    let total_sqty = 0;
    let total_qty = 0;

    // Calculate row amounts and sums
    const calculatedItems = items.map(item => {
      const meter = parseFloat(item.meter) || 0;
      const t_qty = parseFloat(item.t_qty) || 0;
      const p_qty = parseFloat(item.p_qty) || 0;
      const s_qty = parseFloat(item.s_qty) || 0;
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate) || 0;
      const amount = qty * rate;

      gross_amount += amount;
      total_meter += meter;
      total_tqty += t_qty;
      total_pqty += p_qty;
      total_sqty += s_qty;
      total_qty += qty;

      return {
        ...item,
        amount: amount.toFixed(2)
      };
    });

    const discountPercent = parseFloat(invoiceForm.discount_percent) || 0;
    const discount_amount = (gross_amount * discountPercent) / 100;
    const blouseCharge = parseFloat(invoiceForm.blouse_charge) || 0;
    const extraCharges = parseFloat(invoiceForm.extra_charges) || 0;
    const subtotal = gross_amount - discount_amount + blouseCharge + (invoiceForm.extra_charges_type === 'cut' ? -extraCharges : extraCharges);

    const sgstPercent = parseFloat(invoiceForm.sgst_percent) || 0;
    const sgst_amount = (subtotal * sgstPercent) / 100;
    const cgstPercent = parseFloat(invoiceForm.cgst_percent) || 0;
    const cgst_amount = (subtotal * cgstPercent) / 100;

    const exactTotal = subtotal + sgst_amount + cgst_amount;
    const amount = Math.round(exactTotal);
    const round_off = amount - exactTotal;
    const amount_in_words = convertNumberToWords(amount);

    return {
      items: calculatedItems,
      totals: {
        total_meter: total_meter.toFixed(2),
        total_tqty: total_tqty,
        total_pqty: total_pqty.toFixed(2),
        total_sqty: total_sqty.toFixed(2),
        total_qty: total_qty.toFixed(2)
      },
      summary: {
        gross_amount: gross_amount.toFixed(2),
        discount_amount: discount_amount.toFixed(2),
        subtotal: subtotal.toFixed(2),
        sgst_amount: sgst_amount.toFixed(2),
        cgst_amount: cgst_amount.toFixed(2),
        round_off: round_off.toFixed(2),
        amount: amount.toFixed(2),
        amount_in_words
      }
    };
  }, [items, invoiceForm.discount_percent, invoiceForm.blouse_charge, invoiceForm.extra_charges, invoiceForm.extra_charges_type, invoiceForm.sgst_percent, invoiceForm.cgst_percent]);

  const handleClosePreview = () => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setPreviewInvoiceId(null);
    setPreviewBillNumber('');
    navigate('/invoice-history');
  };

  const handleDownloadPreviewPdf = () => {
    if (!previewBlobUrl) return;
    const link = document.createElement('a');
    link.href = previewBlobUrl;
    const cleanBillNo = (previewBillNumber || invoiceForm.bill_number || 'Preview').replace(/\//g, '_');
    const prefix = invoiceForm.is_challan ? 'Challan' : 'Invoice';
    link.setAttribute('download', `${prefix}_${cleanBillNo}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Fetch PDF as blob when previewInvoiceId changes (fixes Electron app:// protocol PDF rendering)
  useEffect(() => {
    if (!previewInvoiceId) {
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
          const cleanBillNo = (previewBillNumber || invoiceForm.bill_number || 'Preview').replace(/\//g, '_');
          const prefix = invoiceForm.is_challan ? 'Challan' : 'Invoice';
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
          setPreviewInvoiceId(null);
          setPreviewBillNumber('');
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => { cancelled = true; };
  }, [previewInvoiceId, previewBillNumber]);

  // Form submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (planExpiryDate && invoiceForm.bill_date > planExpiryDate) {
      setShowExpiryModal(true);
      return;
    }

    if (dashboardItemDate && invoiceForm.bill_date < dashboardItemDate) {
      setShowDateErrorModal(true);
      return;
    }

    if (mode === 'Add' && !selectedPendingItemId) {
      triggerAlert('Please select a pending dashboard item from the Customer Name suggestions to generate this invoice.', 'danger');
      return;
    }

    // Validate customer selection or ad-hoc details
    if (!invoiceForm.customer) {
      if (!customerForm.name) {
        triggerAlert('Please select an existing customer or enter the Customer Name manually.', 'danger');
        return;
      }
    }

    // Filter valid rows
    const validItems = calculations.items
      .map(item => ({
        p_ch_no: (item.p_ch_no || '').trim(),
        lot_no: (item.lot_no || '').trim(),
        design: (item.design || '').trim(),
        meter: parseFloat(item.meter) || 0,
        t_qty: parseFloat(item.t_qty) || 0,
        p_qty: parseFloat(item.p_qty) || 0,
        s_qty: parseFloat(item.s_qty) || 0,
        qty: parseFloat(item.qty) || 0,
        rate: parseFloat(item.rate) || 0,
        amount: parseFloat(item.amount) || 0
      }))
      .filter(item => {
        // Skip entirely blank rows
        return (
          item.p_ch_no !== "" ||
          item.lot_no !== "" ||
          item.design !== "" ||
          item.meter !== 0 ||
          item.qty !== 0 ||
          item.rate !== 0
        );
      });

    if (validItems.length === 0) {
      triggerAlert('Please add at least one product row with valid quantities and rates.', 'danger');
      return;
    }

    // Combine form and calculations payload
    // Build billed_products from source tracking on items
    const billedProducts = [];
    calculations.items.forEach(item => {
      if (item._dashboard_item_id != null && item._product_index != null) {
        billedProducts.push({
          item_id: item._dashboard_item_id,
          product_index: item._product_index
        });
      }
    });

    const payload = {
      ...invoiceForm,
      customer: invoiceForm.customer || null,
      customer_name: customerForm.name || '',
      customer_address: customerForm.address || '',
      customer_gst_number: customerForm.gst_number || '',
      dashboard_item_id: selectedPendingItemId,
      billed_products: billedProducts,
      gross_amount: parseFloat(calculations.summary.gross_amount),
      discount_amount: parseFloat(calculations.summary.discount_amount),
      subtotal: parseFloat(calculations.summary.subtotal),
      sgst_amount: parseFloat(calculations.summary.sgst_amount),
      cgst_amount: parseFloat(calculations.summary.cgst_amount),
      round_off: parseFloat(calculations.summary.round_off),
      amount: parseFloat(calculations.summary.amount),
      amount_in_words: calculations.summary.amount_in_words,
      items: validItems
    };

    setSaving(true);
    try {
      let response;
      if (mode === 'Edit' && id) {
        response = await invoiceAPI.edit(id, payload);
        triggerAlert(`Invoice ${response.bill_number} updated successfully.`, 'success');
      } else {
        response = await invoiceAPI.add(payload);
        triggerAlert(`Invoice ${response.bill_number} created successfully.`, 'success');
      }
      setPreviewBillNumber(response.bill_number || '');
      setPreviewInvoiceId(response.id);
    } catch (err) {
      console.error('Failed to save invoice:', err);
      const details = err.response?.data?.details;
      if (details && details.bill_number) {
        setShowDuplicateModal(true);
      } else {
        triggerAlert(err.response?.data?.error || 'Error saving invoice details.', 'danger');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container-fluid p-0">
        <div className="text-center py-5" style={{ padding: '24px 0' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-0 d-flex flex-column flex-grow-1" style={{ marginTop: '-10px' }}>
      <div className="flex-grow-1 d-flex flex-column mb-0" style={{ padding: '0 0 24px 0' }}>
        <div className="card-title mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
          <span className="fs-3 fw-bold">
            <i className={`bi ${mode === 'Edit' ? 'bi-pencil-square' : 'bi-file-earmark-plus'} me-2 text-primary`}></i>
            {mode === 'Edit' ? 'Edit Invoice' : 'Create Invoice'}
          </span>
        </div>
        <form onSubmit={handleSubmit} id="invoice-form">
          <div className="card p-3 border bg-light-subtle mb-4">
            <div className="row g-3">
              {/* Row 1 */}
              {/* Customer Name / Suggestion Dropdown */}
              <div className="col-lg-4 col-md-6 col-12 customer-dropdown-container position-relative">
                <label className="form-label text-uppercase fw-bold invoice-form-label">Customer Name</label>
                <div className="input-group">
                  <input
                    type="text"
                    name="name"
                    className="form-control"
                    placeholder="Enter Customer Name"
                    value={customerForm.name}
                    onChange={(e) => {
                      handleCustomerFormChange(e);
                      setDropdownOpen(true);
                      fetchPendingDashboardItems();
                    }}
                    onFocus={() => {
                      setDropdownOpen(true);
                      fetchPendingDashboardItems();
                    }}
                    required={!invoiceForm.customer}
                    disabled={saving || mode === 'Edit' || !!selectedPendingItemId}
                    autoComplete="off"
                  />
                  {(invoiceForm.customer || selectedPendingItemId) && mode === 'Add' && (
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={handleDeselectPendingItem}
                      title="Deselect Customer"
                      disabled={saving}
                    >
                      <i className="bi bi-x"></i>
                    </button>
                  )}
                </div>

                {dropdownOpen && (
                  <ul
                    className="dropdown-menu show w-100 shadow-lg border border-light-subtle py-1"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      zIndex: 1050,
                      display: 'block',
                      maxHeight: '250px',
                      overflowY: 'auto'
                    }}
                  >
                    {mode === 'Add' ? (
                      filteredPendingItems.length === 0 ? (
                        <li className="px-3 py-2 text-muted small">No pending dashboard bills found</li>
                      ) : (
                        filteredPendingItems.map(item => (
                          <li
                            key={item.id}
                            className="d-flex flex-column px-3 py-2 border-bottom border-light-subtle text-black"
                            style={{ cursor: 'pointer', transition: 'background-color 0.15s' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            onClick={() => handleSelectPendingItem(item)}
                          >
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="fw-bold text-dark">{item.customer_name}</span>
                              <span className="badge bg-warning text-dark small font-monospace" style={{ fontSize: '10px', padding: '3px 8px' }}>
                                {item.itemsCount} Pending
                              </span>
                            </div>
                            <div className="text-muted small" style={{ fontSize: '11px' }}>
                              Click to select designs for billing
                            </div>
                          </li>
                        ))
                      )
                    ) : (
                      filteredCustomers.length === 0 ? (
                        <li className="px-3 py-2 text-muted small">No matching customers found</li>
                      ) : (
                        filteredCustomers.map(c => (
                          <li
                            key={c.id}
                            className="d-flex align-items-center justify-content-between px-3 py-1 border-bottom border-light-subtle text-black"
                            style={{ cursor: 'pointer', transition: 'background-color 0.15s ease-in-out' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <span
                              className="text-truncate flex-grow-1 py-1 fw-medium"
                              onClick={() => {
                                handleCustomerSelectionChange(c.id);
                                setDropdownOpen(false);
                              }}
                            >
                              {c.name}
                            </span>
                            <div className="d-flex gap-1">
                              <button
                                className="btn btn-sm btn-outline-primary border-0 p-1"
                                type="button"
                                title="Edit Customer Details"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEditCustomer(c);
                                  setDropdownOpen(false);
                                }}
                              >
                                <i className="bi bi-pencil-square"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger border-0 p-1"
                                type="button"
                                title="Delete Customer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCustomerToDelete(c);
                                  setDropdownOpen(false);
                                }}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </li>
                        ))
                      )
                    )}
                  </ul>
                )}
              </div>

              {/* GST Number */}
              <div className="col-lg-4 col-md-6 col-12">
                <label className="form-label text-uppercase fw-bold invoice-form-label">GST Number</label>
                <div className="input-group">
                  <input
                    type="text"
                    name="gst_number"
                    className="form-control"
                    placeholder="Enter GSTIN"
                    value={customerForm.gst_number}
                    onChange={handleCustomerFormChange}
                    disabled={saving || mode === 'Add' || (!!invoiceForm.customer && !isEditingCustomer) || isLinkedToDashboard}
                  />
                  {mode !== 'Add' && invoiceForm.customer && !isLinkedToDashboard && (
                    isEditingCustomer ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-success text-white px-2 btn-sm text-truncate"
                          onClick={handleUpdateCustomer}
                          disabled={saving || savingCustomer}
                          title="Update Customer"
                          style={{ maxWidth: '80px' }}
                        >
                          {savingCustomer ? '...' : 'Update'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary text-white px-2 btn-sm text-truncate"
                          onClick={handleCancelEditCustomer}
                          disabled={saving || savingCustomer}
                          title="Cancel"
                          style={{ maxWidth: '80px' }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm text-truncate"
                        onClick={() => setIsEditingCustomer(true)}
                        disabled={saving}
                        title="Edit Customer"
                        style={{ maxWidth: '120px' }}
                      >
                        <i className="bi bi-pencil-square me-1"></i> Edit
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Bill Number */}
              <div className="col-lg-2 col-md-6 col-6">
                <label className="form-label text-uppercase fw-bold invoice-form-label">Bill Number</label>
                <input
                  type="text"
                  name="bill_number"
                  className="form-control"
                  value={invoiceForm.bill_number}
                  onChange={handleFormChange}
                  disabled={saving || mode === 'Add'}
                />
              </div>

              {/* Bill Date */}
              <div className="col-lg-2 col-md-6 col-6">
                <label className="form-label text-uppercase fw-bold invoice-form-label">Bill Date</label>
                <DateInput
                  name="bill_date"
                  className="form-control"
                  value={invoiceForm.bill_date}
                  onChange={handleFormChange}
                  required
                  disabled={saving}
                />
              </div>

              {/* Row 2 */}
              {/* Billing Address */}
              <div className="col-lg-6 col-md-12 col-12">
                <label className="form-label text-uppercase fw-bold invoice-form-label">Billing Address</label>
                <textarea
                  ref={addressRef}
                  name="address"
                  rows="1"
                  className="form-control"
                  placeholder="Enter Billing Address"
                  value={customerForm.address}
                  onChange={handleCustomerFormChange}
                  disabled={saving || mode === 'Add' || (!!invoiceForm.customer && !isEditingCustomer) || isLinkedToDashboard}
                  style={{ resize: 'none', overflowY: 'hidden', minHeight: '38px' }}
                ></textarea>
              </div>

              {/* Cha. No */}
              <div className="col-lg-2 col-md-4 col-4">
                <label className="form-label text-uppercase fw-bold invoice-form-label">Cha. No</label>
                <input
                  type="text"
                  name="challan_no"
                  className="form-control"
                  value={invoiceForm.challan_no}
                  onChange={handleFormChange}
                  disabled={saving}
                />
              </div>

              {/* HSN Code */}
              <div className="col-lg-2 col-md-4 col-4">
                <label className="form-label text-uppercase fw-bold invoice-form-label">HSN Code</label>
                <input
                  type="text"
                  name="hsn_code"
                  className="form-control"
                  value={invoiceForm.hsn_code}
                  onChange={handleFormChange}
                  disabled={saving || mode === 'Add' || isLinkedToDashboard}
                />
              </div>

              {/* Broker */}
              <div className="col-lg-2 col-md-4 col-4">
                <label className="form-label text-uppercase fw-bold invoice-form-label">Broker</label>
                <input
                  type="text"
                  name="broker"
                  className="form-control"
                  value={invoiceForm.broker}
                  onChange={handleFormChange}
                  disabled={saving || mode === 'Add' || isLinkedToDashboard}
                />
              </div>
            </div>
          </div>

          <div className="table-responsive mb-0 rounded-3 border">
            <table className="table table-bordered table-sm align-middle invoice-table mb-0">
              <thead className="table-dark text-center small text-uppercase">
                <tr>
                  <th className="col-nowrap text-center align-middle" style={{ width: '40px' }}>No</th>
                  <th className="col-wrap-text text-center align-middle" style={{ minWidth: '90px' }}>P.Ch.No</th>
                  <th className="col-wrap-text text-center align-middle" style={{ minWidth: '90px' }}>Lot No</th>
                  <th className="col-wrap-text text-center align-middle" style={{ minWidth: '150px' }}>Design</th>
                  <th className="col-nowrap text-center align-middle" style={{ minWidth: '80px' }}>Meter</th>
                  <th className="col-wrap-text text-center align-middle" style={{ minWidth: '70px' }}>Total<br/>Qty</th>
                  <th className="col-wrap-text text-center align-middle" style={{ minWidth: '70px' }}>Plain<br/>Qty</th>
                  <th className="col-wrap-text text-center align-middle" style={{ minWidth: '70px' }}>Short<br/>Qty</th>
                  <th className="col-nowrap text-center align-middle" style={{ minWidth: '80px' }}>Qty</th>
                  <th className="col-nowrap text-center align-middle" style={{ minWidth: '90px' }}>Rate</th>
                  <th className="col-nowrap text-center align-middle" style={{ minWidth: '120px' }}>Amount</th>
                  <th className="col-nowrap text-center align-middle" style={{ width: '50px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const calculatedAmount = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
                  return (
                    <tr key={index}>
                      <td className="text-center align-middle row-number col-nowrap">{index + 1}</td>
                      {renderEditableCell(index, 'p_ch_no', 'text', 'text-center item-pch col-wrap-text')}
                      {renderEditableCell(index, 'lot_no', 'text', 'text-center item-lot col-wrap-text')}
                      {renderEditableCell(index, 'design', 'text', 'text-center item-design col-wrap-text')}
                      {renderEditableCell(index, 'meter', 'number', 'text-center item-meter col-nowrap')}
                      {renderEditableCell(index, 't_qty', 'number', 'text-center item-tqty col-nowrap')}
                      {renderEditableCell(index, 'p_qty', 'number', 'text-center item-pqty col-nowrap')}
                      {renderEditableCell(index, 's_qty', 'number', 'text-center item-sqty col-nowrap')}
                      {renderEditableCell(index, 'qty', 'number', 'text-center item-qty col-nowrap')}
                      {renderEditableCell(index, 'rate', 'number', 'text-center item-rate col-nowrap')}
                      <td className="text-end align-middle item-amount col-nowrap">
                        {formatAmount(calculatedAmount)}
                      </td>
                      <td className="text-center align-middle p-0 col-nowrap">
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm border-0 remove-row-btn"
                          onClick={() => setRowToDelete(index)}
                          disabled={saving || items.length === 1 || isFormFieldsDisabled || !!item._dashboard_item_id}
                        >
                          <i className="bi bi-trash"></i>
                          <span className="btn-text">Delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {/* Row Type Add Button inside Table */}
                {!isFormFieldsDisabled && (
                  <tr>
                    <td colSpan="12" className="text-center p-2 bg-light-subtle">
                      <button
                        type="button"
                        onClick={addRow}
                        className="btn btn-outline-primary btn-sm rounded-pill mx-auto"
                        disabled={saving}
                        style={{ borderStyle: 'dashed', width: '85%' }}
                      >
                        <i className="bi bi-plus-lg me-1"></i> Add Row
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="table-light fw-bold text-end">
                <tr>
                  <td colSpan="4" className="text-center col-nowrap">TOTALS</td>
                  <td id="total-meter" className="col-nowrap">{calculations.totals.total_meter}</td>
                  <td id="total-tqty" className="col-nowrap">{calculations.totals.total_tqty}</td>
                  <td id="total-pqty" className="col-nowrap">{calculations.totals.total_pqty}</td>
                  <td id="total-sqty" className="col-nowrap">{calculations.totals.total_sqty}</td>
                  <td id="total-qty" className="col-nowrap">{calculations.totals.total_qty}</td>
                  <td className="col-nowrap"></td>
                  <td id="total-amount" className="col-nowrap">{formatAmount(calculations.summary.gross_amount)}</td>
                  <td className="col-nowrap"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="row g-2 mt-0">
            {/* Left side: Discount table */}
            <div className="col-lg-4 col-md-6 col-12 order-lg-1 order-md-1 order-1">
              <div className="card p-2 border-0 bg-light h-100">
                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <label className="form-label fw-bold invoice-form-label mb-0">Gross Amount (<Rupee />)</label>
                    <input
                      type="text"
                      className="form-control form-control-sm bg-light text-muted text-end"
                      value={formatAmount(calculations.summary.gross_amount)}
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-bold invoice-form-label mb-0">Discount %</label>
                    <input
                      type="number"
                      step="0.01"
                      name="discount_percent"
                      className="form-control form-control-sm"
                      value={invoiceForm.discount_percent}
                      onChange={handleFormChange}
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <label className="form-label fw-bold invoice-form-label mb-0">Discount Amount (<Rupee />)</label>
                    <input
                      type="text"
                      className="form-control form-control-sm bg-light text-muted text-end"
                      value={formatAmount(calculations.summary.discount_amount)}
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-bold invoice-form-label mb-0">Blouse Charge (<Rupee />)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="blouse_charge"
                      className="form-control form-control-sm"
                      value={invoiceForm.blouse_charge}
                      onChange={handleFormChange}
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="row g-2">
                  <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label className="form-label fw-bold invoice-form-label mb-0">Sub Total (<Rupee />)</label>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-decoration-none fw-bold text-primary"
                        style={{ fontSize: '0.75rem', outline: 'none', boxShadow: 'none' }}
                        onClick={handleOpenExtraChargesModal}
                        disabled={saving}
                      >
                        {invoiceForm.extra_charges && parseFloat(invoiceForm.extra_charges) > 0 ? (
                          (() => {
                            let label = `Extra: ${invoiceForm.extra_charges_type === 'cut' ? '-' : '+'}${formatAmount(invoiceForm.extra_charges)}`;
                            const reasonStr = invoiceForm.extra_charges_reason || '';
                            if (reasonStr.trim().startsWith('[')) {
                              try {
                                const parsed = JSON.parse(reasonStr);
                                if (Array.isArray(parsed) && parsed.length > 0) {
                                  if (parsed.length === 1) {
                                    label += parsed[0].reason ? ` (${parsed[0].reason})` : '';
                                  } else {
                                    label += ` (${parsed.length} items)`;
                                  }
                                }
                              } catch (e) {}
                            } else if (reasonStr) {
                              label += ` (${reasonStr})`;
                            }
                            return <span>{label} (Edit)</span>;
                          })()
                        ) : (
                          "+ Extra Charges"
                        )}
                      </button>
                    </div>
                    <input
                      type="text"
                      className="form-control form-control-sm bg-light text-muted text-end"
                      value={formatAmount(calculations.summary.subtotal)}
                      readOnly
                      disabled
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Middle part: Buttons & Amount in Words */}
            <div className="col-lg-4 col-md-12 col-12 order-lg-2 order-md-3 order-3 d-flex flex-column justify-content-between">
              <div className="card p-2 border-0 bg-light flex-grow-1 mb-2">
                <label className="form-label fw-bold invoice-form-label mb-0">Amount In Words</label>
                <textarea
                  className="form-control form-control-sm bg-light text-muted flex-grow-1 mt-1"
                  value={calculations.summary.amount_in_words}
                  readOnly
                  disabled
                  rows="2"
                  style={{ resize: 'none' }}
                />
              </div>

              {/* Actions */}
              <div className="d-flex justify-content-center gap-2 mt-auto">
                {mode === 'Edit' ? (
                  <button
                    type="button"
                    onClick={() => navigate('/invoice-history')}
                    className="btn btn-light border btn-sm px-3"
                  >
                    Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="btn btn-light border btn-sm px-3"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="submit"
                  className="btn btn-primary btn-sm px-4"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-1"></i> Save Invoice
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right side: Totals table */}
            <div className="col-lg-4 col-md-6 col-12 order-lg-3 order-md-2 order-2">
              <div className="card p-2 border-0 bg-light h-100">
                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <label className="form-label fw-bold invoice-form-label mb-0">SGST %</label>
                    <input
                      type="number"
                      step="0.01"
                      name="sgst_percent"
                      className="form-control form-control-sm"
                      value={invoiceForm.sgst_percent}
                      onChange={handleFormChange}
                      disabled={saving}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-bold invoice-form-label mb-0">SGST Amount (<Rupee />)</label>
                    <input
                      type="text"
                      className="form-control form-control-sm bg-light text-muted text-end"
                      value={formatAmount(calculations.summary.sgst_amount)}
                      readOnly
                      disabled
                    />
                  </div>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <label className="form-label fw-bold invoice-form-label mb-0">CGST %</label>
                    <input
                      type="number"
                      step="0.01"
                      name="cgst_percent"
                      className="form-control form-control-sm"
                      value={invoiceForm.cgst_percent}
                      onChange={handleFormChange}
                      disabled={saving}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-bold invoice-form-label mb-0">CGST Amount (<Rupee />)</label>
                    <input
                      type="text"
                      className="form-control form-control-sm bg-light text-muted text-end"
                      value={formatAmount(calculations.summary.cgst_amount)}
                      readOnly
                      disabled
                    />
                  </div>
                </div>
                <div className="row g-2">
                  <div className="col-6">
                    <label className="form-label fw-bold invoice-form-label mb-0">Round Off (<Rupee />)</label>
                    <input
                      type="text"
                      className="form-control form-control-sm bg-light text-muted text-end"
                      value={formatAmount(calculations.summary.round_off)}
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label text-success mb-0 fw-bold" style={{ fontSize: '16.5px' }}>Grand Amount (<Rupee />)</label>
                    <input
                      type="text"
                      className="form-control form-control-sm bg-light text-success fw-bold text-end"
                      style={{ fontSize: '1.1rem', color: '#198754' }}
                      value={`Rs. ${formatAmount(calculations.summary.amount)}`}
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Modal overlay popup for Extra Charges / Cuts */}
      {showExtraChargesModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-primary d-flex align-items-center">
                  <i className="bi bi-plus-slash-minus me-2"></i> Extra Charges / Cuts
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowExtraChargesModal(false)} 
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body py-3">
                {/* 1. List of Added Charges */}
                <div className="mb-3">
                  <label className="form-label fw-bold small mb-2 text-secondary">Added Charges / Cuts ({extraChargesList.length})</label>
                  {extraChargesList.length === 0 ? (
                    <div className="text-muted text-center py-2 bg-light rounded" style={{ fontSize: '0.85rem', border: '1px dashed #cbd5e1' }}>
                      No extra charges or cuts added yet.
                    </div>
                  ) : (
                    <div className="border rounded charges-scroll-container" style={{ height: '110px', overflowY: 'auto' }}>
                      <table className="table table-sm table-borderless mb-0" style={{ fontSize: '0.9rem' }}>
                        <thead className="table-light border-bottom" style={{ fontSize: '0.8rem', position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr>
                            <th className="px-2 py-1">Type</th>
                            <th className="px-2 py-1 text-end">Amount</th>
                            <th className="px-2 py-1">Reason</th>
                            <th className="px-2 py-1 text-center" style={{ width: '40px' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {extraChargesList.map((item, idx) => (
                            <tr key={idx} className="border-bottom align-middle">
                              <td className="px-2 py-1">
                                <span className={`badge ${item.type === 'add' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill`} style={{ fontSize: '0.75rem' }}>
                                  {item.type === 'add' ? 'Add' : 'Cut'}
                                </span>
                              </td>
                              <td className="px-2 py-1 text-end fw-bold">₹ {formatAmount(item.amount)}</td>
                              <td className="px-2 py-1 text-truncate" style={{ maxWidth: '120px' }} title={item.reason}>
                                {item.reason || '-'}
                              </td>
                              <td className="px-2 py-1 text-center">
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm text-danger p-0 border-0"
                                  onClick={() => handleRemoveChargeFromList(idx)}
                                >
                                  <i className="bi bi-trash-fill"></i>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <hr className="my-3" />

                {/* 2. Form to Add New Charge */}
                <div className="mt-2">
                  <div className="fw-bold small mb-2 text-primary" style={{ fontSize: '0.85rem' }}>Add New Charge / Cut</div>
                  
                  <div className="mb-2.5">
                    <label className="form-label fw-bold small mb-1" style={{ fontSize: '0.8rem' }}>Type</label>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className={`btn btn-sm flex-grow-1 ${extraChargesInput.type === 'add' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => handleSelectExtraChargesType('add')}
                        style={{ height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}
                      >
                        <i className="bi bi-plus-circle me-1"></i> Add
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm flex-grow-1 ${extraChargesInput.type === 'cut' ? 'btn-danger' : 'btn-outline-danger'}`}
                        onClick={() => handleSelectExtraChargesType('cut')}
                        style={{ height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}
                      >
                        <i className="bi bi-dash-circle me-1"></i> Cut
                      </button>
                    </div>
                  </div>

                  <div className="mb-2.5">
                    <label htmlFor="extra-charges-amount" className="form-label fw-bold small mb-1" style={{ fontSize: '0.8rem' }}>Amount (₹)</label>
                    <input
                      ref={amountInputRef}
                      type="number"
                      step="0.01"
                      min="0"
                      id="extra-charges-amount"
                      className="form-control form-control-sm"
                      style={{ fontSize: '0.85rem' }}
                      placeholder="0.00"
                      value={extraChargesInput.amount}
                      onChange={(e) => setExtraChargesInput(prev => ({ ...prev, amount: e.target.value }))}
                      disabled={!extraChargesInput.type}
                      autoFocus={!!extraChargesInput.type}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>

                  <div className="mb-2">
                    <label htmlFor="extra-charges-reason" className="form-label fw-bold small mb-1" style={{ fontSize: '0.8rem' }}>Reason</label>
                    <input
                      type="text"
                      id="extra-charges-reason"
                      className="form-control form-control-sm"
                      style={{ fontSize: '0.85rem' }}
                      placeholder="e.g. Transport, Special Discount"
                      value={extraChargesInput.reason}
                      onChange={(e) => setExtraChargesInput(prev => ({ ...prev, reason: e.target.value }))}
                      disabled={!extraChargesInput.type}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm w-100 mt-2 d-flex align-items-center justify-content-center gap-1 fw-bold"
                    style={{ height: '32px', fontSize: '0.8rem' }}
                    onClick={handleAddChargeToList}
                    disabled={!extraChargesInput.type}
                  >
                    <i className="bi bi-plus-lg"></i> Add to List
                  </button>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0 d-flex justify-content-between">
                <button
                  type="button"
                  onClick={handleClearExtraCharges}
                  className="btn btn-outline-secondary btn-sm px-3"
                >
                  Clear All
                </button>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowExtraChargesModal(false)}
                    className="btn btn-light border btn-sm px-3"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyExtraCharges}
                    className="btn btn-primary btn-sm px-3"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay popup for Duplicate Bill Number */}
      {showDuplicateModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title text-warning fw-bold d-flex align-items-center">
                  <i className="bi bi-exclamation-triangle-fill me-2 text-warning"></i> Duplicate Bill Number
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowDuplicateModal(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body py-3">
                <p className="mb-0">
                  The bill number <strong>"{invoiceForm.bill_number}"</strong> already exists in the system. Please enter a different, unique bill number to save this invoice.
                </p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  onClick={() => setShowDuplicateModal(false)}
                  className="btn btn-warning text-white btn-sm px-4"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay popup for Confirm Clear Form */}
      {showClearConfirmModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title text-danger fw-bold d-flex align-items-center">
                  <i className="bi bi-exclamation-triangle-fill me-2 text-danger"></i> Clear Invoice Form
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowClearConfirmModal(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body py-3">
                <p className="mb-0">
                  Are you sure you want to clear all form fields? This will discard all of your current inputs and restore the defaults.
                </p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  onClick={() => setShowClearConfirmModal(false)}
                  className="btn btn-light border btn-sm px-3"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    executeClearForm();
                    setShowClearConfirmModal(false);
                  }}
                  className="btn btn-danger btn-sm px-3"
                >
                  Clear Form
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay popup for Confirm Delete Row */}
      {rowToDelete !== null && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title text-danger fw-bold d-flex align-items-center">
                  <i className="bi bi-exclamation-triangle-fill me-2 text-danger"></i> Delete Row
                </h5>
                <button type="button" className="btn-close" onClick={() => setRowToDelete(null)} aria-label="Close"></button>
              </div>
              <div className="modal-body py-3">
                <p className="mb-0">
                  Are you sure you want to delete row #{rowToDelete + 1}? This will discard all of its inputs.
                </p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  onClick={() => setRowToDelete(null)}
                  className="btn btn-light border btn-sm px-3"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteRow}
                  className="btn btn-danger btn-sm px-3"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay popup for Confirm Delete Customer */}
      {customerToDelete !== null && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title text-danger fw-bold d-flex align-items-center">
                  <i className="bi bi-exclamation-triangle-fill me-2 text-danger"></i> Delete Customer
                </h5>
                <button type="button" className="btn-close" onClick={() => setCustomerToDelete(null)} aria-label="Close"></button>
              </div>
              <div className="modal-body py-3 text-start">
                <p className="mb-0 text-black">
                  Are you sure you want to delete customer <strong>{customerToDelete.name}</strong>? This will remove them from the list, but will not delete their past invoices.
                </p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  onClick={() => setCustomerToDelete(null)}
                  className="btn btn-light border btn-sm px-3"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCustomer}
                  className="btn btn-danger btn-sm px-3"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay popup for Plan Expiry */}
      {showExpiryModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title text-danger fw-bold d-flex align-items-center">
                  <i className="bi bi-exclamation-triangle-fill me-2 text-danger"></i> Plan Expired
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowExpiryModal(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body py-3 text-center">
                <p className="mb-0 fs-5">
                  Your plan has expired.
                </p>
                <p className="mt-2 text-muted">
                  Expiry Date: <strong>{formatDateDDMMYYYY(planExpiryDate)}</strong>
                </p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  onClick={() => setShowExpiryModal(false)}
                  className="btn btn-danger btn-sm px-4"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay popup for Date Error */}
      {showDateErrorModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg text-start">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title text-danger fw-bold d-flex align-items-center">
                  <i className="bi bi-exclamation-triangle-fill me-2 text-danger"></i> Invalid Bill Date
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowDateErrorModal(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body py-3">
                <p className="mb-0 text-black">
                  Bill Date cannot be earlier than Dashboard Billing Date (<strong>{formatDateDDMMYYYY(dashboardItemDate)}</strong>).
                </p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  onClick={() => setShowDateErrorModal(false)}
                  className="btn btn-danger btn-sm px-4"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay popup for Different Broker Alert */}
      {showDifferentBrokerModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg text-start">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title text-danger fw-bold d-flex align-items-center">
                  <i className="bi bi-exclamation-triangle-fill me-2 text-danger"></i> Different Broker Detected
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowDifferentBrokerModal(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body py-3">
                <p className="mb-0 text-black">
                  You cannot select items with different broker names. Please select items belonging to the same broker.
                </p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  onClick={() => setShowDifferentBrokerModal(false)}
                  className="btn btn-danger btn-sm px-4"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay popup for Different HSN Alert */}
      {showDifferentHsnModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg text-start">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title text-danger fw-bold d-flex align-items-center">
                  <i className="bi bi-exclamation-triangle-fill me-2 text-danger"></i> Different HSN Codes Detected
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowDifferentHsnModal(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body py-3">
                <p className="mb-0 text-black">
                  You cannot select items with different HSN codes. Please select items belonging to the same HSN code.
                </p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  onClick={() => setShowDifferentHsnModal(false)}
                  className="btn btn-danger btn-sm px-4"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay popup for Selecting Pending Designs */}
      {showDesignsModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg text-start">
              <div className="modal-header bg-primary text-white py-3">
                <h5 className="modal-title fw-bold d-flex align-items-center">
                  <i className="bi bi-grid-3x3-gap-fill me-2"></i> Select Pending Designs for Bill
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={handleCancelDesignsModal} aria-label="Close"></button>
              </div>
              <div className="modal-body p-4" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <p className="text-muted small mb-3">
                  Check the designs/items from the dashboard you want to include in this invoice.
                </p>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0 text-center">
                    <thead className="table-light text-uppercase font-monospace" style={{ fontSize: '12px' }}>
                      <tr>
                        <th width="40" className="text-center">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={modalProducts.length > 0 && modalProducts.every(p => p.checked)}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setModalProducts(prev => prev.map(p => ({ ...p, checked: val })));
                            }}
                          />
                        </th>
                        <th className="text-center">Date</th>
                        <th className="text-center">P.Ch.No</th>
                        <th className="text-center">Design</th>
                        <th className="text-center">Lot No</th>
                        <th className="text-center">Broker</th>
                        <th className="text-center">Qty</th>
                        <th className="text-center">Rate</th>
                        <th className="text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalProducts.map((prod, idx) => (
                        <tr
                          key={prod.id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            setModalProducts(prev => prev.map((p, pIdx) => pIdx === idx ? { ...p, checked: !p.checked } : p));
                          }}
                        >
                          <td className="text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={prod.checked}
                              onChange={(e) => {
                                const val = e.target.checked;
                                setModalProducts(prev => prev.map((p, pIdx) => pIdx === idx ? { ...p, checked: val } : p));
                              }}
                            />
                          </td>
                          <td className="small text-center">{formatDateDDMMYYYY(prod.date)}</td>
                          <td className="small font-monospace text-center">{prod.pChNo || '-'}</td>
                          <td className="fw-bold text-center">{prod.design}</td>
                          <td className="small font-monospace text-center">{prod.lotNo || '-'}</td>
                          <td className="small text-center">{prod.broker || '-'}</td>
                          <td className="text-center small">{prod.qty}</td>
                          <td className="text-center small">₹{prod.rate.toFixed(2)}</td>
                          <td className="text-center fw-semibold">₹{(prod.qty * prod.rate).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer bg-light py-3 d-flex justify-content-between">
                <button type="button" className="btn btn-light border btn-sm px-3" onClick={handleCancelDesignsModal}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary btn-sm px-4 fw-semibold" onClick={handleConfirmSelectedDesigns}>
                  Add to Bill ({modalProducts.filter(p => p.checked).length})
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
                  <i className="bi bi-file-earmark-pdf-fill me-2 text-danger"></i> Invoice PDF Live Preview
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={handleClosePreview}
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
                  onClick={handleClosePreview}
                  className="btn btn-secondary btn-sm px-4"
                  style={{ minWidth: '180px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Close & Go to History
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPreviewPdf}
                  className="btn btn-primary btn-sm px-4"
                  disabled={!previewBlobUrl}
                  style={{ minWidth: '180px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <i className="bi bi-download me-1"></i> Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal overlay popup for Confirm Delete Charge */}
      {chargeToDelete !== null && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title text-danger fw-bold d-flex align-items-center">
                  <i className="bi bi-exclamation-triangle-fill me-2 text-danger"></i> Delete Extra Charge
                </h5>
                <button type="button" className="btn-close" onClick={() => setChargeToDelete(null)} aria-label="Close"></button>
              </div>
              <div className="modal-body py-3">
                <p className="mb-0">
                  Are you sure you want to delete this extra charge/cut of <strong>₹ {formatAmount(extraChargesList[chargeToDelete]?.amount)}</strong> ({extraChargesList[chargeToDelete]?.reason || 'no reason'})?
                </p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  onClick={() => setChargeToDelete(null)}
                  className="btn btn-light border btn-sm px-3"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCharge}
                  className="btn btn-danger btn-sm px-3"
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
