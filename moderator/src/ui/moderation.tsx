import { createContext, useContext } from 'react';
import { FALLBACK_AVATAR } from '../lib/format';
import { Attachment, UserRef } from '../lib/types';
import { Icon } from './Icon';

// Peças específicas da moderação: usuários clicáveis (que levam pra aba
// Usuários), estrelas, anexos e links pro app.

interface Navigation {
  /** Abre a ficha de um usuário na aba "Usuários", venha de onde vier. */
  openUser: (userId: number) => void;
  /** Base do app Daqui, para os links "ver no app". */
  appUrl: string;
}

const NavigationContext = createContext<Navigation | null>(null);

export function NavigationProvider({
  value,
  children,
}: {
  value: Navigation;
  children: React.ReactNode;
}) {
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): Navigation {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation precisa de um <NavigationProvider>.');
  return ctx;
}

export function Avatar({ user, size = 'md' }: { user: UserRef; size?: 'md' | 'sm' }) {
  return (
    <img
      className={`avatar${size === 'sm' ? ' sm' : ''}`}
      src={user.avatar_url || FALLBACK_AVATAR}
      alt=""
    />
  );
}

/** Bloco avatar + @usuário + bairro; clicar abre a ficha do usuário. */
export function UserChip({ user, sub }: { user: UserRef; sub?: React.ReactNode }) {
  const { openUser } = useNavigation();
  return (
    <button type="button" className="user-chip" onClick={() => openUser(user.id)}>
      <Avatar user={user} />
      <div style={{ minWidth: 0 }}>
        <div className="card-title">@{user.username}</div>
        <div className="card-sub">{sub ?? user.neighborhood ?? ''}</div>
      </div>
    </button>
  );
}

/** Só o @usuário, clicável — pra usar dentro de frases. */
export function UserLink({ user }: { user: UserRef }) {
  const { openUser } = useNavigation();
  return (
    <button type="button" className="user-link" onClick={() => openUser(user.id)}>
      @{user.username}
    </button>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars">
      <span className="base">★★★★★</span>
      <span className="fill" style={{ width: `${(rating / 5) * 100}%` }}>
        ★★★★★
      </span>
    </span>
  );
}

/** Fotos/vídeos (até 3) enviados numa denúncia ou chamado. */
export function Attachments({ items }: { items?: Attachment[] | null }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="attach-row">
      {items.map((a, i) =>
        a.type === 'video' ? (
          <button
            key={i}
            type="button"
            className="attach-thumb video"
            title="Abrir vídeo em nova aba"
            onClick={() => window.open(a.url, '_blank', 'noopener')}
          >
            ▶
          </button>
        ) : (
          <img
            key={i}
            className="attach-thumb"
            src={a.url}
            alt=""
            title="Abrir imagem em nova aba"
            style={{ cursor: 'pointer' }}
            onClick={() => window.open(a.url, '_blank', 'noopener')}
          />
        ),
      )}
    </div>
  );
}

export function AppLink({ path, label }: { path: string; label: string }) {
  const { appUrl } = useNavigation();
  return (
    <a className="applink" href={`${appUrl}${path}`} target="_blank" rel="noopener noreferrer">
      {label}
      <Icon name="externalLink" size={13} />
    </a>
  );
}
