import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Bike, 
  Receipt, 
  Users, 
  TrendingUp, 
  Wallet, 
  Target, 
  Settings, 
  Clock, 
  Menu, 
  X,
  Fish,
  LogOut,
  Building2,
  BarChart3
} from 'lucide-react';
import { AuthUser } from '../../lib/auth';

export type TabType = 
  | 'dashboard' 
  | 'performance'
  | 'orders' 
  | 'couriers' 
  | 'payables' 
  | 'fixed_costs'
  | 'freelancers' 
  | 'investments' 
  | 'cash' 
  | 'goals' 
  | 'settings'
  | 'clockin';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  pendingCount: number;
  payablesAlertCount?: number;
  fixedCostsAlertCount?: number;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  setIsOpen,
  pendingCount,
  payablesAlertCount = 0,
  fixedCostsAlertCount = 0,
  currentUser,
  onLogout
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'performance', label: 'Desempenho', icon: BarChart3 },
    { 
      id: 'orders', 
      label: 'Pedidos', 
      icon: ShoppingBag,
      badge: pendingCount > 0 ? pendingCount : null 
    },
    { id: 'couriers', label: 'Motoboys', icon: Bike },
    { 
      id: 'payables', 
      label: 'Insumos / Pagar', 
      icon: Receipt,
      badge: payablesAlertCount > 0 ? payablesAlertCount : null,
      badgeColor: '#FB7185'
    },
    { 
      id: 'fixed_costs', 
      label: 'Custos Fixos', 
      icon: Building2,
      badge: fixedCostsAlertCount > 0 ? fixedCostsAlertCount : null,
      badgeColor: '#FBBF24'
    },
    { id: 'freelancers', label: 'Freelancers', icon: Users },
    { id: 'investments', label: 'Investimentos', icon: TrendingUp },
    { id: 'cash', label: 'Saídas', icon: Wallet },
    { id: 'goals', label: 'Metas', icon: Target },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            zIndex: 40,
            backdropFilter: 'blur(2px)'
          }}
        />
      )}

      {/* Sidebar Container */}
      <aside style={{
        width: '260px',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 50,
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }} className="sidebar-element">
        {/* Logo & Brand Header */}
        <div style={{
          padding: '24px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
              backgroundColor: '#1E0807',
              flexShrink: 0
            }}>
              <img
                src="/logo-umami-zen.png"
                alt="Umami Zen"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div>
              <h1 style={{ fontSize: '1.18rem', color: '#FFFFFF', lineHeight: 1.15, letterSpacing: '0.03em', fontWeight: 800 }}>UMAMI ZEN</h1>
              <span style={{ fontSize: '0.68rem', color: '#FBBF24', letterSpacing: '0.06em', fontWeight: 600 }}>GESTÃO & OPERAÇÃO</span>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'none'
            }}
            className="mobile-close-btn"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as TabType);
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  backgroundColor: isActive ? 'rgba(244, 63, 94, 0.15)' : 'transparent',
                  color: isActive ? '#F43F5E' : 'var(--text-secondary)',
                  border: isActive ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid transparent',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Icon size={18} color={isActive ? '#F43F5E' : '#94A3B8'} />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span style={{
                    backgroundColor: item.badgeColor || '#F43F5E',
                    color: 'white',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    boxShadow: `0 2px 5px ${(item.badgeColor || '#F43F5E')}80`
                  }}>
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Bottom Freelancer Clock-in Shortcut */}
        <div style={{ padding: '16px 14px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => {
              setActiveTab('clockin');
              setIsOpen(false);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              borderRadius: '8px',
              backgroundColor: activeTab === 'clockin' ? 'var(--accent-gold)' : 'rgba(245, 158, 11, 0.12)',
              color: activeTab === 'clockin' ? '#0B0F19' : '#FBBF24',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            <Clock size={16} />
            <span>Registrar Horário (Ponto)</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span>Status Supabase</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10B981' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }}></span>
              Conectado
            </span>
          </div>

          {currentUser && (
            <div style={{
              marginTop: '4px',
              padding: '10px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(244, 63, 94, 0.2)',
                  color: '#F43F5E',
                  border: '1px solid rgba(244, 63, 94, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  flexShrink: 0
                }}>
                  {currentUser.avatarLetter}
                </div>
                <div style={{ overflow: 'hidden', lineHeight: 1.2 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#F1F5F9', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {currentUser.name}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748B', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={currentUser.email}>
                    {currentUser.email}
                  </div>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  title="Sair do sistema"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#F43F5E';
                    e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#94A3B8';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      <style>{`
        @media (min-width: 1024px) {
          .sidebar-element {
            transform: translateX(0) !important;
            position: sticky !important;
          }
        }
        @media (max-width: 1023px) {
          .mobile-close-btn {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
};
