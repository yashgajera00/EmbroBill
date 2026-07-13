import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import customersAPI from '../services/customersAPI';
import invoiceAPI from '../services/invoiceAPI';
import settingsAPI from '../services/settingsAPI';
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

export default function CreateChallan({ triggerAlert, mode }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  // Search parameters for duplication check
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const duplicateId = queryParams.get('duplicate_id');

  // Load state
  const [customers, setCustomers] = useState([]);
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
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [planExpiryDate, setPlanExpiryDate] = useState(null);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { rowIndex: number, field: string }

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
    sgst_percent: '0.00',
    cgst_percent: '0.00',
    is_challan: true
  });

  // Customer fields state
  const [customerForm, setCustomerForm] = useState({
    name: '',
    address: '',
    gst_number: ''
  });

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

  // Initial load
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      try {
        // Load customers dropdown options
        const customersList = await customersAPI.list();
        setCustomers(customersList);

        try {
          const settings = await settingsAPI.get();
          if (settings && settings.plan_expiry_date) {
            setPlanExpiryDate(settings.plan_expiry_date);
          }
        } catch (settingsErr) {
          console.error('Failed to load company settings:', settingsErr);
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
            sgst_percent: '0.00',
            cgst_percent: '0.00',
            is_challan: true
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
        } else if (mode === 'Add' && duplicateId) {
          // Duplication mode (Add from Duplicate ID)
          const invoiceData = await invoiceAPI.get(duplicateId);
          setInvoiceForm({
            customer: invoiceData.customer?.id || '',
            bill_number: '', // Must be filled manually
            bill_date: new Date().toISOString().substr(0, 10), // Defaults to today's date
            challan_no: invoiceData.challan_no || '',
            hsn_code: invoiceData.hsn_code || '',
            broker: invoiceData.broker || '',
            discount_percent: parseFloat(invoiceData.discount_percent).toFixed(2),
            blouse_charge: parseFloat(invoiceData.blouse_charge).toFixed(2),
            sgst_percent: '0.00',
            cgst_percent: '0.00',
            is_challan: true
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
    if (name === 'bill_date' && planExpiryDate && value > planExpiryDate) {
      setShowExpiryModal(true);
      return;
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
    setCustomerForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

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
  const EDITABLE_FIELDS = ['p_ch_no', 'lot_no', 'design', 'meter', 't_qty', 'p_qty', 's_qty', 'qty', 'rate'];

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
    const isEditing = editingCell && editingCell.rowIndex === index && editingCell.field === field;
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
          cursor: 'pointer',
          height: '38px',
          verticalAlign: 'middle',
          position: 'relative', // relative context for overlay positioning
          ...widthStyle
        }}
        onClick={() => !saving && setEditingCell({ rowIndex: index, field })}
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
            backgroundColor: 'transparent',
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
    const subtotal = gross_amount - discount_amount + blouseCharge;

    const sgstPercent = 0;
    const sgst_amount = 0;
    const cgstPercent = 0;
    const cgst_amount = 0;

    const exactTotal = subtotal;
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
  }, [items]);

  const handleClosePreview = () => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setPreviewInvoiceId(null);
    navigate('/invoice-history');
  };

  // Fetch PDF as blob when previewInvoiceId changes (fixes Electron app:// protocol PDF rendering)
  useEffect(() => {
    if (!previewInvoiceId) {
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    invoiceAPI.getPdfBlob(previewInvoiceId)
      .then(blob => {
        if (!cancelled) {
          const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
          setPreviewBlobUrl(url);
        }
      })
      .catch(err => {
        console.error('Failed to load PDF preview:', err);
        if (!cancelled) {
          setPreviewInvoiceId(null);
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => { cancelled = true; };
  }, [previewInvoiceId]);

  // Form submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (planExpiryDate && invoiceForm.bill_date > planExpiryDate) {
      setShowExpiryModal(true);
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
    const payload = {
      ...invoiceForm,
      customer: invoiceForm.customer || null,
      customer_name: customerForm.name || '',
      customer_address: customerForm.address || '',
      customer_gst_number: customerForm.gst_number || '',
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
        triggerAlert(`Delivery Challan ${response.bill_number} updated successfully.`, 'success');
      } else {
        response = await invoiceAPI.add(payload);
        triggerAlert(`Delivery Challan ${response.bill_number} created successfully.`, 'success');
      }
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
            {mode === 'Edit' ? 'Edit Delivery Challan' : 'Create Delivery Challan'}
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
                    }}
                    onFocus={() => setDropdownOpen(true)}
                    required={!invoiceForm.customer}
                    disabled={saving || (!!invoiceForm.customer && !isEditingCustomer)}
                    autoComplete="off"
                  />
                  {invoiceForm.customer && (
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={() => {
                        handleCustomerSelectionChange("");
                      }}
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
                    disabled={saving || (!!invoiceForm.customer && !isEditingCustomer)}
                  />
                  {invoiceForm.customer ? (
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
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm text-truncate"
                      onClick={handleSaveCustomer}
                      disabled={saving || savingCustomer}
                      title="Save Customer"
                      style={{ maxWidth: '120px' }}
                    >
                      {savingCustomer ? (
                        <>...</>
                      ) : (
                        <>
                          <i className="bi bi-person-plus-fill me-1"></i> Save
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Bill Number */}
              <div className="col-lg-2 col-md-6 col-6">
                <label className="form-label text-uppercase fw-bold invoice-form-label">Challan Number</label>
                <input
                  type="text"
                  name="bill_number"
                  className="form-control"
                  value={invoiceForm.bill_number}
                  onChange={handleFormChange}
                  disabled={saving}
                />
              </div>

              {/* Bill Date */}
              <div className="col-lg-2 col-md-6 col-6">
                <label className="form-label text-uppercase fw-bold invoice-form-label">Challan Date</label>
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
                  disabled={saving || (!!invoiceForm.customer && !isEditingCustomer)}
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
                  disabled={saving}
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
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          <div className="table-responsive mb-0 rounded-3 border">
            <table className="table table-bordered table-sm align-middle invoice-table mb-0">
              <thead className="table-dark text-center small text-uppercase">
                <tr>
                  <th className="col-nowrap" style={{ width: '40px' }}>No</th>
                  <th className="col-wrap-text" style={{ minWidth: '90px' }}>P.Ch.No</th>
                  <th className="col-wrap-text" style={{ minWidth: '90px' }}>Lot No</th>
                  <th className="col-wrap-text" style={{ minWidth: '150px' }}>Design</th>
                  <th className="col-nowrap" style={{ minWidth: '80px' }}>Meter</th>
                  <th className="col-nowrap" style={{ minWidth: '70px' }}>T.Qty</th>
                  <th className="col-nowrap" style={{ minWidth: '70px' }}>P.Qty</th>
                  <th className="col-nowrap" style={{ minWidth: '70px' }}>S.Qty</th>
                  <th className="col-nowrap" style={{ minWidth: '80px' }}>Qty</th>
                  <th className="col-nowrap" style={{ minWidth: '90px' }}>Rate</th>
                  <th className="col-nowrap" style={{ minWidth: '120px' }}>Amount</th>
                  <th className="col-nowrap" style={{ width: '50px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const calculatedAmount = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
                  return (
                    <tr key={index}>
                      <td className="text-center align-middle row-number col-nowrap">{index + 1}</td>
                      {renderEditableCell(index, 'p_ch_no', 'text', 'item-pch col-wrap-text')}
                      {renderEditableCell(index, 'lot_no', 'text', 'item-lot col-wrap-text')}
                      {renderEditableCell(index, 'design', 'text', 'item-design col-wrap-text')}
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
                          onClick={() => setRowToDelete(index)}
                          className="btn btn-outline-danger btn-sm border-0 remove-row-btn"
                          disabled={saving || items.length === 1}
                        >
                          <i className="bi bi-trash3-fill"></i>
                          <span className="btn-text">Delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {/* Row Type Add Button inside Table */}
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

          <div className="card p-3 border bg-light-subtle mt-2 mb-4">
            <div className="row g-3">
              {/* Left side: Amount in Words */}
              <div className="col-lg-6 col-md-12 col-12">
                <label className="form-label fw-bold invoice-form-label mb-1">Amount In Words</label>
                <textarea
                  className="form-control form-control-sm bg-light text-muted"
                  value={calculations.summary.amount_in_words}
                  readOnly
                  disabled
                  rows="2"
                  style={{ resize: 'none', height: '62px' }}
                />
              </div>

              {/* Right side: Round off & Grand Amount */}
              <div className="col-lg-6 col-md-12 col-12 d-flex align-items-center">
                <div className="row g-2 w-100">
                  <div className="col-6">
                    <label className="form-label fw-bold invoice-form-label mb-1">Round Off (<Rupee />)</label>
                    <input
                      type="text"
                      className="form-control form-control-sm bg-light text-muted text-end"
                      value={formatAmount(calculations.summary.round_off)}
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label text-success mb-1 fw-bold" style={{ fontSize: '16.5px' }}>Grand Amount (<Rupee />)</label>
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

            {/* Actions (centered at the bottom) */}
            <div className="d-flex justify-content-center gap-2 mt-4">
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
                    <i className="bi bi-check-circle me-1"></i> Save Delivery Challan
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

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

      {/* Modal overlay popup for Live PDF Invoice Preview */}
      {previewInvoiceId && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-xl modal-dialog-centered" style={{ maxWidth: '90%', height: '90vh' }}>
            <div className="modal-content h-100 border-0 shadow-lg d-flex flex-column">
              <div className="modal-header bg-dark text-white border-0 py-2">
                <h5 className="modal-title fw-bold d-flex align-items-center small text-uppercase font-monospace">
                  <i className="bi bi-file-earmark-pdf-fill me-2 text-danger"></i> Delivery Challan PDF Live Preview
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
              <div className="modal-footer border-0 py-2">
                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="btn btn-secondary btn-sm px-4"
                >
                  Close & Go to History
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
