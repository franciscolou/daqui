import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { api, ApiError } from './api';
import { useAuth } from './auth';
import { useT } from './i18n';
import { useAvailability, AvailabilityState } from './useAvailability';

// Último passo do cadastro via Google (nome + usuário) — compartilhado entre
// app/(auth)/google-username.tsx (rota própria, usada no fluxo mobile/estreito
// vindo de login.tsx/signup.tsx) e o painel embutido em app/(auth)/welcome.tsx
// (versão desktop), mesmo padrão do useSignupFlow, pra evitar que as duas
// telas divirjam quando o fluxo mudar.
export function useGoogleUsernameFlow(ticket: string | undefined, initialName: string) {
  const { completeGoogleSignup } = useAuth();
  const { t } = useT();

  const [name, setName] = useState(initialName);
  // Em welcome.tsx (desktop) o hook fica montado o tempo todo — o `name`
  // inicial só chega DEPOIS do primeiro render, quando o Google responde.
  // Ressincroniza sempre que um ticket novo aparece (nova tentativa de
  // "Entrar com Google"), sem sobrescrever o que o usuário já editou depois
  // disso. Na rota separada (app/(auth)/google-username.tsx) o ticket já
  // nasce no primeiro render, então esse efeito só confirma o valor inicial.
  useEffect(() => {
    if (ticket) setName(initialName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket]);
  const [username, setUsername] = useState('');
  const usernameCheck = useAvailability(username, api.checkSignupUsername, {
    ready: (v) => v.length >= 3,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (submitting || !ticket) return;
    setError(null);
    if (!name.trim()) {
      setError(t('auth.googleUsername.nameRequired'));
      return;
    }
    if (!username.trim()) {
      setError(t('auth.googleUsername.usernameRequired'));
      return;
    }
    if (usernameCheck.status === 'checking') {
      setError(t('auth.googleUsername.checkingUsername'));
      return;
    }
    if (usernameCheck.status !== 'ok') {
      setError(usernameCheck.error ?? t('auth.googleUsername.invalidUsername'));
      return;
    }
    setSubmitting(true);
    try {
      await completeGoogleSignup(ticket, username.trim(), name.trim());
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('auth.googleUsername.genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  return { name, setName, username, setUsername, usernameCheck, submitting, error, handleSubmit };
}

export type GoogleUsernameFlow = ReturnType<typeof useGoogleUsernameFlow>;
export type { AvailabilityState };
