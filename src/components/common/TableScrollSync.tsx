import React, { useRef, useState, useEffect } from 'react';

/**
 * Hook to synchronize horizontal scroll between a top scrollbar and table container.
 * Automatically avoids touch conflicts on mobile devices (<= 768px).
 */
export function useSyncedHorizontalScroll<T = any>(dependencyData?: T) {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState<number>(1500);
  const isSyncingRef = useRef<boolean>(false);

  const isMobileScreen = () => {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  };

  const handleTopScroll = () => {
    if (isSyncingRef.current || isMobileScreen()) return;
    isSyncingRef.current = true;
    if (tableContainerRef.current && topScrollRef.current) {
      tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  };

  const handleTableScroll = () => {
    if (isSyncingRef.current || isMobileScreen()) return;
    isSyncingRef.current = true;
    if (topScrollRef.current && tableContainerRef.current) {
      topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  };

  useEffect(() => {
    if (tableContainerRef.current) {
      setScrollWidth(tableContainerRef.current.scrollWidth);
    }
  }, [dependencyData]);

  return {
    topScrollRef,
    tableContainerRef,
    scrollWidth,
    handleTopScroll,
    handleTableScroll
  };
}

export interface TableTopScrollProps {
  topScrollRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  scrollWidth: number;
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  label?: string;
}

export const TableTopScroll: React.FC<TableTopScrollProps> = ({
  topScrollRef,
  onScroll,
  scrollWidth,
  currentPage,
  totalPages,
  totalItems,
  label = 'registros'
}) => {
  return (
    <div className="table-top-scroll-wrapper">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderBottom: 'none',
        borderRadius: '8px 8px 0 0',
        padding: '6px 12px',
        fontSize: '0.75rem',
        color: 'var(--text-muted)'
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#94A3B8' }}>
          ↔ Rolagem Lateral Rápida (topo da tabela)
        </span>
        {currentPage !== undefined && totalPages !== undefined && (
          <span style={{ fontSize: '0.7rem' }}>
            Página {currentPage} de {totalPages} {totalItems !== undefined ? `(${totalItems} ${label})` : ''}
          </span>
        )}
      </div>

      <div
        ref={topScrollRef}
        onScroll={onScroll}
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderBottom: 'none',
          height: '14px'
        }}
      >
        <div style={{ width: `${Math.max(scrollWidth, 1200)}px`, height: '1px' }} />
      </div>
    </div>
  );
};

