import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  ChevronDown, 
  X 
} from 'lucide-react';
import { DateRange } from '../../types';
import { 
  getPresetOptions, 
  getCalendarMonthMatrix, 
  MONTH_NAMES_SHORT_PT, 
  WEEKDAYS_SHORT_PT,
  formatDateBR,
  startOfDay,
  endOfDay
} from '../../lib/dateUtils';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  align?: 'left' | 'right' | 'auto';
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange, align = 'auto' }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [computedAlign, setComputedAlign] = useState<'left' | 'right'>(align === 'right' ? 'right' : 'left');

  useEffect(() => {
    if (isOpen) {
      if (align === 'right') {
        setComputedAlign('right');
      } else if (align === 'left') {
        setComputedAlign('left');
      } else if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.left + 740 > window.innerWidth) {
          setComputedAlign('right');
        } else {
          setComputedAlign('left');
        }
      }
    }
  }, [isOpen, align]);

  // Presets always computed from the real current clock time
  const presets = useMemo(() => getPresetOptions(new Date()), []);

  // Temporary selection state while picker is open
  const [tempStart, setTempStart] = useState<Date>(value.startDate);
  const [tempEnd, setTempEnd] = useState<Date>(value.endDate);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [isSelectingRange, setIsSelectingRange] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<string | null>(value.presetKey || null);
  const [timeStart, setTimeStart] = useState<string>('00:00');
  const [timeEnd, setTimeEnd] = useState<string>('23:59');

  // Month navigation: Left calendar & Right calendar
  const [leftMonthDate, setLeftMonthDate] = useState<Date>(() => {
    return new Date(value.startDate.getFullYear(), value.startDate.getMonth(), 1);
  });
  const [rightMonthDate, setRightMonthDate] = useState<Date>(() => {
    return new Date(value.startDate.getFullYear(), value.startDate.getMonth() + 1, 1);
  });

  // Keep temporary selection in sync when value changes from outside
  useEffect(() => {
    setTempStart(value.startDate);
    setTempEnd(value.endDate);
    setActivePreset(value.presetKey || null);
    setLeftMonthDate(new Date(value.startDate.getFullYear(), value.startDate.getMonth(), 1));
    if (value.startDate.getMonth() === value.endDate.getMonth() && value.startDate.getFullYear() === value.endDate.getFullYear()) {
      setRightMonthDate(new Date(value.startDate.getFullYear(), value.startDate.getMonth() + 1, 1));
    } else {
      setRightMonthDate(new Date(value.endDate.getFullYear(), value.endDate.getMonth(), 1));
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsSelectingRange(false);
        setHoverDate(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle Preset Click
  const handleSelectPreset = (presetKey: string) => {
    const p = presets.find((item) => item.key === presetKey);
    if (!p) return;
    const { startDate, endDate } = p.getRange(new Date());
    setTempStart(startDate);
    setTempEnd(endDate);
    setTimeStart('00:00');
    setTimeEnd('23:59');
    setActivePreset(presetKey);
    setIsSelectingRange(false);
    setHoverDate(null);

    // Auto align calendars to show the selected range
    setLeftMonthDate(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      setRightMonthDate(new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1));
    } else {
      setRightMonthDate(new Date(endDate.getFullYear(), endDate.getMonth(), 1));
    }
  };

  // Handle Calendar Day Click
  const handleDayClick = (dayDate: Date) => {
    setActivePreset(null);

    if (!isSelectingRange) {
      // First click: start of range
      const newStart = startOfDay(dayDate);
      // Parse timeStart
      const [h, m] = timeStart.split(':').map(Number);
      newStart.setHours(h || 0, m || 0, 0, 0);

      setTempStart(newStart);
      setTempEnd(endOfDay(dayDate));
      setIsSelectingRange(true);
      setHoverDate(null);
    } else {
      // Second click: end of range
      let finalStart = tempStart;
      let finalEnd = endOfDay(dayDate);
      const [h, m] = timeEnd.split(':').map(Number);
      finalEnd.setHours(h || 23, m || 59, 59, 999);

      if (finalEnd.getTime() < finalStart.getTime()) {
        // Swap if clicked backwards
        const temp = finalStart;
        finalStart = startOfDay(dayDate);
        finalEnd = endOfDay(temp);
      }

      setTempStart(finalStart);
      setTempEnd(finalEnd);
      setIsSelectingRange(false);
      setHoverDate(null);
    }
  };

  // Month navigation helpers
  const handlePrevLeftMonth = () => {
    setLeftMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextLeftMonth = () => {
    setLeftMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const handlePrevRightMonth = () => {
    setRightMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextRightMonth = () => {
    setRightMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Check day state
  const isStartDay = (d: Date) => {
    return (
      d.getDate() === tempStart.getDate() &&
      d.getMonth() === tempStart.getMonth() &&
      d.getFullYear() === tempStart.getFullYear()
    );
  };

  const isEndDay = (d: Date) => {
    const end = isSelectingRange && hoverDate ? hoverDate : tempEnd;
    return (
      d.getDate() === end.getDate() &&
      d.getMonth() === end.getMonth() &&
      d.getFullYear() === end.getFullYear()
    );
  };

  const isInRange = (d: Date) => {
    const startTime = startOfDay(tempStart).getTime();
    const effectiveEnd = isSelectingRange && hoverDate 
      ? (hoverDate.getTime() >= startTime ? endOfDay(hoverDate).getTime() : startTime)
      : endOfDay(tempEnd).getTime();

    const effectiveStart = isSelectingRange && hoverDate && hoverDate.getTime() < startTime
      ? startOfDay(hoverDate).getTime()
      : startTime;

    const current = d.getTime();
    return current >= effectiveStart && current <= effectiveEnd;
  };

  // Confirm and Apply
  const handleConfirm = () => {
    let finalStart = new Date(tempStart);
    let finalEnd = new Date(tempEnd);

    // Apply custom times
    const [sh, sm] = timeStart.split(':').map(Number);
    finalStart.setHours(sh || 0, sm || 0, 0, 0);

    const [eh, em] = timeEnd.split(':').map(Number);
    finalEnd.setHours(eh || 23, em || 59, 59, 999);

    if (finalEnd.getTime() < finalStart.getTime()) {
      const t = finalStart;
      finalStart = finalEnd;
      finalEnd = t;
    }

    // Determine label
    let label = `${formatDateBR(finalStart)} ~ ${formatDateBR(finalEnd)}`;
    if (activePreset) {
      const p = presets.find((x) => x.key === activePreset);
      if (p) label = p.label;
    } else if (
      finalStart.getDate() === finalEnd.getDate() &&
      finalStart.getMonth() === finalEnd.getMonth() &&
      finalStart.getFullYear() === finalEnd.getFullYear()
    ) {
      label = formatDateBR(finalStart);
    }

    onChange({
      startDate: finalStart,
      endDate: finalEnd,
      label,
      presetKey: activePreset || undefined
    });

    setIsOpen(false);
    setIsSelectingRange(false);
    setHoverDate(null);
  };

  // Matrices for left and right calendars
  const leftDays = getCalendarMonthMatrix(leftMonthDate.getFullYear(), leftMonthDate.getMonth());
  const rightDays = getCalendarMonthMatrix(rightMonthDate.getFullYear(), rightMonthDate.getMonth());

  // Formatted preview string in header
  const rangeDisplayString = `${formatDateBR(tempStart)} ${timeStart} ~ ${formatDateBR(tempEnd)} ${timeEnd}`;

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger Button in Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-secondary"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '7px 14px',
          fontSize: '0.85rem',
          fontWeight: 500,
          backgroundColor: isOpen ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
          borderColor: isOpen ? '#3B82F6' : 'var(--border-color)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          borderRadius: '8px',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
        }}
      >
        <CalendarIcon size={16} color="#3B82F6" />
        <span style={{ fontWeight: 600 }}>{value.label || `${formatDateBR(value.startDate)} ~ ${formatDateBR(value.endDate)}`}</span>
        <ChevronDown size={15} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {/* Floating Popover Picker Modal */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: computedAlign === 'left' ? 0 : 'auto',
            right: computedAlign === 'right' ? 0 : 'auto',
            zIndex: 1000,
            backgroundColor: '#0F172A',
            border: '1px solid #334155',
            borderRadius: '12px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'row',
            overflow: 'hidden',
            width: '740px',
            maxWidth: '96vw',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          {/* Left Column: Preset Shortcuts */}
          <div
            style={{
              width: '160px',
              flexShrink: 0,
              backgroundColor: '#090D16',
              borderRight: '1px solid #1E293B',
              padding: '12px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              overflowY: 'auto',
              maxHeight: '440px'
            }}
          >
            {presets.map((p) => {
              const isActive = activePreset === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handleSelectPreset(p.key)}
                  style={{
                    background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: 'none',
                    color: isActive ? '#60A5FA' : '#94A3B8',
                    padding: '8px 12px',
                    textAlign: 'left',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = '#38BDF8';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.color = '#94A3B8';
                  }}
                >
                  <span>{p.label}</span>
                  {isActive && <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#60A5FA' }} />}
                </button>
              );
            })}
          </div>

          {/* Right Section: Header Display, Dual Calendars, and Footer */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Top Bar: Date Range String Display */}
            <div
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid #1E293B',
                fontSize: '0.88rem',
                fontWeight: 600,
                color: '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#0F172A'
              }}
            >
              <span>{rangeDisplayString}</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Calendars Container (2 months side-by-side) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                padding: '16px 20px',
                backgroundColor: '#0F172A'
              }}
            >
              {/* Left Calendar */}
              <div>
                {/* Month header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <button
                    type="button"
                    onClick={handlePrevLeftMonth}
                    style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
                    title="Mês anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#E2E8F0', textTransform: 'capitalize' }}>
                    {MONTH_NAMES_SHORT_PT[leftMonthDate.getMonth()]}, {leftMonthDate.getFullYear()}
                  </span>

                  <button
                    type="button"
                    onClick={handleNextLeftMonth}
                    style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
                    title="Próximo mês"
                  >
                    <ChevronRight size={16} />
                  </button>

                  <input
                    type="text"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
                    style={{
                      width: '54px',
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      borderRadius: '4px',
                      color: '#94A3B8',
                      fontSize: '0.78rem',
                      padding: '2px 4px',
                      textAlign: 'center'
                    }}
                    placeholder="00:00"
                  />
                </div>

                {/* Weekday headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '6px', textAlign: 'center' }}>
                  {WEEKDAYS_SHORT_PT.map((w, i) => (
                    <span key={i} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
                      {w}
                    </span>
                  ))}
                </div>

                {/* Days Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                  {leftDays.map((cell) => {
                    const selectedStart = isStartDay(cell.date);
                    const selectedEnd = isEndDay(cell.date);
                    const selectedMiddle = isInRange(cell.date) && !selectedStart && !selectedEnd;

                    return (
                      <button
                        key={cell.dateKey}
                        type="button"
                        onClick={() => handleDayClick(cell.date)}
                        onMouseEnter={() => isSelectingRange && setHoverDate(cell.date)}
                        style={{
                          height: '32px',
                          border: 'none',
                          borderRadius: selectedStart || selectedEnd ? '6px' : (selectedMiddle ? '0' : '4px'),
                          backgroundColor: selectedStart || selectedEnd 
                            ? '#2563EB' 
                            : (selectedMiddle ? 'rgba(37, 99, 235, 0.2)' : 'transparent'),
                          color: selectedStart || selectedEnd 
                            ? '#FFFFFF' 
                            : (cell.isCurrentMonth ? '#E2E8F0' : '#475569'),
                          fontWeight: selectedStart || selectedEnd ? 700 : (cell.isCurrentMonth ? 500 : 400),
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s'
                        }}
                      >
                        {cell.dayNumber}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Calendar */}
              <div>
                {/* Month header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <button
                    type="button"
                    onClick={handlePrevRightMonth}
                    style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
                    title="Mês anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#E2E8F0', textTransform: 'capitalize' }}>
                    {MONTH_NAMES_SHORT_PT[rightMonthDate.getMonth()]}, {rightMonthDate.getFullYear()}
                  </span>

                  <button
                    type="button"
                    onClick={handleNextRightMonth}
                    style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
                    title="Próximo mês"
                  >
                    <ChevronRight size={16} />
                  </button>

                  <input
                    type="text"
                    value={timeEnd}
                    onChange={(e) => setTimeEnd(e.target.value)}
                    style={{
                      width: '54px',
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      borderRadius: '4px',
                      color: '#94A3B8',
                      fontSize: '0.78rem',
                      padding: '2px 4px',
                      textAlign: 'center'
                    }}
                    placeholder="23:59"
                  />
                </div>

                {/* Weekday headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '6px', textAlign: 'center' }}>
                  {WEEKDAYS_SHORT_PT.map((w, i) => (
                    <span key={i} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
                      {w}
                    </span>
                  ))}
                </div>

                {/* Days Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                  {rightDays.map((cell) => {
                    const selectedStart = isStartDay(cell.date);
                    const selectedEnd = isEndDay(cell.date);
                    const selectedMiddle = isInRange(cell.date) && !selectedStart && !selectedEnd;

                    return (
                      <button
                        key={cell.dateKey}
                        type="button"
                        onClick={() => handleDayClick(cell.date)}
                        onMouseEnter={() => isSelectingRange && setHoverDate(cell.date)}
                        style={{
                          height: '32px',
                          border: 'none',
                          borderRadius: selectedStart || selectedEnd ? '6px' : (selectedMiddle ? '0' : '4px'),
                          backgroundColor: selectedStart || selectedEnd 
                            ? '#2563EB' 
                            : (selectedMiddle ? 'rgba(37, 99, 235, 0.2)' : 'transparent'),
                          color: selectedStart || selectedEnd 
                            ? '#FFFFFF' 
                            : (cell.isCurrentMonth ? '#E2E8F0' : '#475569'),
                          fontWeight: selectedStart || selectedEnd ? 700 : (cell.isCurrentMonth ? 500 : 400),
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s'
                        }}
                      >
                        {cell.dayNumber}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Action Footer */}
            <div
              style={{
                borderTop: '1px solid #1E293B',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                backgroundColor: '#090D16'
              }}
            >
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px 16px', fontSize: '0.82rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                style={{
                  backgroundColor: '#2563EB',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '6px 22px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.4)',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1D4ED8')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2563EB')}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
