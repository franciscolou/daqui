import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api, getRealtimeUrl } from './api';
import { useAuth } from './auth';

interface RealtimeSyncPayload {
  unread_messages: number;
  unread_notifications: number;
  new_message_senders: number[];
  new_group_message_groups: number[];
  has_new_notification: boolean;
}

type MessageListener = (senderIds: string[], groupIds: string[]) => void;
type NotificationListener = () => void;

interface RealtimeState {
  unreadMessages: number;
  unreadNotifications: number;
  subscribeMessages: (cb: MessageListener) => () => void;
  subscribeNotifications: (cb: NotificationListener) => () => void;
  // Busca a contagem real no servidor — usado logo após abrir/atualizar uma
  // conversa (que já marca como lida no back) pra não esperar o próximo tick
  // do websocket (~2s) só pra sumir o indicador.
  refreshUnreadCounts: () => void;
}

const RealtimeContext = createContext<RealtimeState | null>(null);

const RECONNECT_DELAY_MS = 3000;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { signedIn } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const messageListeners = useRef(new Set<MessageListener>());
  const notificationListeners = useRef(new Set<NotificationListener>());

  const refreshUnreadCounts = useCallback(() => {
    if (!signedIn) return;
    api.getUnreadMessagesCount().then(setUnreadMessages).catch(() => {});
    api.getUnreadNotificationsCount().then(setUnreadNotifications).catch(() => {});
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) {
      setUnreadMessages(0);
      setUnreadNotifications(0);
      return;
    }

    let stopped = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    refreshUnreadCounts();

    const connect = () => {
      if (stopped) return;
      const url = getRealtimeUrl();
      if (!url) return;

      socket = new WebSocket(url);

      socket.onmessage = (event) => {
        let data: RealtimeSyncPayload;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        setUnreadMessages(data.unread_messages ?? 0);
        setUnreadNotifications(data.unread_notifications ?? 0);

        if (data.new_message_senders?.length || data.new_group_message_groups?.length) {
          const senderIds = (data.new_message_senders ?? []).map(String);
          const groupIds = (data.new_group_message_groups ?? []).map(String);
          messageListeners.current.forEach((cb) => cb(senderIds, groupIds));
        }
        if (data.has_new_notification) {
          notificationListeners.current.forEach((cb) => cb());
        }
      };

      socket.onclose = () => {
        if (!stopped) retryTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [signedIn, refreshUnreadCounts]);

  const subscribeMessages = useCallback((cb: MessageListener) => {
    messageListeners.current.add(cb);
    return () => messageListeners.current.delete(cb);
  }, []);

  const subscribeNotifications = useCallback((cb: NotificationListener) => {
    notificationListeners.current.add(cb);
    return () => notificationListeners.current.delete(cb);
  }, []);

  const value = useMemo<RealtimeState>(
    () => ({
      unreadMessages,
      unreadNotifications,
      subscribeMessages,
      subscribeNotifications,
      refreshUnreadCounts,
    }),
    [
      unreadMessages,
      unreadNotifications,
      subscribeMessages,
      subscribeNotifications,
      refreshUnreadCounts,
    ],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeState {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime deve ser usado dentro de RealtimeProvider');
  return ctx;
}
