import React from 'react';
import { 
  Menu, 
  UploadCloud, 
  PlusCircle, 
  CalendarOff, 
  TrendingUp, 
  Wallet,
  Receipt,
  LogOut
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
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);

  React.useEffect(() => {
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
    <header style={{
      backgroundColor: 'var(--bg-sidebar)',
      borderBottom: '1px solid var(--border-color)',
      padding: '14px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      position: 'sticky',
      top: 0,
      zIndex: 30,
    }}>
      {/* Left side: Hamburger + Period selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
          }}
          className="lg-hide-btn"
        >
          <Menu size={22} />
        </button>

        {/* Category-Specific Date Range Picker Component */}
        {dateRange && onDateRangeChange && CATEGORY_LABELS[activeTab] && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#38BDF8',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              padding: '4px 8px',
              borderRadius: '6px',
              whiteSpace: 'nowrap'
            }}>
              Filtro {CATEGORY_LABELS[activeTab]}
            </span>
            <DateRangePicker 
              value={dateRange} 
              onChange={onDateRangeChange} 
            />
          </div>
        )}
      </div>

      {/* Right side: Quick Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
          <span className="hide-mobile">Importar Arquivos</span>
        </button>

        <button 
          onClick={onOpenNewCash} 
          className="btn btn-secondary btn-sm"
          title="Lançar gasto ou entrada no Caixa"
        >
          <Wallet size={15} color="#38BDF8" />
          <span className="hide-mobile">+ Caixa</span>
        </button>

        <button 
          onClick={onOpenNewPayable} 
          className="btn btn-secondary btn-sm"
          title="Cadastrar Insumo ou Conta a Pagar"
        >
          <Receipt size={15} color="#FBBF24" />
          <span className="hide-mobile">+ Insumo</span>
        </button>

        <button 
          onClick={onOpenNewInvestment} 
          className="btn btn-secondary btn-sm"
          title="Registrar Investimento da empresa"
        >
          <TrendingUp size={15} color="#A855F7" />
          <span className="hide-mobile">+ Investimento</span>
        </button>

        <button 
          onClick={onOpenClosedDay} 
          className="btn btn-secondary btn-sm"
          title="Informar dia em que o restaurante excepcionalmente não abriu"
        >
          <CalendarOff size={15} color="#FB7185" />
          <span className="hide-mobile">Dia Fechado</span>
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
              <span className="hide-mobile">Sair</span>
            </button>
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .lg-hide-btn {
            display: none !important;
          }
        }
        @media (max-width: 640px) {
          .hide-mobile {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
};
