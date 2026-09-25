import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Edit3, 
  History, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ShoppingBag,
  Clock,
  ArrowUpDown,
  FileSpreadsheet,
  Plus,
  Trash2,
  X,
  Wand2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { 
  Order, 
  NeighborhoodRate, 
  Courier, 
  SystemSettings,
  DateRange 
} from '../../types';
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { isDateInRange, getOperationalDateKey } from '../../lib/dateUtils';
import { autoResolvePendingNeighborhoodOrders } from '../../lib/neighborhoodSync';
import { OrderEditModal } from './OrderEditModal';
import { OrderCreateModal } from './OrderCreateModal';
import { OrderHistoryModal } from './OrderHistoryModal';
import { DateRangePicker } from '../common/DateRangePicker';

interface OrdersViewProps {
  orders: Order[];
  onRefresh: () => void;
  settings: SystemSettings;
  neighborhoodRates: NeighborhoodRate[];
  couriers: Courier[];
  selectedMonth: number;
  selectedYear: number;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  onOpenImport?: (tab?: 'import' | 'history') => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  onRefresh,
  settings,
  neighborhoodRates,
  couriers,
  selectedMonth,
  selectedYear,
  dateRange,
  onDateRangeChange,
  onOpenImport
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [pendingOnly, setPendingOnly] = useState<boolean>(false);
  const [periodFilter, setPeriodFilter] = useState<string>('month');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [historyOrder, setHistoryOrder] = useState<{ id: string; number: string } | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [deleteLinkedDelivery, setDeleteLinkedDelivery] = useState<boolean>(true);
  const [isDeletingOrder, setIsDeletingOrder] = useState<boolean>(false);

  const handleConfirmDeleteOrder = async () => {
    if (!deletingOrder) return;
    setIsDeletingOrder(true);
    try {
      if (deleteLinkedDelivery) {
        await supabase
          .from('deliveries')
          .delete()
          .or(`order_id.eq.${deletingOrder.id},external_order_id.eq.${deletingOrder.external_order_id}`);
      }
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', deletingOrder.id);

      if (error) throw error;

      onRefresh();
      setDeletingOrder(null);
    } catch (err: any) {
      console.error('Erro ao excluir pedido:', err);
      alert('Erro ao excluir pedido: ' + (err.message || String(err)));
    } finally {
      setIsDeletingOrder(false);
    }
  };

  const [isAutoResolving, setIsAutoResolving] = useState<boolean>(false);

  const pendingNeighborhoodOrdersCount = useMemo(() => {
    return orders.filter(
      (o) => o.has_pending_issue && o.pending_issue_reason === 'Conferir bairro'
    ).length;
  }, [orders]);

