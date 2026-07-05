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
  typing_dm: number[];
  typing_groups: Record<string, number[]>;
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
  // "Digitando": quem está digitando pra mim agora numa DM (ids de usuário),
  // e por grupo (id do grupo → ids de quem está digitando nele).
  typingDmUserIds: Set<string>;
  typingGroupUserIds: (groupId: string) => string[];
  // Avisa o servidor que eu estou digitando (com debounce simples — só
  // reenvia se já fez um tempo desde o último aviso pra essa conversa).
  pingTyping: (target: { kind: 'dm' | 'group'; id: string }) => void;
}

const RealtimeContext = createContext<RealtimeState | null>(null);

const RECONNECT_DELAY_MS = 3000;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { signedIn } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [typingDmUserIds, setTypingDmUserIds] = useState<Set<string>>(new Set());
  const [typingGroups, setTypingGroups] = useState<Record<string, string[]>>({});
  const messageListeners = useRef(new Set<MessageListener>());
  const notificationListeners = useRef(new Set<NotificationListener>());
  const lastTypingPingRef = useRef(new Map<string, number>());

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
        setTypingDmUserIds(new Set((data.typing_dm ?? []).map(String)));
        setTypingGroups(
          Object.fromEntries(
            Object.entries(data.typing_groups ?? {}).map(([gid, ids]) => [gid, ids.map(String)]),
          ),
        );

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

  const typingGroupUserIds = useCallback(
    (groupId: string) => typingGroups[groupId] ?? [],
    [typingGroups],
  );

  // Debounce simples: só reenvia o aviso pra mesma conversa a cada 2s (o TTL
  // no servidor é de 4s — reavisar antes disso mantém o indicador "vivo"
  // enquanto o usuário continua digitando, sem virar um POST por tecla).
  const pingTyping = useCallback((target: { kind: 'dm' | 'group'; id: string }) => {
    const key = `${target.kind}:${target.id}`;
    const now = Date.now();
    const last = lastTypingPingRef.current.get(key) ?? 0;
    if (now - last < 2000) return;
    lastTypingPingRef.current.set(key, now);
    api.pingTyping(target.kind, target.id).catch(() => {});
  }, []);

  const value = useMemo<RealtimeState>(
    () => ({
      unreadMessages,
      unreadNotifications,
      subscribeMessages,
      subscribeNotifications,
      refreshUnreadCounts,
      typingDmUserIds,
      typingGroupUserIds,
      pingTyping,
    }),
    [
      unreadMessages,
      unreadNotifications,
      subscribeMessages,
      subscribeNotifications,
      refreshUnreadCounts,
      typingDmUserIds,
      typingGroupUserIds,
      pingTyping,
    ],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeState {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime deve ser usado dentro de RealtimeProvider');
  return ctx;
}
