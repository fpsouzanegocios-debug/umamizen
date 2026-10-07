import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  UploadCloud, 
  PlusCircle, 
  CalendarOff, 
  TrendingUp, 
  Wallet,
  Receipt,
  LogOut,
  Zap,
  X,
  Smartphone
} from 'lucide-react';
import { AuthUser } from '../../lib/auth';

import { DateRange, DateFilterCategory } from '../../types';
import { DateRangePicker } from '../common/DateRangePicker';
import { TabType } from './Sidebar';

interface HeaderProps {
  activeTab: TabType;
  onToggleSidebar: () => void;
  onOpenImport: () => void;
  onOpenClosedDay: () => void;
  onOpenNewCash: () => void;
  onOpenNewPayable: () => void;
  onOpenNewInvestment: () => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  selectedMonth?: number;
  selectedYear?: number;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  orders: 'Pedidos',
  couriers: 'Motoboys',
  payables: 'Insumos',
  fixed_costs: 'Custos Fixos',
  freelancers: 'Freelancers',
  investments: 'Investimentos',
  cash: 'Saídas',
  goals: 'Metas'
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onToggleSidebar,
  onOpenImport,
  onOpenClosedDay,
  onOpenNewCash,
  onOpenNewPayable,
  onOpenNewInvestment,
  dateRange,
  onDateRangeChange,
  currentUser,
  onLogout
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showMobileActions, setShowMobileActions] = useState<boolean>(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <>
      <header style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border-color)',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        minHeight: '54px'
      }}>
        {/* Left side: Hamburger + Period selector (desktop) / Brand badge (mobile) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <button
            onClick={onToggleSidebar}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)'
            }}
            className="lg-hide-btn"
            title="Abrir Menu Lateral"
          >
            <Menu size={22} />
          </button>

          {/* Mobile Brand Name + Current Tab Badge */}
          <div className="header-mobile-brand">
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#F8FAFC', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
              🍣 Umami Zen
            </span>
            {CATEGORY_LABELS[activeTab] && (
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#38BDF8',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                padding: '2px 6px',
                borderRadius: '5px',
                whiteSpace: 'nowrap'
              }}>
                {CATEGORY_LABELS[activeTab]}
              </span>
            )}
          </div>

          {/* Category-Specific Date Range Picker (Desktop only to prevent duplicate on mobile) */}
          {dateRange && onDateRangeChange && CATEGORY_LABELS[activeTab] && (
            <div className="header-desktop-datepicker">
              <span 
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#38BDF8',
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                Filtro {CATEGORY_LABELS[activeTab]}
              </span>
              <DateRangePicker 
                value={dateRange} 
                onChange={onDateRangeChange} 
              />
            </div>
          )}
        </div>

        {/* Right side Desktop Actions */}
        <div className="header-desktop-actions">
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="btn btn-gold btn-sm"
              title="Instalar aplicativo no computador ou celular"
            >
              <span>📲 Instalar App</span>
            </button>
          )}

          <button 
            onClick={onOpenImport} 
            className="btn btn-primary btn-sm"
            title="Importar relatórios XLSX de vendas e entregadores"
          >
            <UploadCloud size={16} />
            <span>Importar Arquivos</span>
          </button>

          <button 
            onClick={onOpenNewCash} 
            className="btn btn-secondary btn-sm"
            title="Lançar gasto ou entrada no Caixa"
          >
            <Wallet size={15} color="#38BDF8" />
            <span>+ Caixa</span>
          </button>

          <button 
            onClick={onOpenNewPayable} 
            className="btn btn-secondary btn-sm"
            title="Cadastrar Insumo ou Conta a Pagar"
          >
            <Receipt size={15} color="#FBBF24" />
            <span>+ Insumo</span>
          </button>

          <button 
            onClick={onOpenNewInvestment} 
            className="btn btn-secondary btn-sm"
            title="Registrar Investimento da empresa"
          >
            <TrendingUp size={15} color="#A855F7" />
            <span>+ Investimento</span>
          </button>

          <button 
            onClick={onOpenClosedDay} 
            className="btn btn-secondary btn-sm"
            title="Informar dia em que o restaurante excepcionalmente não abriu"
          >
            <CalendarOff size={15} color="#FB7185" />
            <span>Dia Fechado</span>
          </button>

          {currentUser && onLogout && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginLeft: '6px',
              paddingLeft: '10px',
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <button
                onClick={onLogout}
                className="btn btn-secondary btn-sm"
                style={{
                  color: '#FB7185',
                  borderColor: 'rgba(244, 63, 94, 0.3)',
                  backgroundColor: 'rgba(244, 63, 94, 0.08)'
                }}
                title={`Conectado como ${currentUser.email}. Clique para Sair.`}
              >
                <LogOut size={15} />
                <span>Sair</span>
              </button>
            </div>
          )}
        </div>

        {/* Right side Mobile Actions: Compact, Single-Row */}
        <div className="header-mobile-right">
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="btn btn-gold btn-sm"
              style={{ padding: '6px 9px', fontSize: '0.75rem' }}
              title="Instalar App no Celular"
            >
              <Smartphone size={14} />
              <span>App</span>
            </button>
          )}

          <button
            onClick={() => setShowMobileActions(true)}
            className="btn btn-primary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 11px',
              fontSize: '0.8rem',
              fontWeight: 700
            }}
            title="Abrir menu de ações rápidas"
          >
            <Zap size={14} />
            <span>+ Ações</span>
          </button>

          {currentUser && onLogout && (
            <button
              onClick={onLogout}
              className="btn btn-secondary btn-sm"
              style={{
                padding: '6px 9px',
                color: '#FB7185',
                borderColor: 'rgba(244, 63, 94, 0.3)',
                backgroundColor: 'rgba(244, 63, 94, 0.08)'
              }}
              title="Sair da Conta"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>

        <style>{`
          @media (min-width: 1024px) {
            .lg-hide-btn {
              display: none !important;
            }
          }
        `}</style>
      </header>

      {/* Mobile Quick Actions Action Sheet Modal */}
      {showMobileActions && (
        <div className="modal-overlay" onClick={() => setShowMobileActions(false)}>
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '420px',
              padding: '20px',
              borderRadius: '16px',
              animation: 'slideUp 0.2s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={20} color="#F43F5E" />
                  Ações Rápidas
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Atalhos operacionais rápidos do sistema
                </p>
              </div>
              <button 
                onClick={() => setShowMobileActions(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-secondary)', 
                  cursor: 'pointer', 
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => { setShowMobileActions(false); onOpenImport(); }}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px 14px', width: '100%', gap: '12px' }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(244, 63, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UploadCloud size={18} color="#F43F5E" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#F8FAFC' }}>Importar Arquivos (XLSX)</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Relatórios de vendas e motoboys</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setShowMobileActions(false); onOpenNewCash(); }}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px 14px', width: '100%', gap: '12px' }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={18} color="#38BDF8" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#F8FAFC' }}>Lançar Saída de Caixa</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sangrias, compras ou saídas avulsas</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setShowMobileActions(false); onOpenNewPayable(); }}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px 14px', width: '100%', gap: '12px' }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(251, 191, 24, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Receipt size={18} color="#FBBF24" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#F8FAFC' }}>Cadastrar Insumo / Boleto</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Contas a pagar e notas de fornecedores</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setShowMobileActions(false); onOpenNewInvestment(); }}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px 14px', width: '100%', gap: '12px' }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={18} color="#A855F7" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#F8FAFC' }}>Registrar Investimento</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Equipamentos, reformas e marketing</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setShowMobileActions(false); onOpenClosedDay(); }}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px 14px', width: '100%', gap: '12px' }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(251, 113, 133, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarOff size={18} color="#FB7185" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#F8FAFC' }}>Informar Dia Fechado</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Data em que o restaurante não abriu</div>
                </div>
              </button>

              {currentUser && onLogout && (
                <button
                  type="button"
                  onClick={() => { setShowMobileActions(false); onLogout(); }}
                  className="btn btn-danger"
                  style={{ justifyContent: 'flex-start', padding: '12px 14px', width: '100%', gap: '12px', marginTop: '6px' }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LogOut size={18} color="#EF4444" />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Sair da Conta</div>
                    <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>{currentUser.email}</div>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
