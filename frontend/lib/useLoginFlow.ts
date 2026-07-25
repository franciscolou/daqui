import { useState } from 'react';
import { router } from 'expo-router';
import { ApiError } from './api';
import { useAuth } from './auth';

// Lógica do fluxo de login (senha → 2FA ou verificação de e-mail pendente,
// quando aplicável), compartilhada entre app/(auth)/login.tsx e o painel de
// login embutido em app/(auth)/welcome.tsx (versão desktop), pra evitar que
// as duas telas divirjam de novo quando o fluxo mudar.
export function useLoginFlow() {
  const { login, verifyLogin2fa, verifyEmailCode, resendVerification } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 'login': formulário normal. 'verify'/'2fa': senha certa, mas falta um
  // segundo passo — guardamos o ticket devolvido e pedimos o código de 6
  // dígitos (por e-mail não confirmado, ou por A2F, respectivamente).
  const [mode, setMode] = useState<'login' | 'verify' | '2fa'>('login');
  const [ticket, setTicket] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const onCodeChange = (t: string) => {
    setCode(t.replace(/[^0-9]/g, '').slice(0, 6));
    setResent(false);
  };

  const handleLogin = async () => {
    if (submitting) return;
    setError(null);
    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      if (result.status === '2fa' || result.status === 'verify') {
        setMode(result.status);
        setTicket(result.ticket);
        setCode('');
      } else {
        router.replace('/(tabs)');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao entrar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (submitting) return;
    setError(null);
    if (code.trim().length < 6) {
      setError(
        mode === '2fa'
          ? 'Digite o código de 6 dígitos do seu app autenticador.'
          : 'Digite o código de 6 dígitos que enviamos por e-mail.',
      );
      return;
    }
    setSubmitting(true);
    try {
      if (mode === '2fa') await verifyLogin2fa(ticket!, code.trim());
      else await verifyEmailCode(ticket!, code.trim());
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível verificar o código.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resending || !ticket) return;
    setError(null);
    setResent(false);
    setResending(true);
    try {
      setTicket(await resendVerification(ticket));
      setCode('');
      setResent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível reenviar o código.');
    } finally {
      setResending(false);
    }
  };

  const cancelSecondStep = () => {
    setMode('login');
    setTicket(null);
    setCode('');
    setError(null);
  };

  return {
    email, setEmail, password, setPassword, showPassword, setShowPassword,
    submitting, error,
    mode, ticket, code, onCodeChange,
    resending, resent,
    handleLogin, handleVerify, handleResend, cancelSecondStep,
  };
}

export type LoginFlow = ReturnType<typeof useLoginFlow>;
