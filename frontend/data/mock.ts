export type PostCategory =
  | 'geral'
  | 'aviso'
  | 'seguranca'
  | 'evento'
  | 'recomendacao'
  | 'venda'
  | 'pets'
  | 'ajuda'
  | 'perdidos'
  | 'enquete';

export interface PollOption {
  id: string;
  text: string;
  votesCount: number;
}

export interface Poll {
  multiple: boolean;
  closesAt: string; // ISO
  closed: boolean;
  totalVotes: number;
  options: PollOption[];
  myVotes: string[]; // ids das opções em que o usuário votou
}

export interface User {
  id: string;
  username: string;      // identificador único (sem espaços)
  name: string;          // nome de exibição livre
  bio?: string;
  avatar: string;
  neighborhood: string;
  city?: string;
  state?: string;
  badge?: 'morador' | 'lider' | 'comerciante';
  verified: boolean;
  joinedAt: string;
  postsCount: number;
  helpCount: number;
  latitude?: number;          // coordenadas do usuário (só /auth/me e vizinhos do bairro)
  longitude?: number;
  locked?: boolean;           // perfil de outro bairro: só nome, @username, foto e nº de posts
  twoFactorEnabled?: boolean; // só presente em /auth/me (conta do próprio usuário)
}

export interface Post {
  id: string;
  author: User;
  category: PostCategory;
  title?: string;
  content: string;
  images?: string[];
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  neighborhood: string;
  distance: string;
  latitude?: number;          // coordenadas do local do post (quando validado no bairro)
  longitude?: number;
  liked: boolean;
  pinned?: boolean;
  important?: boolean;
  // Campos específicos por categoria (vindos de `details` no backend)
  eventDates?: string[];      // ISO YYYY-MM-DD, um ou mais dias (evento)
  allDay?: boolean;           // evento o dia inteiro
  eventTime?: string;         // "HH:MM" quando não é o dia inteiro
  placeName?: string;         // recomendação: nome do local
  location?: string;          // texto livre (evento, recomendação, venda, perdidos)
  price?: number;             // venda: preço em R$
  priceNegotiable?: boolean;  // venda: "Negociável"
  poll?: Poll;                // enquete
}

export interface Message {
  id: string;
  user: User;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'mention' | 'alert' | 'event' | 'welcome';
  user?: User;
  content: string;
  time: string;
  read: boolean;
  postId?: string;
}

export const CURRENT_USER: User = {
  id: 'u0',
  username: 'francisco',
  name: 'Francisco Gardenberg',
  avatar: 'https://i.pravatar.cc/150?img=68',
  neighborhood: 'Vila Madalena',
  badge: 'lider',
  verified: true,
  joinedAt: 'Março 2024',
  postsCount: 47,
  helpCount: 23,
};

export const USERS: User[] = [
  {
    id: 'u1',
    username: 'anapaula',
    name: 'Ana Paula Lima',
    avatar: 'https://i.pravatar.cc/150?img=47',
    neighborhood: 'Vila Madalena',
    badge: 'lider',
    verified: true,
    joinedAt: 'Jan 2023',
    postsCount: 134,
    helpCount: 89,
  },
  {
    id: 'u2',
    username: 'carlosmendes',
    name: 'Carlos Mendes',
    avatar: 'https://i.pravatar.cc/150?img=52',
    neighborhood: 'Pinheiros',
    badge: 'morador',
    verified: true,
    joinedAt: 'Mar 2023',
    postsCount: 28,
    helpCount: 14,
  },
  {
    id: 'u3',
    username: 'beatriz',
    name: 'Beatriz Santos',
    avatar: 'https://i.pravatar.cc/150?img=44',
    neighborhood: 'Vila Madalena',
    badge: 'comerciante',
    verified: true,
    joinedAt: 'Jun 2022',
    postsCount: 256,
    helpCount: 41,
  },
  {
    id: 'u4',
    username: 'roberto',
    name: 'Roberto Alves',
    avatar: 'https://i.pravatar.cc/150?img=57',
    neighborhood: 'Jardins',
    badge: 'morador',
    verified: false,
    joinedAt: 'Ago 2023',
    postsCount: 12,
    helpCount: 7,
  },
  {
    id: 'u5',
    username: 'mariana',
    name: 'Mariana Costa',
    avatar: 'https://i.pravatar.cc/150?img=25',
    neighborhood: 'Vila Madalena',
    badge: 'morador',
    verified: true,
    joinedAt: 'Fev 2024',
    postsCount: 8,
    helpCount: 3,
  },
  {
    id: 'u6',
    username: 'thiago',
    name: 'Thiago Ferreira',
    avatar: 'https://i.pravatar.cc/150?img=61',
    neighborhood: 'Perdizes',
    badge: 'morador',
    verified: true,
    joinedAt: 'Nov 2022',
    postsCount: 55,
    helpCount: 32,
  },
];

