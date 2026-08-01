import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal } from './primitives';

// Diálogos do app no lugar de window.confirm/window.alert — nativos não seguem
// o tema nem o visual do painel, e `confirm` trava a thread.

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface DialogsApi {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  alert: (message: string, title?: string) => void;
}

const DialogsContext = createContext<DialogsApi | null>(null);

interface ConfirmState extends Required<ConfirmOptions> {
  message: string;
}

export function DialogsProvider({ children }: { children: React.ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [alertState, setAlertState] = useState<{ title: string; message: string } | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
    setConfirmState({
      message,
      title: options.title ?? 'Confirmar ação',
      confirmLabel: options.confirmLabel ?? 'Confirmar',
      danger: options.danger ?? true,
    });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    setConfirmState(null);
    resolver.current?.(value);
    resolver.current = null;
  }, []);

  const alert = useCallback((message: string, title = 'Aviso') => {
    setAlertState({ title, message });
  }, []);

  const api = useMemo(() => ({ confirm, alert }), [confirm, alert]);

  return (
    <DialogsContext.Provider value={api}>
      {children}
      {confirmState && (
        <Modal
          title={confirmState.title}
          onClose={() => settle(false)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => settle(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className={`btn ${confirmState.danger ? 'danger' : 'primary'}`}
                onClick={() => settle(true)}
              >
                {confirmState.confirmLabel}
              </button>
            </>
          }
        >
          {confirmState.message}
        </Modal>
      )}
      {alertState && (
        <Modal
          title={alertState.title}
          onClose={() => setAlertState(null)}
          footer={
            <button type="button" className="btn primary" onClick={() => setAlertState(null)}>
              OK
            </button>
          }
        >
          {alertState.message}
        </Modal>
      )}
    </DialogsContext.Provider>
  );
}

export function useDialogs(): DialogsApi {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error('useDialogs precisa de um <DialogsProvider>.');
  return ctx;
}
