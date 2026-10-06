import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Bike, 
  Calendar, 
  ArrowRight, 
  MapPin, 
  Trash2, 
  Edit3, 
  Plus, 
  DollarSign, 
  UserCheck, 
  User, 
  Banknote,
  ChevronDown,
  ChevronUp,
  Package,
  Layers,
  FileText
} from 'lucide-react';
import { CourierAdjustment, Delivery, Courier, Order } from '../../types';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { formatDateBR } from '../../lib/dateUtils';

interface CourierAdjustmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  couriers: Courier[];
  deliveries: Delivery[];
  orders?: Order[];
}

export const CourierAdjustmentsModal: React.FC<CourierAdjustmentsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  couriers,
  deliveries,
  orders = []
}) => {
  const [adjustments, setAdjustments] = useState<CourierAdjustment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filterTab, setFilterTab] = useState<'pending' | 'resolved'>('pending');
  const [selectedCourierFilter, setSelectedCourierFilter] = useState<string>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState<boolean>(false);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [expandedDeliveryLists, setExpandedDeliveryLists] = useState<Record<string, boolean>>({});

  // Fetch all adjustments from database
  const fetchAdjustments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('courier_adjustments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar solicitações de motoboys:', error);
      } else if (data) {
        setAdjustments(data as CourierAdjustment[]);
      }
    } catch (err) {
      console.error('Falha ao carregar ajustes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAdjustments();
    }
  }, [isOpen]);

  // Fast map to find matching order and customer name
  const ordersMap = useMemo(() => {
    const map = new Map<string, Order>();
    if (orders) {
      orders.forEach((o) => {
        if (o.external_order_id) map.set(o.external_order_id, o);
        if (o.order_number) map.set(o.order_number, o);
        if (o.id) map.set(o.id, o);
      });
    }
    return map;
  }, [orders]);

  const getCustomerName = (adj: CourierAdjustment): string | null => {
    if (adj.customer_name) return adj.customer_name;
    if (adj.delivery_id) {
      const del = deliveries.find(d => d.id === adj.delivery_id);
      if (del) {
        const order = ordersMap.get(del.external_order_id) || (del.order_number ? ordersMap.get(del.order_number) : undefined);
        if (order?.customer_name) return order.customer_name;
      }
    }
    if (adj.order_number) {
      const order = ordersMap.get(adj.order_number);
      if (order?.customer_name) return order.customer_name;
    }
    return null;
  };

  // Group adjustments by Date and Courier for Daily Conference
  const dailyConferenceGroups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      courierName: string;
      courierId: string;
      date: string;
      adjustments: CourierAdjustment[];
    }>();

    adjustments.forEach((adj) => {
      if (selectedCourierFilter !== 'all' && adj.courier_name !== selectedCourierFilter) {
        return;
      }
      const groupKey = `${adj.courier_name}_${adj.date}`;
      if (!map.has(groupKey)) {
        map.set(groupKey, {
          key: groupKey,
          courierName: adj.courier_name,
          courierId: adj.courier_id,
          date: adj.date,
          adjustments: []
        });
      }
      map.get(groupKey)!.adjustments.push(adj);
    });

    const groups = Array.from(map.values()).map((grp) => {
      // Find all registered deliveries for this courier and date
      const dayDeliveries = deliveries.filter(d => {
        const matchCourier = d.courier_name === grp.courierName || d.courier_id === grp.courierId;
        const dDate = d.delivery_date ? (d.delivery_date.startsWith(grp.date) || d.delivery_date.split('T')[0] === grp.date) : false;
        return matchCourier && dDate;
      });

      const pendingAdjustments = grp.adjustments.filter(a => a.status === 'pending');
      const hasPending = pendingAdjustments.length > 0;
      const conferenceRecord = grp.adjustments.find(a => a.type === 'daily_conference');

      // 1. Deliveries count
      const removedDeliveryIds = new Set(
        grp.adjustments
          .filter(a => a.type === 'remove_delivery' && a.status !== 'rejected')
          .map(a => a.delivery_id)
          .filter(Boolean)
      );
      const activeDeliveries = dayDeliveries.filter(d => !removedDeliveryIds.has(d.id));
      const addedDeliveries = grp.adjustments.filter(a => a.type === 'new_delivery' && a.status !== 'rejected');
      const totalDeliveriesCount = activeDeliveries.length + addedDeliveries.length;

      // 2. Fees Calculation
      let totalFees = 0;
      activeDeliveries.forEach(d => {
        const editAdj = grp.adjustments.find(a => a.type === 'edit_fee' && a.delivery_id === d.id && a.status !== 'rejected');
        if (editAdj) {
          totalFees += Number(editAdj.proposed_fee);
        } else {
          totalFees += Number(d.courier_fee || 0);
        }
      });
      addedDeliveries.forEach(a => {
        totalFees += Number(a.proposed_fee || 0);
      });

      // 3. Retained Cash Calculation
      let totalRetainedCash = 0;
      activeDeliveries.forEach(d => {
        const cashAdj = grp.adjustments.find(a => a.delivery_id === d.id && a.status !== 'rejected' && a.received_cash);
        if (cashAdj) {
          totalRetainedCash += Number(cashAdj.received_cash);
        } else if (d.payment_method?.toLowerCase() === 'dinheiro' || d.payment_method?.toLowerCase() === 'cash') {
          const order = ordersMap.get(d.external_order_id) || (d.order_number ? ordersMap.get(d.order_number) : undefined);
          totalRetainedCash += Number(d.order_amount ?? order?.gross_amount ?? 0);
        }
      });
      addedDeliveries.forEach(a => {
        if (a.received_cash) totalRetainedCash += Number(a.received_cash);
      });
      if (conferenceRecord?.received_cash && Number(conferenceRecord.received_cash) > totalRetainedCash) {
        totalRetainedCash = Number(conferenceRecord.received_cash);
      }

      const netBalance = totalFees - totalRetainedCash;

      return {
        ...grp,
        dayDeliveries,
        pendingCount: pendingAdjustments.length,
        hasPending,
        conferenceRecord,
        totalDeliveriesCount,
        totalFees,
        totalRetainedCash,
        netBalance
      };
    });

    // Filter by pending vs resolved
    return groups
      .filter((g) => {
        if (filterTab === 'pending') return g.hasPending;
        if (filterTab === 'resolved') return !g.hasPending;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [adjustments, filterTab, selectedCourierFilter, deliveries, ordersMap]);

  const totalPendingCount = useMemo(() => {
    return adjustments.filter((a) => a.status === 'pending').length;
  }, [adjustments]);

  // Handle Approve a Single Adjustment Item
  const handleApprove = async (adj: CourierAdjustment) => {
    setProcessingId(adj.id);
    try {
      if (adj.type === 'edit_fee' && adj.delivery_id) {
        const currentDelivery = deliveries.find((d) => d.id === adj.delivery_id);
        const baseRate = Number(currentDelivery?.base_rate || 8.00);
        const newFee = Number(adj.proposed_fee);
        const newAdditional = Math.max(0, newFee - baseRate);
        const finalNeighborhood = (adj.proposed_neighborhood || adj.neighborhood_name || currentDelivery?.neighborhood_name || '').trim();

        const updatePayload: any = {
          neighborhood_name: finalNeighborhood || currentDelivery?.neighborhood_name,
          courier_fee: newFee,
          additional_rate: newAdditional,
          neighborhood_total_rate: newFee,
          is_manually_edited: true,
          notes: (currentDelivery?.notes ? currentDelivery.notes + ' | ' : '') + `Ajuste aprovado: Bairro ${finalNeighborhood} - R$ ${newFee.toFixed(2)} (${adj.notes || ''})`,
          updated_at: new Date().toISOString()
        };

        if (adj.received_cash) {
          updatePayload.payment_method = 'Dinheiro';
          updatePayload.order_amount = Number(adj.received_cash);
        } else if (adj.payment_method) {
          updatePayload.payment_method = adj.payment_method;
        }

        const { error: delError } = await supabase
          .from('deliveries')
          .update(updatePayload)
          .eq('id', adj.delivery_id);

        if (delError) throw delError;

        if ((adj.payment_method === 'Dinheiro' || adj.received_cash) && currentDelivery?.external_order_id) {
          await supabase
            .from('orders')
            .update({ final_payment_method: 'Dinheiro' })
            .eq('external_order_id', currentDelivery.external_order_id);
        }

      } else if (adj.type === 'new_delivery') {
        const proposedFee = Number(adj.proposed_fee);
        const baseRate = Math.min(8.00, proposedFee);
        const additionalRate = Math.max(0, proposedFee - baseRate);

        const { error: insError } = await supabase
          .from('deliveries')
          .insert({
            external_order_id: `MOTOBOY-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            order_number: adj.order_number || 'AVULSO',
            courier_id: adj.courier_id,
            courier_name: adj.courier_name,
            delivery_date: `${adj.date}T20:00:00`,
            neighborhood_name: adj.neighborhood_name || 'Bairro Avulso',
            base_rate: baseRate,
            additional_rate: additionalRate,
            courier_fee: proposedFee,
            neighborhood_total_rate: proposedFee,
            order_amount: adj.received_cash ? Number(adj.received_cash) : 0,
            payment_method: adj.payment_method || (adj.received_cash ? 'Dinheiro' : 'Cartão / App'),
            status: 'delivered',
            is_manually_edited: true,
            notes: `Corrida adicionada pelo motoboy e aprovada: ${adj.notes || ''}`
          });

        if (insError) throw insError;

      } else if (adj.type === 'remove_delivery' && adj.delivery_id) {
        const { error: delError } = await supabase
          .from('deliveries')
          .delete()
          .eq('id', adj.delivery_id);

        if (delError) throw delError;
      }

      const { error: adjError } = await supabase
        .from('courier_adjustments')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: 'Administrador'
        })
        .eq('id', adj.id);

      if (adjError) throw adjError;

      await fetchAdjustments();
      onSuccess();
    } catch (err: any) {
      alert('Erro ao aprovar ajuste: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Reject a Single Adjustment Item
  const handleReject = async (adj: CourierAdjustment) => {
    const reason = prompt('Motivo da recusa (opcional):', 'Taxa original mantida conforme tabela');
    if (reason === null) return;

    setProcessingId(adj.id);
    try {
      const { error } = await supabase
        .from('courier_adjustments')
        .update({
          status: 'rejected',
          notes: (adj.notes ? adj.notes + ' | ' : '') + `Recusado: ${reason}`,
          reviewed_at: new Date().toISOString(),
          reviewed_by: 'Administrador'
        })
        .eq('id', adj.id);

      if (error) throw error;

      await fetchAdjustments();
      onSuccess();
    } catch (err: any) {
      alert('Erro ao recusar ajuste: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Approve ENTIRE DAY CONFERENCE for a Courier
  const handleApproveDayGroup = async (group: typeof dailyConferenceGroups[0]) => {
    const pendings = group.adjustments.filter((a) => a.status === 'pending');
    if (pendings.length === 0) return;

    if (!confirm(`Deseja aprovar a conferência completa de ${group.courierName} do dia ${formatDateBR(new Date(group.date + 'T12:00:00'))} com todas as ${pendings.length} solicitações?`)) {
      return;
    }

    setProcessingId(group.key);
    try {
      for (const adj of pendings) {
        if (adj.type === 'edit_fee' && adj.delivery_id) {
          const currentDelivery = deliveries.find((d) => d.id === adj.delivery_id);
          const baseRate = Number(currentDelivery?.base_rate || 8.00);
          const newFee = Number(adj.proposed_fee);
          const newAdditional = Math.max(0, newFee - baseRate);
          const finalNeighborhood = (adj.proposed_neighborhood || adj.neighborhood_name || currentDelivery?.neighborhood_name || '').trim();

          const updatePayload: any = {
            neighborhood_name: finalNeighborhood || currentDelivery?.neighborhood_name,
            courier_fee: newFee,
            additional_rate: newAdditional,
            neighborhood_total_rate: newFee,
            is_manually_edited: true,
            notes: (currentDelivery?.notes ? currentDelivery.notes + ' | ' : '') + `Ajuste aprovado: Bairro ${finalNeighborhood} - R$ ${newFee.toFixed(2)}`,
            updated_at: new Date().toISOString()
          };

          if (adj.received_cash) {
            updatePayload.payment_method = 'Dinheiro';
            updatePayload.order_amount = Number(adj.received_cash);
          } else if (adj.payment_method) {
            updatePayload.payment_method = adj.payment_method;
          }

          await supabase
            .from('deliveries')
            .update(updatePayload)
            .eq('id', adj.delivery_id);

          if ((adj.payment_method === 'Dinheiro' || adj.received_cash) && currentDelivery?.external_order_id) {
            await supabase
              .from('orders')
              .update({ final_payment_method: 'Dinheiro' })
              .eq('external_order_id', currentDelivery.external_order_id);
          }

        } else if (adj.type === 'new_delivery') {
          const proposedFee = Number(adj.proposed_fee);
          const baseRate = Math.min(8.00, proposedFee);
          const additionalRate = Math.max(0, proposedFee - baseRate);

          await supabase
            .from('deliveries')
            .insert({
              external_order_id: `MOTOBOY-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              order_number: adj.order_number || 'AVULSO',
              courier_id: adj.courier_id,
              courier_name: adj.courier_name,
              delivery_date: `${adj.date}T20:00:00`,
              neighborhood_name: adj.neighborhood_name || 'Bairro Avulso',
              base_rate: baseRate,
              additional_rate: additionalRate,
              courier_fee: proposedFee,
              neighborhood_total_rate: proposedFee,
              order_amount: adj.received_cash ? Number(adj.received_cash) : 0,
              payment_method: adj.payment_method || (adj.received_cash ? 'Dinheiro' : 'Cartão / App'),
              status: 'delivered',
              is_manually_edited: true,
              notes: `Corrida adicionada pelo motoboy e aprovada: ${adj.notes || ''}`
            });

        } else if (adj.type === 'remove_delivery' && adj.delivery_id) {
          await supabase
            .from('deliveries')
            .delete()
            .eq('id', adj.delivery_id);
        }

        await supabase
          .from('courier_adjustments')
          .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: 'Administrador'
          })
          .eq('id', adj.id);
      }

      await fetchAdjustments();
      onSuccess();
    } catch (err: any) {
      alert('Erro ao aprovar conferência do dia: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Approve ALL Pending Days
  const handleApproveAllPending = async () => {
    const pendings = adjustments.filter((a) => a.status === 'pending');
    if (pendings.length === 0) return;

    if (!confirm(`Deseja aprovar todas as ${pendings.length} solicitações pendentes de todos os motoboys de uma só vez?`)) {
      return;
    }

    setIsProcessingAll(true);
    try {
      for (const adj of pendings) {
        if (adj.type === 'edit_fee' && adj.delivery_id) {
          const currentDelivery = deliveries.find((d) => d.id === adj.delivery_id);
          const baseRate = Number(currentDelivery?.base_rate || 8.00);
          const newFee = Number(adj.proposed_fee);
          const newAdditional = Math.max(0, newFee - baseRate);
          const finalNeighborhood = (adj.proposed_neighborhood || adj.neighborhood_name || currentDelivery?.neighborhood_name || '').trim();

          const updatePayload: any = {
            neighborhood_name: finalNeighborhood || currentDelivery?.neighborhood_name,
            courier_fee: newFee,
            additional_rate: newAdditional,
            neighborhood_total_rate: newFee,
            is_manually_edited: true,
            notes: (currentDelivery?.notes ? currentDelivery.notes + ' | ' : '') + `Ajuste aprovado: Bairro ${finalNeighborhood} - R$ ${newFee.toFixed(2)}`,
            updated_at: new Date().toISOString()
          };

          if (adj.received_cash) {
            updatePayload.payment_method = 'Dinheiro';
            updatePayload.order_amount = Number(adj.received_cash);
          } else if (adj.payment_method) {
            updatePayload.payment_method = adj.payment_method;
          }

          await supabase
            .from('deliveries')
            .update(updatePayload)
            .eq('id', adj.delivery_id);

          if ((adj.payment_method === 'Dinheiro' || adj.received_cash) && currentDelivery?.external_order_id) {
            await supabase
              .from('orders')
              .update({ final_payment_method: 'Dinheiro' })
              .eq('external_order_id', currentDelivery.external_order_id);
          }

        } else if (adj.type === 'new_delivery') {
          const proposedFee = Number(adj.proposed_fee);
          const baseRate = Math.min(8.00, proposedFee);
          const additionalRate = Math.max(0, proposedFee - baseRate);

          await supabase
            .from('deliveries')
            .insert({
              external_order_id: `MOTOBOY-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              order_number: adj.order_number || 'AVULSO',
              courier_id: adj.courier_id,
              courier_name: adj.courier_name,
              delivery_date: `${adj.date}T20:00:00`,
              neighborhood_name: adj.neighborhood_name || 'Bairro Avulso',
              base_rate: baseRate,
              additional_rate: additionalRate,
              courier_fee: proposedFee,
              neighborhood_total_rate: proposedFee,
              order_amount: adj.received_cash ? Number(adj.received_cash) : 0,
              payment_method: adj.payment_method || (adj.received_cash ? 'Dinheiro' : 'Cartão / App'),
              status: 'delivered',
              is_manually_edited: true,
              notes: `Corrida adicionada pelo motoboy e aprovada: ${adj.notes || ''}`
            });

        } else if (adj.type === 'remove_delivery' && adj.delivery_id) {
          await supabase
            .from('deliveries')
            .delete()
            .eq('id', adj.delivery_id);
        }

        await supabase
          .from('courier_adjustments')
          .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: 'Administrador'
          })
          .eq('id', adj.id);
      }

      await fetchAdjustments();
      onSuccess();
    } catch (err: any) {
      alert('Erro ao aprovar em lote: ' + err.message);
    } finally {
      setIsProcessingAll(false);
    }
  };

  const toggleDayExpansion = (key: string) => {
    setExpandedDays(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleDeliveryList = (key: string) => {
    setExpandedDeliveryLists(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 110 }}>
      <div className="modal-content" style={{ maxWidth: '880px', width: '96%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(244, 63, 94, 0.15)',
              color: '#F43F5E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UserCheck size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
                Conferência Diária dos Motoboys
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '2px 0 0 0' }}>
                Todas as corridas, taxas e dinheiro retido agrupados por dia para conferência completa
              </p>
            </div>
          </div>

          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Filter Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '14px 0',
          borderBottom: '1px solid var(--border-color)'
        }}>
          {/* Tabs: Pendentes vs Resolvidos */}
          <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.05)', padding: '3px', borderRadius: '8px' }}>
            <button
              onClick={() => setFilterTab('pending')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: filterTab === 'pending' ? '#F43F5E' : 'transparent',
                color: filterTab === 'pending' ? '#FFFFFF' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>Aguardando Conferência</span>
              {totalPendingCount > 0 && (
                <span style={{
                  backgroundColor: filterTab === 'pending' ? '#FFFFFF' : '#F43F5E',
                  color: filterTab === 'pending' ? '#F43F5E' : '#FFFFFF',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  fontWeight: 800
                }}>
                  {totalPendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setFilterTab('resolved')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: filterTab === 'resolved' ? 'var(--accent-primary)' : 'transparent',
                color: filterTab === 'resolved' ? '#FFFFFF' : 'var(--text-secondary)'
              }}
            >
              <span>Histórico Concluído</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Filter by Courier */}
            <select
              className="select"
              value={selectedCourierFilter}
              onChange={(e) => setSelectedCourierFilter(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '6px 10px', minWidth: '150px' }}
            >
              <option value="all">Todos os Motoboys</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            {/* Batch Approve Button */}
            {filterTab === 'pending' && totalPendingCount > 0 && (
              <button
                onClick={handleApproveAllPending}
                disabled={isProcessingAll}
                className="btn btn-primary btn-sm"
                style={{ backgroundColor: '#10B981', borderColor: '#10B981', fontWeight: 700 }}
              >
                <Check size={14} />
                <span>{isProcessingAll ? 'Aprovando...' : 'Dar OK em Tudo'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Body: Grouped by Day */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              Carregando conferências dos motoboys...
            </div>
          )}

          {!isLoading && dailyConferenceGroups.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={44} color="#10B981" style={{ margin: '0 auto 12px auto' }} />
              <div style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '1.05rem' }}>
                {filterTab === 'pending' 
                  ? 'Nenhuma conferência aguardando aprovação!' 
                  : 'Nenhum histórico encontrado.'}
              </div>
              <p style={{ fontSize: '0.85rem', marginTop: '6px', maxWidth: '420px', marginInline: 'auto' }}>
                {filterTab === 'pending'
                  ? 'Todas as conferências diárias e ajustes informados pelos motoboys já foram conferidos e aprovados.'
                  : 'Os fechamentos aprovados ou recusados aparecerão aqui.'}
              </p>
            </div>
          )}

          {!isLoading && dailyConferenceGroups.map((group) => {
            const isProcessingThis = processingId === group.key;
            const adjustmentsOnly = group.adjustments.filter(a => a.type !== 'daily_conference');

            return (
              <div
                key={group.key}
                style={{
                  backgroundColor: '#1E293B',
                  borderRadius: '14px',
                  border: group.hasPending
                    ? '1.5px solid rgba(245, 158, 11, 0.5)'
                    : '1px solid rgba(16, 185, 129, 0.4)',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
                  overflow: 'hidden'
                }}
              >
                {/* Day Card Header */}
                <div style={{
                  backgroundColor: group.hasPending ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.06)',
                  padding: '14px 18px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      backgroundColor: 'rgba(244, 63, 94, 0.2)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontWeight: 800,
                      color: '#F8FAFC',
                      fontSize: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <Bike size={16} color="#F43F5E" />
                      <span>{group.courierName}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#CBD5E1', fontSize: '0.88rem', fontWeight: 600 }}>
                      <Calendar size={15} color="#38BDF8" />
                      <span>{formatDateBR(new Date(group.date + 'T12:00:00'))}</span>
                    </div>

                    {group.conferenceRecord && (
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor: 'rgba(56, 189, 248, 0.15)',
                        color: '#38BDF8',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: '6px',
                        padding: '2px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <FileText size={12} />
                        <span>Fechamento Enviado</span>
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div>
                    {group.hasPending ? (
                      <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', fontSize: '0.8rem' }}>
                        <Clock size={13} />
                        <span>{group.pendingCount} solicitação(ões) aguardando OK</span>
                      </span>
                    ) : (
                      <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', fontSize: '0.8rem' }}>
                        <CheckCircle2 size={13} />
                        <span>Conferência 100% Aprovada</span>
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ padding: '16px 18px' }}>
                  {/* Motoboy General Shift Note */}
                  {group.conferenceRecord?.notes && (
                    <div style={{
                      backgroundColor: 'rgba(56, 189, 248, 0.08)',
                      borderLeft: '4px solid #38BDF8',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '14px',
                      color: '#E2E8F0',
                      fontSize: '0.84rem'
                    }}>
                      <strong style={{ color: '#38BDF8' }}>💬 Mensagem do Motoboy no Fechamento:</strong> "{group.conferenceRecord.notes}"
                    </div>
                  )}

                  {/* Daily Financial Consolidated Settlement Box */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '10px',
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}>
                    {/* Corridas */}
                    <div>
                      <div style={{ fontSize: '0.74rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Package size={13} />
                        <span>Corridas do Dia</span>
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F8FAFC', marginTop: '2px' }}>
                        {group.totalDeliveriesCount}
                      </div>
                    </div>

                    {/* Taxas a Pagar */}
                    <div>
                      <div style={{ fontSize: '0.74rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <DollarSign size={13} />
                        <span>Total de Taxas</span>
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34D399', marginTop: '2px' }}>
                        {formatCurrency(group.totalFees)}
                      </div>
                    </div>

                    {/* Dinheiro Retido */}
                    <div>
                      <div style={{ fontSize: '0.74rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Banknote size={13} />
                        <span>Dinheiro Retido em Mãos</span>
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: group.totalRetainedCash > 0 ? '#FBBF24' : '#CBD5E1', marginTop: '2px' }}>
                        {formatCurrency(group.totalRetainedCash)}
                      </div>
                    </div>

                    {/* Saldo Líquido do Acerto */}
                    <div style={{
                      backgroundColor: group.netBalance >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.15)',
                      border: group.netBalance >= 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: '8px',
                      padding: '8px 12px'
                    }}>
                      <div style={{ fontSize: '0.72rem', color: group.netBalance >= 0 ? '#34D399' : '#FB7185', fontWeight: 700 }}>
                        {group.netBalance >= 0 ? 'Líquido a Pagar ao Motoboy' : 'Motoboy Deve Repassar'}
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: group.netBalance >= 0 ? '#34D399' : '#FB7185', marginTop: '2px' }}>
                        {formatCurrency(Math.abs(group.netBalance))}
                      </div>
                    </div>
                  </div>

                  {/* List of All Adjustments for this Day Together */}
                  {adjustmentsOnly.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: '#CBD5E1',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Layers size={14} color="#F43F5E" />
                          <span>Solicitações e Alterações Relacionadas ao Dia ({adjustmentsOnly.length}):</span>
                        </div>
                        <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                          Conferidas juntas abaixo
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {adjustmentsOnly.map((adj) => {
                          const customerName = getCustomerName(adj);
                          const isPending = adj.status === 'pending';
                          const isApproved = adj.status === 'approved';
                          const isRejected = adj.status === 'rejected';
                          const diff = Number(adj.proposed_fee) - Number(adj.original_fee);

                          return (
                            <div
                              key={adj.id}
                              style={{
                                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                                border: isPending ? '1px solid rgba(245, 158, 11, 0.4)' : isApproved ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.25)',
                                borderRadius: '10px',
                                padding: '12px 14px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 800, color: '#F8FAFC', fontSize: '0.92rem' }}>
                                      #{adj.order_number || 'S/N'}
                                    </span>

                                    {/* Type badge */}
                                    <span style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      backgroundColor: 
                                        adj.type === 'edit_fee' ? 'rgba(56, 189, 248, 0.15)' :
                                        adj.type === 'new_delivery' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                      color:
                                        adj.type === 'edit_fee' ? '#38BDF8' :
                                        adj.type === 'new_delivery' ? '#FBBF24' : '#FB7185'
                                    }}>
                                      {adj.type === 'edit_fee' ? '✏️ Ajuste de Taxa' :
                                       adj.type === 'new_delivery' ? '➕ Corrida Faltante' : '🗑️ Remoção de Corrida'}
                                    </span>

                                    {customerName && (
                                      <span style={{ fontSize: '0.82rem', color: '#38BDF8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <User size={13} />
                                        <span>{customerName}</span>
                                      </span>
                                    )}
                                  </div>

                                  {/* Cash Info */}
                                  {adj.received_cash && (
                                    <div style={{
                                      marginTop: '4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                      border: '1px solid rgba(245, 158, 11, 0.35)',
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      fontSize: '0.75rem',
                                      color: '#FBBF24',
                                      fontWeight: 700
                                    }}>
                                      <Banknote size={13} />
                                      <span>Recebido em Dinheiro: {formatCurrency(adj.received_cash)}</span>
                                    </div>
                                  )}

                                  {/* Neighborhood Info */}
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    {adj.original_neighborhood && adj.proposed_neighborhood && adj.original_neighborhood !== adj.proposed_neighborhood ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <span style={{ textDecoration: 'line-through', color: '#94A3B8' }}>{adj.original_neighborhood}</span>
                                        <span style={{ color: '#38BDF8' }}>➔</span>
                                        <span style={{ fontWeight: 700, color: '#38BDF8' }}>{adj.proposed_neighborhood}</span>
                                      </div>
                                    ) : (
                                      <span>{adj.proposed_neighborhood || adj.neighborhood_name || 'Bairro informado'}</span>
                                    )}
                                  </div>

                                  {/* Note */}
                                  {adj.notes && (
                                    <div style={{ fontSize: '0.78rem', color: '#CBD5E1', marginTop: '4px', fontStyle: 'italic' }}>
                                      "{adj.notes}"
                                    </div>
                                  )}
                                </div>

                                {/* Comparison & Individual Item Actions */}
                                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {adj.type === 'edit_fee' && (
                                      <>
                                        <span style={{ color: 'var(--text-secondary)', textDecoration: 'line-through', fontSize: '0.82rem' }}>
                                          {formatCurrency(adj.original_fee)}
                                        </span>
                                        <ArrowRight size={13} color="#94A3B8" />
                                        <span style={{ fontWeight: 800, color: '#34D399', fontSize: '0.95rem' }}>
                                          {formatCurrency(adj.proposed_fee)}
                                        </span>
                                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: diff >= 0 ? '#34D399' : '#FB7185' }}>
                                          ({diff >= 0 ? '+' : ''}{formatCurrency(diff)})
                                        </span>
                                      </>
                                    )}

                                    {adj.type === 'new_delivery' && (
                                      <div style={{ fontWeight: 800, color: '#34D399', fontSize: '0.95rem' }}>
                                        + {formatCurrency(adj.proposed_fee)}
                                      </div>
                                    )}

                                    {adj.type === 'remove_delivery' && (
                                      <div style={{ fontWeight: 800, color: '#FB7185', fontSize: '0.95rem' }}>
                                        Remover (-{formatCurrency(adj.original_fee)})
                                      </div>
                                    )}
                                  </div>

                                  {/* Item Status / Actions */}
                                  {isPending ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <button
                                        type="button"
                                        disabled={processingId === adj.id || isProcessingThis}
                                        onClick={() => handleReject(adj)}
                                        style={{
                                          padding: '3px 8px',
                                          borderRadius: '6px',
                                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                          border: '1px solid rgba(239, 68, 68, 0.3)',
                                          color: '#FB7185',
                                          fontSize: '0.72rem',
                                          fontWeight: 600,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Recusar item
                                      </button>
                                      <button
                                        type="button"
                                        disabled={processingId === adj.id || isProcessingThis}
                                        onClick={() => handleApprove(adj)}
                                        style={{
                                          padding: '3px 8px',
                                          borderRadius: '6px',
                                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                          border: '1px solid rgba(16, 185, 129, 0.35)',
                                          color: '#34D399',
                                          fontSize: '0.72rem',
                                          fontWeight: 700,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Aprovar item
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '0.74rem', color: isApproved ? '#34D399' : '#FB7185', fontWeight: 700 }}>
                                      {isApproved ? 'Aprovado' : 'Recusado'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Toggle View Full Deliveries of the Day */}
                  {group.dayDeliveries.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={() => toggleDeliveryList(group.key)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#38BDF8',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 0'
                        }}
                      >
                        {expandedDeliveryLists[group.key] ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        <span>
                          {expandedDeliveryLists[group.key] ? 'Ocultar corridas do dia' : `Ver todas as ${group.dayDeliveries.length} corridas deste dia`}
                        </span>
                      </button>

                      {expandedDeliveryLists[group.key] && (
                        <div style={{
                          marginTop: '8px',
                          backgroundColor: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '8px',
                          padding: '10px',
                          maxHeight: '220px',
                          overflowY: 'auto'
                        }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                            <thead>
                              <tr style={{ color: '#94A3B8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'left' }}>
                                <th style={{ padding: '6px' }}>Pedido</th>
                                <th style={{ padding: '6px' }}>Cliente</th>
                                <th style={{ padding: '6px' }}>Bairro</th>
                                <th style={{ padding: '6px' }}>Pagamento</th>
                                <th style={{ padding: '6px', textAlign: 'right' }}>Taxa</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.dayDeliveries.map((del) => {
                                const order = ordersMap.get(del.external_order_id) || (del.order_number ? ordersMap.get(del.order_number) : undefined);
                                const isCash = (del.payment_method?.toLowerCase() === 'dinheiro' || del.payment_method?.toLowerCase() === 'cash');
                                return (
                                  <tr key={del.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                    <td style={{ padding: '6px', fontWeight: 700, color: '#F8FAFC' }}>
                                      #{del.order_number || del.external_order_id}
                                    </td>
                                    <td style={{ padding: '6px', color: '#38BDF8' }}>
                                      {order?.customer_name || '-'}
                                    </td>
                                    <td style={{ padding: '6px', color: '#CBD5E1' }}>
                                      {del.neighborhood_name}
                                    </td>
                                    <td style={{ padding: '6px' }}>
                                      {isCash ? (
                                        <span style={{ color: '#FBBF24', fontWeight: 700 }}>
                                          💵 Dinheiro ({formatCurrency(del.order_amount || order?.gross_amount || 0)})
                                        </span>
                                      ) : (
                                        <span style={{ color: '#94A3B8' }}>{del.payment_method || 'Cartão / App'}</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: '#34D399' }}>
                                      {formatCurrency(del.courier_fee)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Day Footer Actions: Master Approve Button */}
                  {group.hasPending && (
                    <div style={{
                      marginTop: '14px',
                      paddingTop: '12px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '10px'
                    }}>
                      <button
                        type="button"
                        disabled={isProcessingThis}
                        onClick={() => handleApproveDayGroup(group)}
                        className="btn btn-primary btn-sm"
                        style={{
                          backgroundColor: '#10B981',
                          borderColor: '#10B981',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                          padding: '10px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Check size={16} />
                        <span>
                          {isProcessingThis
                            ? 'Aprovando dia completo...'
                            : `Dar OK e Aprovar Conferência do Dia (${group.pendingCount} itens)`}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
