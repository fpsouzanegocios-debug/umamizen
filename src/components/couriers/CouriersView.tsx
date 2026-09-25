import React, { useState, useMemo, useEffect } from 'react';
import { 
  Bike, 
  DollarSign, 
  CreditCard, 
  Banknote, 
  MapPin, 
  AlertCircle, 
  Plus, 
  Edit3, 
  Check, 
  UserCheck,
  Search,
  X,
  Trash2,
  Calendar,
  RotateCcw,
  Clock,
  ChevronDown,
  ChevronUp,
  Table,
  LayoutGrid
} from 'lucide-react';
import { Courier, Delivery, Order, NeighborhoodRate, SystemSettings, DateRange, CourierDailyPayment } from '../../types';
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { isDateInRange, getOperationalDateKey, getLocalDateKey, formatDateBR } from '../../lib/dateUtils';
import { supabase } from '../../lib/supabase';
import { calculateDeliveryRates } from '../../lib/calculations';
import { normalizeNeighborhoodName } from '../../lib/neighborhoodMatcher';
import { syncNeighborhoodRateToOrders } from '../../lib/neighborhoodSync';
import { DateRangePicker } from '../common/DateRangePicker';
import { DeliveryCreateModal } from './DeliveryCreateModal';
import { CourierPaymentModal } from './CourierPaymentModal';
import { ReconciliationDetailModal, ReconciliationModalType, ReconciliationItem } from './ReconciliationDetailModal';

interface CouriersViewProps {
  couriers: Courier[];
  deliveries: Delivery[];
  orders: Order[];
  neighborhoodRates: NeighborhoodRate[];
  settings: SystemSettings;
  onRefresh: () => void;
  selectedMonth: number;
  selectedYear: number;
  onMonthChange?: (month: number) => void;
  onYearChange?: (year: number) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
}

