import type { GroupPrivacy } from '../lib/api';

interface GroupPrivacyInfo {
  label: string;
  shortLabel: string;
  description: string;
  icon: string; // nome do ícone Ionicons
}

export const GROUP_PRIVACY_INFO: Record<GroupPrivacy, GroupPrivacyInfo> = {
  public: {
    label: 'Aberto ao público',
    shortLabel: 'Aberto',
    description: 'Qualquer vizinho do bairro entra a qualquer momento.',
    icon: 'earth',
  },
  request: {
    label: 'Aberto para solicitações',
    shortLabel: 'Solicitações',
    description: 'Aparece no Descobrir, mas quem quiser entrar precisa ser aprovado por um admin.',
    icon: 'people-circle-outline',
  },
  closed: {
    label: 'Fechado',
    shortLabel: 'Fechado',
    description: 'Não aparece no Descobrir. Só entra quem for adicionado direto por um admin.',
    icon: 'lock-closed',
  },
};
