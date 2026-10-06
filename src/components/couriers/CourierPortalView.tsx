import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Bike, 
  Lock, 
  Calendar, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowLeft, 
  RefreshCw,
  LogOut,
  MapPin,
  Check,
  X,
  Send,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  User,
  Banknote,
  CreditCard,
  DollarSign,
  Wallet,
  Receipt,
  ArrowRight,
  History
} from 'lucide-react';
import { Courier, Delivery, Order, CourierAdjustment, NeighborhoodRate, DateRange } from '../../types';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { getOperationalDateKey, formatDateBR, getDefaultDateRange, startOfDay, endOfDay } from '../../lib/dateUtils';
import { normalizeNeighborhoodName } from '../../lib/neighborhoodMatcher';
import { DateRangePicker } from '../common/DateRangePicker';

interface SearchableNeighborhoodSelectProps {
  value: string;
  onChange: (neighborhoodName: string, rate?: number) => void;
  availableNeighborhoods: NeighborhoodRate[];
  placeholder?: string;
  required?: boolean;
}

const SearchableNeighborhoodSelect: React.FC<SearchableNeighborhoodSelectProps> = ({
  value,
  onChange,
  availableNeighborhoods,
  placeholder = 'Digite o nome do bairro...',
  required = false
}) => {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  const filteredNeighborhoods = useMemo(() => {
    const term = searchTerm.trim();
    if (!term) {
      return availableNeighborhoods;
    }
    const normalizedTerm = normalizeNeighborhoodName(term);
    return availableNeighborhoods.filter((n) => {
      const normalizedName = normalizeNeighborhoodName(n.name);
      return normalizedName.includes(normalizedTerm);
    });
  }, [searchTerm, availableNeighborhoods]);

  const selectedMatch = useMemo(() => {
    if (!value) return null;
    const norm = normalizeNeighborhoodName(value);
    return availableNeighborhoods.find((n) => normalizeNeighborhoodName(n.name) === norm);
  }, [value, availableNeighborhoods]);

  const handleSelect = (neighborhood: NeighborhoodRate) => {
    setSearchTerm(neighborhood.name);
    onChange(neighborhood.name, neighborhood.total_rate);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setSearchTerm(text);
    setIsOpen(true);

    const norm = normalizeNeighborhoodName(text);
    const matched = availableNeighborhoods.find((n) => normalizeNeighborhoodName(n.name) === norm);
    if (matched) {
      onChange(matched.name, matched.total_rate);
    } else {
      onChange(text, undefined);
    }
  };

  const handleClear = () => {
    setSearchTerm('');
    onChange('', undefined);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Search Input Box */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search
          size={18}
          style={{
            position: 'absolute',
            left: '12px',
            color: isOpen ? '#F43F5E' : '#94A3B8',
            pointerEvents: 'none',
            transition: 'color 0.2s'
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          style={{
            width: '100%',
            padding: '12px 38px 12px 38px',
            backgroundColor: '#0F172A',
            border: isOpen ? '1px solid #F43F5E' : '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '10px',
            color: '#F8FAFC',
            fontSize: '0.95rem',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
            boxShadow: isOpen ? '0 0 0 2px rgba(244, 63, 94, 0.2)' : 'none'
          }}
        />
        {searchTerm ? (
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: '10px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '22px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: 0
            }}
            title="Limpar campo"
          >
            <X size={13} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            style={{
              position: 'absolute',
              right: '10px',
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronDown size={16} />
          </button>
        )}
      </div>

      {/* Matched Badge indicator */}
      {selectedMatch && !isOpen && (
        <div style={{
          marginTop: '6px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '6px',
          padding: '4px 8px',
          fontSize: '0.74rem',
          color: '#34D399'
        }}>
          <Check size={12} />
          <span>Bairro cadastrado: <strong>{selectedMatch.name}</strong> • Taxa padrão: <strong>{formatCurrency(selectedMatch.total_rate)}</strong></span>
        </div>
      )}

      {/* Floating Suggestions List */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          maxHeight: '230px',
          overflowY: 'auto',
          backgroundColor: '#0F172A',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7)',
          zIndex: 999,
          padding: '6px 0'
        }}>
          {filteredNeighborhoods.length > 0 ? (
            <>
              <div style={{
                padding: '4px 12px 6px 12px',
                fontSize: '0.68rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: '#64748B',
                letterSpacing: '0.5px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
              }}>
                {searchTerm.trim() ? `Resultados (${filteredNeighborhoods.length})` : `Bairros cadastrados (${filteredNeighborhoods.length})`}
              </div>
              {filteredNeighborhoods.map((n) => {
                const isSelected = selectedMatch?.id === n.id || n.name.toLowerCase() === searchTerm.trim().toLowerCase();
                return (
                  <div
                    key={n.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(n);
                    }}
                    onClick={() => handleSelect(n)}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(244, 63, 94, 0.15)' : 'transparent',
                      borderLeft: isSelected ? '3px solid #F43F5E' : '3px solid transparent',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <MapPin size={14} style={{ color: isSelected ? '#F43F5E' : '#94A3B8', flexShrink: 0 }} />
                      <span style={{
                        fontSize: '0.88rem',
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? '#F8FAFC' : '#E2E8F0',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {n.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: '#34D399',
                        backgroundColor: 'rgba(52, 211, 153, 0.1)',
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}>
                        {formatCurrency(n.total_rate)}
                      </span>
                      {isSelected && <Check size={14} style={{ color: '#F43F5E' }} />}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div style={{ padding: '14px', textAlign: 'center' }}>
              <p style={{ color: '#94A3B8', fontSize: '0.82rem', margin: '0 0 8px 0' }}>
                Nenhum bairro cadastrado com "{searchTerm}".
              </p>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(searchTerm.trim(), undefined);
                  setIsOpen(false);
                }}
                onClick={() => {
                  onChange(searchTerm.trim(), undefined);
                  setIsOpen(false);
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'rgba(244, 63, 94, 0.15)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  borderRadius: '6px',
                  color: '#FB7185',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Usar "{searchTerm}" mesmo assim (ajuste a taxa abaixo)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  itemName?: string;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  itemName = 'itens'
}) => {
  if (totalItems <= itemsPerPage) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      marginTop: '16px',
      padding: '12px 14px',
      backgroundColor: '#1E293B',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.08)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        fontSize: '0.8rem',
        color: '#94A3B8'
      }}>
        <span>
          Mostrando <strong style={{ color: '#F8FAFC' }}>{startItem}–{endItem}</strong> de <strong style={{ color: '#F8FAFC' }}>{totalItems}</strong> {itemName}
        </span>
        <span style={{ fontWeight: 600, color: '#CBD5E1' }}>
          Página {currentPage} de {totalPages}
        </span>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        flexWrap: 'wrap'
      }}>
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: currentPage === 1 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: currentPage === 1 ? '#64748B' : '#F8FAFC',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
            transition: 'all 0.15s ease'
          }}
        >
          <ChevronLeft size={16} />
          <span>Anterior</span>
        </button>

        {getPageNumbers().map((page, idx) => {
          if (page === '...') {
            return (
              <span key={`dots-${idx}`} style={{ padding: '0 4px', color: '#64748B', fontSize: '0.85rem' }}>
                ...
              </span>
            );
          }
          const pageNum = Number(page);
          const isActive = pageNum === currentPage;
          return (
            <button
              key={pageNum}
              type="button"
              onClick={() => onPageChange(pageNum)}
              style={{
                minWidth: '36px',
                height: '36px',
                padding: '0 8px',
                borderRadius: '8px',
                backgroundColor: isActive ? '#F43F5E' : 'rgba(255, 255, 255, 0.05)',
                border: isActive ? '1px solid #F43F5E' : '1px solid rgba(255, 255, 255, 0.08)',
                color: isActive ? '#FFFFFF' : '#CBD5E1',
                fontSize: '0.82rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: currentPage === totalPages ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: currentPage === totalPages ? '#64748B' : '#F8FAFC',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
            transition: 'all 0.15s ease'
          }}
        >
          <span>Próxima</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

interface CourierPortalViewProps {
  couriers: Courier[];
  deliveries: Delivery[];
  orders?: Order[];
  neighborhoodRates?: NeighborhoodRate[];
  onBackToMain?: () => void;
  onRefreshData?: () => void;
}

export const CourierPortalView: React.FC<CourierPortalViewProps> = ({
  couriers,
  deliveries,
  orders = [],
  neighborhoodRates = [],
  onBackToMain,
  onRefreshData
}) => {
  // Login State
  const [selectedCourierId, setSelectedCourierId] = useState<string>(() => {
    return localStorage.getItem('sushi_portal_courier_id') || '';
  });
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [authenticatedCourier, setAuthenticatedCourier] = useState<Courier | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [rememberLogin, setRememberLogin] = useState<boolean>(true);

  // Operational State
  const [dateRange, setDateRange] = useState<DateRange>(() => getDefaultDateRange());
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [adjustments, setAdjustments] = useState<CourierAdjustment[]>([]);
  const [isLoadingAdjustments, setIsLoadingAdjustments] = useState<boolean>(false);
  const [availableNeighborhoods, setAvailableNeighborhoods] = useState<NeighborhoodRate[]>(neighborhoodRates);

  // Tabs: 'deliveries' (Corridas do Dia) vs 'receivables' (Extrato & Saldo Acumulado)
  const [activePortalTab, setActivePortalTab] = useState<'deliveries' | 'receivables'>('deliveries');
  const [receivablesFilter, setReceivablesFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

  // Pagination State
  const DELIVERIES_PER_PAGE = 10;
  const [deliveriesCurrentPage, setDeliveriesCurrentPage] = useState<number>(1);

  const DAYS_PER_PAGE = 7;
  const [daysCurrentPage, setDaysCurrentPage] = useState<number>(1);

  // Reset pagination when dateRange or filters change
  useEffect(() => {
    setDeliveriesCurrentPage(1);
    setDaysCurrentPage(1);
  }, [dateRange]);

  useEffect(() => {
    setDaysCurrentPage(1);
  }, [receivablesFilter]);

  // Real-time synced internal states (kept 100% updated with restaurant main system)
  const [internalDeliveries, setInternalDeliveries] = useState<Delivery[]>(deliveries || []);
  const [internalCouriers, setInternalCouriers] = useState<Courier[]>(couriers || []);
  const [internalOrders, setInternalOrders] = useState<Order[]>(orders || []);
  const [dailyPayments, setDailyPayments] = useState<any[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(true);

  // Sync props to internal state when parent props change
  useEffect(() => {
    if (deliveries && deliveries.length > 0) setInternalDeliveries(deliveries);
  }, [deliveries]);

  useEffect(() => {
    if (couriers && couriers.length > 0) setInternalCouriers(couriers);
  }, [couriers]);

  useEffect(() => {
    if (orders && orders.length > 0) setInternalOrders(orders);
  }, [orders]);

  useEffect(() => {
    if (neighborhoodRates && neighborhoodRates.length > 0) {
      setAvailableNeighborhoods(neighborhoodRates.filter((n) => n.is_active));
    }
  }, [neighborhoodRates]);

  // Direct fetchers from Supabase
  const fetchDeliveries = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .order('delivery_date', { ascending: false });
      if (!error && data) {
        setInternalDeliveries(data as Delivery[]);
      }
    } catch (e) {
      console.error('Erro ao sincronizar entregas:', e);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('order_date', { ascending: false });
      if (!error && data) {
        setInternalOrders(data as Order[]);
      }
    } catch (e) {
      console.error('Erro ao sincronizar pedidos:', e);
    }
  }, []);

  const fetchCouriers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('couriers')
        .select('*')
        .order('name');
      if (!error && data) {
        setInternalCouriers(data as Courier[]);
        setAuthenticatedCourier((curr) => {
          if (!curr) return null;
          const updated = (data as Courier[]).find((c) => c.id === curr.id);
          return updated || curr;
        });
      }
    } catch (e) {
      console.error('Erro ao sincronizar motoboys:', e);
    }
  }, []);

  const fetchNeighborhoodRates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('neighborhood_rates')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (!error && data) {
        setAvailableNeighborhoods(data as NeighborhoodRate[]);
      }
    } catch (e) {
      console.error('Erro ao sincronizar bairros:', e);
    }
  }, []);

  const fetchAdjustments = useCallback(async () => {
    if (!authenticatedCourier) return;
    setIsLoadingAdjustments(true);
    try {
      const { data, error } = await supabase
        .from('courier_adjustments')
        .select('*')
        .eq('courier_id', authenticatedCourier.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setAdjustments(data as CourierAdjustment[]);
      }
    } catch (err) {
      console.error('Erro ao buscar ajustes:', err);
    } finally {
      setIsLoadingAdjustments(false);
    }
  }, [authenticatedCourier]);

  const fetchDailyPayments = useCallback(async () => {
    if (!authenticatedCourier) return;
    setIsLoadingPayments(true);
    try {
      const { data, error } = await supabase
        .from('courier_daily_payments')
        .select('*')
        .or(`courier_id.eq.${authenticatedCourier.id},courier_name.eq.${authenticatedCourier.name}`);
      if (!error && data) {
        setDailyPayments(data);
      }
    } catch (err) {
      console.error('Falha ao consultar courier_daily_payments:', err);
    } finally {
      setIsLoadingPayments(false);
    }
  }, [authenticatedCourier]);

  // Master Synchronizer across all courier-related tables
  const syncAllData = useCallback(async (silent = true) => {
    if (!silent) setIsSyncing(true);
    try {
      await Promise.all([
        fetchDeliveries(),
        fetchOrders(),
        fetchCouriers(),
        fetchNeighborhoodRates(),
        fetchAdjustments(),
        fetchDailyPayments()
      ]);
    } catch (err) {
      console.error('Erro na sincronização em tempo real:', err);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }, [fetchDeliveries, fetchOrders, fetchCouriers, fetchNeighborhoodRates, fetchAdjustments, fetchDailyPayments]);

  // Realtime Subscriptions & Polling Heartbeat
  useEffect(() => {
    const channel = supabase
      .channel('courier-portal-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => {
        fetchDeliveries();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courier_daily_payments' }, () => {
        fetchDailyPayments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courier_adjustments' }, () => {
        fetchAdjustments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'neighborhood_rates' }, () => {
        fetchNeighborhoodRates();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'couriers' }, () => {
        fetchCouriers();
      })
      .subscribe((status) => {
        setIsLiveConnected(status === 'SUBSCRIBED');
      });

    // Auto-sync a cada 10 segundos para garantir 100% dos dados frescos
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncAllData(true);
      }
    }, 10000);

    // Auto-sync imediato ao focar na janela ou ligar a tela do celular
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncAllData(true);
      }
    };

    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [syncAllData, fetchDeliveries, fetchOrders, fetchDailyPayments, fetchAdjustments, fetchNeighborhoodRates, fetchCouriers]);

  // Initial fetch for fresh data on mount
  useEffect(() => {
    fetchOrders();
    fetchDeliveries();
    fetchCouriers();
    fetchNeighborhoodRates();
  }, [fetchOrders, fetchDeliveries, fetchCouriers, fetchNeighborhoodRates]);

  const ordersMap = useMemo(() => {
    const map = new Map<string, Order>();
    internalOrders.forEach((o) => {
      if (o.external_order_id) {
        map.set(String(o.external_order_id).trim(), o);
        map.set(String(o.external_order_id).trim().toLowerCase(), o);
      }
      if (o.order_number) {
        map.set(String(o.order_number).trim(), o);
        map.set(String(o.order_number).trim().toLowerCase(), o);
      }
      if (o.id) {
        map.set(String(o.id).trim(), o);
      }
    });
    return map;
  }, [internalOrders]);

  const getDeliveryOrder = useCallback((delivery: Delivery): Order | undefined => {
    const extId = delivery.external_order_id ? String(delivery.external_order_id).trim() : '';
    const ordNum = delivery.order_number ? String(delivery.order_number).trim() : '';
    const ordId = delivery.order_id ? String(delivery.order_id).trim() : '';

    return (extId ? ordersMap.get(extId) : undefined) ||
           (ordNum ? ordersMap.get(ordNum) : undefined) ||
           (ordId ? ordersMap.get(ordId) : undefined);
  }, [ordersMap]);

  const getCustomerName = (delivery: Delivery): string => {
    const order = getDeliveryOrder(delivery);
    return order?.customer_name || 'Cliente Balcão / Avulso';
  };

  const getDeliveryPaymentInfo = useCallback((delivery: Delivery) => {
    const order = getDeliveryOrder(delivery);
    
    // Check if there is a pending or approved adjustment with cash
    const adj = adjustments.find(a => a.delivery_id === delivery.id && a.status !== 'rejected');
    if (adj && (adj.received_cash || adj.payment_method === 'Dinheiro')) {
      const parsedAdjCash = Number(adj.received_cash);
      return {
        isCash: true,
        amount: parsedAdjCash > 0 ? parsedAdjCash : Number(delivery.order_amount ?? order?.gross_amount ?? 0),
        methodName: 'Dinheiro (informado)',
        hasAdjustment: true,
        adjStatus: adj.status
      };
    }

    const rawMethod = delivery.payment_method || 
                      order?.final_payment_method || 
                      order?.original_payment_method || 
                      (order as any)?.payment_method ||
                      (order as any)?.original_imported_data?.['Forma de pagamento'] || 
                      '';
    const norm = String(rawMethod).toLowerCase();
    const isCash = norm.includes('dinheiro') || norm === 'cash';
    const amount = Number(delivery.order_amount ?? order?.gross_amount ?? 0);

    return {
      isCash,
      amount: isCash ? amount : 0,
      methodName: rawMethod || 'Não informado',
      hasAdjustment: false,
      adjStatus: null
    };
  }, [adjustments, getDeliveryOrder]);

  // Modals for Courier Actions
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [proposedNeighborhood, setProposedNeighborhood] = useState<string>('');
  const [proposedFee, setProposedFee] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [isCashPayment, setIsCashPayment] = useState<boolean>(false);
  const [cashAmount, setCashAmount] = useState<string>('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  const [showAddDeliveryModal, setShowAddDeliveryModal] = useState<boolean>(false);
  const [newOrderNumber, setNewOrderNumber] = useState<string>('');
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newNeighborhood, setNewNeighborhood] = useState<string>('');
  const [newFee, setNewFee] = useState<string>('8.00');
  const [newIsCash, setNewIsCash] = useState<boolean>(false);
  const [newCashAmount, setNewCashAmount] = useState<string>('');
  const [newNote, setNewNote] = useState<string>('');
  const [isSubmittingNew, setIsSubmittingNew] = useState<boolean>(false);

  const [deletingDelivery, setDeletingDelivery] = useState<Delivery | null>(null);
  const [deleteNote, setDeleteNote] = useState<string>('');
  const [isSubmittingDelete, setIsSubmittingDelete] = useState<boolean>(false);

  // Daily Conference Submission State
  const [showSendConferenceModal, setShowSendConferenceModal] = useState<boolean>(false);
  const [conferenceNote, setConferenceNote] = useState<string>('');
  const [isSubmittingConference, setIsSubmittingConference] = useState<boolean>(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Show Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Check saved login on mount
  useEffect(() => {
    const savedId = localStorage.getItem('sushi_portal_courier_id');
    const savedPin = localStorage.getItem('sushi_portal_courier_pin');
    if (savedId && savedPin) {
      const found = internalCouriers.find((c) => c.id === savedId && c.is_active);
      if (found && (found.pin || '1234') === savedPin) {
        setAuthenticatedCourier(found);
        setSelectedCourierId(savedId);
      }
    }
  }, [internalCouriers]);

  // Handle Login Submission
  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);

    const courier = internalCouriers.find((c) => c.id === selectedCourierId);
    if (!courier) {
      setAuthError('Selecione seu nome na lista.');
      return;
    }

    const expectedPin = courier.pin || '1234';
    if (enteredPin.trim() !== expectedPin.trim()) {
      setAuthError('PIN incorreto. Verifique seu código de 4 dígitos com o restaurante.');
      return;
    }

    setAuthenticatedCourier(courier);
    if (rememberLogin) {
      localStorage.setItem('sushi_portal_courier_id', courier.id);
      localStorage.setItem('sushi_portal_courier_pin', enteredPin.trim());
    }
    setEnteredPin('');
  };

  const handleLogout = () => {
    setAuthenticatedCourier(null);
    localStorage.removeItem('sushi_portal_courier_id');
    localStorage.removeItem('sushi_portal_courier_pin');
    setEnteredPin('');
  };

  useEffect(() => {
    if (authenticatedCourier) {
      fetchAdjustments();
      fetchDailyPayments();
    }
  }, [authenticatedCourier, selectedDate, fetchAdjustments, fetchDailyPayments]);

  // All deliveries belonging to this courier across all time
  const allCourierDeliveries = useMemo(() => {
    if (!authenticatedCourier) return [];
    return internalDeliveries.filter((d) => {
      return (
        (d.courier_id && d.courier_id === authenticatedCourier.id) ||
        (d.courier_name && d.courier_name.trim().toLowerCase() === authenticatedCourier.name.trim().toLowerCase())
      );
    });
  }, [internalDeliveries, authenticatedCourier]);

  // Group all worked days and calculate accumulated receivables, cash and payment status
  const receivablesHistory = useMemo(() => {
    if (!authenticatedCourier) {
      return {
        days: [],
        unpaidDays: [],
        paidDays: [],
        unpaidDaysCount: 0,
        unpaidFeesTotal: 0,
        unpaidCashTotal: 0,
        accumulatedNetBalance: 0,
        paidDaysCount: 0,
        totalPaidAmount: 0
      };
    }

    const dateSet = new Set<string>();
    allCourierDeliveries.forEach(d => {
      const opKey = getOperationalDateKey(d.delivery_date);
      const k = opKey || (d.delivery_date ? d.delivery_date.split('T')[0] : '');
      if (k) dateSet.add(k);
    });

    adjustments.forEach(a => {
      if (a.date) dateSet.add(a.date);
    });

    dailyPayments.forEach(p => {
      if (p.payment_date) dateSet.add(p.payment_date);
    });

    const daysList = Array.from(dateSet).map(dateStr => {
      const dayDels = allCourierDeliveries.filter(d => {
        const opKey = getOperationalDateKey(d.delivery_date);
        return (opKey || d.delivery_date.split('T')[0]) === dateStr;
      });

      const dayAdjs = adjustments.filter(a => a.date === dateStr);

      const removedIds = new Set(
        dayAdjs.filter(a => a.type === 'remove_delivery' && a.status !== 'rejected')
          .map(a => a.delivery_id)
          .filter(Boolean)
      );
      const activeDeliveries = dayDels.filter(d => !removedIds.has(d.id));
      const addedDeliveries = dayAdjs.filter(a => a.type === 'new_delivery' && a.status !== 'rejected');
      const totalDeliveriesCount = activeDeliveries.length + addedDeliveries.length;

      let dayFees = 0;
      activeDeliveries.forEach(d => {
        const editAdj = dayAdjs.find(a => a.type === 'edit_fee' && a.delivery_id === d.id && a.status !== 'rejected');
        dayFees += editAdj ? Number(editAdj.proposed_fee) : Number(d.courier_fee || 0);
      });
      addedDeliveries.forEach(a => {
        dayFees += Number(a.proposed_fee || 0);
      });

      let dayCash = 0;
      activeDeliveries.forEach(d => {
        const cashAdj = dayAdjs.find(a => a.delivery_id === d.id && a.status !== 'rejected' && a.received_cash);
        if (cashAdj) {
          dayCash += Number(cashAdj.received_cash);
        } else {
          const pInfo = getDeliveryPaymentInfo(d);
          if (pInfo.isCash) {
            dayCash += pInfo.amount;
          }
        }
      });
      addedDeliveries.forEach(a => {
        if (a.received_cash) dayCash += Number(a.received_cash);
      });

      // Daily conference reported cash if any
      const confAdj = dayAdjs.find(a => a.type === 'daily_conference');
      if (confAdj?.received_cash && Number(confAdj.received_cash) > dayCash) {
        dayCash = Number(confAdj.received_cash);
      }

      // Check payment record from restaurant
      const payRecord = dailyPayments.find(p => p.payment_date === dateStr && p.is_paid === true);
      const allDelsPaid = activeDeliveries.length > 0 && activeDeliveries.every(d => d.is_paid);
      const isPaid = Boolean(payRecord) || allDelsPaid;

      if (payRecord?.retained_cash !== undefined && payRecord?.retained_cash !== null && Number(payRecord.retained_cash) > 0) {
        dayCash = Number(payRecord.retained_cash);
      }

      const netAmount = dayFees - dayCash;

      return {
        date: dateStr,
        deliveriesCount: totalDeliveriesCount,
        totalFees: dayFees,
        retainedCash: dayCash,
        netAmount,
        isPaid,
        payRecord,
        adjustmentsCount: dayAdjs.length
      };
    })
    .filter(d => d.deliveriesCount > 0 || d.totalFees > 0 || d.retainedCash > 0 || d.isPaid)
    .sort((a, b) => b.date.localeCompare(a.date));

    const startTime = startOfDay(dateRange.startDate).getTime();
    const endTime = endOfDay(dateRange.endDate).getTime();

    // Days filtered strictly by the selected dateRange
    const filteredDays = daysList.filter(d => {
      const dTime = new Date(`${d.date}T12:00:00`).getTime();
      return dTime >= startTime && dTime <= endTime;
    });

    const unpaidDays = filteredDays.filter(d => !d.isPaid);
    const paidDays = filteredDays.filter(d => d.isPaid);

    const unpaidFeesTotal = unpaidDays.reduce((sum, d) => sum + d.totalFees, 0);
    const unpaidCashTotal = unpaidDays.reduce((sum, d) => sum + d.retainedCash, 0);
    const accumulatedNetBalance = unpaidFeesTotal - unpaidCashTotal;

    const totalPaidAmount = paidDays.reduce((sum, d) => {
      if (d.payRecord) {
        return sum + Number(d.payRecord.paid_amount || d.payRecord.total_paid || d.netAmount);
      }
      return sum + d.netAmount;
    }, 0);

    // Totals for all days in selected period
    const periodTotalFees = filteredDays.reduce((sum, d) => sum + d.totalFees, 0);
    const periodTotalCash = filteredDays.reduce((sum, d) => sum + d.retainedCash, 0);
    const periodNetBalance = periodTotalFees - periodTotalCash;

    // All-time unpaid count and balance for global context
    const allTimeUnpaidDays = daysList.filter(d => !d.isPaid);
    const allTimeUnpaidBalance = allTimeUnpaidDays.reduce((sum, d) => sum + d.netAmount, 0);

    return {
      days: filteredDays,
      allDays: daysList,
      unpaidDays,
      paidDays,
      unpaidDaysCount: unpaidDays.length,
      unpaidFeesTotal,
      unpaidCashTotal,
      accumulatedNetBalance,
      paidDaysCount: paidDays.length,
      totalPaidAmount,
      periodTotalFees,
      periodTotalCash,
      periodNetBalance,
      allTimeUnpaidCount: allTimeUnpaidDays.length,
      allTimeUnpaidBalance
    };
  }, [allCourierDeliveries, adjustments, dailyPayments, authenticatedCourier, getDeliveryPaymentInfo, dateRange]);

  // Filter deliveries belonging strictly to this courier within the selected dateRange
  const courierDeliveries = useMemo(() => {
    if (!authenticatedCourier) return [];

    const startTime = startOfDay(dateRange.startDate).getTime();
    const endTime = endOfDay(dateRange.endDate).getTime();

    return internalDeliveries.filter((d) => {
      // Must match courier by id or name
      const matchesCourier = 
        (d.courier_id && d.courier_id === authenticatedCourier.id) ||
        (d.courier_name && d.courier_name.trim().toLowerCase() === authenticatedCourier.name.trim().toLowerCase());

      if (!matchesCourier) return false;
      if (!d.delivery_date) return false;

      // Check date within range
      const opKey = getOperationalDateKey(d.delivery_date);
      const dateToCheck = opKey ? `${opKey}T12:00:00` : d.delivery_date;
      const dTime = new Date(dateToCheck).getTime();
      return dTime >= startTime && dTime <= endTime;
    });
  }, [internalDeliveries, authenticatedCourier, dateRange]);

  // Pending adjustments for the selected dateRange
  const dayAdjustments = useMemo(() => {
    const startTime = startOfDay(dateRange.startDate).getTime();
    const endTime = endOfDay(dateRange.endDate).getTime();

    return adjustments.filter((a) => {
      if (!a.date) return false;
      const aTime = new Date(`${a.date}T12:00:00`).getTime();
      return aTime >= startTime && aTime <= endTime;
    });
  }, [adjustments, dateRange]);

  // Deliveries Pagination Calculations
  const deliveriesTotalPages = Math.max(1, Math.ceil(courierDeliveries.length / DELIVERIES_PER_PAGE));
  const safeDeliveriesCurrentPage = Math.min(deliveriesCurrentPage, deliveriesTotalPages);
  const paginatedDeliveries = useMemo(() => {
    const start = (safeDeliveriesCurrentPage - 1) * DELIVERIES_PER_PAGE;
    return courierDeliveries.slice(start, start + DELIVERIES_PER_PAGE);
  }, [courierDeliveries, safeDeliveriesCurrentPage]);

  const isDaniel = authenticatedCourier?.name.toLowerCase().includes('daniel') || false;

  // Deliveries total fee calculation, cash retention and daily net settlement
  const stats = useMemo(() => {
    const totalCount = courierDeliveries.length;
    const totalFee = courierDeliveries.reduce((sum, d) => sum + Number(d.courier_fee || 0), 0);
    const pendingCount = dayAdjustments.filter((a) => a.status === 'pending').length;

    let totalCashCollected = 0;
    courierDeliveries.forEach((d) => {
      const pInfo = getDeliveryPaymentInfo(d);
      if (pInfo.isCash) {
        totalCashCollected += pInfo.amount;
      }
    });

    // Also include new_delivery adjustments with reported cash
    dayAdjustments.forEach((adj) => {
      if (adj.type === 'new_delivery' && adj.status !== 'rejected' && adj.received_cash) {
        totalCashCollected += Number(adj.received_cash);
      }
    });

    const netBalance = totalFee - totalCashCollected;

    return { 
      totalCount, 
      totalFee, 
      pendingCount, 
      totalCashCollected, 
      netBalance 
    };
  }, [courierDeliveries, dayAdjustments, internalOrders, adjustments]);

  const dailyConferenceRecord = useMemo(() => {
    return dayAdjustments.find((a) => a.type === 'daily_conference');
  }, [dayAdjustments]);

  // Open Edit Modal with optional cash highlight
  const handleOpenEdit = (delivery: Delivery, forceCash = false) => {
    setEditingDelivery(delivery);
    setProposedNeighborhood(delivery.neighborhood_name || '');
    setProposedFee(String(delivery.courier_fee || 8.00));
    setEditNote('');

    const pInfo = getDeliveryPaymentInfo(delivery);
    const order = ordersMap.get(delivery.external_order_id) || (delivery.order_number ? ordersMap.get(delivery.order_number) : undefined);
    const defAmount = delivery.order_amount || order?.gross_amount || 0;

    setIsCashPayment(forceCash ? true : pInfo.isCash);
    setCashAmount(pInfo.isCash && pInfo.amount > 0 ? String(pInfo.amount) : (defAmount > 0 ? String(defAmount) : ''));
  };

  // Submit Rate / Payment Edit
  const handleSubmitEditFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDelivery || !authenticatedCourier) return;

    const proposed = parseFloat(proposedFee.replace(',', '.'));
    if (isNaN(proposed) || proposed < 0) {
      alert('Por favor, informe um valor de taxa válido.');
      return;
    }

    const finalNeighborhood = (proposedNeighborhood || editingDelivery.neighborhood_name || '').trim();
    const finalCustName = getCustomerName(editingDelivery);
    const parsedCash = isCashPayment ? parseFloat(cashAmount.replace(',', '.')) : null;

    setIsSubmittingEdit(true);
    try {
      const { error } = await supabase.from('courier_adjustments').insert({
        courier_id: authenticatedCourier.id,
        courier_name: authenticatedCourier.name,
        date: selectedDate,
        type: 'edit_fee',
        delivery_id: editingDelivery.id,
        order_number: editingDelivery.order_number || editingDelivery.external_order_id,
        customer_name: finalCustName,
        received_cash: parsedCash && !isNaN(parsedCash) ? parsedCash : null,
        payment_method: isCashPayment ? 'Dinheiro' : null,
        neighborhood_name: finalNeighborhood || 'Bairro não especificado',
        original_neighborhood: editingDelivery.neighborhood_name || '',
        proposed_neighborhood: finalNeighborhood,
        original_fee: Number(editingDelivery.courier_fee || 0),
        proposed_fee: proposed,
        notes: editNote.trim() || (isCashPayment ? `Informado pagamento em dinheiro: R$ ${parsedCash || 0}` : (finalNeighborhood !== editingDelivery.neighborhood_name ? `Bairro alterado para ${finalNeighborhood}` : 'Ajuste de taxa solicitado pelo motoboy')),
        status: 'pending'
      });

      if (error) throw error;

      showToast('Solicitação de ajuste enviada! Aguardando conferência do restaurante.');
      setEditingDelivery(null);
      setProposedNeighborhood('');
      setProposedFee('');
      setEditNote('');
      setIsCashPayment(false);
      setCashAmount('');
      fetchAdjustments();
    } catch (err: any) {
      alert('Erro ao enviar solicitação: ' + err.message);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Submit New Missing Delivery
  const handleSubmitNewDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authenticatedCourier) return;

    const fee = parseFloat(newFee.replace(',', '.'));
    if (isNaN(fee) || fee <= 0) {
      alert('Por favor, informe um valor de taxa válido.');
      return;
    }

    const parsedCash = newIsCash ? parseFloat(newCashAmount.replace(',', '.')) : null;

    setIsSubmittingNew(true);
    try {
      const { error } = await supabase.from('courier_adjustments').insert({
        courier_id: authenticatedCourier.id,
        courier_name: authenticatedCourier.name,
        date: selectedDate,
        type: 'new_delivery',
        delivery_id: null,
        order_number: newOrderNumber.trim() || 'AVULSO',
        customer_name: newCustomerName.trim() || null,
        received_cash: parsedCash && !isNaN(parsedCash) ? parsedCash : null,
        payment_method: newIsCash ? 'Dinheiro' : null,
        neighborhood_name: newNeighborhood.trim() || 'Bairro a confirmar',
        original_fee: 0,
        proposed_fee: fee,
        notes: newNote.trim() || (newIsCash ? `Corrida avulsa com dinheiro recebido: R$ ${parsedCash || 0}` : 'Corrida faltante adicionada pelo motoboy'),
        status: 'pending'
      });

      if (error) throw error;

      showToast('Corrida faltante enviada! Aguardando confirmação do restaurante.');
      setShowAddDeliveryModal(false);
      setNewOrderNumber('');
      setNewCustomerName('');
      setNewNeighborhood('');
      setNewFee('8.00');
      setNewIsCash(false);
      setNewCashAmount('');
      setNewNote('');
      fetchAdjustments();
    } catch (err: any) {
      alert('Erro ao enviar corrida: ' + err.message);
    } finally {
      setIsSubmittingNew(false);
    }
  };

  // Submit Delivery Removal Request
  const handleSubmitDeleteRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingDelivery || !authenticatedCourier) return;

    setIsSubmittingDelete(true);
    try {
      const { error } = await supabase.from('courier_adjustments').insert({
        courier_id: authenticatedCourier.id,
        courier_name: authenticatedCourier.name,
        date: selectedDate,
        type: 'remove_delivery',
        delivery_id: deletingDelivery.id,
        order_number: deletingDelivery.order_number || deletingDelivery.external_order_id,
        neighborhood_name: deletingDelivery.neighborhood_name || '',
        original_fee: Number(deletingDelivery.courier_fee || 0),
        proposed_fee: 0,
        notes: deleteNote.trim() || 'Motoboy informou que não realizou esta corrida',
        status: 'pending'
      });

      if (error) throw error;

      showToast('Solicitação de remoção enviada para conferência do restaurante.');
      setDeletingDelivery(null);
      setDeleteNote('');
      fetchAdjustments();
    } catch (err: any) {
      alert('Erro ao enviar solicitação: ' + err.message);
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Submit Full Day Conference to Restaurant
  const handleSendDailyConference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authenticatedCourier) return;

    setIsSubmittingConference(true);
    try {
      const existing = dayAdjustments.find(a => a.type === 'daily_conference');
      const summaryText = conferenceNote.trim()
        ? conferenceNote.trim()
        : `Fechamento do turno: ${stats.totalCount} entregas, R$ ${stats.totalFee.toFixed(2)} em taxas, R$ ${stats.totalCashCollected.toFixed(2)} em dinheiro retido.`;

      const { error } = await supabase.from('courier_adjustments').upsert({
        ...(existing ? { id: existing.id } : {}),
        courier_id: authenticatedCourier.id,
        courier_name: authenticatedCourier.name,
        date: selectedDate,
        type: 'daily_conference',
        original_fee: stats.totalFee,
        proposed_fee: stats.totalFee,
        received_cash: stats.totalCashCollected,
        notes: summaryText,
        status: 'pending',
        created_at: new Date().toISOString()
      }, { onConflict: 'id' });

      if (error) throw error;

      showToast('Conferência do dia enviada com sucesso! O restaurante recebeu seu fechamento completo.');
      setShowSendConferenceModal(false);
      setConferenceNote('');
      fetchAdjustments();
    } catch (err: any) {
      alert('Erro ao enviar conferência: ' + err.message);
    } finally {
      setIsSubmittingConference(false);
    }
  };

  // -------------------------------------------------------------
  // SCREEN 1: LOGIN / PIN AUTHENTICATION
  // -------------------------------------------------------------
  if (!authenticatedCourier) {
    const activeCouriers = internalCouriers.filter((c) => c.is_active);

    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0B0F19',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{
          maxWidth: '420px',
          width: '100%',
          backgroundColor: '#111827',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '32px 24px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          position: 'relative'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(244, 63, 94, 0.15)',
              color: '#F43F5E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              border: '2px solid rgba(244, 63, 94, 0.3)'
            }}>
              <Bike size={32} />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F8FAFC', margin: '0 0 6px 0' }}>
              Portal do Entregador
            </h1>
            <p style={{ color: '#94A3B8', fontSize: '0.85rem', margin: 0 }}>
              Consulte suas corridas, taxas e envie correções para conferência
            </p>
          </div>

          {authError && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#FB7185',
              fontSize: '0.85rem'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            {/* Courier Selection */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '8px' }}>
                Quem é você?
              </label>
              <select
                value={selectedCourierId}
                onChange={(e) => {
                  setSelectedCourierId(e.target.value);
                  setAuthError(null);
                }}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  backgroundColor: '#1E293B',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  color: '#F8FAFC',
                  fontSize: '1rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
                required
              >
                <option value="">Selecione seu nome...</option>
                {activeCouriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4-Digit PIN */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#CBD5E1' }}>
                  PIN de Acesso (4 dígitos)
                </label>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Padrão: 1234</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  placeholder="••••"
                  style={{
                    width: '100%',
                    padding: '14px 16px 14px 44px',
                    backgroundColor: '#1E293B',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    color: '#F8FAFC',
                    fontSize: '1.25rem',
                    letterSpacing: '8px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  required
                />
                <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              </div>
            </div>

            {/* Remember Me */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', cursor: 'pointer', fontSize: '0.82rem', color: '#94A3B8' }}>
              <input
                type="checkbox"
                checked={rememberLogin}
                onChange={(e) => setRememberLogin(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#F43F5E' }}
              />
              <span>Lembrar meu acesso neste celular</span>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: '#F43F5E',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(244, 63, 94, 0.4)'
              }}
            >
              <Check size={20} />
              <span>Acessar Minhas Corridas</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SCREEN 2: COURIER MAIN DASHBOARD (DELIVERY LIST & ADJUSTMENTS)
  // -------------------------------------------------------------
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0B0F19',
      color: '#F8FAFC',
      fontFamily: 'Inter, sans-serif',
      paddingBottom: '60px'
    }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#10B981',
          color: '#FFFFFF',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          zIndex: 1000,
          fontWeight: 600,
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Mobile-Friendly Header */}
      <header style={{
        backgroundColor: '#111827',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '16px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 20
      }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(244, 63, 94, 0.2)',
              color: '#F43F5E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bike size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#F8FAFC' }}>
                {authenticatedCourier.name}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: isLiveConnected ? '#10B981' : '#F59E0B',
                  boxShadow: isLiveConnected ? '0 0 6px #10B981' : 'none'
                }} />
                <span>{isLiveConnected ? 'Ao Vivo • Sincronizado' : 'Conectando ao sistema...'}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                syncAllData(false);
                if (onRefreshData) onRefreshData();
                showToast('Dados sincronizados com o restaurante!');
              }}
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: isSyncing ? '#38BDF8' : '#CBD5E1',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Sincronizar agora com o restaurante"
            >
              <RefreshCw size={13} style={{ transform: isSyncing ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s ease' }} />
              <span>{isSyncing ? 'Sincronizando...' : 'Atualizar'}</span>
            </button>

            <button
              onClick={handleLogout}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#FB7185',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Trocar de entregador"
            >
              <LogOut size={14} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px' }}>
        {/* Global Date Selector Bar with Standard System DateRangePicker */}
        <div style={{
          backgroundColor: '#1E293B',
          borderRadius: '14px',
          padding: '12px 16px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94A3B8', fontSize: '0.85rem' }}>
            <Calendar size={18} color="#F43F5E" />
            <span style={{ fontWeight: 600, color: '#E2E8F0' }}>Período:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <DateRangePicker
              value={dateRange}
              onChange={(newRange) => {
                setDateRange(newRange);
                const s = newRange.startDate;
                const dateStr = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
                setSelectedDate(dateStr);
              }}
            />

            <button
              type="button"
              onClick={() => {
                fetchAdjustments();
                fetchDailyPayments();
                fetchOrders();
                if (onRefreshData) onRefreshData();
                showToast('Dados atualizados!');
              }}
              style={{
                padding: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#CBD5E1',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Atualizar dados"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs: Corridas vs Extrato */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          backgroundColor: '#1E293B',
          padding: '4px',
          borderRadius: '12px',
          marginBottom: '16px'
        }}>
          <button
            type="button"
            onClick={() => setActivePortalTab('deliveries')}
            style={{
              padding: '10px 14px',
              borderRadius: '9px',
              border: 'none',
              backgroundColor: activePortalTab === 'deliveries' ? '#F43F5E' : 'transparent',
              color: activePortalTab === 'deliveries' ? '#FFFFFF' : '#94A3B8',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <Bike size={16} />
            <span>Corridas ({courierDeliveries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePortalTab('receivables')}
            style={{
              padding: '10px 14px',
              borderRadius: '9px',
              border: 'none',
              backgroundColor: activePortalTab === 'receivables' ? '#10B981' : 'transparent',
              color: activePortalTab === 'receivables' ? '#FFFFFF' : '#94A3B8',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <Wallet size={16} />
            <span>Extrato ({receivablesHistory.days.length}d)</span>
            {receivablesHistory.unpaidDaysCount > 0 && (
              <span style={{
                backgroundColor: activePortalTab === 'receivables' ? '#FFFFFF' : '#F59E0B',
                color: activePortalTab === 'receivables' ? '#10B981' : '#0B0F19',
                padding: '1px 6px',
                borderRadius: '10px',
                fontSize: '0.7rem',
                fontWeight: 800
              }}>
                {receivablesHistory.unpaidDaysCount}
              </span>
            )}
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: CORRIDAS DO DIA */}
        {/* ------------------------------------------------------------- */}
        {activePortalTab === 'deliveries' && (
          <>
            {/* Quick Balance Pill (click to open Receivables tab) */}
            {receivablesHistory.unpaidDaysCount > 0 && (
              <div
                onClick={() => setActivePortalTab('receivables')}
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wallet size={16} color="#34D399" />
                  <span style={{ fontSize: '0.82rem', color: '#CBD5E1' }}>
                    Saldo Acumulado Pendente ({receivablesHistory.unpaidDaysCount} dia(s) em aberto):
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong style={{ color: receivablesHistory.accumulatedNetBalance >= 0 ? '#34D399' : '#FB7185', fontSize: '0.92rem' }}>
                    {formatCurrency(Math.abs(receivablesHistory.accumulatedNetBalance))}
                  </strong>
                  <ArrowRight size={14} color="#34D399" />
                </div>
              </div>
            )}

        {/* Financial KPI Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          marginBottom: (stats.totalCashCollected > 0 || isDaniel) ? '10px' : '20px'
        }}>
          <div style={{ backgroundColor: '#1E293B', borderRadius: '12px', padding: '14px 12px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>Entregas</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F8FAFC', marginTop: '4px' }}>
              {stats.totalCount}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748B' }}>corridas</div>
          </div>

          <div style={{ backgroundColor: '#1E293B', borderRadius: '12px', padding: '14px 12px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>Total Taxas</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#34D399', marginTop: '4px' }}>
              {formatCurrency(stats.totalFee)}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748B' }}>bruto das corridas</div>
          </div>

          <div style={{
            backgroundColor: '#1E293B',
            borderRadius: '12px',
            padding: '14px 12px',
            textAlign: 'center',
            border: stats.totalCashCollected > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <div style={{ fontSize: '0.72rem', color: stats.totalCashCollected > 0 ? '#FBBF24' : '#94A3B8', fontWeight: 600 }}>Dinheiro Retido</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: stats.totalCashCollected > 0 ? '#FBBF24' : '#64748B', marginTop: '4px' }}>
              {formatCurrency(stats.totalCashCollected)}
            </div>
            <div style={{ fontSize: '0.7rem', color: stats.totalCashCollected > 0 ? '#FBBF24' : '#64748B' }}>
              {stats.totalCashCollected > 0 ? 'em mãos (clientes)' : 'sem dinheiro'}
            </div>
          </div>
        </div>

        {/* Settlement Banner: Acerto do Dia com Daniel / Motoboy */}
        {(stats.totalCashCollected > 0 || isDaniel) && (
          <div style={{
            backgroundColor: stats.netBalance >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.12)',
            border: stats.netBalance >= 0 ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: stats.netBalance >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: stats.netBalance >= 0 ? '#34D399' : '#FB7185',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Banknote size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: stats.netBalance >= 0 ? '#34D399' : '#FB7185', letterSpacing: '0.5px' }}>
                  {stats.netBalance >= 0 ? 'Líquido a Receber do Restaurante' : 'Você deve Repassar ao Restaurante'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '2px' }}>
                  Taxas ({formatCurrency(stats.totalFee)}) - Dinheiro Retido ({formatCurrency(stats.totalCashCollected)})
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: stats.netBalance >= 0 ? '#34D399' : '#FB7185' }}>
                {formatCurrency(Math.abs(stats.netBalance))}
              </div>
              <span style={{ fontSize: '0.7rem', color: stats.netBalance >= 0 ? '#34D399' : '#FB7185', fontWeight: 600 }}>
                {stats.netBalance >= 0 ? 'Saldo a seu favor' : 'Valor a devolver'}
              </span>
            </div>
          </div>
        )}

        {/* Daily Conference Section / Button */}
        <div style={{ marginBottom: '18px' }}>
          {dailyConferenceRecord?.status === 'approved' ? (
            <div style={{
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1.5px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <CheckCircle2 size={24} color="#10B981" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 800, color: '#34D399', fontSize: '0.92rem' }}>
                  Fechamento do Dia Aprovado pelo Restaurante!
                </div>
                <div style={{ fontSize: '0.76rem', color: '#CBD5E1', marginTop: '2px' }}>
                  Todas as suas corridas, taxas e valores deste dia foram conferidos e validados pelo restaurante.
                </div>
              </div>
            </div>
          ) : dailyConferenceRecord?.status === 'pending' ? (
            <div style={{
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              border: '1.5px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={24} color="#FBBF24" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 800, color: '#FBBF24', fontSize: '0.92rem' }}>
                    Conferência do Dia Enviada ao Restaurante!
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#CBD5E1', marginTop: '2px' }}>
                    Seu fechamento com todas as corridas deste dia foi enviado junto para conferência do gestor.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setConferenceNote(dailyConferenceRecord.notes || '');
                  setShowSendConferenceModal(true);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: '#FBBF24',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Reenviar / Atualizar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConferenceNote('');
                setShowSendConferenceModal(true);
              }}
              style={{
                width: '100%',
                padding: '15px 18px',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '12px',
                color: '#FFFFFF',
                fontSize: '0.95rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
              }}
            >
              <Send size={18} />
              <span>Enviar Conferência do Dia para o Restaurante</span>
            </button>
          )}
        </div>

        {/* Action Button: Add Missing Delivery */}
        <div style={{ marginBottom: '18px' }}>
          <button
            onClick={() => setShowAddDeliveryModal(true)}
            style={{
              width: '100%',
              padding: '14px 18px',
              backgroundColor: '#1E293B',
              border: '1px dashed #F43F5E',
              borderRadius: '12px',
              color: '#F43F5E',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <Plus size={18} />
            <span>Adicionar Corrida Faltante (que não está na lista)</span>
          </button>
        </div>

        {/* Deliveries Section Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
            Suas Corridas Registradas ({courierDeliveries.length})
            {deliveriesTotalPages > 1 && (
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94A3B8', marginLeft: '6px' }}>
                (Pág. {safeDeliveriesCurrentPage}/{deliveriesTotalPages})
              </span>
            )}
          </h2>
          <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600 }}>
            {dateRange.label || `${formatDateBR(dateRange.startDate)} ~ ${formatDateBR(dateRange.endDate)}`}
          </span>
        </div>

        {/* Empty State */}
        {courierDeliveries.length === 0 && (
          <div style={{
            backgroundColor: '#1E293B',
            borderRadius: '14px',
            padding: '36px 20px',
            textAlign: 'center',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <Bike size={36} color="#64748B" style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#E2E8F0', margin: '0 0 6px 0' }}>
              Nenhuma corrida encontrada nesta data
            </h3>
            <p style={{ color: '#94A3B8', fontSize: '0.82rem', margin: '0 0 16px 0', maxWidth: '380px', marginInline: 'auto' }}>
              O restaurante ainda não importou o fechamento deste dia ou você não teve corridas registradas.
            </p>
            <button
              onClick={() => setShowAddDeliveryModal(true)}
              style={{
                padding: '10px 18px',
                backgroundColor: '#F43F5E',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              + Adicionar Corrida Faltante
            </button>
          </div>
        )}

        {/* Deliveries List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {paginatedDeliveries.map((delivery, pageIdx) => {
            const itemIndex = (safeDeliveriesCurrentPage - 1) * DELIVERIES_PER_PAGE + pageIdx;
            // Check if there is an active adjustment for this delivery
            const pendingAdj = dayAdjustments.find(
              (a) => a.delivery_id === delivery.id && a.status === 'pending'
            );
            const approvedAdj = dayAdjustments.find(
              (a) => a.delivery_id === delivery.id && a.status === 'approved'
            );
            const rejectedAdj = dayAdjustments.find(
              (a) => a.delivery_id === delivery.id && a.status === 'rejected'
            );

            return (
              <div
                key={delivery.id}
                style={{
                  backgroundColor: '#1E293B',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  border: pendingAdj 
                    ? '1px solid rgba(245, 158, 11, 0.5)' 
                    : approvedAdj 
                    ? '1px solid rgba(16, 185, 129, 0.4)' 
                    : '1px solid rgba(255, 255, 255, 0.06)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontWeight: 800,
                        fontSize: '0.98rem',
                        color: '#F8FAFC'
                      }}>
                        #{delivery.order_number || delivery.external_order_id || `${itemIndex + 1}`}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                        {dateRange.startDate.toDateString() === dateRange.endDate.toDateString()
                          ? (formatDateTime(delivery.delivery_date).split(' ')[1] || formatDateTime(delivery.delivery_date))
                          : formatDateTime(delivery.delivery_date)}
                      </span>
                    </div>

                    {/* Customer Name */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '4px',
                      color: '#38BDF8',
                      fontSize: '0.88rem',
                      fontWeight: 600
                    }}>
                      <User size={14} style={{ flexShrink: 0, color: '#38BDF8' }} />
                      <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '260px'
                      }}>
                        {getCustomerName(delivery)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', color: '#CBD5E1', fontSize: '0.85rem' }}>
                      <MapPin size={14} color="#F43F5E" />
                      <span>{delivery.neighborhood_name || 'Bairro Centro'}</span>
                    </div>

                    {/* Payment Info */}
                    {(() => {
                      const pInfo = getDeliveryPaymentInfo(delivery);
                      return (
                        <div style={{ marginTop: '6px' }}>
                          {pInfo.isCash ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              border: '1px solid rgba(245, 158, 11, 0.4)',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '0.78rem',
                              color: '#FBBF24',
                              fontWeight: 700
                            }}>
                              <Banknote size={14} />
                              <span>Dinheiro Retido: {formatCurrency(pInfo.amount)}</span>
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              fontSize: '0.74rem',
                              color: '#94A3B8'
                            }}>
                              <CreditCard size={12} />
                              <span>{pInfo.methodName || 'Cartão / App'}</span>
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#34D399' }}>
                      {formatCurrency(delivery.courier_fee)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                      taxa da corrida
                    </div>
                  </div>
                </div>

                {/* Adjustment Status Pills */}
                {pendingAdj && (
                  <div style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    marginTop: '8px',
                    fontSize: '0.78rem',
                    color: '#FBBF24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} />
                      <span>
                        Ajuste solicitado para <strong>{formatCurrency(pendingAdj.proposed_fee)}</strong> (Aguardando OK do restaurante)
                      </span>
                    </div>
                  </div>
                )}

                {approvedAdj && (
                  <div style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    marginTop: '8px',
                    fontSize: '0.75rem',
                    color: '#34D399',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <CheckCircle2 size={13} />
                    <span>Ajuste de taxa aprovado pelo restaurante!</span>
                  </div>
                )}

                {rejectedAdj && (
                  <div style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    marginTop: '8px',
                    fontSize: '0.75rem',
                    color: '#FB7185',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <AlertCircle size={13} />
                    <span>Ajuste recusado pelo restaurante: {rejectedAdj.notes || 'Mantida taxa padrão'}</span>
                  </div>
                )}

                {/* Action Buttons for this Delivery */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  marginTop: '10px',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  flexWrap: 'wrap'
                }}>
                  <button
                    onClick={() => {
                      setDeletingDelivery(delivery);
                      setDeleteNote('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px'
                    }}
                    title="Informar que essa corrida não foi sua"
                  >
                    <Trash2 size={13} />
                    <span>Não fiz essa</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(delivery, true)}
                    style={{
                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '8px',
                      color: '#FBBF24',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 10px'
                    }}
                    title="Informar ou alterar pagamento em dinheiro"
                  >
                    <Banknote size={13} />
                    <span>{getDeliveryPaymentInfo(delivery).isCash ? 'Editar Dinheiro' : 'Recebeu Dinheiro?'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(delivery, false)}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px'
                    }}
                  >
                    <Edit3 size={13} />
                    <span>Ajustar Bairro / Taxa</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Deliveries Pagination */}
        <PaginationControls
          currentPage={safeDeliveriesCurrentPage}
          totalPages={deliveriesTotalPages}
          totalItems={courierDeliveries.length}
          itemsPerPage={DELIVERIES_PER_PAGE}
          onPageChange={(p) => {
            setDeliveriesCurrentPage(p);
            window.scrollTo({ top: 380, behavior: 'smooth' });
          }}
          itemName="corridas"
        />

        {/* Pending New Deliveries Added By Courier (Awaiting Admin Confirmation) */}
        {dayAdjustments.filter((a) => a.type === 'new_delivery' && a.status === 'pending').length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FBBF24', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} />
              <span>Corridas Adicionadas por Você (Aguardando OK do Restaurante):</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {dayAdjustments
                .filter((a) => a.type === 'new_delivery' && a.status === 'pending')
                .map((adj) => (
                  <div
                    key={adj.id}
                    style={{
                      backgroundColor: 'rgba(245, 158, 11, 0.08)',
                      border: '1px dashed rgba(245, 158, 11, 0.4)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#F8FAFC' }}>
                        #{adj.order_number} - {adj.neighborhood_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#FBBF24', marginTop: '2px' }}>
                        {adj.notes || 'Corrida avulsa informada'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#34D399' }}>
                        {formatCurrency(adj.proposed_fee)}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#FBBF24' }}>Pendente</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
          </>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: EXTRATO & CONTROLE DE RECEBIMENTOS ACUMULADOS */}
        {/* ------------------------------------------------------------- */}
        {activePortalTab === 'receivables' && (
          <div>
            {/* Top Accumulated Balance Card */}
            <div style={{
              backgroundColor: '#1E293B',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '18px',
              border: receivablesHistory.accumulatedNetBalance >= 0 
                ? '1.5px solid rgba(16, 185, 129, 0.4)' 
                : '1.5px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: receivablesHistory.accumulatedNetBalance >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: receivablesHistory.accumulatedNetBalance >= 0 ? '#10B981' : '#FB7185',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Wallet size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
                      {receivablesHistory.accumulatedNetBalance >= 0 
                        ? 'Saldo a Receber no Período' 
                        : 'Valor a Repassar no Período'}
                    </h3>
                    <p style={{ color: '#94A3B8', fontSize: '0.8rem', margin: '2px 0 0 0' }}>
                      {dateRange.label || `${formatDateBR(dateRange.startDate)} ~ ${formatDateBR(dateRange.endDate)}`} — {receivablesHistory.unpaidDaysCount > 0 
                        ? `${receivablesHistory.unpaidDaysCount} dia(s) pendente(s)` 
                        : 'Nenhuma diária pendente'}
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: '1.65rem',
                    fontWeight: 900,
                    color: receivablesHistory.accumulatedNetBalance >= 0 ? '#34D399' : '#FB7185'
                  }}>
                    {formatCurrency(Math.abs(receivablesHistory.accumulatedNetBalance))}
                  </div>
                  <span style={{
                    fontSize: '0.72rem',
                    color: receivablesHistory.accumulatedNetBalance >= 0 ? '#34D399' : '#FB7185',
                    fontWeight: 700
                  }}>
                    {receivablesHistory.accumulatedNetBalance >= 0 ? 'Líquido a seu favor' : 'Valor a devolver'}
                  </span>
                </div>
              </div>

              {/* Breakdown Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                borderRadius: '12px',
                padding: '12px',
                marginTop: '10px'
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Dias Pendentes</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F8FAFC', marginTop: '2px' }}>
                    {receivablesHistory.unpaidDaysCount} {receivablesHistory.unpaidDaysCount === 1 ? 'dia' : 'dias'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Taxas no Período</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#34D399', marginTop: '2px' }}>
                    {formatCurrency(receivablesHistory.unpaidFeesTotal)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Dinheiro em Mãos</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: receivablesHistory.unpaidCashTotal > 0 ? '#FBBF24' : '#CBD5E1', marginTop: '2px' }}>
                    {formatCurrency(receivablesHistory.unpaidCashTotal)}
                  </div>
                </div>
              </div>

              {/* Notice if there are unpaid days outside current filter */}
              {(receivablesHistory.allTimeUnpaidCount || 0) > (receivablesHistory.unpaidDaysCount || 0) && (
                <div style={{
                  marginTop: '12px',
                  padding: '9px 12px',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  color: '#FBBF24',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <span>
                    ⚠️ Existem <strong>{receivablesHistory.allTimeUnpaidCount} dia(s) pendente(s)</strong> no histórico geral ({formatCurrency(receivablesHistory.allTimeUnpaidBalance)}).
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const earliest = new Date('2026-01-01T00:00:00');
                      const now = new Date();
                      setDateRange({
                        startDate: startOfDay(earliest),
                        endDate: endOfDay(now),
                        label: 'Histórico Completo'
                      });
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      color: '#F8FAFC',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.72rem'
                    }}
                  >
                    Ver Tudo
                  </button>
                </div>
              )}

              {/* Explanatory notice */}
              <div style={{
                marginTop: '12px',
                padding: '8px 12px',
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                borderRadius: '8px',
                borderLeft: '3px solid #38BDF8',
                fontSize: '0.76rem',
                color: '#CBD5E1',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Clock size={14} color="#38BDF8" style={{ flexShrink: 0 }} />
                <span>
                  Quando o restaurante marcar o dia como <strong>pago</strong> no sistema, ele é <strong>automaticamente descontado</strong> deste saldo acumulado.
                </span>
              </div>
            </div>

            {/* Filter Pills Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'inline-flex', backgroundColor: '#1E293B', padding: '3px', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={() => setReceivablesFilter('all')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: receivablesFilter === 'all' ? '#F43F5E' : 'transparent',
                    color: receivablesFilter === 'all' ? '#FFFFFF' : '#94A3B8'
                  }}
                >
                  Todos ({receivablesHistory.days.length})
                </button>

                <button
                  type="button"
                  onClick={() => setReceivablesFilter('unpaid')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: receivablesFilter === 'unpaid' ? '#F59E0B' : 'transparent',
                    color: receivablesFilter === 'unpaid' ? '#0B0F19' : '#94A3B8'
                  }}
                >
                  Pendentes ({receivablesHistory.unpaidDaysCount})
                </button>

                <button
                  type="button"
                  onClick={() => setReceivablesFilter('paid')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: receivablesFilter === 'paid' ? '#10B981' : 'transparent',
                    color: receivablesFilter === 'paid' ? '#FFFFFF' : '#94A3B8'
                  }}
                >
                  Pagos ({receivablesHistory.paidDaysCount})
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  syncAllData(false);
                  if (onRefreshData) onRefreshData();
                  showToast('Extrato atualizado com o restaurante!');
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#CBD5E1',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RefreshCw size={12} />
                <span>Atualizar</span>
              </button>
            </div>

            {/* Days List */}
            {(() => {
              const displayDays = receivablesHistory.days.filter((d) => {
                if (receivablesFilter === 'unpaid') return !d.isPaid;
                if (receivablesFilter === 'paid') return d.isPaid;
                return true;
              });

              if (displayDays.length === 0) {
                return (
                  <div style={{
                    backgroundColor: '#1E293B',
                    borderRadius: '12px',
                    padding: '36px 20px',
                    textAlign: 'center',
                    color: '#94A3B8'
                  }}>
                    <CheckCircle2 size={40} color="#10B981" style={{ margin: '0 auto 12px auto' }} />
                    <div style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '1rem' }}>
                      {receivablesFilter === 'unpaid' ? 'Tudo em dia! Nenhum dia pendente de pagamento no período.' : 'Nenhum registro encontrado no período.'}
                    </div>
                    <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                      {receivablesFilter === 'unpaid' 
                        ? 'Todas as suas diárias deste período já foram acertadas pelo restaurante.' 
                        : 'Altere o período de datas no topo para visualizar outros dias ou meses.'}
                    </p>
                  </div>
                );
              }

              const daysTotalPages = Math.max(1, Math.ceil(displayDays.length / DAYS_PER_PAGE));
              const safeDaysCurrentPage = Math.min(daysCurrentPage, daysTotalPages);
              const paginatedDays = displayDays.slice(
                (safeDaysCurrentPage - 1) * DAYS_PER_PAGE,
                safeDaysCurrentPage * DAYS_PER_PAGE
              );

              return (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {paginatedDays.map((day) => {
                    return (
                      <div
                        key={day.date}
                        style={{
                          backgroundColor: '#1E293B',
                          borderRadius: '12px',
                          padding: '14px 16px',
                          border: day.isPaid 
                            ? '1px solid rgba(16, 185, 129, 0.3)' 
                            : '1.5px solid rgba(245, 158, 11, 0.4)',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={15} color="#38BDF8" />
                            <span style={{ fontWeight: 800, color: '#F8FAFC', fontSize: '0.92rem' }}>
                              {formatDateBR(new Date(day.date + 'T12:00:00'))}
                            </span>
                          </div>

                          {/* Status Badge */}
                          <div>
                            {day.isPaid ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.35)',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontSize: '0.74rem',
                                color: '#34D399',
                                fontWeight: 700
                              }}>
                                <CheckCircle2 size={13} />
                                <span>Pago pelo Restaurante</span>
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontSize: '0.74rem',
                                color: '#FBBF24',
                                fontWeight: 700
                              }}>
                                <Clock size={13} />
                                <span>Pendente de Pagamento</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Metrics Grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: '8px',
                          backgroundColor: 'rgba(0, 0, 0, 0.2)',
                          borderRadius: '8px',
                          padding: '10px',
                          marginBottom: '10px'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Entregas</div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#F8FAFC', marginTop: '2px' }}>
                              {day.deliveriesCount}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Taxas</div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#34D399', marginTop: '2px' }}>
                              {formatCurrency(day.totalFees)}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Dinheiro</div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: day.retainedCash > 0 ? '#FBBF24' : '#CBD5E1', marginTop: '2px' }}>
                              {formatCurrency(day.retainedCash)}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.7rem', color: day.netAmount >= 0 ? '#34D399' : '#FB7185', fontWeight: 700 }}>
                              {day.netAmount >= 0 ? 'A Receber' : 'A Devolver'}
                            </div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: day.netAmount >= 0 ? '#34D399' : '#FB7185', marginTop: '2px' }}>
                              {formatCurrency(Math.abs(day.netAmount))}
                            </div>
                          </div>
                        </div>

                        {/* Paid Info or View Runs Action */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ color: '#94A3B8' }}>
                            {day.payRecord?.paid_at && (
                              <span>Pago via {day.payRecord.payment_method || 'Pix'} em {formatDateTime(day.payRecord.paid_at)}</span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const targetDate = new Date(`${day.date}T12:00:00`);
                              setDateRange({
                                startDate: startOfDay(targetDate),
                                endDate: endOfDay(targetDate),
                                label: formatDateBR(targetDate)
                              });
                              setSelectedDate(day.date);
                              setActivePortalTab('deliveries');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#38BDF8',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 0'
                            }}
                          >
                            <span>Ver Corridas Deste Dia</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <PaginationControls
                  currentPage={safeDaysCurrentPage}
                  totalPages={daysTotalPages}
                  totalItems={displayDays.length}
                  itemsPerPage={DAYS_PER_PAGE}
                  onPageChange={(p) => {
                    setDaysCurrentPage(p);
                    window.scrollTo({ top: 380, behavior: 'smooth' });
                  }}
                  itemName="dias"
                />
              </div>
            );
            })()}
          </div>
        )}
      </main>

      {/* --------------------------------------------------------- */}
      {/* MODAL 1: EDIT DELIVERY FEE */}
      {/* --------------------------------------------------------- */}
      {editingDelivery && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#1E293B',
            borderRadius: '16px',
            maxWidth: '420px',
            width: '100%',
            padding: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            maxHeight: '92vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
                Ajustar Bairro / Taxa da Corrida
              </h3>
              <button
                onClick={() => setEditingDelivery(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ backgroundColor: '#0F172A', padding: '14px', borderRadius: '12px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <div style={{ color: '#94A3B8' }}>Pedido: <strong style={{ color: '#F8FAFC' }}>#{editingDelivery.order_number || editingDelivery.external_order_id}</strong></div>
              <div style={{ color: '#94A3B8', marginTop: '4px' }}>Cliente: <strong style={{ color: '#38BDF8' }}>{getCustomerName(editingDelivery)}</strong></div>
              <div style={{ color: '#94A3B8', marginTop: '4px' }}>Bairro Atual: <strong style={{ color: '#F8FAFC' }}>{editingDelivery.neighborhood_name || 'Não informado'}</strong></div>
              <div style={{ color: '#94A3B8', marginTop: '4px' }}>Taxa Atual no Sistema: <strong style={{ color: '#34D399' }}>{formatCurrency(editingDelivery.courier_fee)}</strong></div>
            </div>

            <form onSubmit={handleSubmitEditFee}>
              {/* Bairro Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Bairro Correto da Entrega *
                </label>
                <SearchableNeighborhoodSelect
                  value={proposedNeighborhood}
                  onChange={(name, rate) => {
                    setProposedNeighborhood(name);
                    if (rate !== undefined) {
                      setProposedFee(String(rate));
                    }
                  }}
                  availableNeighborhoods={availableNeighborhoods}
                  placeholder="Digite para buscar o bairro..."
                  required
                />
                <span style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '6px', display: 'block' }}>
                  Digite as primeiras letras para buscar o bairro. A taxa do sistema é preenchida automaticamente.
                </span>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Valor da Taxa (R$) *
                </label>
                <input
                  type="text"
                  value={proposedFee}
                  onChange={(e) => setProposedFee(e.target.value)}
                  placeholder="Ex: 10,00"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: '#0F172A',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: '#F8FAFC',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              {/* Opção de Pagamento em Dinheiro */}
              <div style={{
                backgroundColor: isCashPayment ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                border: isCashPayment ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '14px',
                marginBottom: '18px'
              }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isCashPayment}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsCashPayment(checked);
                      if (checked && (!cashAmount || cashAmount === '0')) {
                        const order = ordersMap.get(editingDelivery.external_order_id) || (editingDelivery.order_number ? ordersMap.get(editingDelivery.order_number) : undefined);
                        const val = editingDelivery.order_amount || order?.gross_amount || 0;
                        setCashAmount(val > 0 ? String(val) : '');
                      }
                    }}
                    style={{ width: '18px', height: '18px', accentColor: '#F59E0B', marginTop: '2px', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#F8FAFC' }}>
                      💵 Cliente pagou em DINHEIRO na entrega?
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
                      Marque se o cliente trocou de cartão para dinheiro ou se você recebeu o valor em mãos.
                    </div>
                  </div>
                </label>

                {isCashPayment && (
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#FBBF24', marginBottom: '6px' }}>
                      Valor do pedido recebido em dinheiro (R$) *
                    </label>
                    <input
                      type="text"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      placeholder="Ex: 85,00"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        backgroundColor: '#0F172A',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        borderRadius: '8px',
                        color: '#FBBF24',
                        fontSize: '1.05rem',
                        fontWeight: 800,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      required={isCashPayment}
                    />
                    <span style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '4px', display: 'block' }}>
                      Esse valor será somado ao seu dinheiro retido e abatido do seu acerto diário.
                    </span>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Motivo / Observação (opcional)
                </label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Ex: Bairro distante, chuva, taxa combinada com o dono..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#0F172A',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: '#F8FAFC',
                    fontSize: '0.85rem',
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setEditingDelivery(null)}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  style={{
                    padding: '12px 20px',
                    backgroundColor: '#F43F5E',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#FFFFFF',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Send size={15} />
                  <span>{isSubmittingEdit ? 'Enviando...' : 'Enviar para Conferência'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* MODAL 2: ADD MISSING DELIVERY */}
      {/* --------------------------------------------------------- */}
      {showAddDeliveryModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#1E293B',
            borderRadius: '16px',
            maxWidth: '440px',
            width: '100%',
            padding: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            maxHeight: '92vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
                Adicionar Corrida Faltante
              </h3>
              <button
                onClick={() => setShowAddDeliveryModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: '#94A3B8', fontSize: '0.8rem', marginTop: 0, marginBottom: '16px' }}>
              Informe os dados da corrida que você realizou e não consta na lista importada. O restaurante irá conferir e aprovar.
            </p>

            <form onSubmit={handleSubmitNewDelivery}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Número do Pedido (se souber)
                </label>
                <input
                  type="text"
                  value={newOrderNumber}
                  onChange={(e) => setNewOrderNumber(e.target.value)}
                  placeholder="Ex: 2450 ou Balcão"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: '#0F172A',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: '#F8FAFC',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Nome do Cliente (se souber)
                </label>
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Ex: Mariana, Lucas..."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: '#0F172A',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: '#F8FAFC',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Bairro da Entrega *
                </label>
                <SearchableNeighborhoodSelect
                  value={newNeighborhood}
                  onChange={(name, rate) => {
                    setNewNeighborhood(name);
                    if (rate !== undefined) {
                      setNewFee(String(rate));
                    }
                  }}
                  availableNeighborhoods={availableNeighborhoods}
                  placeholder="Digite para buscar o bairro..."
                  required
                />
                <span style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '6px', display: 'block' }}>
                  Digite as primeiras letras para buscar o bairro. A taxa do sistema é preenchida automaticamente.
                </span>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Valor da Taxa (R$) *
                </label>
                <input
                  type="text"
                  value={newFee}
                  onChange={(e) => setNewFee(e.target.value)}
                  placeholder="Ex: 8,00 ou 10,00"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: '#0F172A',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: '#F8FAFC',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              {/* Opção de Pagamento em Dinheiro */}
              <div style={{
                backgroundColor: newIsCash ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                border: newIsCash ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '16px'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newIsCash}
                    onChange={(e) => setNewIsCash(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#F59E0B', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F8FAFC' }}>
                      💵 Recebi o valor do pedido em DINHEIRO
                    </div>
                  </div>
                </label>

                {newIsCash && (
                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#FBBF24', marginBottom: '4px' }}>
                      Valor recebido em dinheiro (R$) *
                    </label>
                    <input
                      type="text"
                      value={newCashAmount}
                      onChange={(e) => setNewCashAmount(e.target.value)}
                      placeholder="Ex: 75,00"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        backgroundColor: '#0F172A',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        borderRadius: '8px',
                        color: '#FBBF24',
                        fontSize: '1rem',
                        fontWeight: 800,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      required={newIsCash}
                    />
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Observação
                </label>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Ex: Corrida feita por volta das 21h30..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#0F172A',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: '#F8FAFC',
                    fontSize: '0.85rem',
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddDeliveryModal(false)}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  style={{
                    padding: '12px 20px',
                    backgroundColor: '#F43F5E',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#FFFFFF',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Send size={15} />
                  <span>{isSubmittingNew ? 'Enviando...' : 'Enviar para o Restaurante'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* MODAL 3: DELETE REQUEST */}
      {/* --------------------------------------------------------- */}
      {deletingDelivery && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#1E293B',
            borderRadius: '16px',
            maxWidth: '420px',
            width: '100%',
            padding: '24px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 12px 0', color: '#FB7185' }}>
              Solicitar Remoção desta Corrida
            </h3>
            
            <div style={{ backgroundColor: '#0F172A', padding: '12px', borderRadius: '10px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <div style={{ color: '#94A3B8' }}>Pedido: <strong style={{ color: '#F8FAFC' }}>#{deletingDelivery.order_number || deletingDelivery.external_order_id}</strong></div>
              <div style={{ color: '#94A3B8', marginTop: '4px' }}>Cliente: <strong style={{ color: '#38BDF8' }}>{getCustomerName(deletingDelivery)}</strong></div>
              <div style={{ color: '#94A3B8', marginTop: '4px' }}>Bairro: <strong style={{ color: '#F8FAFC' }}>{deletingDelivery.neighborhood_name || 'Não informado'}</strong></div>
              <div style={{ color: '#94A3B8', marginTop: '4px' }}>Taxa: <strong style={{ color: '#34D399' }}>{formatCurrency(deletingDelivery.courier_fee)}</strong></div>
            </div>

            <p style={{ color: '#CBD5E1', fontSize: '0.85rem', margin: '0 0 16px 0' }}>
              Você está informando que a entrega deste pedido não foi realizada por você.
            </p>

            <form onSubmit={handleSubmitDeleteRequest}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Motivo
                </label>
                <input
                  type="text"
                  value={deleteNote}
                  onChange={(e) => setDeleteNote(e.target.value)}
                  placeholder="Ex: Foi feita por outro motoboy / Cancelada..."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: '#0F172A',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    color: '#F8FAFC',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setDeletingDelivery(null)}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDelete}
                  style={{
                    padding: '12px 20px',
                    backgroundColor: '#EF4444',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#FFFFFF',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {isSubmittingDelete ? 'Enviando...' : 'Confirmar e Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Daily Conference Modal */}
      {showSendConferenceModal && (
        <div className="modal-overlay" style={{ zIndex: 120 }}>
          <div className="modal-content" style={{ maxWidth: '480px', width: '92%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Send size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
                    Enviar Conferência do Dia
                  </h3>
                  <p style={{ color: '#94A3B8', fontSize: '0.78rem', margin: 0 }}>
                    {authenticatedCourier.name} — {dateRange.label || formatDateBR(new Date(selectedDate + 'T12:00:00'))}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSendConferenceModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Shift Financial Overview */}
            <div style={{
              backgroundColor: '#0F172A',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
                <span>Total de Corridas:</span>
                <strong style={{ color: '#F8FAFC' }}>{stats.totalCount} entregas</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
                <span>Total de Taxas a Receber:</span>
                <strong style={{ color: '#34D399' }}>{formatCurrency(stats.totalFee)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
                <span>Dinheiro Retido com Você:</span>
                <strong style={{ color: '#FBBF24' }}>{formatCurrency(stats.totalCashCollected)}</strong>
              </div>
              <div style={{
                marginTop: '6px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 800
              }}>
                <span style={{ color: stats.netBalance >= 0 ? '#34D399' : '#FB7185' }}>
                  {stats.netBalance >= 0 ? 'Líquido a Receber:' : 'Valor a Devolver:'}
                </span>
                <span style={{ fontSize: '1.1rem', color: stats.netBalance >= 0 ? '#34D399' : '#FB7185' }}>
                  {formatCurrency(Math.abs(stats.netBalance))}
                </span>
              </div>
            </div>

            {/* List of Adjustments included */}
            {dayAdjustments.filter(a => a.type !== 'daily_conference').length > 0 && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '10px',
                padding: '10px 14px',
                marginBottom: '14px',
                fontSize: '0.78rem'
              }}>
                <div style={{ color: '#CBD5E1', fontWeight: 700, marginBottom: '6px' }}>
                  Solicitações e alterações incluídas neste envio:
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', color: '#94A3B8', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {dayAdjustments.filter(a => a.type !== 'daily_conference').map(adj => (
                    <li key={adj.id}>
                      <strong style={{ color: '#F8FAFC' }}>#{adj.order_number || 'S/N'}</strong>: {adj.type === 'edit_fee' ? `Taxa ${formatCurrency(adj.proposed_fee)}` : adj.type === 'new_delivery' ? 'Corrida faltante' : 'Remoção'}
                      {adj.received_cash ? ` (Dinheiro: ${formatCurrency(adj.received_cash)})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleSendDailyConference}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '6px' }}>
                  Alguma observação para o restaurante? (opcional)
                </label>
                <textarea
                  value={conferenceNote}
                  onChange={(e) => setConferenceNote(e.target.value)}
                  placeholder="Ex: Turno finalizado sem problemas, dinheiro conferido..."
                  rows={2}
                  style={{
                    width: '100%',
                    backgroundColor: '#0F172A',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    color: '#F8FAFC',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowSendConferenceModal(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#CBD5E1',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingConference}
                  style={{
                    flex: 2,
                    padding: '12px',
                    backgroundColor: '#10B981',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Send size={16} />
                  <span>{isSubmittingConference ? 'Enviando...' : 'Confirmar e Enviar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