  const handleAutoResolveNeighborhoods = async () => {
    setIsAutoResolving(true);
    try {
      const res = await autoResolvePendingNeighborhoodOrders(settings);
      if (res.resolvedOrders > 0) {
        const summary = res.details
          .slice(0, 15)
          .map((d) => `• Pedido #${d.orderNumber}: "${d.originalName}" ➔ ${d.matchedName} (${d.method})`)
          .join('\n');
        const extraCount = res.details.length > 15 ? `\n... e mais ${res.details.length - 15} pedido(s)` : '';
        alert(`✅ Sucesso!\n\n${res.resolvedOrders} pedido(s) corrigido(s) com sucesso!\n${res.registeredAliases} novo(s) apelido(s) de bairro registrado(s) no sistema.\n\nDetalhes:\n${summary}${extraCount}`);
        onRefresh();
      } else {
        alert('Nenhum pedido pendente com bairro similar pôde ser identificado automaticamente.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro ao corrigir bairros automaticamente: ' + (err.message || String(err)));
    } finally {
      setIsAutoResolving(false);
    }
  };

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Period filter
      if (periodFilter === 'month') {
        if (dateRange) {
          if (!isDateInRange(o.order_date, dateRange)) return false;
        } else {
          const opKey = getOperationalDateKey(o.order_date);
          if (opKey && /^\d{4}-\d{2}-\d{2}$/.test(opKey)) {
            const [y, m] = opKey.split('-').map(Number);
            if (m !== selectedMonth || y !== selectedYear) {
              return false;
            }
          } else {
            const d = new Date(o.order_date);
            if (d.getMonth() + 1 !== selectedMonth || d.getFullYear() !== selectedYear) {
              return false;
            }
          }
        }
      }

      // Search term
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches = 
          o.order_number.toLowerCase().includes(q) ||
          o.external_order_id.toLowerCase().includes(q) ||
          (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
          (o.neighborhood_name && o.neighborhood_name.toLowerCase().includes(q)) ||
          (o.notes && o.notes.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Channel filter
      if (channelFilter !== 'all' && o.channel !== channelFilter) {
        return false;
      }

      // Payment filter
      if (paymentFilter !== 'all') {
        const pay = o.final_payment_method || o.original_payment_method;
        if (!pay || !pay.toLowerCase().includes(paymentFilter.toLowerCase())) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'concluido' && o.is_canceled) return false;
        if (statusFilter === 'cancelado' && !o.is_canceled) return false;
      }

      // Courier filter
      if (courierFilter !== 'all') {
        if (courierFilter === 'sem_motoboy' && o.courier_name) return false;
        if (courierFilter !== 'sem_motoboy' && o.courier_name !== courierFilter) return false;
      }

      // Pending only
      if (pendingOnly && !o.has_pending_issue) {
        return false;
      }

      return true;
    });
  }, [orders, dateRange, selectedMonth, selectedYear, periodFilter, searchTerm, channelFilter, paymentFilter, statusFilter, courierFilter, pendingOnly]);

  // Top Totals (Completed orders only!)
  const stats = useMemo(() => {
    const completed = filteredOrders.filter((o) => !o.is_canceled);
    const count = completed.length;
    const gross = completed.reduce((acc, o) => acc + Number(o.gross_amount || 0), 0);
    const platformFees = completed.reduce((acc, o) => acc + Number(o.platform_fee_amount || 0), 0);
    const cardFees = completed.reduce((acc, o) => acc + Number(o.card_fee_amount || 0), 0);
    const adjustments = completed.reduce((acc, o) => acc + Number(o.adjustment_amount || 0), 0);
    const net = completed.reduce((acc, o) => acc + Number(o.net_amount || 0), 0);
    const avgTicket = count > 0 ? gross / count : 0;

    return { count, gross, platformFees, cardFees, adjustments, net, avgTicket };
  }, [filteredOrders]);

  return (
    <div className="page-container">
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', color: '#F8FAFC' }}>Gestão de Pedidos</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Consulte, audite e edite pedidos importados com recálculo automático de taxas
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {onOpenImport && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onOpenImport('history')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem' }}
              title="Visualizar e remover relatórios importados no sistema"
            >
              <FileSpreadsheet size={15} color="#38BDF8" />
              <span>Gerenciar Relatórios</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleAutoResolveNeighborhoods}
            disabled={isAutoResolving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.84rem',
              backgroundColor: pendingNeighborhoodOrdersCount > 0 ? 'rgba(245, 158, 11, 0.15)' : undefined,
              borderColor: pendingNeighborhoodOrdersCount > 0 ? '#F59E0B' : undefined,
              color: pendingNeighborhoodOrdersCount > 0 ? '#F59E0B' : undefined,
              fontWeight: pendingNeighborhoodOrdersCount > 0 ? 700 : 500
            }}
            title="Identificar bairros cadastrados com nomes parecidos e corrigir pendências automaticamente"
          >
            <Wand2 size={15} />
            <span>{isAutoResolving ? 'Corrigindo Bairros...' : `Corrigir Bairros Parecidos ${pendingNeighborhoodOrdersCount > 0 ? `(${pendingNeighborhoodOrdersCount})` : ''}`}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <Plus size={16} />
            <span>+ Novo Pedido</span>
          </button>

          {dateRange && onDateRangeChange && (
            <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
          )}
        </div>
      </div>

      {/* Top Totals KPI Cards (Section 9) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div className="kpi-card">
          <div className="kpi-title">Pedidos Concluídos</div>
          <div className="kpi-value">{stats.count}</div>
          <div className="kpi-subtitle">Ticket médio: {formatCurrency(stats.avgTicket)}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Faturamento Bruto</div>
          <div className="kpi-value" style={{ color: '#F8FAFC' }}>{formatCurrency(stats.gross)}</div>
          <div className="kpi-subtitle">Sem pedidos cancelados</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Taxas Plataformas</div>
          <div className="kpi-value" style={{ color: '#FB7185' }}>-{formatCurrency(stats.platformFees)}</div>
          <div className="kpi-subtitle">iFood & AiqFome (15%)</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Taxas Maquininha</div>
          <div className="kpi-value" style={{ color: '#FBBF24' }}>-{formatCurrency(stats.cardFees)}</div>
          <div className="kpi-subtitle">Cartão Débito & Crédito</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-title">Ajustes / Promoções</div>
          <div className="kpi-value" style={{ color: '#38BDF8' }}>-{formatCurrency(stats.adjustments)}</div>
          <div className="kpi-subtitle">Entrega grátis & Cupons</div>
        </div>

        <div className="kpi-card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
          <div className="kpi-title" style={{ color: '#34D399' }}>Faturamento Líquido</div>
          <div className="kpi-value" style={{ color: '#34D399' }}>{formatCurrency(stats.net)}</div>
          <div className="kpi-subtitle">Margem sobre o bruto</div>
        </div>
      </div>

      {/* Alert Banner for pending neighborhood issues */}
      {pendingNeighborhoodOrdersCount > 0 && (
        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F59E0B'
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#FBBF24', fontSize: '0.95rem' }}>
                {pendingNeighborhoodOrdersCount} {pendingNeighborhoodOrdersCount === 1 ? 'pedido com pendência operacional de bairro' : 'pedidos com pendências operacionais de bairros'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Existem pedidos com bairros cadastrados mas que vieram com nomes parecidos ou pequenas variações (sem acento, algarismos romanos, prefixos ou logradouros).
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleAutoResolveNeighborhoods}
            disabled={isAutoResolving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#F59E0B',
              borderColor: '#F59E0B',
              fontWeight: 700,
              padding: '8px 16px',
              color: '#0F172A'
            }}
          >
            <Wand2 size={15} />
            <span>{isAutoResolving ? 'Corrigindo Bairros...' : 'Corrigir Todos Automaticamente'}</span>
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={16} color="#64748B" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar cliente, nº pedido, id..."
              className="input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>

          {/* Period Filter */}
          <select
            className="select"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
          >
            <option value="month">Período Selecionado ({dateRange?.label || `${selectedMonth}/${selectedYear}`})</option>
            <option value="all">Todos os Registros</option>
          </select>

          {/* Channel */}
          <select
            className="select"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
          >
            <option value="all">Todas as Plataformas</option>
            <option value="Balcão / WhatsApp">Balcão / WhatsApp</option>
            <option value="Cardápio Digital">Cardápio Digital</option>
            <option value="iFood">iFood</option>
            <option value="AiqFome">AiqFome</option>
          </select>

          {/* Payment */}
          <select
            className="select"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="all">Todos os Pagamentos</option>
            <option value="pix">Pix (qualquer)</option>
            <option value="crédito">Cartão de Crédito</option>
            <option value="débito">Cartão de Débito</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="ifood">iFood Online</option>
            <option value="aiqfome">AiqFome Online</option>
          </select>

          {/* Status */}
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos os Status</option>
            <option value="concluido">Concluídos</option>
            <option value="cancelado">Cancelados</option>
          </select>

          {/* Motoboy */}
          <select
            className="select"
            value={courierFilter}
            onChange={(e) => setCourierFilter(e.target.value)}
          >
            <option value="all">Todos os Motoboys</option>
            <option value="sem_motoboy">Sem Motoboy Vinculado</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          {/* Checkbox Somente com Pendência */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: '#FBBF24', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={pendingOnly}
              onChange={(e) => setPendingOnly(e.target.checked)}
              style={{ accentColor: '#F59E0B', width: '16px', height: '16px' }}
            />
            <span>Apenas com Pendência</span>
          </label>
        </div>
      </div>

      {/* Orders Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Nº Pedido</th>
              <th>Id Ext.</th>
              <th>Cliente</th>
              <th>Plataforma</th>
              <th>Pagamento</th>
              <th>Bruto</th>
              <th>Tx Entrega</th>
              <th>Tx Plataforma</th>
              <th>Tx Maquineta</th>
              <th>Ajustes / Promo</th>
              <th>Líquido</th>
              <th>Bairro</th>
              <th>Motoboy</th>
              <th>Status</th>
              <th>Pendência</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={17} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Nenhum pedido encontrado com os filtros atuais.
                </td>
              </tr>
            ) : (
              filteredOrders.map((o) => {
                const finalPay = o.final_payment_method || o.original_payment_method;
                const isEdited = o.is_manually_edited;

                return (
                  <tr key={o.id} style={{ opacity: o.is_canceled ? 0.65 : 1 }}>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {formatDateTime(o.order_date)}
                    </td>

                    <td style={{ fontWeight: 700, color: '#F8FAFC' }}>
                      #{o.order_number}
                    </td>

                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {o.external_order_id}
                    </td>

                    <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.customer_name || 'N/A'}
                    </td>

                    <td>
                      <span className={`badge ${
                        o.channel === 'iFood' ? 'badge-danger' : 
                        o.channel === 'AiqFome' ? 'badge-warning' : 'badge-info'
                      }`}>
                        {o.channel}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          {finalPay || 'N/A'}
                        </span>
                        {o.original_payment_method && o.original_payment_method !== finalPay && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                            Orig: {o.original_payment_method}
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ fontWeight: 600 }}>
                      {formatCurrency(o.gross_amount)}
                    </td>

                    {/* Taxa de Entrega cobrada do cliente */}
                    <td>
                      {o.channel === 'Cardápio Digital' ? (
                        (o.delivery_fee === 0 || o.is_free_delivery) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                              Grátis
                            </span>
                            {Number(o.neighborhood_fee || (o.is_free_delivery ? o.delivery_fee : 0)) > 0 && (
                              <span style={{ fontSize: '0.72rem', color: '#38BDF8', fontWeight: 600 }}>
                                + Bairro {formatCurrency(o.neighborhood_fee || o.delivery_fee || 0)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#F1F5F9' }}>
                              {formatCurrency(o.delivery_fee ?? 0)}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              Taxa normal
                            </span>
                          </div>
                        )
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {formatCurrency(o.delivery_fee ?? 0)}
                        </span>
                      )}
                    </td>

                    <td style={{ color: '#FB7185' }}>
                      {o.platform_fee_amount > 0 ? `-${formatCurrency(o.platform_fee_amount)}` : 'R$ 0,00'}
                    </td>

                    <td style={{ color: '#FBBF24' }}>
                      {o.card_fee_amount > 0 ? `-${formatCurrency(o.card_fee_amount)}` : 'R$ 0,00'}
                    </td>

                    {/* Ajustes e Cupons mostrados separadamente */}
                    <td>
                      {o.is_free_delivery || Number(o.coupon_amount || 0) > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {o.is_free_delivery && (
                            <span className="badge badge-info" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                              Grátis (-{formatCurrency(o.free_delivery_cost || 8)})
                            </span>
                          )}
                          {Number(o.coupon_amount || 0) > 0 && (
                            <span 
                              className="badge" 
                              style={{ 
                                fontSize: '0.68rem', 
                                backgroundColor: 'rgba(168, 85, 247, 0.15)', 
                                color: '#C084FC', 
                                border: '1px solid rgba(168, 85, 247, 0.3)',
                                whiteSpace: 'nowrap'
                              }}
                              title={o.coupon_name ? `Cupom: ${o.coupon_name}` : undefined}
                            >
                              Cupom (-{formatCurrency(o.coupon_amount!)})
                            </span>
                          )}
                        </div>
                      ) : o.adjustment_amount > 0 ? (
                        <span style={{ color: '#38BDF8', fontSize: '0.8rem' }}>
                          -{formatCurrency(o.adjustment_amount)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>R$ 0,00</span>
                      )}
                    </td>

                    <td style={{ fontWeight: 800, color: o.is_canceled ? 'var(--text-muted)' : '#34D399' }}>
                      {formatCurrency(o.net_amount)}
                    </td>

                    <td style={{ fontSize: '0.8rem' }}>
                      {o.neighborhood_name || '-'}
                    </td>

                    <td style={{ fontSize: '0.8rem' }}>
                      {o.courier_name ? (
                        <span style={{ color: '#38BDF8', fontWeight: 500 }}>{o.courier_name}</span>
                      ) : (
                        <span style={{ color: '#FBBF24', fontSize: '0.72rem' }}>Sem motoboy</span>
                      )}
                    </td>

                    <td>
                      <span className={`badge ${o.is_canceled ? 'badge-danger' : 'badge-success'}`}>
                        {o.status}
                      </span>
                    </td>

                    <td>
                      {o.has_pending_issue ? (
                        <span className="badge badge-warning" title={o.pending_issue_reason || 'Requer atenção'}>
                          <AlertTriangle size={11} />
                          {o.pending_issue_reason || 'Pendente'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>-</span>
                      )}
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => setEditingOrder(o)}
                          className="btn btn-secondary btn-sm"
                          title="Editar pedido manualmente"
                        >
                          <Edit3 size={13} />
                          {isEdited && <span style={{ color: '#FBBF24', fontSize: '0.65rem' }}>*</span>}
                        </button>

                        <button
                          onClick={() => setHistoryOrder({ id: o.id, number: o.order_number })}
                          className="btn btn-secondary btn-sm"
                          title="Ver histórico de auditoria"
                        >
                          <History size={13} />
                        </button>

                        <button
                          onClick={() => setDeletingOrder(o)}
                          className="btn btn-secondary btn-sm"
                          title="Excluir pedido"
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

      {/* Create Modal */}
      {showCreateModal && (
        <OrderCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={onRefresh}
          orders={orders}
          settings={settings}
          neighborhoodRates={neighborhoodRates}
          couriers={couriers}
        />
      )}

      {/* Edit Modal */}
      {editingOrder && (
        <OrderEditModal
          isOpen={Boolean(editingOrder)}
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSuccess={onRefresh}
          settings={settings}
          neighborhoodRates={neighborhoodRates}
          couriers={couriers}
        />
      )}

      {/* History Modal */}
      {historyOrder && (
        <OrderHistoryModal
          isOpen={Boolean(historyOrder)}
          orderId={historyOrder.id}
          orderNumber={historyOrder.number}
          onClose={() => setHistoryOrder(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingOrder && (
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
                    Excluir Pedido #{deletingOrder.order_number}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                    ID: {deletingOrder.external_order_id}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setDeletingOrder(null)} 
                className="btn btn-secondary" 
                style={{ padding: '6px', borderRadius: '8px' }}
                disabled={isDeletingOrder}
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
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>
                Esta ação é irreversível. O pedido será removido e todos os faturamentos e indicadores serão recalculados.
              </span>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '0.875rem',
              display: 'grid',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Cliente:</span>
                <strong style={{ color: '#F8FAFC' }}>{deletingOrder.customer_name || 'N/A'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Canal:</span>
                <strong style={{ color: '#F8FAFC' }}>{deletingOrder.channel}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Valor Bruto:</span>
                <strong style={{ color: '#38BDF8' }}>{formatCurrency(deletingOrder.gross_amount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Data/Hora:</span>
                <span style={{ color: '#F8FAFC' }}>{formatDateTime(deletingOrder.order_date)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Forma Pagamento:</span>
                <span style={{ color: '#F8FAFC' }}>{deletingOrder.final_payment_method || deletingOrder.original_payment_method}</span>
              </div>
              {deletingOrder.courier_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94A3B8' }}>Motoboy:</span>
                  <span style={{ color: '#FBBF24' }}>{deletingOrder.courier_name}</span>
                </div>
              )}
            </div>

            {/* Checkbox delete linked delivery */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#E2E8F0' }}>
                <input
                  type="checkbox"
                  checked={deleteLinkedDelivery}
                  onChange={(e) => setDeleteLinkedDelivery(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#EF4444' }}
                />
                <span>Excluir também a entrega vinculada deste pedido na aba de <strong>Motoboys</strong></span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingOrder(null)}
                disabled={isDeletingOrder}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDeleteOrder}
                disabled={isDeletingOrder}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={15} />
                <span>{isDeletingOrder ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
