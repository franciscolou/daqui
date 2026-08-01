import { useMemo, useState } from 'react';
import { canManageStaff, useAuth } from '../lib/auth';
import { STAFF_ROLE_LABEL } from '../lib/labels';
import { Icon, IconName } from '../ui/Icon';
import { Avatar } from '../ui/primitives';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Account } from './Account';
import { Campaigns } from './Campaigns';
import { Analytics } from './Analytics';
import { NewProposal } from './NewProposal';
import { Plans } from './Plans';
import { Settings } from './Settings';
import { Staff } from './Staff';

// Casca do painel: navegação lateral + seção ativa. Cada seção é uma tela
// independente que busca os próprios dados — adicionar uma nova é só uma
// entrada nesta lista.

interface Section {
  key: string;
  label: string;
  icon: IconName;
  title: string;
  subtitle?: string;
  wide?: boolean;
  render: () => React.ReactNode;
}

const BASE_SECTIONS: Section[] = [
  {
    key: 'campaigns',
    label: 'Campanhas',
    icon: 'grid',
    title: 'Campanhas',
    subtitle: 'Tudo que está no ar (ou esperando pagamento)',
    render: () => <Campaigns />,
  },
  {
    key: 'analytics',
    label: 'Analytics',
    icon: 'barChart',
    title: 'Analytics',
    subtitle: 'Desempenho agregado de todas as campanhas',
    wide: true,
    render: () => <Analytics />,
  },
  {
    key: 'new',
    label: 'Nova proposta',
    icon: 'plusCircle',
    title: 'Inserir proposta manual',
    subtitle: 'Propostas negociadas por Instagram/WhatsApp/Gmail',
    render: () => <NewProposal />,
  },
  {
    key: 'plans',
    label: 'Planos',
    icon: 'list',
    title: 'Planos',
    subtitle: 'O que o anunciante vê em "Anuncie no Daqui"',
    wide: true,
    render: () => <Plans />,
  },
  {
    key: 'settings',
    label: 'Configurações',
    icon: 'settings',
    title: 'Configurações',
    subtitle: 'Parâmetros globais de precificação',
    render: () => <Settings />,
  },
  {
    key: 'account',
    label: 'Minha conta',
    icon: 'user',
    title: 'Minha conta',
    subtitle: 'Foto, senha e autenticação de dois fatores da sua conta',
    render: () => <Account />,
  },
];

// Gestão de contas do time — inserida antes de "Configurações" para
// Administrador/Owner. Moderador/Administrador/Owner têm paridade
// operacional no resto do painel; só a Equipe difere por cargo.
const STAFF_SECTION: Section = {
  key: 'staff',
  label: 'Equipe',
  icon: 'shield',
  title: 'Equipe de anúncios',
  subtitle: 'Contas com acesso a este painel',
  render: () => <Staff />,
};

export function Shell() {
  const { me, signOut } = useAuth();
  const [active, setActive] = useState('campaigns');

  const sections = useMemo(() => {
    if (!canManageStaff(me?.role)) return BASE_SECTIONS;
    const idx = BASE_SECTIONS.findIndex((s) => s.key === 'settings');
    return [...BASE_SECTIONS.slice(0, idx), STAFF_SECTION, ...BASE_SECTIONS.slice(idx)];
  }, [me?.role]);

  const section = sections.find((s) => s.key === active) ?? sections[0];
  const email = me?.email ?? '';

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-dot">d</div>
          <span>Anúncios</span>
        </div>

        <div className="sidebar-nav">
          {sections.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`nav-btn${s.key === section.key ? ' active' : ''}`}
              onClick={() => setActive(s.key)}
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
              <div className="who-role">{STAFF_ROLE_LABEL[me?.role ?? ''] ?? me?.role}</div>
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
        <div className={`container${section.wide ? ' wide' : ''}`}>
          {/* A key remonta a seção ao trocar de aba: cada tela recarrega
              seus dados na entrada, sem estado vazando de uma pra outra. */}
          <div key={section.key}>{section.render()}</div>
        </div>
      </div>
    </div>
  );
}
