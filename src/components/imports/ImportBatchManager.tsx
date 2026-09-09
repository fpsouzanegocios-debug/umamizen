import React, { useState, useEffect, useCallback } from 'react';
import { 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  FileSpreadsheet, 
  Package, 
  Bike, 
  Calendar, 
  AlertCircle,
  X,
  ShoppingBag
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ImportBatch } from '../../types';
import { formatDateTime } from '../../lib/formatters';

interface BatchWithCounts extends ImportBatch {
  ordersCount: number;
  deliveriesCount: number;
  ordersFilename?: string;
  couriersFilename?: string;
}

type RemoveTargetType = 'orders_only' | 'deliveries_only' | 'both' | 'all_orders' | 'all_deliveries';

interface ConfirmState {
  target: RemoveTargetType;
  batch?: BatchWithCounts;
  title: string;
  description: string;
  countWarning: string;
}

interface ImportBatchManagerProps {
  onDataChanged: () => void;
}

export const ImportBatchManager: React.FC<ImportBatchManagerProps> = ({ onDataChanged }) => {
  const [batches, setBatches] = useState<BatchWithCounts[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const { data: batchList, error: batchErr } = await supabase
        .from('import_batches')
        .select('*')
        .order('created_at', { ascending: false });

      if (batchErr) throw batchErr;

      const batchesWithCounts: BatchWithCounts[] = [];

      for (const b of (batchList || [])) {
        const { count: ordCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('import_batch_id', b.id);

        const { count: delCount } = await supabase
          .from('deliveries')
          .select('*', { count: 'exact', head: true })
          .eq('import_batch_id', b.id);

        // Separar nomes de arquivos se vieram combinados com " | "
        let ordersFile = '';
        let couriersFile = '';

        if (b.filename && b.filename.includes(' | ')) {
          const parts = b.filename.split(' | ');
          ordersFile = parts[0]?.trim() || '';
          couriersFile = parts[1]?.trim() || '';
        } else if (b.file_type === 'orders') {
          ordersFile = b.filename || '';
        } else if (b.file_type === 'couriers') {
          couriersFile = b.filename || '';
        } else {
          // Heurística pelo nome do arquivo
          if (b.filename?.toLowerCase().includes('entregador')) {
            couriersFile = b.filename;
          } else {
            ordersFile = b.filename || '';
          }
        }

        batchesWithCounts.push({
          ...b,
          ordersCount: ordCount || 0,
          deliveriesCount: delCount || 0,
          ordersFilename: ordersFile,
          couriersFilename: couriersFile
        });
      }

      setBatches(batchesWithCounts);
    } catch (err: any) {
      console.error('Erro ao carregar lotes de importação:', err);
      setErrorMessage(err?.message || 'Falha ao buscar histórico de relatórios.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // Excluir apenas os Pedidos / Vendas de um lote específico
  const handleRemoveOrdersFromBatch = async (batch: BatchWithCounts) => {
    setDeletingKey(`${batch.id}_orders`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Buscar referências de pedidos para limpar pendências
      const { data: relatedOrders } = await supabase
        .from('orders')
        .select('order_number, external_order_id')
        .eq('import_batch_id', batch.id);

      // 2. Excluir pedidos vinculados
      const { error: ordErr } = await supabase
        .from('orders')
        .delete()
        .eq('import_batch_id', batch.id);

      if (ordErr) throw ordErr;

      // 3. Excluir pendências ligadas a esses pedidos
      if (relatedOrders && relatedOrders.length > 0) {
        const orderRefs = relatedOrders.flatMap(o => [
          o.order_number ? `Pedido #${o.order_number}` : null,
          o.order_number || null,
          o.external_order_id || null
        ]).filter(Boolean) as string[];

        if (orderRefs.length > 0) {
          await supabase.from('pending_issues').delete().in('reference_id', orderRefs);
        }
      }

      // 4. Se não há mais entregas no lote, remover o lote. Se ainda há, atualizar lote.
      if (batch.deliveriesCount === 0) {
        await supabase.from('import_batches').delete().eq('id', batch.id);
      } else {
        await supabase.from('import_batches').update({
          file_type: 'couriers',
          filename: batch.couriersFilename || batch.filename
        }).eq('id', batch.id);
      }

      setSuccessMessage(`Relatório de Vendas (Pedidos) removido com sucesso! ${batch.ordersCount} pedidos foram excluídos.`);
      setConfirmState(null);
      await fetchBatches();
      onDataChanged();
    } catch (err: any) {
      console.error('Erro ao excluir vendas do lote:', err);
      setErrorMessage(err?.message || 'Erro ao remover relatório de vendas.');
    } finally {
      setDeletingKey(null);
    }
  };

  // Excluir apenas os Entregadores / Motoboys de um lote específico
  const handleRemoveDeliveriesFromBatch = async (batch: BatchWithCounts) => {
    setDeletingKey(`${batch.id}_deliveries`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Excluir entregas vinculadas
      const { error: delErr } = await supabase
        .from('deliveries')
        .delete()
        .eq('import_batch_id', batch.id);

      if (delErr) throw delErr;

      // 2. Se não há mais pedidos no lote, remover o lote. Se ainda há, atualizar lote.
      if (batch.ordersCount === 0) {
        await supabase.from('import_batches').delete().eq('id', batch.id);
      } else {
        await supabase.from('import_batches').update({
          file_type: 'orders',
          filename: batch.ordersFilename || batch.filename
        }).eq('id', batch.id);
      }

      setSuccessMessage(`Relatório de Entregadores (Motoboys) removido com sucesso! ${batch.deliveriesCount} entregas foram excluídas.`);
      setConfirmState(null);
      await fetchBatches();
      onDataChanged();
    } catch (err: any) {
      console.error('Erro ao excluir entregas do lote:', err);
      setErrorMessage(err?.message || 'Erro ao remover relatório de entregadores.');
    } finally {
      setDeletingKey(null);
    }
  };

  // Excluir ambos os relatórios do lote
  const handleRemoveBothFromBatch = async (batch: BatchWithCounts) => {
    setDeletingKey(`${batch.id}_both`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Buscar referências de pedidos para limpar pendências
      const { data: relatedOrders } = await supabase
        .from('orders')
        .select('order_number, external_order_id')
        .eq('import_batch_id', batch.id);

      // 2. Excluir pedidos
      await supabase.from('orders').delete().eq('import_batch_id', batch.id);

      // 3. Excluir entregas
      await supabase.from('deliveries').delete().eq('import_batch_id', batch.id);

      // 4. Excluir pendências
      if (relatedOrders && relatedOrders.length > 0) {
        const orderRefs = relatedOrders.flatMap(o => [
          o.order_number ? `Pedido #${o.order_number}` : null,
          o.order_number || null,
          o.external_order_id || null
        ]).filter(Boolean) as string[];

        if (orderRefs.length > 0) {
          await supabase.from('pending_issues').delete().in('reference_id', orderRefs);
        }
      }

      // 5. Excluir lote
      await supabase.from('import_batches').delete().eq('id', batch.id);

      setSuccessMessage(`Ambos os relatórios foram removidos com sucesso! ${batch.ordersCount} pedidos e ${batch.deliveriesCount} entregas foram excluídos.`);
      setConfirmState(null);
      await fetchBatches();
      onDataChanged();
    } catch (err: any) {
      console.error('Erro ao excluir lote completo:', err);
      setErrorMessage(err?.message || 'Erro ao remover relatórios.');
    } finally {
      setDeletingKey(null);
    }
  };

  // Excluir todos os pedidos de vendas do sistema
  const handleRemoveAllOrdersGlobal = async () => {
    setDeletingKey('all_orders');
    setErrorMessage(null);
    try {
      await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // Atualizar lotes para constar apenas entregas
      await supabase.from('import_batches').update({ file_type: 'couriers' }).eq('file_type', 'both');
      setSuccessMessage('Todos os relatórios e dados de vendas/pedidos foram excluídos do sistema. Os dados de entregadores foram mantidos intactos.');
      setConfirmState(null);
      await fetchBatches();
      onDataChanged();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao remover todas as vendas.');
    } finally {
      setDeletingKey(null);
    }
  };

  // Excluir todas as entregas de motoboys do sistema
  const handleRemoveAllDeliveriesGlobal = async () => {
    setDeletingKey('all_deliveries');
    setErrorMessage(null);
    try {
      await supabase.from('deliveries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // Atualizar lotes para constar apenas pedidos
      await supabase.from('import_batches').update({ file_type: 'orders' }).eq('file_type', 'both');
      setSuccessMessage('Todos os relatórios e dados de entregadores/motoboys foram excluídos do sistema. Os dados de vendas/pedidos foram mantidos intactos.');
      setConfirmState(null);
      await fetchBatches();
      onDataChanged();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao remover todas as entregas.');
    } finally {
      setDeletingKey(null);
    }
  };

  // Executar a exclusão confirmada
  const executeConfirmedAction = () => {
    if (!confirmState) return;

    if (confirmState.target === 'orders_only' && confirmState.batch) {
      handleRemoveOrdersFromBatch(confirmState.batch);
    } else if (confirmState.target === 'deliveries_only' && confirmState.batch) {
      handleRemoveDeliveriesFromBatch(confirmState.batch);
    } else if (confirmState.target === 'both' && confirmState.batch) {
      handleRemoveBothFromBatch(confirmState.batch);
    } else if (confirmState.target === 'all_orders') {
      handleRemoveAllOrdersGlobal();
    } else if (confirmState.target === 'all_deliveries') {
      handleRemoveAllDeliveriesGlobal();
    }
  };

  const totalOrders = batches.reduce((acc, b) => acc + b.ordersCount, 0);
  const totalDeliveries = batches.reduce((acc, b) => acc + b.deliveriesCount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Alerta de Sucesso */}
      {successMessage && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: '10px',
          padding: '12px 16px',
          color: '#34D399',
          fontSize: '0.86rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          animation: 'fadeIn 0.2s'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{successMessage}</span>
          </div>
          <button 
            onClick={() => setSuccessMessage(null)}
            style={{ background: 'none', border: 'none', color: '#34D399', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Alerta de Erro */}
      {errorMessage && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '10px',
          padding: '12px 16px',
          color: '#FCA5A5',
          fontSize: '0.86rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          animation: 'fadeIn 0.2s'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
          <button 
            onClick={() => setErrorMessage(null)}
            style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* OS 2 RELATÓRIOS SEPARADOS (SEM DUPLICAÇÃO) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '16px'
      }}>
        {/* CARD 1: RELATÓRIO DE VENDAS / PEDIDOS */}
        {(() => {
          const ordersBatch = batches.find(b => b.ordersCount > 0);
          const hasOrders = totalOrders > 0;

          return (
            <div style={{
              backgroundColor: 'rgba(56, 189, 248, 0.05)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '14px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(56, 189, 248, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#38BDF8'
                    }}>
                      <ShoppingBag size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', color: '#FFFFFF', margin: 0 }}>
                        1. Relatório de Vendas (Pedidos)
                      </h3>
                      <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                        iFood / AiqFome / Site / Balcão
                      </span>
                    </div>
                  </div>

                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    backgroundColor: hasOrders ? 'rgba(56, 189, 248, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                    color: hasOrders ? '#38BDF8' : '#94A3B8',
                    fontSize: '0.76rem',
                    fontWeight: 700
                  }}>
                    {totalOrders} pedidos ativos
                  </span>
                </div>

                <div style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '12px',
                  fontSize: '0.78rem'
                }}>
                  <div style={{ color: '#E2E8F0', fontWeight: 600, wordBreak: 'break-all', marginBottom: '4px' }}>
                    📄 {ordersBatch?.ordersFilename || (hasOrders ? 'Planilha de Vendas' : 'Nenhum relatório de vendas importado')}
                  </div>
                  {ordersBatch?.created_at && (
                    <div style={{ color: '#94A3B8', fontSize: '0.72rem' }}>
                      Importado em: {formatDateTime(ordersBatch.created_at)}
                    </div>
                  )}
                </div>

                <p style={{ fontSize: '0.8rem', color: '#94A3B8', lineHeight: 1.4, margin: 0 }}>
                  Remove exclusivamente os pedidos importados desta planilha, sem alterar nenhuma entrega ou repasse de motoboy.
                </p>
              </div>

              <button
                onClick={() => {
                  if (!ordersBatch) {
                    alert('Não há dados de pedidos de vendas carregados no sistema.');
                    return;
                  }
                  setConfirmState({
                    target: 'orders_only',
                    batch: ordersBatch,
                    title: 'Remover Relatório de Vendas (Pedidos)',
                    description: `Tem certeza que deseja remover o Relatório de Vendas "${ordersBatch.ordersFilename || ordersBatch.filename}"?`,
                    countWarning: `Serão excluídos ${ordersBatch.ordersCount} pedidos do sistema. As entregas dos motoboys NÃO serão afetadas e permanecerão salvas.`
                  });
                }}
                disabled={!hasOrders || loading}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  borderRadius: '8px',
                  backgroundColor: hasOrders ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                  border: hasOrders ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: hasOrders ? '#FB7185' : '#64748B',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: hasOrders ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (hasOrders) {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.22)';
                    e.currentTarget.style.color = '#FFFFFF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (hasOrders) {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                    e.currentTarget.style.color = '#FB7185';
                  }
                }}
              >
                <Trash2 size={16} />
                <span>Remover Relatório de Vendas ({totalOrders} pedidos)</span>
              </button>
            </div>
          );
        })()}

        {/* CARD 2: RELATÓRIO DE ENTREGADORES / MOTOBOYS */}
        {(() => {
          const couriersBatch = batches.find(b => b.deliveriesCount > 0);
          const hasDeliveries = totalDeliveries > 0;

          return (
            <div style={{
              backgroundColor: 'rgba(245, 158, 11, 0.05)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '14px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FBBF24'
                    }}>
                      <Bike size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', color: '#FFFFFF', margin: 0 }}>
                        2. Relatório de Entregadores (Motoboys)
                      </h3>
                      <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                        Diárias / Taxas / Entregas
                      </span>
                    </div>
                  </div>

                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    backgroundColor: hasDeliveries ? 'rgba(245, 158, 11, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                    color: hasDeliveries ? '#FBBF24' : '#94A3B8',
                    fontSize: '0.76rem',
                    fontWeight: 700
                  }}>
                    {totalDeliveries} entregas ativas
                  </span>
                </div>

                <div style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '12px',
                  fontSize: '0.78rem'
                }}>
                  <div style={{ color: '#E2E8F0', fontWeight: 600, wordBreak: 'break-all', marginBottom: '4px' }}>
                    📄 {couriersBatch?.couriersFilename || (hasDeliveries ? 'Planilha de Entregadores' : 'Nenhum relatório de entregadores importado')}
                  </div>
                  {couriersBatch?.created_at && (
                    <div style={{ color: '#94A3B8', fontSize: '0.72rem' }}>
                      Importado em: {formatDateTime(couriersBatch.created_at)}
                    </div>
                  )}
                </div>

                <p style={{ fontSize: '0.8rem', color: '#94A3B8', lineHeight: 1.4, margin: 0 }}>
                  Remove exclusivamente os dados de entregas dos motoboys, sem alterar nenhum dado de vendas ou pedidos.
                </p>
              </div>

              <button
                onClick={() => {
                  if (!couriersBatch) {
                    alert('Não há dados de entregas de motoboys carregados no sistema.');
                    return;
                  }
                  setConfirmState({
                    target: 'deliveries_only',
                    batch: couriersBatch,
                    title: 'Remover Relatório de Entregadores (Motoboys)',
                    description: `Tem certeza que deseja remover o Relatório de Entregadores "${couriersBatch.couriersFilename || couriersBatch.filename}"?`,
                    countWarning: `Serão excluídas ${couriersBatch.deliveriesCount} entregas do sistema. As vendas e pedidos NÃO serão afetados e permanecerão salvos.`
                  });
                }}
                disabled={!hasDeliveries || loading}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  borderRadius: '8px',
                  backgroundColor: hasDeliveries ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                  border: hasDeliveries ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: hasDeliveries ? '#FBBF24' : '#64748B',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: hasDeliveries ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (hasDeliveries) {
                    e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.22)';
                    e.currentTarget.style.color = '#FFFFFF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (hasDeliveries) {
                    e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.12)';
                    e.currentTarget.style.color = '#FBBF24';
                  }
                }}
              >
                <Trash2 size={16} />
                <span>Remover Relatório de Entregadores ({totalDeliveries} entregas)</span>
              </button>
            </div>
          );
        })()}
      </div>

      {/* RODAPÉ COM AÇÕES ADICIONAIS LIMPAS */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        paddingTop: '10px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <button
          onClick={fetchBatches}
          disabled={loading}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}
        >
          <RefreshCw size={13} className={loading ? 'spin-icon' : ''} />
          <span>Atualizar Dados</span>
        </button>

        {totalOrders > 0 && totalDeliveries > 0 && (
          <button
            onClick={() => {
              const activeBatch = batches.find(b => b.ordersCount > 0 && b.deliveriesCount > 0) || batches[0];
              if (!activeBatch) return;
              setConfirmState({
                target: 'both',
                batch: activeBatch,
                title: 'Remover Ambos os Relatórios',
                description: `Deseja excluir simultaneamente os dois relatórios importados?`,
                countWarning: `Serão excluídos ${totalOrders} pedidos E ${totalDeliveries} entregas de motoboys.`
              });
            }}
            disabled={Boolean(deletingKey)}
            className="btn btn-sm"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              color: '#FB7185',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              fontSize: '0.76rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Excluir tanto as vendas quanto as entregas importadas"
          >
            <Trash2 size={13} />
            <span>Remover Ambos os Relatórios Juntos</span>
          </button>
        )}
      </div>

      {/* MODAL DE CONFIRMAÇÃO SEPARADA */}
      {confirmState && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.78)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 120,
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '460px',
            backgroundColor: 'var(--bg-card)',
            border: confirmState.target === 'deliveries_only' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(244, 63, 94, 0.4)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: confirmState.target === 'deliveries_only' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <AlertTriangle size={22} color={confirmState.target === 'deliveries_only' ? '#FBBF24' : '#F43F5E'} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', color: '#FFFFFF', margin: 0 }}>
                  {confirmState.title}
                </h3>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Ação de remoção cirúrgica e segura
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.86rem', color: '#CBD5E1', lineHeight: 1.5, marginBottom: '16px' }}>
              {confirmState.description}
            </p>

            <div style={{
              backgroundColor: confirmState.target === 'deliveries_only' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(244, 63, 94, 0.08)',
              border: confirmState.target === 'deliveries_only' ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(244, 63, 94, 0.25)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '20px',
              fontSize: '0.82rem',
              color: confirmState.target === 'deliveries_only' ? '#FDE68A' : '#FECDD3',
              lineHeight: 1.4
            }}>
              {confirmState.countWarning}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmState(null)}
                disabled={Boolean(deletingKey)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={executeConfirmedAction}
                disabled={Boolean(deletingKey)}
                style={{
                  backgroundColor: confirmState.target === 'deliveries_only' ? '#D97706' : '#E11D48',
                  borderColor: confirmState.target === 'deliveries_only' ? '#B45309' : '#BE123C',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {deletingKey ? (
                  <>
                    <RefreshCw size={14} className="spin-icon" />
                    <span>Removendo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .spin-icon {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
