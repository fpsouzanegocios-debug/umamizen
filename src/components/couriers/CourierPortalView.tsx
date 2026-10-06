import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  User,
  Banknote,
  CreditCard,
  DollarSign
} from 'lucide-react';
import { Courier, Delivery, Order, CourierAdjustment, NeighborhoodRate } from '../../types';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { getOperationalDateKey, formatDateBR } from '../../lib/dateUtils';
import { normalizeNeighborhoodName } from '../../lib/neighborhoodMatcher';

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
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [adjustments, setAdjustments] = useState<CourierAdjustment[]>([]);
  const [isLoadingAdjustments, setIsLoadingAdjustments] = useState<boolean>(false);
  const [availableNeighborhoods, setAvailableNeighborhoods] = useState<NeighborhoodRate[]>(neighborhoodRates);

  // Orders State & Mapping for Customer Name & Payment Details
  const [internalOrders, setInternalOrders] = useState<Order[]>(orders || []);

  useEffect(() => {
    if (orders && orders.length > 0) {
      setInternalOrders(orders);
    } else {
      supabase
        .from('orders')
        .select('*')
        .then(({ data, error }) => {
          if (!error && data) {
            setInternalOrders(data as Order[]);
          }
        });
    }
  }, [orders]);

  const ordersMap = useMemo(() => {
    const map = new Map<string, Order>();
    internalOrders.forEach((o) => {
      if (o.external_order_id) map.set(o.external_order_id, o);
      if (o.order_number) map.set(o.order_number, o);
      if (o.id) map.set(o.id, o);
    });
    return map;
  }, [internalOrders]);

  const getCustomerName = (delivery: Delivery): string => {
    const order = ordersMap.get(delivery.external_order_id) || 
                  (delivery.order_number ? ordersMap.get(delivery.order_number) : undefined) ||
                  (delivery.order_id ? ordersMap.get(delivery.order_id) : undefined);
    return order?.customer_name || 'Cliente Balcão / Avulso';
  };

  const getDeliveryPaymentInfo = (delivery: Delivery) => {
    const order = ordersMap.get(delivery.external_order_id) || 
                  (delivery.order_number ? ordersMap.get(delivery.order_number) : undefined);
    
    // Check if there is a pending or approved adjustment with cash
    const adj = adjustments.find(a => a.delivery_id === delivery.id && a.status !== 'rejected');
    if (adj && (adj.received_cash || adj.payment_method === 'Dinheiro')) {
      return {
        isCash: true,
        amount: Number(adj.received_cash ?? delivery.order_amount ?? order?.gross_amount ?? 0),
        methodName: 'Dinheiro (informado)',
        hasAdjustment: true,
        adjStatus: adj.status
      };
    }

    const rawMethod = delivery.payment_method || order?.final_payment_method || order?.original_payment_method || '';
    const norm = rawMethod.toLowerCase();
    const isCash = norm.includes('dinheiro') || norm === 'cash';
    const amount = Number(delivery.order_amount ?? order?.gross_amount ?? 0);

    return {
      isCash,
      amount: isCash ? amount : 0,
      methodName: rawMethod || 'Não informado',
      hasAdjustment: false,
      adjStatus: null
    };
  };

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
      const found = couriers.find((c) => c.id === savedId && c.is_active);
      if (found && (found.pin || '1234') === savedPin) {
        setAuthenticatedCourier(found);
        setSelectedCourierId(savedId);
      }
    }
  }, [couriers]);

  // Load system neighborhood rates if not provided
  useEffect(() => {
    if (neighborhoodRates && neighborhoodRates.length > 0) {
      setAvailableNeighborhoods(neighborhoodRates.filter((n) => n.is_active));
    } else {
      supabase
        .from('neighborhood_rates')
        .select('*')
        .eq('is_active', true)
        .order('name')
        .then(({ data, error }) => {
          if (!error && data) {
            setAvailableNeighborhoods(data as NeighborhoodRate[]);
          }
        });
    }
  }, [neighborhoodRates]);

  // Handle Login Submission
  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);

    const courier = couriers.find((c) => c.id === selectedCourierId);
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

  // Fetch Adjustments for this Courier from Supabase
  const fetchAdjustments = async () => {
    if (!authenticatedCourier) return;
    setIsLoadingAdjustments(true);
    try {
      const { data, error } = await supabase
        .from('courier_adjustments')
        .select('*')
        .eq('courier_id', authenticatedCourier.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar ajustes:', error);
      } else if (data) {
        setAdjustments(data as CourierAdjustment[]);
      }
    } catch (err) {
      console.error('Erro ao buscar ajustes:', err);
    } finally {
      setIsLoadingAdjustments(false);
    }
  };

  useEffect(() => {
    if (authenticatedCourier) {
      fetchAdjustments();
    }
  }, [authenticatedCourier, selectedDate]);

  // Filter deliveries belonging strictly to this courier on the selected date
  const courierDeliveries = useMemo(() => {
    if (!authenticatedCourier) return [];

    return deliveries.filter((d) => {
      // Must match courier by id or name
      const matchesCourier = 
        (d.courier_id && d.courier_id === authenticatedCourier.id) ||
        (d.courier_name && d.courier_name.trim().toLowerCase() === authenticatedCourier.name.trim().toLowerCase());

      if (!matchesCourier) return false;

      // Match operational date
      const opKey = getOperationalDateKey(d.delivery_date);
      if (opKey) {
        return opKey === selectedDate;
      }
      return d.delivery_date.startsWith(selectedDate);
    });
  }, [deliveries, authenticatedCourier, selectedDate]);

  // Pending adjustments for the selected date
  const dayAdjustments = useMemo(() => {
    return adjustments.filter((a) => a.date === selectedDate);
  }, [adjustments, selectedDate]);

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
    const activeCouriers = couriers.filter((c) => c.is_active);

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
          {onBackToMain && (
            <button
              onClick={onBackToMain}
              style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                color: '#94A3B8',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem'
              }}
            >
              <ArrowLeft size={16} />
              <span>Painel</span>
            </button>
          )}

          <div style={{ textAlign: 'center', marginTop: onBackToMain ? '20px' : '0', marginBottom: '24px' }}>
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
              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                Entregador Cadastrado
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onBackToMain && (
              <button
                onClick={onBackToMain}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94A3B8',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Voltar ao sistema gerencial"
              >
                <ArrowLeft size={14} />
                <span>Painel</span>
              </button>
            )}

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
        {/* Date Selector Bar */}
        <div style={{
          backgroundColor: '#1E293B',
          borderRadius: '14px',
          padding: '12px 16px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94A3B8', fontSize: '0.85rem' }}>
            <Calendar size={18} color="#F43F5E" />
            <span style={{ fontWeight: 600 }}>Data do Fechamento:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                backgroundColor: '#0F172A',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#F8FAFC',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            />

            <button
              onClick={() => {
                fetchAdjustments();
                if (onRefreshData) onRefreshData();
                showToast('Dados atualizados!');
              }}
              style={{
                padding: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                borderRadius: '8px',
                color: '#CBD5E1',
                cursor: 'pointer'
              }}
              title="Atualizar dados"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
            Suas Corridas Registradas ({courierDeliveries.length})
          </h2>
          <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
            {formatDateBR(new Date(selectedDate + 'T12:00:00'))}
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
          {courierDeliveries.map((delivery, index) => {
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
                        #{delivery.order_number || delivery.external_order_id || `${index + 1}`}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                        {formatDateTime(delivery.delivery_date).split(' ')[1] || ''}
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
                    {authenticatedCourier.name} — {formatDateBR(new Date(selectedDate + 'T12:00:00'))}
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