export const POSTS: Post[] = [
  {
    id: 'p1',
    author: USERS[0],
    category: 'aviso',
    title: 'Atenção: Obra na Rua Harmonia',
    content:
      'Pessoal, a prefeitura vai iniciar obras na Rua Harmonia amanhã às 8h. Previsão de 15 dias. Trânsito na rua será desviado pela Aspicuelta. Fiquem atentos! 🚧',
    createdAt: '2m atrás',
    likesCount: 47,
    commentsCount: 12,
    sharesCount: 8,
    neighborhood: 'Vila Madalena',
    distance: '200m',
    liked: false,
    pinned: true,
    important: false,
  },
  {
    id: 'p2',
    author: USERS[2],
    category: 'recomendacao',
    title: 'Padaria incrível na Vila Madalena!',
    content:
      'Descobri a Padaria Levain na Rua Fradique Coutinho. O croissant de manteiga é de outro nível 🥐 Atendimento nota 10, aberta desde as 7h. Recomendo demais para o café da manhã!',
    images: ['https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600'],
    createdAt: '45m atrás',
    likesCount: 89,
    commentsCount: 23,
    sharesCount: 15,
    neighborhood: 'Vila Madalena',
    distance: '350m',
    liked: true,
  },
  {
    id: 'p3',
    author: USERS[1],
    category: 'seguranca',
    title: 'Cuidado com golpe do WhatsApp',
    content:
      'ATENÇÃO: Estão circulando mensagens se passando pela síndica do Cond. Vista Verde pedindo dados bancários. Não responda! Já avisei a síndica real e ela está ciente. Compartilhem com os vizinhos! 🚨',
    createdAt: '1h atrás',
    likesCount: 156,
    commentsCount: 34,
    sharesCount: 67,
    neighborhood: 'Vila Madalena',
    distance: '180m',
    liked: false,
    important: true,
  },
  {
    id: 'p4',
    author: USERS[4],
    category: 'pets',
    title: 'Cachorro desaparecido 😢',
    content:
      'Meu Golden Retriever, Thor, desapareceu ontem perto do Parque Villa-Lobos. Ele usa coleira azul e tem uma mancha branca no focinho. Quem viu por favor me chama! Recompensa de R$500 💛',
    images: ['https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600'],
    createdAt: '2h atrás',
    likesCount: 203,
    commentsCount: 41,
    sharesCount: 98,
    neighborhood: 'Pinheiros',
    distance: '1.2km',
    liked: true,
    important: true,
  },
  {
    id: 'p5',
    author: USERS[5],
    category: 'evento',
    title: 'Festa Junina da Rua Wisard',
    content:
      'Convite oficial para a nossa tradicional Festa Junina! 🎪\n📅 Sábado, 15/06 a partir das 16h\n📍 Rua Wisard, 305\n\nForró ao vivo, comidas típicas, quadrilha e muito mais! Entrada com 1kg de alimento não perecível. Vem arrastar o pé com a gente!',
    createdAt: '3h atrás',
    likesCount: 312,
    commentsCount: 87,
    sharesCount: 143,
    neighborhood: 'Vila Madalena',
    distance: '400m',
    liked: false,
  },
  {
    id: 'p6',
    author: USERS[3],
    category: 'venda',
    title: 'Sofá 3 lugares — R$ 800',
    content:
      'Vendo sofá 3 lugares, cor cinza, em ótimo estado. Só saio por mudança. Mede 2,10m. Retirada por conta do comprador. WhatsApp no direct! 🛋️',
    images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600'],
    createdAt: '4h atrás',
    likesCount: 28,
    commentsCount: 9,
    sharesCount: 3,
    neighborhood: 'Jardins',
    distance: '2.1km',
    liked: false,
  },
  {
    id: 'p7',
    author: USERS[0],
    category: 'ajuda',
    title: 'Alguém tem escada de 3 metros?',
    content:
      'Oi vizinhos! Preciso trocar uma lâmpada no teto de 3 metros de altura e não tenho escada. Alguém pode emprestar por 30 minutos? Devolvo lavada! 😅',
    createdAt: '5h atrás',
    likesCount: 15,
    commentsCount: 6,
    sharesCount: 1,
    neighborhood: 'Vila Madalena',
    distance: '280m',
    liked: false,
  },
  {
    id: 'p8',
    author: USERS[2],
    category: 'geral',
    title: 'Pôr do sol incrível hoje!',
    content:
      'Não tinha como não compartilhar — o pôr do sol da semana mais lindo que já vi por aqui! Tirei lá da minha varanda. A Vila Madalena é incrível 🌅',
    images: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600'],
    createdAt: '6h atrás',
    likesCount: 445,
    commentsCount: 52,
    sharesCount: 87,
    neighborhood: 'Vila Madalena',
    distance: '320m',
    liked: true,
  },
];

