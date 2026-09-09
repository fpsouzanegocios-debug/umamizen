export interface AuthUser {
  email: string;
  name: string;
  avatarLetter: string;
  loggedAt: string;
}

// Credenciais autorizadas definidas pelo administrador
const AUTHORIZED_ACCOUNTS: Array<{ email: string; pass: string; name: string }> = [
  {
    email: 'fpsouzanegocios@gmail.com',
    pass: 'Umami102030*',
    name: 'FP Souza Negócios'
  },
  {
    email: 'umamizen01@gmail.coom',
    pass: 'Umami102030*',
    name: 'Umami Zen'
  },
  {
    // Alias para prevenir erro caso seja digitado com final .com
    email: 'umamizen01@gmail.com',
    pass: 'Umami102030*',
    name: 'Umami Zen'
  }
];

const STORAGE_KEY = 'sushi_gestao_session_user';

export const authService = {
  login: (emailInput: string, passwordInput: string): AuthUser => {
    const cleanEmail = (emailInput || '').trim().toLowerCase();
    const cleanPassword = (passwordInput || '').trim();

    const account = AUTHORIZED_ACCOUNTS.find(
      (acc) => acc.email.toLowerCase() === cleanEmail && acc.pass === cleanPassword
    );

    if (!account) {
      throw new Error('E-mail ou senha incorretos. Acesso restrito a usuários autorizados.');
    }

    const user: AuthUser = {
      email: account.email,
      name: account.name,
      avatarLetter: account.name.charAt(0).toUpperCase() || 'U',
      loggedAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  },

  getCurrentUser: (): AuthUser | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored) as AuthUser;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  },

  logout: (): void => {
    localStorage.removeItem(STORAGE_KEY);
  },

  isAuthenticated: (): boolean => {
    return authService.getCurrentUser() !== null;
  }
};
