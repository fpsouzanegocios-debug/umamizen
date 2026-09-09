import React, { useState } from 'react';
import { 
  Fish, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  AlertCircle, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { authService, AuthUser } from '../../lib/auth';

interface LoginViewProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    document.title = 'Umami Zen - Gestão Financeira e Operacional';
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Por favor, informe seu e-mail de acesso.');
      return;
    }

    if (!password) {
      setError('Por favor, digite a sua senha.');
      return;
    }

    setLoading(true);

    // Simulação suave de autenticação para ótima sensação de segurança e feedback visual
    setTimeout(() => {
      try {
        const user = authService.login(email, password);
        onLoginSuccess(user);
      } catch (err: any) {
        setError(err?.message || 'Falha ao autenticar. Verifique suas credenciais.');
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#070A11',
      backgroundImage: `
        radial-gradient(circle at 50% 0%, rgba(244, 63, 94, 0.15), transparent 45%),
        radial-gradient(circle at 10% 90%, rgba(245, 158, 11, 0.08), transparent 35%),
        radial-gradient(circle at 90% 80%, rgba(56, 189, 248, 0.06), transparent 35%)
      `,
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Elementos decorativos de fundo */}
      <div style={{
        position: 'absolute',
        top: '-120px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '350px',
        background: 'linear-gradient(180deg, rgba(244, 63, 94, 0.2) 0%, rgba(190, 18, 60, 0) 100%)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Cartão de Login */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: 'rgba(19, 27, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        padding: '40px 32px',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Topo / Marca */}
        {/* Topo / Marca Oficial Umami Zen */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            width: '96px',
            height: '96px',
            borderRadius: '22px',
            overflow: 'hidden',
            margin: '0 auto 16px',
            border: '2px solid rgba(245, 158, 11, 0.4)',
            boxShadow: '0 12px 28px -6px rgba(0, 0, 0, 0.8), 0 0 20px rgba(245, 158, 11, 0.15)',
            backgroundColor: '#1E0807'
          }}>
            <img
              src="/logo-umami-zen.png"
              alt="Umami Zen"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          <h1 style={{
            fontSize: '1.85rem',
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '0.04em',
            margin: '0 0 4px 0',
            fontFamily: "'Outfit', sans-serif"
          }}>
            UMAMI ZEN
          </h1>

          <p style={{
            fontSize: '0.85rem',
            color: '#E2E8F0',
            margin: 0,
            letterSpacing: '0.05em'
          }}>
            Gestão Financeira & Operacional
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '12px',
            padding: '4px 12px',
            borderRadius: '999px',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            fontSize: '0.72rem',
            fontWeight: 600,
            color: '#FB7185'
          }}>
            <ShieldCheck size={13} />
            <span>Área Restrita Exclusiva</span>
          </div>
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <div style={{
            marginBottom: '20px',
            padding: '12px 14px',
            borderRadius: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#FCA5A5',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'fadeIn 0.2s ease-in-out'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, color: '#EF4444' }} />
            <div style={{ flex: 1, lineHeight: 1.4 }}>{error}</div>
          </div>
        )}

        {/* Formulário de Login */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* E-mail */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#CBD5E1',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              E-mail de Acesso
            </label>
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Mail 
                size={18} 
                style={{
                  position: 'absolute',
                  left: '14px',
                  color: '#64748B',
                  pointerEvents: 'none'
                }} 
              />
              <input
                type="email"
                required
                autoFocus
                placeholder="seu.email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  backgroundColor: '#0F172A',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  fontSize: '0.92rem',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#F43F5E';
                  e.target.style.boxShadow = '0 0 0 3px rgba(244, 63, 94, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Senha */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#CBD5E1',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Senha
            </label>
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Lock 
                size={18} 
                style={{
                  position: 'absolute',
                  left: '14px',
                  color: '#64748B',
                  pointerEvents: 'none'
                }} 
              />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 44px 12px 42px',
                  backgroundColor: '#0F172A',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  fontSize: '0.92rem',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#F43F5E';
                  e.target.style.boxShadow = '0 0 0 3px rgba(244, 63, 94, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title={showPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Botão Entrar */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px',
              width: '100%',
              padding: '14px 20px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 8px 20px -4px rgba(244, 63, 94, 0.5)',
              transition: 'all 0.2s ease',
              opacity: loading ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 12px 24px -4px rgba(244, 63, 94, 0.6)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 20px -4px rgba(244, 63, 94, 0.5)';
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: '#FFFFFF',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <span>Acessando...</span>
              </>
            ) : (
              <>
                <span>Entrar no Sistema</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Rodapé informativo de segurança */}
        <div style={{
          marginTop: '28px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: '0.75rem',
            color: '#64748B',
            lineHeight: 1.5,
            margin: 0
          }}>
            🔒 Acesso restrito. Não há opção de auto-cadastro. Apenas operadores e gestores credenciados podem acessar.
          </p>
        </div>
      </div>

      <style>{`
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
