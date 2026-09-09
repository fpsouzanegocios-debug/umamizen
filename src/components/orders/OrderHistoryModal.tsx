import React, { useEffect, useState } from 'react';
import { X, History, Clock, User, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { OrderChangeHistory } from '../../types';
import { formatDateTime } from '../../lib/formatters';

interface OrderHistoryModalProps {
  isOpen: boolean;
  orderId: string | null;
  orderNumber: string;
  onClose: () => void;
}

export const OrderHistoryModal: React.FC<OrderHistoryModalProps> = ({
  isOpen,
  orderId,
  orderNumber,
  onClose
}) => {
  const [history, setHistory] = useState<OrderChangeHistory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchHistory();
    }
  }, [isOpen, orderId]);

  const fetchHistory = async () => {
    if (!orderId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_change_history')
        .select('*')
        .eq('order_id', orderId)
        .order('changed_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching order history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={22} color="#F59E0B" />
            <h3 style={{ fontSize: '1.2rem' }}>Histórico de Alterações - Pedido #{orderNumber}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Carregando histórico...
          </div>
        ) : history.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Nenhuma alteração manual registrada para este pedido. Os dados permanecem idênticos à importação original.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
            {history.map((item) => (
              <div
                key={item.id}
                style={{
                  backgroundColor: 'var(--bg-input)',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} /> {formatDateTime(item.changed_at)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#FBBF24' }}>
                    <User size={13} /> {item.changed_by}
                  </span>
                </div>

                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                    {item.field_name}:
                  </span>{' '}
                  <span style={{ color: '#FB7185', textDecoration: 'line-through' }}>
                    {item.old_value || '(vazio)'}
                  </span>{' '}
                  <ArrowRight size={12} style={{ display: 'inline', margin: '0 4px', color: 'var(--text-muted)' }} />{' '}
                  <span style={{ color: '#34D399', fontWeight: 600 }}>
                    {item.new_value || '(vazio)'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
