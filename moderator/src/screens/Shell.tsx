import { useCallback, useMemo, useState } from 'react';
import { canManageStaff, isOwner, useAuth } from '../lib/auth';
import { STAFF_ROLE_LABEL } from '../lib/labels';
import { BrandMark } from '../ui/BrandMark';
import { Icon, IconName } from '../ui/Icon';
import { NavigationProvider } from '../ui/moderation';
import { Avatar } from '../ui/primitives';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Account } from './Account';
import { Analytics } from './Analytics';
import { Audit } from './Audit';
import { Reports } from './Reports';
import { Reviews } from './Reviews';
import { Staff } from './Staff';
import { Tickets } from './Tickets';
import { Trash } from './Trash';
import { Users } from './Users';

// Casca do painel: navegação lateral + seção ativa. Novas filas de moderação
// só precisam de uma entrada nesta lista.

interface Section {
  key: string;
  label: string;
  icon: IconName;
  title: string;
  subtitle?: string;
}

const BASE_SECTIONS: Section[] = [
  {
    key: 'reviews',
    label: 'Avaliações',
    icon: 'star',
    title: 'Avaliações do Daqui',
    subtitle: 'A opinião dos usuários sobre o app',
  },
  {
    key: 'reports',
    label: 'Denúncias',
    icon: 'flag',
    title: 'Denúncias',
    subtitle: 'Conteúdo e perfis reportados pela comunidade',
  },
  {
    key: 'tickets',
    label: 'Chamados',
    icon: 'mail',
    title: 'Chamados de suporte',
    subtitle: 'Dúvidas que o FAQ não resolveu',
  },
  {
    key: 'users',
    label: 'Usuários',
    icon: 'users',
    title: 'Usuários',
    subtitle: 'Busca, conteúdo e suspensão de contas',
  },
  {
    key: 'trash',
    label: 'Lixeira',
    icon: 'trash',
    title: 'Lixeira da moderação',
    subtitle: 'Posts e comentários restauráveis por 60 dias',
  },
  {
    key: 'audit',
    label: 'Auditoria',
    icon: 'clock',
    title: 'Registro de auditoria',
    subtitle: 'Toda ação da moderação, pesquisável',
  },
  {
    key: 'account',
    label: 'Minha conta',
    icon: 'user',
    title: 'Minha conta',
    subtitle: 'Foto, senha e autenticação de dois fatores da sua conta',
  },
];

// Gestão de contas do time — inserida antes de "Minha conta" para
// Administrador/Owner.
const STAFF_SECTION: Section = {
  key: 'staff',
  label: 'Equipe',
  icon: 'shield',
  title: 'Equipe de moderação',
  subtitle: 'Contas com acesso a este painel',
};

// Uso do app principal (Daqui) — restrito ao Owner (ver core/deps.get_current_owner
// no backend), inserida logo após "Auditoria" (as duas são seções de
// relatório, só leitura).
const ANALYTICS_SECTION: Section = {
  key: 'analytics',
  label: 'Analytics',
  icon: 'barChart',
  title: 'Analytics do Daqui',
  subtitle: 'Frequência de uso, permanência por tela e ações mais feitas pelos vizinhos',
};

export function Shell() {
  const { me, appUrl, signOut } = useAuth();
  const [active, setActive] = useState('reviews');
  // Usuário a abrir quando se clica num @usuário em outra seção. O contador
  // faz a ficha reabrir mesmo se for o mesmo id de antes.
  const [target, setTarget] = useState<{ id: number; nonce: number } | null>(null);

  const openUser = useCallback((userId: number) => {
    setTarget((prev) => ({ id: userId, nonce: (prev?.nonce ?? 0) + 1 }));
    setActive('users');
  }, []);

  const navigation = useMemo(() => ({ openUser, appUrl }), [openUser, appUrl]);

  const sections = useMemo(() => {
    let list = BASE_SECTIONS;
    // Ambas inseridas logo antes de "Minha conta" — nesta ordem, pra Owner
    // ver Auditoria, Analytics e Equipe em sequência.
    if (isOwner(me?.staff_role)) {
      const idx = list.findIndex((s) => s.key === 'account');
      list = [...list.slice(0, idx), ANALYTICS_SECTION, ...list.slice(idx)];
    }
    if (canManageStaff(me?.staff_role)) {
      const idx = list.findIndex((s) => s.key === 'account');
      list = [...list.slice(0, idx), STAFF_SECTION, ...list.slice(idx)];
    }
    return list;
  }, [me?.staff_role]);

  const section = sections.find((s) => s.key === active) ?? sections[0];
  const email = me?.email ?? '';

  const renderSection = () => {
    switch (section.key) {
      case 'reviews':
        return <Reviews />;
      case 'reports':
        return <Reports />;
      case 'tickets':
        return <Tickets />;
      case 'users':
        return <Users key={target?.nonce ?? 0} userId={target?.id ?? null} />;
      case 'trash':
        return <Trash />;
      case 'audit':
        return <Audit />;
      case 'analytics':
        return <Analytics />;
      case 'staff':
        return <Staff />;
      case 'account':
        return <Account />;
      default:
        return null;
    }
  };

  return (
    <NavigationProvider value={navigation}>
      <div className="shell">
        <nav className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-dot">
              <BrandMark size={17} />
            </div>
            <span>Moderação</span>
          </div>

          <div className="sidebar-nav">
            {sections.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`nav-btn${s.key === section.key ? ' active' : ''}`}
                onClick={() => {
                  if (s.key !== 'users') setTarget(null);
                  setActive(s.key);
                }}
              >
                <span className="nav-ic">
                  <Icon name={s.icon} size={16} />
                </span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          <div className="sidebar-footer">
            <div className="who">
              <Avatar url={me?.avatar_url} fallback={me?.username || email} />
              <div className="who-text">
                <div className="who-name" title={email}>
                  {email}
                </div>
                <div className="who-role">
                  {STAFF_ROLE_LABEL[me?.staff_role ?? ''] ?? me?.staff_role}
                </div>
              </div>
            </div>
            <div className="footer-actions">
              <ThemeToggle />
              <button type="button" className="logout-btn" onClick={signOut} title="Sair">
                <Icon name="logout" size={16} />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="main">
          <header className="topbar">
            <div>
              <h1>{section.title}</h1>
              {section.subtitle && <div className="sub">{section.subtitle}</div>}
            </div>
          </header>
          <div className="container">{renderSection()}</div>
        </div>
      </div>
    </NavigationProvider>
  );
}
