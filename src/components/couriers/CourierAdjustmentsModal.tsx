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
  UserCheck
} from 'lucide-react';
import { CourierAdjustment, Delivery, Courier } from '../../types';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { formatDateBR } from '../../lib/dateUtils';

interface CourierAdjustmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  couriers: Courier[];
  deliveries: Delivery[];
}

export const CourierAdjustmentsModal: React.FC<CourierAdjustmentsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  couriers,
  deliveries
}) => {
  const [adjustments, setAdjustments] = useState<CourierAdjustment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filterTab, setFilterTab] = useState<'pending' | 'resolved'>('pending');
  const [selectedCourierFilter, setSelectedCourierFilter] = useState<string>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState<boolean>(false);

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

  // Filtered adjustments
  const filteredAdjustments = useMemo(() => {
    return adjustments.filter((adj) => {
      if (filterTab === 'pending' && adj.status !== 'pending') return false;
      if (filterTab === 'resolved' && adj.status === 'pending') return false;
      if (selectedCourierFilter !== 'all' && adj.courier_name !== selectedCourierFilter) return false;
      return true;
    });
  }, [adjustments, filterTab, selectedCourierFilter]);

  const pendingCount = useMemo(() => {
    return adjustments.filter((a) => a.status === 'pending').length;
  }, [adjustments]);

  // Handle Approve a Single Adjustment
  const handleApprove = async (adj: CourierAdjustment) => {
    setProcessingId(adj.id);
    try {
      if (adj.type === 'edit_fee' && adj.delivery_id) {
        // Find existing delivery
        const currentDelivery = deliveries.find((d) => d.id === adj.delivery_id);
        const baseRate = Number(currentDelivery?.base_rate || 8.00);
        const newFee = Number(adj.proposed_fee);
        const newAdditional = Math.max(0, newFee - baseRate);
        const finalNeighborhood = (adj.proposed_neighborhood || adj.neighborhood_name || currentDelivery?.neighborhood_name || '').trim();

        // 1. Update the delivery record
        const { error: delError } = await supabase
          .from('deliveries')
          .update({
            neighborhood_name: finalNeighborhood || currentDelivery?.neighborhood_name,
            courier_fee: newFee,
            additional_rate: newAdditional,
            neighborhood_total_rate: newFee,
            is_manually_edited: true,
            notes: (currentDelivery?.notes ? currentDelivery.notes + ' | ' : '') + `Ajuste aprovado: Bairro ${finalNeighborhood} - R$ ${newFee.toFixed(2)} (${adj.notes || ''})`,
            updated_at: new Date().toISOString()
          })
          .eq('id', adj.delivery_id);

        if (delError) throw delError;

      } else if (adj.type === 'new_delivery') {
        // Insert a new delivery record
        const proposedFee = Number(adj.proposed_fee);
        const baseRate = Math.min(8.00, proposedFee);
        const additionalRate = Math.max(0, proposedFee - baseRate);

        const { error: insError } = await supabase
          .from('deliveries')
          .insert({
            external_order_id: `MOTOBOY-${Date.now()}`,
            order_number: adj.order_number || 'AVULSO',
            courier_id: adj.courier_id,
            courier_name: adj.courier_name,
            delivery_date: `${adj.date}T20:00:00`,
            neighborhood_name: adj.neighborhood_name || 'Bairro Avulso',
            base_rate: baseRate,
            additional_rate: additionalRate,
            courier_fee: proposedFee,
            neighborhood_total_rate: proposedFee,
            status: 'delivered',
            is_manually_edited: true,
            notes: `Corrida adicionada pelo motoboy e aprovada: ${adj.notes || ''}`
          });

        if (insError) throw insError;

      } else if (adj.type === 'remove_delivery' && adj.delivery_id) {
        // Delete or detach the delivery
        const { error: delError } = await supabase
          .from('deliveries')
          .delete()
          .eq('id', adj.delivery_id);

        if (delError) throw delError;
      }

      // Mark adjustment as approved
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

  // Handle Reject
  const handleReject = async (adj: CourierAdjustment) => {
    const reason = prompt('Motivo da recusa (opcional):', 'Taxa original mantida conforme tabela');
    if (reason === null) return; // User cancelled

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

  // Handle Approve All Pending
  const handleApproveAllPending = async () => {
    const pendings = filteredAdjustments.filter((a) => a.status === 'pending');
    if (pendings.length === 0) return;

    if (!confirm(`Deseja aprovar todos os ${pendings.length} ajustes pendentes de uma vez? O sistema será atualizado automaticamente.`)) {
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

          await supabase
            .from('deliveries')
            .update({
              neighborhood_name: finalNeighborhood || currentDelivery?.neighborhood_name,
              courier_fee: newFee,
              additional_rate: newAdditional,
              neighborhood_total_rate: newFee,
              is_manually_edited: true,
              notes: (currentDelivery?.notes ? currentDelivery.notes + ' | ' : '') + `Ajuste aprovado: Bairro ${finalNeighborhood} - R$ ${newFee.toFixed(2)}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', adj.delivery_id);

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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 110 }}>
      <div className="modal-content" style={{ maxWidth: '780px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(244, 63, 94, 0.15)',
              color: '#F43F5E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UserCheck size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
                Conferência de Ajustes dos Motoboys
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '2px 0 0 0' }}>
                Verifique as taxas e corridas solicitadas pelos motoboys antes de dar o OK no sistema
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
              <span>Aguardando OK</span>
              {pendingCount > 0 && (
                <span style={{
                  backgroundColor: filterTab === 'pending' ? '#FFFFFF' : '#F43F5E',
                  color: filterTab === 'pending' ? '#F43F5E' : '#FFFFFF',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  fontWeight: 800
                }}>
                  {pendingCount}
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
              <span>Histórico (Aprovados / Recusados)</span>
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
            {filterTab === 'pending' && filteredAdjustments.length > 0 && (
              <button
                onClick={handleApproveAllPending}
                disabled={isProcessingAll}
                className="btn btn-primary btn-sm"
                style={{ backgroundColor: '#10B981', borderColor: '#10B981' }}
              >
                <Check size={14} />
                <span>{isProcessingAll ? 'Aprovando...' : 'Dar OK em Todos'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              Carregando solicitações...
            </div>
          )}

          {!isLoading && filteredAdjustments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={40} color="#10B981" style={{ margin: '0 auto 12px auto' }} />
              <div style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '1rem' }}>
                {filterTab === 'pending' 
                  ? 'Nenhuma solicitação aguardando conferência!' 
                  : 'Nenhum histórico encontrado.'}
              </div>
              <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                {filterTab === 'pending'
                  ? 'Todas as corridas e taxas informadas pelos motoboys já foram conferidas.'
                  : 'Os ajustes aprovados ou recusados aparecerão aqui.'}
              </p>
            </div>
          )}

          {!isLoading && filteredAdjustments.map((adj) => {
            const isPending = adj.status === 'pending';
            const isApproved = adj.status === 'approved';
            const isRejected = adj.status === 'rejected';

            const diff = Number(adj.proposed_fee) - Number(adj.original_fee);

            return (
              <div
                key={adj.id}
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: '12px',
                  padding: '16px',
                  border: isPending
                    ? '1px solid rgba(245, 158, 11, 0.4)'
                    : isApproved
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : '1px solid rgba(239, 68, 68, 0.25)',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)'
                }}
              >
                {/* Card Top: Courier name + Badges */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontWeight: 800,
                      color: '#F8FAFC',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <Bike size={14} color="#F43F5E" />
                      <span>{adj.courier_name}</span>
                    </div>

                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {formatDateBR(new Date(adj.date + 'T12:00:00'))}
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
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isPending && (
                      <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        <span>Aguardando seu OK</span>
                      </span>
                    )}
                    {isApproved && (
                      <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} />
                        <span>Aprovado no Sistema</span>
                      </span>
                    )}
                    {isRejected && (
                      <span className="badge badge-danger">
                        Recusado
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '10px'
                }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pedido / Bairro</div>
                    <div style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '0.9rem', marginTop: '2px' }}>
                      #{adj.order_number || 'S/N'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {adj.original_neighborhood && adj.proposed_neighborhood && adj.original_neighborhood !== adj.proposed_neighborhood ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          <span style={{ textDecoration: 'line-through', color: '#94A3B8' }}>{adj.original_neighborhood}</span>
                          <span style={{ color: '#38BDF8' }}>➔</span>
                          <span style={{ fontWeight: 700, color: '#38BDF8' }}>{adj.proposed_neighborhood}</span>
                        </div>
                      ) : (
                        <span>{adj.proposed_neighborhood || adj.neighborhood_name || 'Bairro informado'}</span>
                      )}
                    </div>
                  </div>

                  {/* Comparison: Original vs Proposed */}
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Comparativo de Taxa</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      {adj.type === 'edit_fee' && (
                        <>
                          <span style={{ color: 'var(--text-secondary)', textDecoration: 'line-through', fontSize: '0.85rem' }}>
                            {formatCurrency(adj.original_fee)}
                          </span>
                          <ArrowRight size={14} color="#94A3B8" />
                          <span style={{ fontWeight: 800, color: '#34D399', fontSize: '1.05rem' }}>
                            {formatCurrency(adj.proposed_fee)}
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: diff >= 0 ? '#34D399' : '#FB7185' }}>
                            ({diff >= 0 ? '+' : ''}{formatCurrency(diff)})
                          </span>
                        </>
                      )}

                      {adj.type === 'new_delivery' && (
                        <div style={{ fontWeight: 800, color: '#34D399', fontSize: '1.05rem' }}>
                          + {formatCurrency(adj.proposed_fee)}
                        </div>
                      )}

                      {adj.type === 'remove_delivery' && (
                        <div style={{ fontWeight: 800, color: '#FB7185', fontSize: '1.05rem' }}>
                          Remover (era {formatCurrency(adj.original_fee)})
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Motoboy Note */}
                {adj.notes && (
                  <div style={{
                    fontSize: '0.8rem',
                    color: '#CBD5E1',
                    marginBottom: '12px',
                    padding: '8px 10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '8px',
                    borderLeft: '3px solid var(--accent-primary)'
                  }}>
                    <strong>Observação do Motoboy:</strong> "{adj.notes}"
                  </div>
                )}

                {/* Action Buttons (Approve / Reject) */}
                {isPending && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      disabled={processingId === adj.id || isProcessingAll}
                      onClick={() => handleReject(adj)}
                      className="btn btn-secondary btn-sm"
                      style={{ color: '#FB7185', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                    >
                      <X size={14} />
                      <span>Recusar</span>
                    </button>

                    <button
                      type="button"
                      disabled={processingId === adj.id || isProcessingAll}
                      onClick={() => handleApprove(adj)}
                      className="btn btn-primary btn-sm"
                      style={{ backgroundColor: '#10B981', borderColor: '#10B981' }}
                    >
                      <Check size={14} />
                      <span>{processingId === adj.id ? 'Atualizando...' : 'Dar OK (Aprovar no Sistema)'}</span>
                    </button>
                  </div>
                )}
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
