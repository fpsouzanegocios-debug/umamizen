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
import { isDateInRange, getOperationalDateKey } from '../../lib/dateUtils';
import { supabase } from '../../lib/supabase';
import { calculateDeliveryRates } from '../../lib/calculations';
import { normalizeNeighborhoodName } from '../../lib/neighborhoodMatcher';
import { syncNeighborhoodRateToOrders } from '../../lib/neighborhoodSync';
import { DateRangePicker } from '../common/DateRangePicker';
import { DeliveryCreateModal } from './DeliveryCreateModal';
import { CourierPaymentModal } from './CourierPaymentModal';

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

  // Daily Settlement / Payments state (Section 16)
  const [dailyPayments, setDailyPayments] = useState<CourierDailyPayment[]>([]);
  const [paymentModalData, setPaymentModalData] = useState<{
    courierName: string;
    courier?: Courier | null;
    dateStr: string;
    dayDeliveries: Delivery[];
    existingPayment?: CourierDailyPayment | null;
  } | null>(null);
  const [settlementFilter, setSettlementFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [settlementViewMode, setSettlementViewMode] = useState<'table' | 'cards'>('table');
  const [settlementCollapsed, setSettlementCollapsed] = useState<boolean>(false);

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

  // Pre-index orders by external_order_id for fast lookup
  const ordersMap = useMemo(() => {
    const map = new Map<string, Order>();
    orders.forEach((o) => map.set(o.external_order_id, o));
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
      totalToPay: number;
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
          totalToPay: 0,
          payment,
          isPaid: Boolean(payment && payment.is_paid)
        });
      }

      const item = map.get(key)!;
      item.deliveries.push(d);
      item.totalDeliveries++;
      item.baseTotal += Number(d.base_rate) || 8.00;
      item.additionalsTotal += Number(d.additional_rate) || 0;
      item.totalToPay += Number(d.courier_fee) || (Number(d.base_rate) || 8.00) + (Number(d.additional_rate) || 0);
    });

    return Array.from(map.values()).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [filteredDeliveries, couriers, dailyPayments]);

  // Totals for the Couriers Module - com dedução dos pagamentos já efetuados
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
        pendingToPay += item.totalToPay;
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

  // Reconciliation Cash / Card breakdown (Section 15)
  // Cross deliveries with orders to find what was paid directly in physical money or POS card machine
  const reconciliation = useMemo(() => {
    let cashCount = 0;
    let cashTotal = 0;

    let debitCount = 0;
    let debitTotal = 0;

    let creditCount = 0;
    let creditTotal = 0;

    filteredDeliveries.forEach((d) => {
      const order = ordersMap.get(d.external_order_id);
      if (!order) return;

      const payMethod = (order.final_payment_method || order.original_payment_method || '').toLowerCase();
      const amount = Number(order.gross_amount || d.order_amount || 0);

      // Check physical cash
      if (payMethod === 'dinheiro') {
        cashCount++;
        cashTotal += amount;
      } else if (payMethod.includes('débito') || payMethod.includes('debito')) {
        debitCount++;
        debitTotal += amount;
      } else if (payMethod.includes('crédito') || payMethod.includes('credito')) {
        creditCount++;
        creditTotal += amount;
      }
    });

    const cardCount = debitCount + creditCount;
    const cardTotal = debitTotal + creditTotal;
    const totalReceivedInHand = cashTotal + cardTotal;

    return {
      cashCount,
      cashTotal,
      debitCount,
      debitTotal,
      creditCount,
      creditTotal,
      cardCount,
      cardTotal,
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
            <div style={{ backgroundColor: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: '#34D399', fontWeight: 600 }}>DINHEIRO</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px' }}>
                {formatCurrency(reconciliation.cashTotal)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {reconciliation.cashCount} pedidos
              </div>
            </div>

            {/* Débito */}
            <div style={{ backgroundColor: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: '#38BDF8', fontWeight: 600 }}>DÉBITO</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px' }}>
                {formatCurrency(reconciliation.debitTotal)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {reconciliation.debitCount} pedidos
              </div>
            </div>

            {/* Crédito */}
            <div style={{ backgroundColor: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: '#A855F7', fontWeight: 600 }}>CRÉDITO</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px' }}>
                {formatCurrency(reconciliation.creditTotal)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {reconciliation.creditCount} pedidos
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#FBBF24' }}>
                TOTAL CARTÃO (Débito + Crédito):
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {reconciliation.cardCount} pedidos na maquininha
              </span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#FBBF24' }}>
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
            {displayedSettlements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                Nenhum acerto de diária para o filtro selecionado ({settlementFilter === 'pending' ? 'sem pendências' : settlementFilter === 'paid' ? 'nenhum pago' : 'vazio'}).
              </div>
            ) : settlementViewMode === 'table' ? (
              /* Compact Table Mode */
              <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Motoboy</th>
                      <th>Corridas</th>
                      <th>Base (R$ 8)</th>
                      <th>Adicionais</th>
                      <th>Total Diária</th>
                      <th>Status</th>
                      <th>Forma Pgto</th>
                      <th style={{ textAlign: 'right' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedSettlements.map((item) => {
                      const isPaid = item.isPaid;
                      const formattedDate = item.dateStr.split('-').reverse().join('/');

                      return (
                        <tr key={`${item.dateStr}_${item.courierName}`}>
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
                          <td style={{ fontWeight: 800, color: isPaid ? '#34D399' : '#F8FAFC' }}>
                            {formatCurrency(item.totalToPay)}
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
                                existingPayment: item.payment
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
                </table>
              </div>
            ) : (
              /* Cards Mode */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }}>
                {displayedSettlements.map((item) => {
                  const isPaid = item.isPaid;
                  const formattedDate = item.dateStr.split('-').reverse().join('/');

                  return (
                    <div
                      key={`${item.dateStr}_${item.courierName}`}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        border: isPaid ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(251, 191, 36, 0.4)',
                        borderRadius: '10px',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F8FAFC' }}>
                            {item.courierName}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <Calendar size={13} />
                            <span>Data da Diária: <strong>{formattedDate}</strong></span>
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
                        gridTemplateColumns: 'repeat(3, 1fr)',
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
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: isPaid ? '#34D399' : 'var(--text-muted)' }}>
                            {isPaid ? `Pago via ${item.payment?.payment_method || 'Pix'}` : 'VALOR DA DIÁRIA:'}
                          </div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isPaid ? '#34D399' : '#F8FAFC' }}>
                            {formatCurrency(item.totalToPay)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setPaymentModalData({
                            courierName: item.courierName,
                            courier: item.courier,
                            dateStr: item.dateStr,
                            dayDeliveries: item.deliveries,
                            existingPayment: item.payment
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
        />
      )}
    </div>
  );
};
