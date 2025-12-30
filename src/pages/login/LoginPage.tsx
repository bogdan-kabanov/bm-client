import { useState } from 'react';
import { useAppDispatch } from '@src/shared/lib/hooks';
import { loginWithEmail } from '@src/features/auth/authCheck';
import { useLanguage } from '@src/app/providers/useLanguage';

interface LoginPageProps {
  onLoginSuccess: (token: string) => void;
}

export const LoginPage = ({ onLoginSuccess }: LoginPageProps) => {
  const dispatch = useAppDispatch();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
        const result = await dispatch(loginWithEmail({ email, password }));
        if (loginWithEmail.rejected.match(result)) {
          const errorMessage = result.payload as string;

          // Маппинг ошибок от authCheck.tsx
          if (errorMessage.includes('Invalid email or password') || errorMessage.includes('Invalid credentials')) {
            setError(t('auth.errors.invalidCredentials'));
          } else if (errorMessage.includes('Invalid password')) {
            setError(t('auth.errors.invalidPassword'));
          } else if (errorMessage.includes('User not found')) {
            setError(t('auth.errors.invalidCredentials'));
          } else if (errorMessage.includes('Session expired')) {
            setError(t('auth.errors.sessionExpired'));
          } else if (errorMessage.includes('Network error')) {
            setError(t('auth.errors.networkError'));
          } else if (errorMessage.includes('Server error')) {
            setError(t('auth.errors.serverError'));
          } else {
            setError(t('auth.errors.loginFailed'));
          }
        } else {
          onLoginSuccess(result.payload.token);
        }
    } catch (err: any) {
      if (err?.message?.includes('Network Error')) {
        setError(t('auth.errors.networkError'));
      } else {
        setError(t('auth.errors.unknownError'));
      }
    }
  };

  return (
    <div className="login-page" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh', 
      background: '#f0f2f5',
      zIndex: 1,
      position: 'relative'
    }}>
      <h2>{t('auth.loginTitle')}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '300px' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.email')}
          autoComplete="email"
          required
          style={{ padding: '10px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth.password')}
          autoComplete="current-password"
          required
          style={{ padding: '10px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        <button 
          type="submit"
          style={{ 
            padding: '10px', 
            fontSize: '16px', 
            background: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px', 
            cursor: 'pointer' 
          }}
        >
          {t('auth.loginButton')}
        </button>
      </form>
      {error && (
        <p style={{ color: 'red', marginTop: '10px' }}>
          {error}
        </p>
      )}
    </div>
  );
};