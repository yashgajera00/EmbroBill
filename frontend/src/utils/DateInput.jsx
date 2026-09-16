import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * DateInput – A cross-browser date input that always displays DD/MM/YYYY
 * with a built-in calendar dropdown picker that auto-positions on small screens.
 */

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// Convert YYYY-MM-DD → DD/MM/YYYY for display
const toDisplay = (isoStr) => {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoStr;
};

// Convert DD/MM/YYYY → YYYY-MM-DD for internal use
const toISO = (displayStr) => {
  if (!displayStr) return '';
  const parts = displayStr.split('/');
  if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return '';
};

// Validate a complete DD/MM/YYYY string
const isValidDate = (displayStr) => {
  const iso = toISO(displayStr);
  if (!iso) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

/* ─── Inject calendar CSS once ─── */
const injectCalendarStyles = () => {
  const styleId = 'dateinput-calendar-styles';
  if (document.getElementById(styleId)) return;
  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = `
    @keyframes dpFadeIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .dp-calendar-overlay {
      position: fixed;
      z-index: 99999;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.18), 0 2px 10px rgba(0,0,0,0.08);
      border: 1px solid #dee2e6;
      padding: 10px;
      width: 270px;
      box-sizing: border-box;
      user-select: none;
      animation: dpFadeIn 0.15s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .dp-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      gap: 2px;
    }

    .dp-nav-btn {
      background: none;
      border: 1px solid #dee2e6;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #495057;
      transition: all 0.15s;
      flex-shrink: 0;
      padding: 0;
      line-height: 1;
    }
    .dp-nav-btn:hover {
      background: #f0f0f0;
      border-color: #adb5bd;
    }

    .dp-month-year {
      font-weight: 700;
      font-size: 13px;
      color: #212529;
      text-align: center;
      flex: 1;
      white-space: nowrap;
      min-width: 0;
    }

    .dp-day-headers {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      margin-bottom: 2px;
    }
    .dp-day-header-cell {
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      color: #868e96;
      padding: 4px 0;
    }

    .dp-days-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 1px;
    }

    .dp-day-cell {
      text-align: center;
      padding: 0;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.1s;
      color: #212529;
      width: 100%;
    }
    .dp-day-cell:hover:not(.dp-selected):not(:disabled) {
      background: #e9ecef;
    }
    .dp-day-cell.dp-today {
      background: #e7f1ff;
      color: #0d6efd;
      font-weight: 700;
      box-shadow: inset 0 0 0 1.5px #0d6efd;
    }
    .dp-day-cell.dp-selected {
      background: #0d6efd;
      color: #fff !important;
      font-weight: 700;
      box-shadow: none;
    }
    .dp-day-cell:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .dp-day-cell.dp-sunday {
      color: #dc3545;
    }

    .dp-empty-cell {
      height: 32px;
    }

    .dp-today-btn {
      display: block;
      width: 100%;
      margin-top: 6px;
      padding: 5px;
      background: none;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      color: #0d6efd;
      transition: all 0.15s;
      text-align: center;
    }
    .dp-today-btn:hover {
      background: #e7f1ff;
      border-color: #0d6efd;
    }

    .dp-calendar-icon {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      cursor: pointer;
      color: #6c757d;
      font-size: 15px;
      line-height: 1;
      padding: 2px;
      display: flex;
      align-items: center;
    }
    .dp-calendar-icon:hover {
      color: #0d6efd;
    }
    .dp-calendar-icon.dp-disabled {
      cursor: default;
      color: #adb5bd;
    }

    /* Small screens: shrink calendar */
    @media (max-width: 360px) {
      .dp-calendar-overlay {
        width: 240px;
        padding: 8px;
      }
      .dp-day-cell {
        height: 28px;
        font-size: 12px;
      }
      .dp-nav-btn {
        width: 24px;
        height: 24px;
        font-size: 12px;
      }
      .dp-month-year {
        font-size: 12px;
      }
    }
  `;
  document.head.appendChild(styleEl);
};

const DateInput = ({
  value,
  onChange,
  name,
  className = 'form-control',
  disabled = false,
  required = false,
  min,
  max,
  style,
  ...rest
}) => {
  const [display, setDisplay] = useState(() => toDisplay(value));
  const [isFocused, setIsFocused] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calPos, setCalPos] = useState({ top: 0, left: 0 });
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const calRef = useRef(null);

  const getInitialCalDate = useCallback(() => {
    if (value) {
      const [y, m] = value.split('-').map(Number);
      return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, [value]);

  const [calDate, setCalDate] = useState(getInitialCalDate);

  useEffect(() => { injectCalendarStyles(); }, []);

  useEffect(() => {
    if (!isFocused) {
      setDisplay(toDisplay(value));
    }
  }, [value, isFocused]);

  useEffect(() => {
    if (value && !showCalendar) {
      const [y, m] = value.split('-').map(Number);
      setCalDate({ year: y, month: m - 1 });
    }
  }, [value, showCalendar]);

  // Calculate calendar position to stay within viewport
  const updateCalendarPosition = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const calWidth = 270;
    const calHeight = 320; // approximate
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = rect.bottom + 4;
    let left = rect.left;

    // If calendar would overflow right edge, align to right side of input
    if (left + calWidth > vw - 8) {
      left = Math.max(8, rect.right - calWidth);
    }
    // If still overflows right, push to left edge
    if (left + calWidth > vw - 8) {
      left = Math.max(8, vw - calWidth - 8);
    }
    // If calendar would overflow bottom, show above input
    if (top + calHeight > vh - 8) {
      top = Math.max(8, rect.top - calHeight - 4);
    }

    setCalPos({ top, left });
  }, []);

  // Recalculate position when calendar opens or window resizes/scrolls
  useEffect(() => {
    if (showCalendar) {
      updateCalendarPosition();
      const handleReposition = () => updateCalendarPosition();
      window.addEventListener('resize', handleReposition);
      window.addEventListener('scroll', handleReposition, true);
      return () => {
        window.removeEventListener('resize', handleReposition);
        window.removeEventListener('scroll', handleReposition, true);
      };
    }
  }, [showCalendar, updateCalendarPosition]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target) &&
          calRef.current && !calRef.current.contains(e.target)) {
        setShowCalendar(false);
        setIsFocused(false);
        if (display.length > 0 && display.length < 10) {
          setDisplay(toDisplay(value));
        }
      }
    };
    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCalendar, display, value]);

  const handleInputChange = (e) => {
    let raw = e.target.value;
    raw = raw.replace(/[^0-9/]/g, '');
    let digits = raw.replace(/\//g, '');
    if (digits.length > 8) digits = digits.slice(0, 8);

    let formatted = '';
    for (let i = 0; i < digits.length; i++) {
      if (i === 2 || i === 4) formatted += '/';
      formatted += digits[i];
    }

    setDisplay(formatted);

    if (formatted.length === 10 && isValidDate(formatted)) {
      const isoVal = toISO(formatted);
      if (min && isoVal < min) return;
      if (max && isoVal > max) return;
      onChange({ target: { name, value: isoVal } });
      const [y, m] = isoVal.split('-').map(Number);
      setCalDate({ year: y, month: m - 1 });
    } else if (formatted.length === 0) {
      onChange({ target: { name, value: '' } });
    }
  };

  const handleFocus = () => { setIsFocused(true); };

  const handleBlur = (e) => {
    // Don't blur if clicking inside calendar (it's now fixed position, outside wrapper)
    if (calRef.current && calRef.current.contains(e.relatedTarget)) return;
    if (wrapperRef.current && wrapperRef.current.contains(e.relatedTarget)) return;
    setIsFocused(false);
    if (display.length === 10 && isValidDate(display)) {
      const isoVal = toISO(display);
      onChange({ target: { name, value: isoVal } });
    } else if (display.length > 0 && display.length < 10) {
      setDisplay(toDisplay(value));
    }
  };

  const openCalendar = () => {
    if (disabled) return;
    if (value) {
      const [y, m] = value.split('-').map(Number);
      setCalDate({ year: y, month: m - 1 });
    } else {
      const now = new Date();
      setCalDate({ year: now.getFullYear(), month: now.getMonth() });
    }
    setShowCalendar(true);
  };

  const toggleCalendar = () => {
    if (disabled) return;
    if (showCalendar) {
      setShowCalendar(false);
    } else {
      openCalendar();
    }
  };

  const handlePrevMonth = () => {
    setCalDate((prev) => prev.month === 0 ? { year: prev.year - 1, month: 11 } : { ...prev, month: prev.month - 1 });
  };
  const handleNextMonth = () => {
    setCalDate((prev) => prev.month === 11 ? { year: prev.year + 1, month: 0 } : { ...prev, month: prev.month + 1 });
  };
  const handlePrevYear = () => {
    setCalDate((prev) => ({ ...prev, year: prev.year - 1 }));
  };
  const handleNextYear = () => {
    setCalDate((prev) => ({ ...prev, year: prev.year + 1 }));
  };

  const selectDate = (day) => {
    const m = String(calDate.month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const isoVal = `${calDate.year}-${m}-${d}`;
    if (min && isoVal < min) return;
    if (max && isoVal > max) return;
    setDisplay(toDisplay(isoVal));
    onChange({ target: { name, value: isoVal } });
    setShowCalendar(false);
    inputRef.current?.focus();
  };

  const selectToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const isoVal = `${y}-${m}-${d}`;
    setDisplay(toDisplay(isoVal));
    setCalDate({ year: y, month: now.getMonth() });
    onChange({ target: { name, value: isoVal } });
    setShowCalendar(false);
  };

  const renderCalendar = () => {
    const { year, month } = calDate;
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Use short month name if viewport is small
    const isSmall = window.innerWidth < 400;
    const monthLabel = isSmall ? MONTHS_SHORT[month] : MONTHS[month];

    const cells = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="dp-empty-cell" />);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const m = String(month + 1).padStart(2, '0');
      const d = String(day).padStart(2, '0');
      const dayIso = `${year}-${m}-${d}`;
      const isSelected = dayIso === value;
      const isToday = dayIso === todayStr;
      const isDisabledDay = (min && dayIso < min) || (max && dayIso > max);
      const dayOfWeek = (firstDay + day - 1) % 7;
      const isSunday = dayOfWeek === 0;

      let cellClass = 'dp-day-cell';
      if (isSelected) cellClass += ' dp-selected';
      else if (isToday) cellClass += ' dp-today';
      if (isSunday && !isSelected) cellClass += ' dp-sunday';

      cells.push(
        <button
          key={day}
          type="button"
          tabIndex={-1}
          disabled={isDisabledDay}
          className={cellClass}
          onClick={() => selectDate(day)}
          onMouseDown={(e) => e.preventDefault()}
        >
          {day}
        </button>
      );
    }

    return (
      <div
        ref={calRef}
        className="dp-calendar-overlay"
        style={{ top: `${calPos.top}px`, left: `${calPos.left}px` }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="dp-header">
          <button type="button" tabIndex={-1} className="dp-nav-btn"
            onClick={handlePrevYear} onMouseDown={(e) => e.preventDefault()} title="Previous year"
          >«</button>
          <button type="button" tabIndex={-1} className="dp-nav-btn"
            onClick={handlePrevMonth} onMouseDown={(e) => e.preventDefault()} title="Previous month"
          >‹</button>
          <span className="dp-month-year">
            {monthLabel} {year}
          </span>
          <button type="button" tabIndex={-1} className="dp-nav-btn"
            onClick={handleNextMonth} onMouseDown={(e) => e.preventDefault()} title="Next month"
          >›</button>
          <button type="button" tabIndex={-1} className="dp-nav-btn"
            onClick={handleNextYear} onMouseDown={(e) => e.preventDefault()} title="Next year"
          >»</button>
        </div>

        <div className="dp-day-headers">
          {DAYS_SHORT.map((d) => (
            <div key={d} className="dp-day-header-cell">{d}</div>
          ))}
        </div>

        <div className="dp-days-grid">
          {cells}
        </div>

        <button type="button" tabIndex={-1} className="dp-today-btn"
          onClick={selectToday} onMouseDown={(e) => e.preventDefault()}
        >
          Today
        </button>
      </div>
    );
  };

  const hasError = display.length > 0 && display.length < 10;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', ...style }}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        name={name}
        className={className}
        value={display}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={() => { if (!showCalendar && !disabled) openCalendar(); }}
        placeholder="DD/MM/YYYY"
        maxLength={10}
        disabled={disabled}
        required={required}
        autoComplete="off"
        style={{
          paddingRight: '32px',
          fontVariantNumeric: 'tabular-nums',
          ...(hasError ? { borderColor: '#dc3545' } : {}),
        }}
        {...rest}
      />
      <span
        className={`dp-calendar-icon${disabled ? ' dp-disabled' : ''}`}
        onClick={toggleCalendar}
        onMouseDown={(e) => e.preventDefault()}
        title="Open calendar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/>
        </svg>
      </span>

      {showCalendar && !disabled && renderCalendar()}
    </div>
  );
};

export default DateInput;
