import React, { useState, useMemo } from 'react';
import { 
  X, 
  Banknote, 
  CreditCard, 
  Search, 
  Calendar, 
  MapPin, 
  Bike, 
  ShoppingBag, 
  FileText,
  DollarSign,
  ChevronDown
} from 'lucide-react';
import { Delivery, Order } from '../../types';
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { getOperationalDateKey } from '../../lib/dateUtils';

export interface ReconciliationItem {
  id: string;
  orderNumber: string;
  externalOrderId: string;
  customerName: string;
  customerPhone?: string;
  neighborhood: string;
  courierName: string;
  deliveryDate: string;
  amount: number;
  paymentMethod: string;
  channel: string;
  notes?: string;
  changeFor?: number;
  order?: Order | null;
  delivery: Delivery;
}

export type ReconciliationModalType = 'cash' | 'debit' | 'credit' | 'card';

interface ReconciliationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ReconciliationModalType;
  items: ReconciliationItem[];
  currentDateRangeLabel?: string;
  selectedCourierName?: string;
}

export const ReconciliationDetailModal: React.FC<ReconciliationDetailModalProps> = ({
  isOpen,
  onClose,
  type,
  items,
  currentDateRangeLabel,
  selectedCourierName
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterDay, setFilterDay] = useState<string>('all');
  const [filterCourier, setFilterCourier] = useState<string>('all');

  // Extract distinct days for day selector
  const availableDays = useMemo(() => {
    const daysSet = new Set<string>();
    items.forEach((item) => {
      const opKey = getOperationalDateKey(item.deliveryDate) || item.deliveryDate.slice(0, 10);
      if (opKey) daysSet.add(opKey);
    });
    return Array.from(daysSet).sort((a, b) => b.localeCompare(a));
  }, [items]);

  // Extract distinct couriers
  const availableCouriers = useMemo(() => {
    const courierSet = new Set<string>();
    items.forEach((item) => {
      if (item.courierName) courierSet.add(item.courierName);
    });
    return Array.from(courierSet).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Day filter
      if (filterDay !== 'all') {
        const opKey = getOperationalDateKey(item.deliveryDate) || item.deliveryDate.slice(0, 10);
        if (opKey !== filterDay) return false;
      }

      // Courier filter
      if (filterCourier !== 'all' && item.courierName !== filterCourier) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const numMatch = (item.orderNumber || '').toLowerCase().includes(q);
        const extMatch = (item.externalOrderId || '').toLowerCase().includes(q);
        const custMatch = (item.customerName || '').toLowerCase().includes(q);
        const neighMatch = (item.neighborhood || '').toLowerCase().includes(q);
        const courMatch = (item.courierName || '').toLowerCase().includes(q);
        if (!numMatch && !extMatch && !custMatch && !neighMatch && !courMatch) {
          return false;
        }
      }

      return true;
    });
  }, [items, filterDay, filterCourier, searchTerm]);

  // Totals for filtered items
  const totalAmount = useMemo(() => {
    return filteredItems.reduce((acc, item) => acc + item.amount, 0);
  }, [filteredItems]);

  const avgTicket = useMemo(() => {
    return filteredItems.length > 0 ? totalAmount / filteredItems.length : 0;
  }, [filteredItems, totalAmount]);

  if (!isOpen) return null;

  // Metadata by type
  const config = {
    cash: {
      title: 'Conferência de Caixa — Pedidos em Dinheiro',
      subtitle: 'Valores recebidos em espécie pelo motoboy',
      icon: Banknote,
      color: '#34D399',
      bgColor: 'rgba(52, 211, 153, 0.15)',
      badge: 'DINHEIRO FÍSICO'
    },
    debit: {
      title: 'Conferência de Caixa — Débito na Maquininha',
      subtitle: 'Transações via cartão de débito na maquininha do motoboy',
      icon: CreditCard,
      color: '#38BDF8',
      bgColor: 'rgba(56, 189, 248, 0.15)',
      badge: 'CARTÃO DE DÉBITO'
    },
    credit: {
      title: 'Conferência de Caixa — Crédito na Maquininha',
      subtitle: 'Transações via cartão de crédito na maquininha do motoboy',
      icon: CreditCard,
      color: '#A855F7',
      bgColor: 'rgba(168, 85, 247, 0.15)',
      badge: 'CARTÃO DE CRÉDITO'
    },
    card: {
      title: 'Conferência de Caixa — Total Maquininha (Débito + Crédito)',
      subtitle: 'Todas as transações realizadas nas maquininhas pelos entregadores',
      icon: CreditCard,
      color: '#FBBF24',
      bgColor: 'rgba(251, 191, 36, 0.15)',
      badge: 'TOTAL MAQUININHA'
    }
  }[type];

  const IconComponent = config.icon;

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '1050px', 
          width: '95vw', 
          maxHeight: '92vh', 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '24px' 
        }}
      >
        {/* Modal Top Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: config.bgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: config.color,
              flexShrink: 0
            }}>
              <IconComponent size={24} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
                  {config.title}
                </h3>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: config.bgColor,
                  color: config.color
                }}>
                  {config.badge}
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                {config.subtitle}
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px', borderRadius: '50%' }}
            title="Fechar janela"
          >
            <X size={18} />
          </button>
        </div>

        {/* Badges / Active context row */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          flexWrap: 'wrap', 
          marginBottom: '16px',
          padding: '8px 12px',
          backgroundColor: 'var(--bg-input)',
          borderRadius: '8px',
          fontSize: '0.78rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#F8FAFC' }}>
            <Calendar size={14} color="#38BDF8" />
            <span>Período Ativo: <strong>{currentDateRangeLabel || 'Período selecionado'}</strong></span>
          </div>

          <span style={{ color: 'var(--border-color)' }}>•</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#F8FAFC' }}>
            <Bike size={14} color="#F43F5E" />
            <span>Motoboy: <strong>{selectedCourierName && selectedCourierName !== 'all' ? selectedCourierName : 'Todos os Motoboys'}</strong></span>
          </div>

          {availableDays.length > 1 && (
            <>
              <span style={{ color: 'var(--border-color)' }}>•</span>
              <span style={{ color: 'var(--text-muted)' }}>
                {availableDays.length} dias com lançamentos neste período
              </span>
            </>
          )}
        </div>

        {/* KPI Mini-Cards Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '12px 14px'
          }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total de Pedidos
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F8FAFC', marginTop: '2px' }}>
              {filteredItems.length}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {filteredItems.length === 1 ? '1 entrega registrada' : `${filteredItems.length} entregas registradas`}
            </div>
          </div>

          <div style={{
            backgroundColor: config.bgColor,
            border: `1px solid ${config.color}40`,
            borderRadius: '8px',
            padding: '12px 14px'
          }}>
            <div style={{ fontSize: '0.72rem', color: config.color, textTransform: 'uppercase', fontWeight: 700 }}>
              Valor Total a Conferir
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: config.color, marginTop: '2px' }}>
              {formatCurrency(totalAmount)}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              Soma total dos pedidos
            </div>
          </div>

          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '12px 14px'
          }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Ticket Médio
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F8FAFC', marginTop: '2px' }}>
              {formatCurrency(avgTicket)}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              Média por pedido conferido
            </div>
          </div>
        </div>

        {/* Filter Controls Row inside Modal */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr auto auto', 
          gap: '10px', 
          marginBottom: '14px',
          alignItems: 'center'
        }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar por nº pedido, cliente, motoboy ou bairro..."
              className="input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '0.82rem', height: '36px' }}
            />
          </div>

          {/* Filter by Day (if multi-day period) */}
          {availableDays.length > 1 && (
            <select
              className="select"
              value={filterDay}
              onChange={(e) => setFilterDay(e.target.value)}
              style={{ fontSize: '0.82rem', height: '36px', minWidth: '160px' }}
            >
              <option value="all">Todos os Dias ({availableDays.length})</option>
              {availableDays.map((day) => {
                const [y, m, d] = day.split('-');
                return (
                  <option key={day} value={day}>
                    Dia {d}/{m}/{y}
                  </option>
                );
              })}
            </select>
          )}

          {/* Filter by Courier (if all couriers active) */}
          {(!selectedCourierName || selectedCourierName === 'all') && availableCouriers.length > 1 && (
            <select
              className="select"
              value={filterCourier}
              onChange={(e) => setFilterCourier(e.target.value)}
              style={{ fontSize: '0.82rem', height: '36px', minWidth: '160px' }}
            >
              <option value="all">Todos os Motoboys</option>
              {availableCouriers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Orders Table Container */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <table className="data-table" style={{ margin: 0 }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>
                <th style={{ width: '135px' }}>Data / Hora</th>
                <th style={{ width: '110px' }}>Nº Pedido</th>
                <th>Cliente</th>
                <th>Bairro Destino</th>
                <th>Entregador</th>
                <th>Forma de Pgto</th>
                <th style={{ textAlign: 'right', width: '130px' }}>Valor do Pedido</th>
                <th>Obs / Troco</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    Nenhum pedido encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  return (
                    <tr key={item.id}>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatDateTime(item.deliveryDate)}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '0.88rem' }}>
                            #{item.orderNumber}
                          </span>
                          {item.channel && (
                            <span style={{
                              fontSize: '0.65rem',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(56, 189, 248, 0.15)',
                              color: '#38BDF8'
                            }}>
                              {item.channel}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: '#F8FAFC' }}>
                          {item.customerName}
                        </div>
                        {item.customerPhone && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {item.customerPhone}
                          </span>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem' }}>
                          <MapPin size={12} color="#94A3B8" />
                          <span>{item.neighborhood || '-'}</span>
                        </div>
                      </td>

                      <td style={{ fontWeight: 600, color: '#38BDF8', fontSize: '0.82rem' }}>
                        {item.courierName}
                      </td>

                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: config.bgColor,
                          color: config.color
                        }}>
                          {item.paymentMethod}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.95rem', color: config.color }}>
                        {formatCurrency(item.amount)}
                      </td>

                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {item.changeFor && item.changeFor > 0 ? (
                          <span style={{ color: '#FBBF24', fontWeight: 600 }}>
                            Troco p/ {formatCurrency(item.changeFor)}
                          </span>
                        ) : item.notes ? (
                          item.notes
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredItems.length > 0 && (
              <tfoot>
                <tr style={{ position: 'sticky', bottom: 0, backgroundColor: 'var(--bg-card)', fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                  <td colSpan={6} style={{ textAlign: 'right', padding: '10px 14px', fontSize: '0.85rem' }}>
                    TOTAL ({filteredItems.length} pedidos):
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 14px', fontSize: '1.1rem', fontWeight: 800, color: config.color }}>
                    {formatCurrency(totalAmount)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Modal Footer */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-color)',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Exibindo <strong>{filteredItems.length}</strong> de <strong>{items.length}</strong> pedidos conferidos.
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