export const CouriersView: React.FC<CouriersViewProps> = ({
  couriers,
  deliveries,
  orders,
  neighborhoodRates,
  settings,
  onRefresh,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  dateRange,
  onDateRangeChange
}) => {
  const [selectedCourierName, setSelectedCourierName] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newCourierName, setNewCourierName] = useState<string>('');
  const [newCourierPhone, setNewCourierPhone] = useState<string>('');
  const [newCourierPix, setNewCourierPix] = useState<string>('');
  const [showAddDeliveryModal, setShowAddDeliveryModal] = useState<boolean>(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [editDeliveryRate, setEditDeliveryRate] = useState<number>(8.00);
  const [updateOfficialRate, setUpdateOfficialRate] = useState<boolean>(true);
  const [deletingDelivery, setDeletingDelivery] = useState<Delivery | null>(null);
  const [isDeletingDelivery, setIsDeletingDelivery] = useState<boolean>(false);
  const [reconciliationModalType, setReconciliationModalType] = useState<ReconciliationModalType | null>(null);

  // Daily Settlement / Payments state (Section 16)
  const [dailyPayments, setDailyPayments] = useState<CourierDailyPayment[]>([]);
  const [paymentModalData, setPaymentModalData] = useState<{
    courierName: string;
    courier?: Courier | null;
    dateStr: string;
    dayDeliveries: Delivery[];
    existingPayment?: CourierDailyPayment | null;
    initialRetainedCash?: number;
  } | null>(null);
  const [settlementFilter, setSettlementFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [settlementViewMode, setSettlementViewMode] = useState<'table' | 'cards'>('table');
  const [settlementCollapsed, setSettlementCollapsed] = useState<boolean>(false);

  // Retained cash input overrides state: keyed by `${dateStr}__${courierName.toLowerCase()}`
  const [retainedCashInputs, setRetainedCashInputs] = useState<Record<string, string>>({});
  const [retainedCashOverrides, setRetainedCashOverrides] = useState<Record<string, number>>({});

  // Fetch registered courier payments from database
  const fetchDailyPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('courier_daily_payments')
        .select('*');
      if (error) {
        console.error('Erro ao buscar pagamentos de diárias:', error);
      } else if (data) {
        setDailyPayments(data);
      }
    } catch (err) {
      console.error('Falha ao consultar courier_daily_payments:', err);
    }
  };

  const saveRetainedCashToDb = async (item: {
    dateStr: string;
    courierName: string;
    courier?: Courier | null;
    totalDeliveries: number;
    baseTotal: number;
    additionalsTotal: number;
    payment?: CourierDailyPayment | null;
  }, newValue: number) => {
    try {
      const isDaniel = item.courierName.toLowerCase().includes('daniel');
      if (!isDaniel) return;

      const gross = item.baseTotal + item.additionalsTotal;
      const netTotal = gross - newValue;

      const payload: any = {
        courier_id: item.courier?.id || null,
        courier_name: item.courierName,
        payment_date: item.dateStr,
        delivery_count: item.totalDeliveries,
        total_deliveries: item.totalDeliveries,
        base_total: item.baseTotal,
        base_amount: item.baseTotal,
        additional_total: item.additionalsTotal,
        additional_amount: item.additionalsTotal,
        retained_cash: newValue,
        total_amount: netTotal,
        updated_at: new Date().toISOString()
      };

      if (item.payment) {
        payload.id = item.payment.id;
        payload.payment_method = item.payment.payment_method || 'Pix';
        payload.is_paid = item.payment.is_paid || false;
        payload.paid_amount = item.payment.paid_amount ?? (netTotal > 0 ? netTotal : 0);
        payload.total_paid = item.payment.total_paid ?? (netTotal > 0 ? netTotal : 0);
        payload.notes = item.payment.notes || '';
      } else {
        payload.payment_method = 'Pix';
        payload.is_paid = false;
        payload.paid_amount = netTotal > 0 ? netTotal : 0;
        payload.total_paid = netTotal > 0 ? netTotal : 0;
        payload.notes = '';
      }

      const { data, error } = await supabase
        .from('courier_daily_payments')
        .upsert(payload, { onConflict: 'courier_name,payment_date' })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Erro ao salvar dinheiro retido no banco:', error);
      } else if (data) {
        setDailyPayments(prev => {
          const idx = prev.findIndex(
            p => p.payment_date?.slice(0, 10) === item.dateStr && p.courier_name.toLowerCase() === item.courierName.toLowerCase()
          );
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...data };
            return copy;
          }
          return [...prev, data];
        });
      }
    } catch (err) {
      console.error('Falha ao salvar dinheiro retido:', err);
    }
  };

  const handleRetainedCashChange = (item: any, valStr: string) => {
    const key = `${item.dateStr}__${item.courierName.toLowerCase()}`;
    setRetainedCashInputs(prev => ({ ...prev, [key]: valStr }));
    const num = parseFloat(valStr) || 0;
    setRetainedCashOverrides(prev => ({ ...prev, [key]: num }));
  };

  const handleRetainedCashBlur = (item: any) => {
    const key = `${item.dateStr}__${item.courierName.toLowerCase()}`;
    const num = retainedCashOverrides[key] !== undefined ? retainedCashOverrides[key] : item.retainedCash;
    saveRetainedCashToDb(item, num);
  };

  const handleResetToOrdersCash = (item: any) => {
    const key = `${item.dateStr}__${item.courierName.toLowerCase()}`;
    const ordersVal = item.ordersCashTotal || 0;
    setRetainedCashInputs(prev => ({ ...prev, [key]: String(ordersVal) }));
    setRetainedCashOverrides(prev => ({ ...prev, [key]: ordersVal }));
    saveRetainedCashToDb(item, ordersVal);
  };

  // Multi-day selection state for automatic summation
  const [selectedSettlementKeys, setSelectedSettlementKeys] = useState<Set<string>>(new Set());

  const toggleSelectSettlement = (key: string) => {
    setSelectedSettlementKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSelectAllSettlements = () => {
    if (selectedSettlementKeys.size === displayedSettlements.length && displayedSettlements.length > 0) {
      setSelectedSettlementKeys(new Set());
    } else {
      const allKeys = new Set(displayedSettlements.map(s => `${s.dateStr}_${s.courierName.toLowerCase()}`));
      setSelectedSettlementKeys(allKeys);
    }
  };

  const selectOnlyPendingSettlements = () => {
    const pendingKeys = new Set(
      displayedSettlements
        .filter(s => !s.isPaid)
        .map(s => `${s.dateStr}_${s.courierName.toLowerCase()}`)
    );
    setSelectedSettlementKeys(pendingKeys);
  };

  const clearSelectedSettlements = () => {
    setSelectedSettlementKeys(new Set());
  };

  useEffect(() => {
    fetchDailyPayments();
  }, []);

  const handleConfirmDeleteDelivery = async () => {
    if (!deletingDelivery) return;
    setIsDeletingDelivery(true);
    try {
      const { error } = await supabase
        .from('deliveries')
        .delete()
        .eq('id', deletingDelivery.id);

      if (error) throw error;

      setDeletingDelivery(null);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao excluir entrega: ' + err.message);
    } finally {
      setIsDeletingDelivery(false);
    }
  };

  // Pre-index orders by external_order_id and order_number for fast lookup
  const ordersMap = useMemo(() => {
    const map = new Map<string, Order>();
    orders.forEach((o) => {
      if (o.external_order_id) map.set(o.external_order_id, o);
      if (o.order_number) map.set(o.order_number, o);
    });
    return map;
  }, [orders]);

  // Filter deliveries by dateRange (or month) and selected courier
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      if (dateRange) {
        if (!isDateInRange(d.delivery_date, dateRange)) return false;
      } else {
        const opKey = getOperationalDateKey(d.delivery_date);
        if (opKey && /^\d{4}-\d{2}-\d{2}$/.test(opKey)) {
          const [y, m] = opKey.split('-').map(Number);
          if (m !== selectedMonth || y !== selectedYear) {
            return false;
          }
        } else {
          const dt = new Date(d.delivery_date);
          if (dt.getMonth() + 1 !== selectedMonth || dt.getFullYear() !== selectedYear) {
            return false;
          }
        }
      }
      if (selectedCourierName !== 'all' && d.courier_name !== selectedCourierName) {
        return false;
      }
      return true;
    });
  }, [deliveries, dateRange, selectedMonth, selectedYear, selectedCourierName]);

  // Group deliveries by Operational Date (YYYY-MM-DD) and Courier for daily settlement / payment control
  const dailySettlements = useMemo(() => {
    const map = new Map<string, {
      dateStr: string;
      courierName: string;
      courier?: Courier | null;
      deliveries: Delivery[];
      totalDeliveries: number;
      baseTotal: number;
      additionalsTotal: number;
      grossTotal: number;
      ordersCashTotal: number;
      retainedCash: number;
      retainedCashInputVal: string;
      totalToPay: number;
      isDaniel: boolean;
      payment?: CourierDailyPayment | null;
      isPaid: boolean;
    }>();

    filteredDeliveries.forEach((d) => {
      if (!d.delivery_date || !d.courier_name) return;
      const dateStr = getOperationalDateKey(d.delivery_date);
      if (!dateStr) return;
      const key = `${dateStr}__${d.courier_name.toLowerCase()}`;

      if (!map.has(key)) {
        const courierObj = couriers.find((c) => c.name.toLowerCase() === d.courier_name.toLowerCase());
        const payment = dailyPayments.find(
          (p) => (p.payment_date?.slice(0, 10) === dateStr) && p.courier_name.toLowerCase() === d.courier_name.toLowerCase()
        );

        map.set(key, {
          dateStr,
          courierName: d.courier_name,
          courier: courierObj,
          deliveries: [],
          totalDeliveries: 0,
          baseTotal: 0,
          additionalsTotal: 0,
          grossTotal: 0,
          ordersCashTotal: 0,
          retainedCash: 0,
          retainedCashInputVal: '0',
          totalToPay: 0,
          isDaniel: d.courier_name.toLowerCase().includes('daniel'),
          payment,
          isPaid: Boolean(payment && payment.is_paid)
        });
      }

      const item = map.get(key)!;
      item.deliveries.push(d);
      item.totalDeliveries++;
      item.baseTotal += Number(d.base_rate) || 8.00;
      item.additionalsTotal += Number(d.additional_rate) || 0;
    });

    // Compute cash breakdown, discount and total for each item
    map.forEach((item, key) => {
      const isDaniel = item.isDaniel;

      let ordersCashTotal = 0;
      item.deliveries.forEach((d) => {
        const order = ordersMap.get(d.external_order_id);
        const payMethod = (order?.final_payment_method || order?.original_payment_method || d.payment_method || '').toLowerCase();
        if (payMethod.includes('dinheiro') || payMethod === 'cash') {
          ordersCashTotal += Number(order?.gross_amount ?? d.order_amount ?? 0);
        }
      });

      const grossTotal = item.baseTotal + item.additionalsTotal;
      item.grossTotal = grossTotal;
      item.ordersCashTotal = ordersCashTotal;

      let effectiveRetained = 0;
      if (isDaniel) {
        if (retainedCashOverrides[key] !== undefined) {
          effectiveRetained = retainedCashOverrides[key];
        } else if (item.payment?.retained_cash !== undefined && item.payment?.retained_cash !== null) {
          effectiveRetained = Number(item.payment.retained_cash);
        } else {
          effectiveRetained = ordersCashTotal;
        }
      }

      item.retainedCash = effectiveRetained;
      item.retainedCashInputVal = retainedCashInputs[key] ?? (effectiveRetained > 0 ? String(effectiveRetained) : '0');
      item.totalToPay = isDaniel ? (grossTotal - effectiveRetained) : grossTotal;
    });

    return Array.from(map.values()).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [filteredDeliveries, couriers, dailyPayments, ordersMap, retainedCashOverrides, retainedCashInputs]);

  // Totals for the Couriers Module - com dedução dos pagamentos já efetuados e desconto do Daniel
  const courierStats = useMemo(() => {
    const totalDeliveries = filteredDeliveries.length;
    const baseTotal = filteredDeliveries.reduce((acc, d) => acc + Number(d.base_rate || 8.00), 0);
    const additionalsTotal = filteredDeliveries.reduce((acc, d) => acc + Number(d.additional_rate || 0), 0);
    const totalGross = baseTotal + additionalsTotal;

    let totalPaid = 0;
    let paidDeliveriesCount = 0;
    let pendingToPay = 0;
    let pendingDeliveriesCount = 0;

    dailySettlements.forEach((item) => {
      if (item.isPaid) {
        totalPaid += Number(item.payment?.paid_amount) || Number(item.payment?.total_paid) || item.totalToPay;
        paidDeliveriesCount += item.totalDeliveries;
      } else {
        pendingToPay += Math.max(0, item.totalToPay);
        pendingDeliveriesCount += item.totalDeliveries;
      }
    });

    return {
      totalDeliveries,
      baseTotal,
      additionalsTotal,
      totalGross,
      totalPaid,
      pendingToPay,
      paidDeliveriesCount,
      pendingDeliveriesCount
    };
  }, [filteredDeliveries, dailySettlements]);

  // Counts and filtered list for daily settlements
  const pendingSettlementsCount = useMemo(() => {
    return dailySettlements.filter((s) => !s.isPaid).length;
  }, [dailySettlements]);

  const paidSettlementsCount = useMemo(() => {
    return dailySettlements.filter((s) => s.isPaid).length;
  }, [dailySettlements]);

  const displayedSettlements = useMemo(() => {
    if (settlementFilter === 'pending') {
      return dailySettlements.filter((s) => !s.isPaid);
    }
    if (settlementFilter === 'paid') {
      return dailySettlements.filter((s) => s.isPaid);
    }
    return dailySettlements;
  }, [dailySettlements, settlementFilter]);

  // Automatic summation calculation for multi-day selection
  const selectedSettlementsSummary = useMemo(() => {
    if (selectedSettlementKeys.size === 0) return null;

    const selectedItems = displayedSettlements.filter((item) =>
      selectedSettlementKeys.has(`${item.dateStr}_${item.courierName.toLowerCase()}`)
    );

    if (selectedItems.length === 0) return null;

    let totalDeliveries = 0;
    let baseTotal = 0;
    let additionalsTotal = 0;
    let grossTotal = 0;
    let retainedCashTotal = 0;
    let totalToPay = 0;
    let paidCount = 0;
    let pendingCount = 0;

    selectedItems.forEach((item) => {
      totalDeliveries += item.totalDeliveries;
      baseTotal += item.baseTotal;
      additionalsTotal += item.additionalsTotal;
      grossTotal += item.grossTotal;
      retainedCashTotal += item.retainedCash || 0;
      totalToPay += item.totalToPay;
      if (item.isPaid) paidCount++;
      else pendingCount++;
    });

    return {
      count: selectedItems.length,
      totalDeliveries,
      baseTotal,
      additionalsTotal,
      grossTotal,
      retainedCashTotal,
      totalToPay,
      paidCount,
      pendingCount
    };
  }, [displayedSettlements, selectedSettlementKeys]);

  // Reconciliation Cash / Card breakdown (Section 15)
  // Cross deliveries with orders to find what was paid directly in physical money or POS card machine
  const reconciliation = useMemo(() => {
    let cashCount = 0;
    let cashTotal = 0;

    let debitCount = 0;
    let debitTotal = 0;

    let creditCount = 0;
    let creditTotal = 0;

    const cashItems: ReconciliationItem[] = [];
    const debitItems: ReconciliationItem[] = [];
    const creditItems: ReconciliationItem[] = [];

    filteredDeliveries.forEach((d) => {
      const order = ordersMap.get(d.external_order_id) || (d.order_number ? ordersMap.get(d.order_number) : undefined);

      const rawPayMethod = order?.final_payment_method || order?.original_payment_method || d.payment_method || '';
      const payMethod = rawPayMethod.toLowerCase();
      const amount = Number(order?.gross_amount ?? d.order_amount ?? 0);

      const item: ReconciliationItem = {
        id: d.id,
        orderNumber: order?.order_number || d.order_number || d.external_order_id,
        externalOrderId: d.external_order_id,
        customerName: order?.customer_name || 'Cliente Balcão / Avulso',
        customerPhone: order?.customer_phone || (order?.original_imported_data?.Telefone) || undefined,
        neighborhood: d.neighborhood_name || order?.neighborhood_name || 'Bairro a definir',
        courierName: d.courier_name,
        deliveryDate: d.delivery_date,
        amount,
        paymentMethod: rawPayMethod || 'Não informado',
        channel: order?.channel || (d.external_order_id?.startsWith('RET') ? 'Retorno' : 'Manual'),
        notes: order?.notes || d.notes || undefined,
        changeFor: Number(order?.original_imported_data?.['Troco para']) || undefined,
        order: order || null,
        delivery: d
      };

      // Check physical cash
      if (payMethod.includes('dinheiro') || payMethod === 'cash') {
        cashCount++;
        cashTotal += amount;
        cashItems.push(item);
      } else if (payMethod.includes('débito') || payMethod.includes('debito')) {
        debitCount++;
        debitTotal += amount;
        debitItems.push(item);
      } else if (payMethod.includes('crédito') || payMethod.includes('credito')) {
        creditCount++;
        creditTotal += amount;
        creditItems.push(item);
      }
    });

    const cardCount = debitCount + creditCount;
    const cardTotal = debitTotal + creditTotal;
    const cardItems: ReconciliationItem[] = [...debitItems, ...creditItems];
    const totalReceivedInHand = cashTotal + cardTotal;

    return {
      cashCount,
      cashTotal,
      cashItems,
      debitCount,
      debitTotal,
      debitItems,
      creditCount,
      creditTotal,
      creditItems,
      cardCount,
      cardTotal,
      cardItems,
      totalReceivedInHand
    };
  }, [filteredDeliveries, ordersMap]);

  const handleCreateCourier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourierName.trim()) return;

    try {
      const { error } = await supabase.from('couriers').insert({
        name: newCourierName.trim(),
        phone: newCourierPhone.trim() || null,
        pix_key: newCourierPix.trim() || null,
        is_active: true
      });

      if (error) throw error;

      setNewCourierName('');
      setNewCourierPhone('');
      setNewCourierPix('');
      setShowAddModal(false);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao cadastrar motoboy: ' + err.message);
    }
  };

  const handleOpenEditModal = (d: Delivery) => {
    setEditingDelivery(d);
    const matched = neighborhoodRates.find(
      (r) => r.name.trim().toLowerCase() === (d.neighborhood_name || '').trim().toLowerCase()
    );
    const initialRate = Number(
      d.neighborhood_total_rate !== undefined && d.neighborhood_total_rate !== null
        ? d.neighborhood_total_rate
        : (matched?.total_rate || d.courier_fee || 8.00)
    );
    setEditDeliveryRate(initialRate);
    setUpdateOfficialRate(true);
  };

  const handleNeighborhoodChange = (newName: string) => {
    if (!editingDelivery) return;
    setEditingDelivery({ ...editingDelivery, neighborhood_name: newName });
    const norm = normalizeNeighborhoodName(newName);
    const matched = neighborhoodRates.find(
      (r) => normalizeNeighborhoodName(r.name) === norm || r.name.toLowerCase() === newName.toLowerCase().trim()
    );
    if (matched) {
      setEditDeliveryRate(Number(matched.total_rate));
    }
  };

  const handleUpdateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDelivery) return;

    try {
      const baseRate = Number(settings.courier_base_rate || 8.00);
      const totalRate = Number(editDeliveryRate);
      const rates = calculateDeliveryRates(totalRate, baseRate);
      const neighborhoodName = (editingDelivery.neighborhood_name || '').trim();
      const normNeighborhood = normalizeNeighborhoodName(neighborhoodName);

      // 1. Find if neighborhood exists in catalog
      let matchedRate = neighborhoodRates.find(
        (r) => normalizeNeighborhoodName(r.name) === normNeighborhood || 
               r.name.toLowerCase() === neighborhoodName.toLowerCase()
      );

      // 2. If updateOfficialRate is enabled, update or insert into neighborhood_rates
      if (updateOfficialRate && neighborhoodName) {
        if (matchedRate) {
          const { error: updateErr } = await supabase
            .from('neighborhood_rates')
            .update({
              total_rate: totalRate,
              base_rate: baseRate,
              additional_rate: rates.additionalRate,
              is_active: true
            })
            .eq('id', matchedRate.id);

          if (updateErr) console.error('Erro ao atualizar taxa do bairro:', updateErr);
        } else {
          const { data: newRate, error: insertErr } = await supabase
            .from('neighborhood_rates')
            .insert({
              name: neighborhoodName.toUpperCase(),
              normalized_name: normNeighborhood,
              total_rate: totalRate,
              base_rate: baseRate,
              additional_rate: rates.additionalRate,
              is_blocked: false,
              is_active: true
            })
            .select()
            .single();

          if (insertErr) {
            console.error('Erro ao cadastrar novo bairro:', insertErr);
          } else if (newRate) {
            matchedRate = newRate;
          }
        }
        if (matchedRate) {
          await syncNeighborhoodRateToOrders(matchedRate, undefined, settings);
        }
      }

      // 3. Update deliveries table
      const { error: deliveryError } = await supabase
        .from('deliveries')
        .update({
          courier_name: editingDelivery.courier_name,
          neighborhood_name: neighborhoodName,
          neighborhood_rate_id: matchedRate ? matchedRate.id : editingDelivery.neighborhood_rate_id,
          neighborhood_total_rate: totalRate,
          base_rate: rates.baseRate,
          additional_rate: rates.additionalRate,
          courier_fee: rates.courierFee,
          is_manually_edited: true,
          notes: editingDelivery.notes
        })
        .eq('id', editingDelivery.id);

      if (deliveryError) throw deliveryError;

      // 4. Update matching order delivery_fee in orders table
      if (editingDelivery.external_order_id) {
        await supabase
          .from('orders')
          .update({
            delivery_fee: totalRate
          })
          .eq('external_order_id', editingDelivery.external_order_id);
      }

      setEditingDelivery(null);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao atualizar entrega: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bike size={28} color="#F43F5E" />
            Controle de Motoboys e Entregas
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Cálculo de diárias (Base R$ 8,00 + Adicionais dos Bairros) e prestação de contas física
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {dateRange && onDateRangeChange && (
            <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
          )}

          <select
            className="select"
            value={selectedCourierName}
            onChange={(e) => setSelectedCourierName(e.target.value)}
            style={{ width: '200px' }}
          >
            <option value="all">Todos os Motoboys</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          <button 
            type="button"
            onClick={() => setShowAddDeliveryModal(true)} 
            className="btn btn-primary"
            style={{ backgroundColor: '#F43F5E', borderColor: '#F43F5E' }}
            title="Lançar retorno ao cliente, corrida avulsa ou viagem extra"
          >
            <RotateCcw size={15} />
            <span>+ Adicionar Entrega (Retorno)</span>
          </button>

          <button type="button" onClick={() => setShowAddModal(true)} className="btn btn-secondary">
            <Plus size={15} />
            <span>Cadastrar Motoboy</span>
          </button>
        </div>
      </div>

      {/* Grid: 1. Payment Summary + 2. Reconciliation Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Payment to Couriers (Section 13) - Descontando o já pago */}
        <div className="card">
          <div className="card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38BDF8' }}>
              <DollarSign size={20} />
              <span>Resumo Financeiro do Entregador</span>
            </div>
            <span className="badge badge-info">{selectedCourierName === 'all' ? 'Todos' : selectedCourierName}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '12px', marginBottom: '14px' }}>
            <div style={{ backgroundColor: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Corridas</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{courierStats.totalDeliveries}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Base: {formatCurrency(courierStats.baseTotal)}
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 600 }}>JÁ PAGO (DIÁRIAS)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10B981' }}>
                {formatCurrency(courierStats.totalPaid)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {courierStats.paidDeliveriesCount} entregas quitadas
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: courierStats.pendingToPay > 0 ? '#FBBF24' : '#10B981', fontWeight: 600 }}>
                SALDO PENDENTE
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: courierStats.pendingToPay > 0 ? '#FBBF24' : '#10B981' }}>
                {formatCurrency(courierStats.pendingToPay)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {courierStats.pendingDeliveriesCount} a acertar
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: courierStats.pendingToPay > 0 ? 'rgba(251, 191, 36, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            border: courierStats.pendingToPay > 0 ? '1px solid rgba(251, 191, 36, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: courierStats.pendingToPay > 0 ? '#FBBF24' : '#34D399', fontWeight: 700 }}>
                {courierStats.pendingToPay > 0 ? 'SALDO A PAGAR AO MOTOBOY (PENDENTE):' : 'TODAS AS DIÁRIAS PAGAS NO PERÍODO:'}
              </span>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Total gerado: {formatCurrency(courierStats.totalGross)} | Descontado pago: -{formatCurrency(courierStats.totalPaid)}
              </div>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: courierStats.pendingToPay > 0 ? '#FBBF24' : '#34D399' }}>
              {formatCurrency(courierStats.pendingToPay)}
            </div>
          </div>
        </div>

        {/* Section 15: Prestação de Contas Dinheiro / Maquininha */}
        <div className="card">
          <div className="card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F59E0B' }}>
              <Banknote size={20} />
              <span>Conferência de Caixa do Motoboy</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dinheiro & Maquininha</span>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Valores físicos recebidos pelo entregador em mãos para conferência no fechamento do turno.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
            {/* Dinheiro */}
            <div 
              onClick={() => setReconciliationModalType('cash')}
              role="button"
              tabIndex={0}
              style={{ 
                backgroundColor: 'var(--bg-input)', 
                padding: '10px 12px', 
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: '1px solid rgba(52, 211, 153, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#34D399';
                e.currentTarget.style.backgroundColor = 'rgba(52, 211, 153, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(52, 211, 153, 0.2)';
                e.currentTarget.style.backgroundColor = 'var(--bg-input)';
              }}
              title="Clique para abrir a lista detalhada de pedidos em dinheiro deste período"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.72rem', color: '#34D399', fontWeight: 700 }}>DINHEIRO</div>
                <span style={{ fontSize: '0.65rem', color: '#34D399', opacity: 0.9 }}>Ver pedidos ↗</span>
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '2px', color: '#F8FAFC' }}>
                {formatCurrency(reconciliation.cashTotal)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {reconciliation.cashCount} pedidos
              </div>
            </div>

            {/* Débito */}
            <div 
              onClick={() => setReconciliationModalType('debit')}
              role="button"
              tabIndex={0}
              style={{ 
                backgroundColor: 'var(--bg-input)', 
                padding: '10px 12px', 
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: '1px solid rgba(56, 189, 248, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#38BDF8';
                e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.2)';
                e.currentTarget.style.backgroundColor = 'var(--bg-input)';
              }}
              title="Clique para abrir a lista detalhada de pedidos em débito deste período"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.72rem', color: '#38BDF8', fontWeight: 700 }}>DÉBITO</div>
                <span style={{ fontSize: '0.65rem', color: '#38BDF8', opacity: 0.9 }}>Ver pedidos ↗</span>
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '2px', color: '#F8FAFC' }}>
                {formatCurrency(reconciliation.debitTotal)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {reconciliation.debitCount} pedidos
              </div>
            </div>

            {/* Crédito */}
            <div 
              onClick={() => setReconciliationModalType('credit')}
              role="button"
              tabIndex={0}
              style={{ 
                backgroundColor: 'var(--bg-input)', 
                padding: '10px 12px', 
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: '1px solid rgba(168, 85, 247, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#A855F7';
                e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.2)';
                e.currentTarget.style.backgroundColor = 'var(--bg-input)';
              }}
              title="Clique para abrir a lista detalhada de pedidos em crédito deste período"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.72rem', color: '#A855F7', fontWeight: 700 }}>CRÉDITO</div>
                <span style={{ fontSize: '0.65rem', color: '#A855F7', opacity: 0.9 }}>Ver pedidos ↗</span>
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '2px', color: '#F8FAFC' }}>
                {formatCurrency(reconciliation.creditTotal)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {reconciliation.creditCount} pedidos
              </div>
            </div>
          </div>

          <div 
            onClick={() => setReconciliationModalType('card')}
            role="button"
            tabIndex={0}
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#F59E0B';
              e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.18)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.3)';
              e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
            }}
            title="Clique para abrir a lista de todos os pedidos em cartão na maquininha (débito + crédito)"
          >
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#FBBF24', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>TOTAL CARTÃO (Débito + Crédito):</span>
                <span style={{ fontSize: '0.68rem', opacity: 0.9 }}>Ver lista completa ↗</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {reconciliation.cardCount} pedidos na maquininha
              </span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#FBBF24' }}>
              {formatCurrency(reconciliation.cardTotal)}
            </div>
          </div>
        </div>
      </div>

      {/* Daily Settlements & Payments Control (Novo Controle de Diárias por Dia) */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: settlementCollapsed ? 0 : '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10B981'
            }}>
              <Calendar size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
                Controle de Pagamento de Diárias por Dia
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                {dailySettlements.length} {dailySettlements.length === 1 ? 'dia apurado' : 'dias apurados'} • {paidSettlementsCount} pagos • {pendingSettlementsCount} pendentes
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Status Filter Tabs */}
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-input)', padding: '3px', borderRadius: '8px', gap: '2px' }}>
              <button
                type="button"
                onClick={() => setSettlementFilter('all')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: settlementFilter === 'all' ? 'var(--bg-card)' : 'transparent',
                  color: settlementFilter === 'all' ? '#F8FAFC' : 'var(--text-muted)'
                }}
              >
                Todos ({dailySettlements.length})
              </button>
              <button
                type="button"
                onClick={() => setSettlementFilter('pending')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: settlementFilter === 'pending' ? 'rgba(251, 191, 36, 0.2)' : 'transparent',
                  color: settlementFilter === 'pending' ? '#FBBF24' : 'var(--text-muted)'
                }}
              >
                ⏳ Pendentes ({pendingSettlementsCount})
              </button>
              <button
                type="button"
                onClick={() => setSettlementFilter('paid')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: settlementFilter === 'paid' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                  color: settlementFilter === 'paid' ? '#10B981' : 'var(--text-muted)'
                }}
              >
                ✅ Pagos ({paidSettlementsCount})
              </button>
            </div>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-input)', padding: '3px', borderRadius: '8px', gap: '2px' }}>
              <button
                type="button"
                onClick={() => { setSettlementViewMode('table'); setSettlementCollapsed(false); }}
                title="Modo Tabela Resumida (ideal para mês inteiro)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: settlementViewMode === 'table' ? 'var(--bg-card)' : 'transparent',
                  color: settlementViewMode === 'table' ? '#38BDF8' : 'var(--text-muted)'
                }}
              >
                <Table size={13} />
                <span>Tabela</span>
              </button>
              <button
                type="button"
                onClick={() => { setSettlementViewMode('cards'); setSettlementCollapsed(false); }}
                title="Modo Cards Detalhados"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: settlementViewMode === 'cards' ? 'var(--bg-card)' : 'transparent',
                  color: settlementViewMode === 'cards' ? '#38BDF8' : 'var(--text-muted)'
                }}
              >
                <LayoutGrid size={13} />
                <span>Cards</span>
              </button>
            </div>

            {/* Quick Multi-select Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={toggleSelectAllSettlements}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.74rem', padding: '4px 8px' }}
                title="Selecionar ou desmarcar todos os dias da listagem"
              >
                {selectedSettlementKeys.size === displayedSettlements.length && displayedSettlements.length > 0
                  ? 'Desmarcar Todos'
                  : 'Selecionar Todos'}
              </button>
              {pendingSettlementsCount > 0 && (
                <button
                  type="button"
                  onClick={selectOnlyPendingSettlements}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem', padding: '4px 8px', color: '#FBBF24', borderColor: 'rgba(251, 191, 36, 0.3)' }}
                  title="Selecionar todos os dias pendentes de pagamento"
                >
                  Pendentes ({pendingSettlementsCount})
                </button>
              )}
              {selectedSettlementKeys.size > 0 && (
                <button
                  type="button"
                  onClick={clearSelectedSettlements}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem', padding: '4px 8px', color: '#F43F5E', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                  title="Limpar seleção"
                >
                  Limpar ({selectedSettlementKeys.size})
                </button>
              )}
            </div>

            {/* Collapse / Expand Button */}
            <button
              type="button"
              onClick={() => setSettlementCollapsed(!settlementCollapsed)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px' }}
              title={settlementCollapsed ? 'Expandir painel de diárias' : 'Recolher painel para liberar espaço na tela'}
            >
              {settlementCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              <span>{settlementCollapsed ? 'Expandir' : 'Recolher'}</span>
            </button>
          </div>
        </div>

        {/* When not collapsed: content */}
        {!settlementCollapsed && (
          <div>
            {/* Somatória Automática dos Dias Selecionados */}
            {selectedSettlementsSummary && (
              <div style={{
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '14px',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      backgroundColor: 'rgba(56, 189, 248, 0.2)',
                      color: '#38BDF8',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Check size={13} />
                      {selectedSettlementsSummary.count} {selectedSettlementsSummary.count === 1 ? 'DIA SELECIONADO' : 'DIAS SELECIONADOS'}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F8FAFC' }}>
                      Somatória Automática dos Dias Selecionados:
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ({selectedSettlementsSummary.pendingCount} pendentes • {selectedSettlementsSummary.paidCount} pagos)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={clearSelectedSettlements}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                  >
                    Desmarcar Todos
                  </button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: selectedSettlementsSummary.retainedCashTotal > 0 ? 'repeat(auto-fit, minmax(130px, 1fr))' : 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '8px',
                  backgroundColor: 'var(--bg-card)',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>CORRIDAS</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F8FAFC', marginTop: '2px' }}>
                      {selectedSettlementsSummary.totalDeliveries}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>BASE (R$ 8)</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC', marginTop: '2px' }}>
                      {formatCurrency(selectedSettlementsSummary.baseTotal)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>ADICIONAIS</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FBBF24', marginTop: '2px' }}>
                      +{formatCurrency(selectedSettlementsSummary.additionalsTotal)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL DIÁRIA (BRUTO)</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F8FAFC', marginTop: '2px' }}>
                      {formatCurrency(selectedSettlementsSummary.grossTotal)}
                    </div>
                  </div>

                  {selectedSettlementsSummary.retainedCashTotal > 0 && (
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#F43F5E', fontWeight: 600 }}>DINHEIRO RETIDO (DANIEL)</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F43F5E', marginTop: '2px' }}>
                        -{formatCurrency(selectedSettlementsSummary.retainedCashTotal)}
                      </div>
                    </div>
                  )}

                  <div style={{
                    backgroundColor: 'rgba(56, 189, 248, 0.12)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(56, 189, 248, 0.35)'
                  }}>
                    <div style={{ fontSize: '0.68rem', color: selectedSettlementsSummary.totalToPay < 0 ? '#F43F5E' : '#38BDF8', fontWeight: 700 }}>
                      LÍQUIDO A PAGAR TOTAL
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: selectedSettlementsSummary.totalToPay < 0 ? '#F43F5E' : '#38BDF8', marginTop: '2px' }}>
                      {formatCurrency(selectedSettlementsSummary.totalToPay)}
                    </div>
                    {selectedSettlementsSummary.totalToPay < 0 && (
                      <div style={{ fontSize: '0.65rem', color: '#F43F5E', fontWeight: 700 }}>
                        Daniel deve devolver {formatCurrency(Math.abs(selectedSettlementsSummary.totalToPay))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {displayedSettlements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                Nenhum acerto de diária para o filtro selecionado ({settlementFilter === 'pending' ? 'sem pendências' : settlementFilter === 'paid' ? 'nenhum pago' : 'vazio'}).
              </div>
            ) : settlementViewMode === 'table' ? (
              /* Compact Table Mode */
              <div style={{ overflowX: 'auto', maxHeight: '440px', overflowY: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '38px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={displayedSettlements.length > 0 && selectedSettlementKeys.size === displayedSettlements.length}
                          onChange={toggleSelectAllSettlements}
                          title={selectedSettlementKeys.size === displayedSettlements.length ? 'Desmarcar todos' : 'Selecionar todos'}
                          style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                        />
                      </th>
                      <th>Data</th>
                      <th>Motoboy</th>
                      <th>Corridas</th>
                      <th>Base (R$ 8)</th>
                      <th>Adicionais</th>
                      <th>Total Diária (Bruto)</th>
                      <th>Dinheiro c/ Motoboy</th>
                      <th>Líquido a Pagar</th>
                      <th>Status</th>
                      <th>Forma Pgto</th>
                      <th style={{ textAlign: 'right' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedSettlements.map((item) => {
                      const isPaid = item.isPaid;
                      const formattedDate = item.dateStr.split('-').reverse().join('/');
                      const itemKey = `${item.dateStr}_${item.courierName.toLowerCase()}`;
                      const isSelected = selectedSettlementKeys.has(itemKey);

                      return (
                        <tr
                          key={`${item.dateStr}_${item.courierName}`}
                          style={{
                            backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.08)' : undefined,
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectSettlement(itemKey)}
                              style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                            />
                          </td>
                          <td style={{ fontWeight: 700, color: '#F8FAFC' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Calendar size={13} color="var(--text-muted)" />
                              <span>{formattedDate}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 600, color: '#38BDF8' }}>
                            {item.courierName}
                          </td>
                          <td>{item.totalDeliveries}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>
                            {formatCurrency(item.baseTotal)}
                          </td>
                          <td style={{ color: item.additionalsTotal > 0 ? '#FBBF24' : 'var(--text-muted)', fontWeight: 600 }}>
                            +{formatCurrency(item.additionalsTotal)}
                          </td>

                          {/* 1. Total Diária SEM desconto (Bruto: Base + Adicionais) */}
                          <td style={{ fontWeight: 700, color: '#F8FAFC' }}>
                            {formatCurrency(item.grossTotal)}
                          </td>

                          {/* 2. Dinheiro Retido dos Pedidos (Exclusivo Daniel) */}
                          <td>
                            {item.isDaniel ? (
                              <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <div style={{ position: 'relative', width: '96px' }}>
                                    <span style={{
                                      position: 'absolute',
                                      left: '6px',
                                      top: '50%',
                                      transform: 'translateY(-50%)',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      color: '#F43F5E',
                                      pointerEvents: 'none'
                                    }}>
                                      -R$
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={item.retainedCashInputVal}
                                      onChange={(e) => handleRetainedCashChange(item, e.target.value)}
                                      onBlur={() => handleRetainedCashBlur(item)}
                                      title="Dinheiro dos pedidos retido com Daniel (descontado do total da diária)"
                                      style={{
                                        width: '100%',
                                        padding: '3px 4px 3px 26px',
                                        backgroundColor: 'var(--bg-input)',
                                        border: '1px solid rgba(244, 63, 94, 0.45)',
                                        borderRadius: '6px',
                                        color: '#F43F5E',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        outline: 'none'
                                      }}
                                    />
                                  </div>
                                  {item.ordersCashTotal > 0 && item.retainedCash !== item.ordersCashTotal && (
                                    <button
                                      type="button"
                                      onClick={() => handleResetToOrdersCash(item)}
                                      title={`Restaurar valor dos pedidos em dinheiro deste dia: ${formatCurrency(item.ordersCashTotal)}`}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        padding: '2px',
                                        display: 'flex',
                                        alignItems: 'center'
                                      }}
                                    >
                                      <RotateCcw size={12} />
                                    </button>
                                  )}
                                </div>
                                {item.ordersCashTotal > 0 && (
                                  <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>
                                    pedidos: {formatCurrency(item.ordersCashTotal)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }} title="Desconto de dinheiro retido exclusivo para o Daniel">—</span>
                            )}
                          </td>

                          {/* 3. Total COM desconto (Líquido a pagar após abater o dinheiro em mãos) */}
                          <td style={{ fontWeight: 800 }}>
                            {item.isDaniel && item.retainedCash > 0 ? (
                              <div>
                                <span style={{ color: item.totalToPay < 0 ? '#F43F5E' : isPaid ? '#34D399' : '#38BDF8' }}>
                                  {formatCurrency(item.totalToPay)}
                                </span>
                                <div style={{ fontSize: '0.68rem', color: item.totalToPay < 0 ? '#F43F5E' : '#FB7185', fontWeight: 600 }}>
                                  {item.totalToPay < 0 ? `(devolver ${formatCurrency(Math.abs(item.totalToPay))})` : `(-${formatCurrency(item.retainedCash)})`}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: isPaid ? '#34D399' : '#38BDF8' }}>
                                {formatCurrency(item.totalToPay)}
                              </span>
                            )}
                          </td>

                          <td>
                            <span style={{
                              fontSize: '0.72rem',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontWeight: 700,
                              backgroundColor: isPaid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                              color: isPaid ? '#10B981' : '#FBBF24',
                              border: isPaid ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(251, 191, 36, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {isPaid ? <Check size={11} /> : <Clock size={11} />}
                              {isPaid ? 'PAGO' : 'PENDENTE'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {isPaid ? (item.payment?.payment_method || 'Pix') : '-'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => setPaymentModalData({
                                courierName: item.courierName,
                                courier: item.courier,
                                dateStr: item.dateStr,
                                dayDeliveries: item.deliveries,
                                existingPayment: item.payment,
                                initialRetainedCash: item.retainedCash
                              })}
                              className={isPaid ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}
                              style={isPaid ? { padding: '3px 8px', fontSize: '0.75rem' } : { backgroundColor: '#10B981', borderColor: '#10B981', padding: '3px 8px', fontSize: '0.75rem' }}
                            >
                              {isPaid ? <Edit3 size={12} /> : <DollarSign size={12} />}
                              <span>{isPaid ? 'Ver / Editar' : 'Marcar Pago'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)', borderTop: '2px solid var(--border-color)', fontWeight: 800 }}>
                      <td colSpan={3} style={{ color: '#F8FAFC', padding: '10px 12px' }}>
                        {selectedSettlementsSummary ? (
                          <span style={{ color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={13} />
                            SOMA SELECIONADA ({selectedSettlementsSummary.count} {selectedSettlementsSummary.count === 1 ? 'dia' : 'dias'}):
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>TOTAL VISÍVEL ({displayedSettlements.length} dias):</span>
                        )}
                      </td>
                      <td>
                        {selectedSettlementsSummary ? selectedSettlementsSummary.totalDeliveries : displayedSettlements.reduce((acc, s) => acc + s.totalDeliveries, 0)}
                      </td>
                      <td>
                        {formatCurrency(selectedSettlementsSummary ? selectedSettlementsSummary.baseTotal : displayedSettlements.reduce((acc, s) => acc + s.baseTotal, 0))}
                      </td>
                      <td style={{ color: '#FBBF24' }}>
                        +{formatCurrency(selectedSettlementsSummary ? selectedSettlementsSummary.additionalsTotal : displayedSettlements.reduce((acc, s) => acc + s.additionalsTotal, 0))}
                      </td>
                      <td style={{ color: '#F8FAFC' }}>
                        {formatCurrency(selectedSettlementsSummary ? selectedSettlementsSummary.grossTotal : displayedSettlements.reduce((acc, s) => acc + s.grossTotal, 0))}
                      </td>
                      <td style={{ color: '#F43F5E' }}>
                        {(() => {
                          const ret = selectedSettlementsSummary
                            ? selectedSettlementsSummary.retainedCashTotal
                            : displayedSettlements.reduce((acc, s) => acc + (s.retainedCash || 0), 0);
                          return ret > 0 ? `-${formatCurrency(ret)}` : '—';
                        })()}
                      </td>
                      <td style={{ color: '#38BDF8', fontSize: '0.95rem' }}>
                        {formatCurrency(selectedSettlementsSummary ? selectedSettlementsSummary.totalToPay : displayedSettlements.reduce((acc, s) => acc + s.totalToPay, 0))}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              /* Cards Mode */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }}>
                {displayedSettlements.map((item) => {
                  const isPaid = item.isPaid;
                  const formattedDate = item.dateStr.split('-').reverse().join('/');
                  const itemKey = `${item.dateStr}_${item.courierName.toLowerCase()}`;
                  const isSelected = selectedSettlementKeys.has(itemKey);

                  return (
                    <div
                      key={`${item.dateStr}_${item.courierName}`}
                      style={{
                        backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-input)',
                        border: isSelected
                          ? '1px solid #38BDF8'
                          : isPaid
                          ? '1px solid rgba(16, 185, 129, 0.4)'
                          : '1px solid rgba(251, 191, 36, 0.4)',
                        borderRadius: '10px',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectSettlement(itemKey)}
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          />
                          <div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F8FAFC' }}>
                              {item.courierName}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <Calendar size={13} />
                              <span>Data da Diária: <strong>{formattedDate}</strong></span>
                            </div>
                          </div>
                        </div>

                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '12px',
                          backgroundColor: isPaid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                          color: isPaid ? '#10B981' : '#FBBF24',
                          border: isPaid ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(251, 191, 36, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {isPaid ? <Check size={12} /> : <Clock size={12} />}
                          {isPaid ? 'PAGO' : 'PENDENTE'}
                        </span>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '8px',
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        fontSize: '0.75rem'
                      }}>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Corridas</div>
                          <div style={{ fontWeight: 700, color: '#F8FAFC' }}>{item.totalDeliveries}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Base (R$ 8)</div>
                          <div style={{ fontWeight: 600, color: '#F8FAFC' }}>{formatCurrency(item.baseTotal)}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Adicionais</div>
                          <div style={{ fontWeight: 600, color: '#FBBF24' }}>+{formatCurrency(item.additionalsTotal)}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)' }}>Total Diária</div>
                          <div style={{ fontWeight: 700, color: '#F8FAFC' }}>{formatCurrency(item.grossTotal)}</div>
                        </div>
                      </div>

                      {item.isDaniel && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: 'rgba(244, 63, 94, 0.08)',
                          border: '1px solid rgba(244, 63, 94, 0.25)',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '0.75rem'
                        }}>
                          <span style={{ color: '#F43F5E', fontWeight: 600 }}>💵 Dinheiro retido c/ Daniel:</span>
                          <span style={{ fontWeight: 700, color: '#F43F5E' }}>-{formatCurrency(item.retainedCash)}</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: isPaid ? '#34D399' : 'var(--text-muted)' }}>
                            {isPaid ? `Pago via ${item.payment?.payment_method || 'Pix'}` : (item.isDaniel ? 'LÍQUIDO A PAGAR (COM DESCONTO):' : 'VALOR DA DIÁRIA:')}
                          </div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: item.totalToPay < 0 ? '#F43F5E' : isPaid ? '#34D399' : '#38BDF8' }}>
                            {formatCurrency(item.totalToPay)}
                          </div>
                          {item.isDaniel && item.retainedCash > 0 && (
                            <div style={{ fontSize: '0.7rem', color: item.totalToPay < 0 ? '#F43F5E' : '#FB7185', fontWeight: 600 }}>
                              {item.totalToPay < 0 ? `Daniel deve devolver ${formatCurrency(Math.abs(item.totalToPay))}` : `Bruto ${formatCurrency(item.grossTotal)} - Retido ${formatCurrency(item.retainedCash)}`}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setPaymentModalData({
                            courierName: item.courierName,
                            courier: item.courier,
                            dateStr: item.dateStr,
                            dayDeliveries: item.deliveries,
                            existingPayment: item.payment,
                            initialRetainedCash: item.retainedCash
                          })}
                          className={isPaid ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}
                          style={isPaid ? {} : { backgroundColor: '#10B981', borderColor: '#10B981' }}
                        >
                          {isPaid ? <Edit3 size={13} /> : <DollarSign size={13} />}
                          <span>{isPaid ? 'Ver / Editar Pgto' : 'Marcar Dia como Pago'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deliveries Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Nº Pedido</th>
              <th>Id Ext.</th>
              <th>Entregador</th>
              <th>Bairro</th>
              <th>Tarifa Bairro</th>
              <th>Base</th>
              <th>Adicional</th>
              <th>Total Entrega</th>
              <th>Valor Pedido</th>
              <th>Pagamento</th>
              <th>Status</th>
              <th>Pgto Motoboy</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeliveries.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Nenhuma entrega registrada para este período.
                </td>
              </tr>
            ) : (
              filteredDeliveries.map((d) => {
                const order = ordersMap.get(d.external_order_id);
                const payMethod = order ? (order.final_payment_method || order.original_payment_method) : d.payment_method;
                const isReturn = d.is_return || (d.order_number && String(d.order_number).startsWith('RET')) || (d.notes && d.notes.toLowerCase().includes('retorno'));

                return (
                  <tr key={d.id}>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {formatDateTime(d.delivery_date)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: '#F8FAFC' }}>
                          #{d.order_number || '-'}
                        </span>
                        {isReturn && (
                          <span style={{
                            fontSize: '0.65rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(244, 63, 94, 0.2)',
                            color: '#F43F5E',
                            fontWeight: 700
                          }}>
                            RETORNO
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {d.external_order_id}
                    </td>
                    <td style={{ fontWeight: 600, color: '#38BDF8' }}>
                      {d.courier_name}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={13} color="#94A3B8" />
                        <span>{d.neighborhood_name || 'Não identificado'}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {formatCurrency(d.neighborhood_total_rate)}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {formatCurrency(d.base_rate)}
                    </td>
                    <td style={{ color: Number(d.additional_rate) > 0 ? '#FBBF24' : 'var(--text-muted)', fontWeight: 600 }}>
                      +{formatCurrency(d.additional_rate)}
                    </td>
                    <td style={{ fontWeight: 800, color: '#34D399' }}>
                      {formatCurrency(d.courier_fee)}
                    </td>
                    <td>
                      {formatCurrency(d.order_amount)}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {payMethod || 'N/A'}
                    </td>
                    <td>
                      <span className="badge badge-success">{d.status}</span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.72rem',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontWeight: 600,
                        backgroundColor: d.is_paid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                        color: d.is_paid ? '#10B981' : '#FBBF24',
                        border: d.is_paid ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(251, 191, 36, 0.3)'
                      }}>
                        {d.is_paid ? '✅ Pago' : '⏳ Pendente'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => handleOpenEditModal(d)}
                          className="btn btn-secondary btn-sm"
                          title="Editar detalhes da entrega"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => setDeletingDelivery(d)}
                          className="btn btn-secondary btn-sm"
                          title="Excluir entrega"
                          style={{ color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Courier Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Cadastrar Novo Motoboy</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateCourier}>
              <div className="form-group">
                <label className="form-label">Nome do Motoboy *</label>
                <input
                  type="text"
                  className="input"
                  value={newCourierName}
                  onChange={(e) => setNewCourierName(e.target.value)}
                  placeholder="Ex: Daniel, Carlos..."
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone / WhatsApp</label>
                <input
                  type="text"
                  className="input"
                  value={newCourierPhone}
                  onChange={(e) => setNewCourierPhone(e.target.value)}
                  placeholder="(35) 99999-9999"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Chave PIX</label>
                <input
                  type="text"
                  className="input"
                  value={newCourierPix}
                  onChange={(e) => setNewCourierPix(e.target.value)}
                  placeholder="CPF, Telefone ou Chave aleatória"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar Motoboy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Delivery Modal */}
      {editingDelivery && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={20} color="#F43F5E" />
                Editar Entrega #{editingDelivery.order_number}
              </h3>
              <button onClick={() => setEditingDelivery(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateDelivery}>
              <div className="form-group">
                <label className="form-label">Motoboy Responsável *</label>
                <select
                  className="select"
                  value={editingDelivery.courier_name}
                  onChange={(e) => setEditingDelivery({ ...editingDelivery, courier_name: e.target.value })}
                  required
                >
                  {couriers.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Bairro de Destino</label>
                <input
                  type="text"
                  list="bairros-deliv"
                  className="input"
                  value={editingDelivery.neighborhood_name || ''}
                  onChange={(e) => handleNeighborhoodChange(e.target.value)}
                  placeholder="Selecione ou digite o bairro..."
                  required
                />
                <datalist id="bairros-deliv">
                  {neighborhoodRates.map((r) => (
                    <option key={r.id} value={r.name}>{r.name} - R$ {Number(r.total_rate).toFixed(2)}</option>
                  ))}
                </datalist>
              </div>

              {/* Taxa de Entrega Editável */}
              <div className="form-group" style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: 700, color: '#38BDF8', fontSize: '0.95rem' }}>
                    Taxa de Entrega (R$) *
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Valor da taxa / tarifa do bairro
                  </span>
                </div>

                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '1.1rem' }}>
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    className="input"
                    style={{ paddingLeft: '42px', fontSize: '1.25rem', fontWeight: 800, color: '#38BDF8' }}
                    value={isNaN(editDeliveryRate) ? '' : editDeliveryRate}
                    onChange={(e) => setEditDeliveryRate(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>

                {/* Detalhamento do Repasse da Taxa */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr 1fr', 
                  gap: '8px', 
                  marginTop: '12px',
                  backgroundColor: 'var(--bg-input)', 
                  padding: '10px 12px', 
                  borderRadius: '6px'
                }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Base Fixa</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      {formatCurrency(settings.courier_base_rate || 8.00)}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Adicional Bairro</div>
                    <div style={{ fontWeight: 700, color: Math.max(0, editDeliveryRate - (settings.courier_base_rate || 8.00)) > 0 ? '#FBBF24' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                      +{formatCurrency(Math.max(0, editDeliveryRate - (settings.courier_base_rate || 8.00)))}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Total ao Motoboy</div>
                    <div style={{ fontWeight: 800, color: '#34D399', fontSize: '1rem' }}>
                      {formatCurrency(editDeliveryRate)}
                    </div>
                  </div>
                </div>

                {/* Opção de ajuste na tabela geral de bairros */}
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.07)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', margin: 0, fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={updateOfficialRate}
                      onChange={(e) => setUpdateOfficialRate(e.target.checked)}
                      style={{ accentColor: 'var(--accent-primary)', width: '17px', height: '17px', marginTop: '2px' }}
                    />
                    <span style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      <strong>Ajustar taxa do bairro na tabela permanente:</strong>
                      <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                        Salva R$ {editDeliveryRate.toFixed(2)} como a taxa padrão do bairro <em>"{editingDelivery.neighborhood_name || 'definido'}"</em> para todas as novas entregas e regras automáticas.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Observações / Motivo do Ajuste</label>
                <input
                  type="text"
                  className="input"
                  value={editingDelivery.notes || ''}
                  onChange={(e) => setEditingDelivery({ ...editingDelivery, notes: e.target.value })}
                  placeholder="Ex: Ajuste acordado com o cliente/motoboy"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setEditingDelivery(null)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Delivery Confirmation Modal */}
      {deletingDelivery && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#EF4444'
                }}>
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', color: '#F8FAFC', margin: 0 }}>
                    Excluir Entrega #{deletingDelivery.order_number || deletingDelivery.external_order_id}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                    Motoboy: {deletingDelivery.courier_name}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setDeletingDelivery(null)} 
                className="btn btn-secondary" 
                style={{ padding: '6px', borderRadius: '8px' }}
                disabled={isDeletingDelivery}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '16px',
              color: '#FCA5A5',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>
                Esta ação removerá o registro desta corrida/entrega e recalculará as taxas e acertos do motoboy.
              </span>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              fontSize: '0.875rem',
              display: 'grid',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Motoboy:</span>
                <strong style={{ color: '#F8FAFC' }}>{deletingDelivery.courier_name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Bairro:</span>
                <strong style={{ color: '#F8FAFC' }}>{deletingDelivery.neighborhood_name || 'N/A'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Taxa do Motoboy:</span>
                <strong style={{ color: '#34D399' }}>{formatCurrency(deletingDelivery.courier_fee)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Valor do Pedido:</span>
                <span style={{ color: '#38BDF8' }}>{formatCurrency(deletingDelivery.order_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Data da Entrega:</span>
                <span style={{ color: '#F8FAFC' }}>{formatDateTime(deletingDelivery.delivery_date)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingDelivery(null)}
                disabled={isDeletingDelivery}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDeleteDelivery}
                disabled={isDeletingDelivery}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={15} />
                <span>{isDeletingDelivery ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Delivery / Return Creation Modal */}
      <DeliveryCreateModal
        isOpen={showAddDeliveryModal}
        onClose={() => setShowAddDeliveryModal(false)}
        onSuccess={() => {
          setShowAddDeliveryModal(false);
          onRefresh();
          fetchDailyPayments();
        }}
        couriers={couriers}
        neighborhoodRates={neighborhoodRates}
        settings={settings}
        defaultCourierName={selectedCourierName !== 'all' ? selectedCourierName : undefined}
        defaultDate={dateRange ? getLocalDateKey(dateRange.startDate) : undefined}
      />

      {/* Daily Courier Payment / Settlement Modal */}
      {paymentModalData && (
        <CourierPaymentModal
          isOpen={true}
          onClose={() => setPaymentModalData(null)}
          onSuccess={() => {
            setPaymentModalData(null);
            onRefresh();
            fetchDailyPayments();
          }}
          courierName={paymentModalData.courierName}
          courier={paymentModalData.courier}
          dateStr={paymentModalData.dateStr}
          dayDeliveries={paymentModalData.dayDeliveries}
          existingPayment={paymentModalData.existingPayment}
          initialRetainedCash={paymentModalData.initialRetainedCash}
          ordersMap={ordersMap}
        />
      )}

      {/* Reconciliation Detail Modal (Dinheiro / Débito / Crédito / Maquininha) */}
      {reconciliationModalType && (
        <ReconciliationDetailModal
          isOpen={true}
          onClose={() => setReconciliationModalType(null)}
          type={reconciliationModalType}
          items={
            reconciliationModalType === 'cash'
              ? reconciliation.cashItems
              : reconciliationModalType === 'debit'
              ? reconciliation.debitItems
              : reconciliationModalType === 'credit'
              ? reconciliation.creditItems
              : reconciliation.cardItems
          }
          currentDateRangeLabel={
            dateRange
              ? `${formatDateBR(dateRange.startDate)}${dateRange.startDate.toDateString() !== dateRange.endDate.toDateString() ? ` até ${formatDateBR(dateRange.endDate)}` : ''}`
              : `${selectedMonth.toString().padStart(2, '0')}/${selectedYear}`
          }
          selectedCourierName={selectedCourierName}
        />
      )}
    </div>
  );
};
