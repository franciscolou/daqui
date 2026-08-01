import { useCallback, useMemo, useState } from 'react';
import { canManageStaff, useAuth } from '../lib/auth';
import { STAFF_ROLE_LABEL } from '../lib/labels';
import { Icon, IconName } from '../ui/Icon';
import { NavigationProvider } from '../ui/moderation';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Audit } from './Audit';
import { Reports } from './Reports';
import { Reviews } from './Reviews';
import { Security } from './Security';
import { Staff } from './Staff';
import { Tickets } from './Tickets';
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
    key: 'audit',
    label: 'Auditoria',
    icon: 'clock',
    title: 'Registro de auditoria',
    subtitle: 'Toda ação da moderação, pesquisável',
  },
  {
    key: 'security',
    label: 'Segurança',
    icon: 'lock',
    title: 'Segurança',
    subtitle: 'Autenticação de dois fatores da sua conta',
  },
];

// Gestão de contas do time — inserida antes de "Segurança" para
// Administrador/Owner.
const STAFF_SECTION: Section = {
  key: 'staff',
  label: 'Equipe',
  icon: 'shield',
  title: 'Equipe de moderação',
  subtitle: 'Contas com acesso a este painel',
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
    if (!canManageStaff(me?.staff_role)) return BASE_SECTIONS;
    const idx = BASE_SECTIONS.findIndex((s) => s.key === 'security');
    return [...BASE_SECTIONS.slice(0, idx), STAFF_SECTION, ...BASE_SECTIONS.slice(idx)];
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
      case 'audit':
        return <Audit />;
      case 'staff':
        return <Staff />;
      case 'security':
        return <Security />;
      default:
        return null;
    }
  };

  return (
    <NavigationProvider value={navigation}>
      <div className="shell">
        <nav className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-dot">d</div>
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
              <div className="who-avatar">{(email[0] || '?').toUpperCase()}</div>
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