export const MESSAGES: Message[] = [
  {
    id: 'm1',
    user: USERS[0],
    lastMessage: 'Obrigada pela dica da padaria! Já fui lá 😍',
    time: '2m',
    unread: 3,
    online: true,
  },
  {
    id: 'm2',
    user: USERS[5],
    lastMessage: 'Você tem interesse na escada? Posso trazer hoje à tarde',
    time: '15m',
    unread: 1,
    online: true,
  },
  {
    id: 'm3',
    user: USERS[1],
    lastMessage: 'Vou passar lá pra ver o sofá amanhã, pode ser?',
    time: '1h',
    unread: 0,
    online: false,
  },
  {
    id: 'm4',
    user: USERS[2],
    lastMessage: 'A festa junina vai ser incrível! Já confirmei presença',
    time: '2h',
    unread: 0,
    online: false,
  },
  {
    id: 'm5',
    user: USERS[3],
    lastMessage: 'Oi! Você conseguiu encontrar o Thor? 🙏',
    time: '3h',
    unread: 0,
    online: true,
  },
  {
    id: 'm6',
    user: USERS[4],
    lastMessage: 'Sim! O Thor apareceu, estava na casa da vizinha do 203',
    time: '5h',
    unread: 0,
    online: false,
  },
];

export const NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    type: 'like',
    user: USERS[0],
    content: 'Ana Paula Lima curtiu sua postagem sobre a festa junina',
    time: '5m',
    read: false,
    postId: 'p5',
  },
  {
    id: 'n2',
    type: 'comment',
    user: USERS[1],
    content: 'Carlos Mendes comentou: "Boa dica! Vou lá essa semana"',
    time: '20m',
    read: false,
    postId: 'p2',
  },
  {
    id: 'n3',
    type: 'alert',
    content: 'Novo aviso de segurança na sua vizinhança',
    time: '1h',
    read: false,
    postId: 'p3',
  },
  {
    id: 'n4',
    type: 'event',
    user: USERS[5],
    content: 'Thiago Ferreira vai ao evento Festa Junina da Rua Wisard',
    time: '2h',
    read: true,
    postId: 'p5',
  },
  {
    id: 'n5',
    type: 'like',
    user: USERS[2],
    content: 'Beatriz Santos e outras 12 pessoas curtiram seu post',
    time: '3h',
    read: true,
    postId: 'p7',
  },
];

export const CATEGORIES = [
  { key: 'todos', label: 'Todos', icon: 'home' },
  { key: 'geral', label: 'Geral', icon: 'chatbubbles' },
  { key: 'aviso', label: 'Avisos', icon: 'megaphone' },
  { key: 'seguranca', label: 'Segurança', icon: 'shield-checkmark' },
  { key: 'evento', label: 'Eventos', icon: 'calendar' },
  { key: 'recomendacao', label: 'Recomendações', icon: 'star' },
  { key: 'venda', label: 'Vendas', icon: 'pricetag' },
  { key: 'pets', label: 'Pets', icon: 'paw' },
  { key: 'ajuda', label: 'Ajuda', icon: 'hand-left' },
  { key: 'perdidos', label: 'Perdidos', icon: 'search' },
  { key: 'enquete', label: 'Enquetes', icon: 'stats-chart' },
] as const;

export const CATEGORY_LABELS: Record<PostCategory, string> = {
  geral: 'Geral',
  aviso: 'Aviso',
  seguranca: 'Segurança',
  evento: 'Evento',
  recomendacao: 'Recomendação',
  venda: 'Venda',
  pets: 'Pets',
  ajuda: 'Ajuda',
  perdidos: 'Perdidos',
  enquete: 'Enquete',
};

export const CATEGORY_ICONS: Record<PostCategory, string> = {
  geral: 'chatbubbles',
  aviso: 'megaphone',
  seguranca: 'shield-checkmark',
  evento: 'calendar',
  recomendacao: 'star',
  venda: 'pricetag',
  pets: 'paw',
  ajuda: 'hand-left',
  perdidos: 'search',
  enquete: 'stats-chart',
};
