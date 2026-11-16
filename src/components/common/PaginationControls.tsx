import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  pageSizeOptions?: number[];
  labelSingular?: string;
  labelPlural?: string;
  themeColor?: string;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  pageSizeOptions = [10, 15, 25, 50, 100],
  labelSingular = 'item',
  labelPlural = 'itens',
  themeColor = '#F43F5E'
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * itemsPerPage + 1;
  const endItem = Math.min(safePage * itemsPerPage, totalItems);

  const pages: (number | string)[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    if (safePage <= 3) {
      pages.push(1, 2, 3, 4, '...', totalPages);
    } else if (safePage >= totalPages - 2) {
      pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages);
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px',
      padding: '12px 16px',
      backgroundColor: 'var(--bg-card)',
      borderTop: '1px solid var(--border-color)',
      borderRadius: '0 0 10px 10px'
    }}>
      {/* Items info and items per page selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
        <span>
          Mostrando <strong style={{ color: '#F8FAFC' }}>{startItem}</strong> a <strong style={{ color: '#F8FAFC' }}>{endItem}</strong> de <strong style={{ color: '#F8FAFC' }}>{totalItems}</strong> {totalItems === 1 ? labelSingular : labelPlural}
        </span>

        {onItemsPerPageChange && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
            <span style={{ fontSize: '0.78rem' }}>Por pág:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                onItemsPerPageChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="select"
              style={{
                width: '68px',
                padding: '2px 6px',
                fontSize: '0.78rem',
                height: '28px',
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-color)'
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page navigation buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          className="btn btn-secondary btn-sm"
          style={{ padding: '6px 10px', fontSize: '0.78rem', opacity: safePage <= 1 ? 0.35 : 1 }}
          title="Primeira página"
        >
          « Primeira
        </button>

        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '6px 10px', fontSize: '0.78rem', opacity: safePage <= 1 ? 0.35 : 1 }}
        >
          <ChevronLeft size={14} />
          <span>Anterior</span>
        </button>

        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`dots-${idx}`} style={{ padding: '0 5px', color: '#64748B', fontSize: '0.82rem' }}>
                ...
              </span>
            );
          }
          const pageNum = Number(p);
          const isActive = pageNum === safePage;
          return (
            <button
              key={`p-${pageNum}-${idx}`}
              type="button"
              onClick={() => onPageChange(pageNum)}
              style={{
                minWidth: '32px',
                height: '32px',
                padding: '0 6px',
                borderRadius: '8px',
                backgroundColor: isActive ? themeColor : 'rgba(255, 255, 255, 0.05)',
                border: isActive ? `1px solid ${themeColor}` : '1px solid rgba(255, 255, 255, 0.1)',
                color: isActive ? '#FFFFFF' : '#CBD5E1',
                fontSize: '0.8rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '6px 10px', fontSize: '0.78rem', opacity: safePage >= totalPages ? 0.35 : 1 }}
        >
          <span>Próxima</span>
          <ChevronRight size={14} />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage >= totalPages}
          className="btn btn-secondary btn-sm"
          style={{ padding: '6px 10px', fontSize: '0.78rem', opacity: safePage >= totalPages ? 0.35 : 1 }}
          title="Última página"
        >
          Última »
        </button>
      </div>
    </div>
  );
};
