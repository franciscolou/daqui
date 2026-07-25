import { useState } from 'react';
import { api, ApiError } from './api';
import { useAuth } from './auth';
import { useAvailability, AvailabilityState } from './useAvailability';

const emailLooksReady = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());

// Lógica do fluxo de cadastro (conta → verificar e-mail → pronto),
// compartilhada entre app/(auth)/signup.tsx e o painel de cadastro embutido
// em app/(auth)/welcome.tsx (versão desktop), pra evitar que as duas telas
// divirjam de novo quando o fluxo mudar.
export function useSignupFlow() {
  const { signup, verifyEmailCode, resendVerification } = useAuth();

  const [step, setStep] = useState(0); // 0 conta, 1 verificar e-mail, 2 pronto
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const usernameCheck = useAvailability(username, api.checkSignupUsername, {
    ready: (v) => v.length >= 3,
  });
  const emailCheck = useAvailability(email, api.checkSignupEmail, { ready: emailLooksReady });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ticket identifica a verificação pendente (devolvido pelo cadastro/reenvio).
  const [ticket, setTicket] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const onCodeChange = (t: string) => {
    setCode(t.replace(/[^0-9]/g, '').slice(0, 6));
    setResent(false);
  };

  const createAccount = async () => {
    setError(null);
    if (!name.trim() || !username.trim() || !email.trim() || !password) {
      setError('Preencha nome, usuário, e-mail e senha.');
      return;
    }
    if (usernameCheck.status === 'checking' || emailCheck.status === 'checking') {
      setError('Aguarde a verificação do usuário e do e-mail.');
      return;
    }
    if (usernameCheck.status !== 'ok') {
      setError(usernameCheck.error ?? 'Escolha um nome de usuário válido e disponível.');
      return;
    }
    if (emailCheck.status !== 'ok') {
      setError(emailCheck.error ?? 'Informe um e-mail válido e disponível.');
      return;
    }
    setSubmitting(true);
    try {
      const t = await signup({
        name: name.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
      });
      setTicket(t);
      setCode('');
      setStep(1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao criar conta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (submitting || !ticket) return;
    setError(null);
    if (code.trim().length < 6) {
      setError('Digite o código de 6 dígitos que enviamos por e-mail.');
      return;
    }
    setSubmitting(true);
    try {
      await verifyEmailCode(ticket, code.trim());
      setStep(2);
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

  const goToPreviousStep = () => {
    setError(null);
    if (step > 0) setStep(step - 1);
  };

  return {
    step, setStep, goToPreviousStep,
    name, setName, username, setUsername, email, setEmail, password, setPassword,
    showPassword, setShowPassword,
    usernameCheck, emailCheck,
    submitting, error,
    ticket, code, onCodeChange,
    resending, resent,
    createAccount, handleVerify, handleResend,
  };
}

export type SignupFlow = ReturnType<typeof useSignupFlow>;
export type { AvailabilityState };
