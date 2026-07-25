// Conteúdo estático dos Termos de Uso e da Política de Privacidade.
// Mantido separado das telas (app/legal/*) pro mesmo padrão de data/mock.ts —
// tela só renderiza, conteúdo vive aqui.

export const LEGAL_UPDATED_AT = '25 de julho de 2026';
export const LEGAL_CONTACT_EMAIL = 'franciscogardenberg@gmail.com';

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] };

export interface LegalSection {
  title: string;
  blocks: LegalBlock[];
}

const p = (text: string): LegalBlock => ({ type: 'p', text });
const ul = (items: string[]): LegalBlock => ({ type: 'ul', items });

export const TERMS_INTRO =
  'Estes Termos de Uso regem o acesso e uso do Daqui — app e site de rede social de bairro. ' +
  'Ao criar uma conta ou usar o Daqui, você concorda com estas regras. Se não concordar, não utilize o serviço.';

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: '1. O que é o Daqui',
    blocks: [
      p('O Daqui é uma rede social organizada por bairro: um espaço para vizinhos trocarem avisos, recomendações, achados e perdidos, organizarem eventos e se ajudarem no dia a dia. O feed, o mapa, as mensagens e os grupos são sempre associados a um bairro — o do seu cadastro ("Meu bairro") ou o mais próximo da sua localização atual ("Perto de mim").'),
      p('O Daqui é gratuito para os moradores. Anunciantes podem contratar espaços publicitários dentro do app; esse uso comercial é regido também pela seção 8 destes Termos.'),
    ],
  },
  {
    title: '2. Quem pode usar',
    blocks: [
      p('O uso do Daqui é permitido a partir de 13 anos de idade. Menores de 18 anos devem usar o app com a ciência e supervisão de um responsável legal.'),
      p('Ao se cadastrar, você declara que as informações fornecidas (nome, nome de usuário, e-mail, bairro) são verdadeiras e que manterá seus dados atualizados.'),
    ],
  },
  {
    title: '3. Sua conta',
    blocks: [
      p('Você é responsável por manter a confidencialidade da sua senha e por tudo o que acontece na sua conta. Avise imediatamente o suporte se suspeitar de acesso não autorizado.'),
      p('Em Configurações você pode ver e revogar remotamente os dispositivos conectados à sua conta ("Dispositivos conectados").'),
      p('Podemos suspender ou encerrar contas que violem estes Termos, com aviso do motivo e do prazo quando houver, a critério da moderação.'),
    ],
  },
  {
    title: '4. Bairro e localização',
    blocks: [
      p('O bairro exibido no seu perfil é o do seu cadastro. A localização usada em "Perto de mim" e no mapa serve para mostrar o feed do bairro mais próximo e posicionar avisos e eventos. Seu endereço exato nunca é exibido a outros usuários, apenas o nome do bairro.'),
      p('O selo "Morador" identifica quem mora de fato no bairro de um post ou comentário, diferenciando de quem só está vendo aquele bairro por "Perto de mim" ou "Incluir redondezas".'),
      p('O bairro cadastrado como "Meu bairro" deve ser onde você realmente mora. Você pode optar por esconder o selo de morador em Privacidade e segurança > Ocultar selo de morador.Ao configurá-lo ou alterá-lo (em Configurações > Editar perfil > Bairro > Alterar), você atesta a veracidade dessa informação. Configurar sua residência em um bairro onde você não mora configura-se como uma violação da organização do aplicativo e acarreta em suspensão da sua conta.'),
    ],
  },
  {
    title: '5. Conteúdo publicado por você',
    blocks: [
      p('Você mantém a titularidade sobre o que publica (posts, comentários, enquetes, fotos, mensagens). Ao publicar em áreas visíveis a outros usuários, você concede ao Daqui uma licença não exclusiva para hospedar, exibir e distribuir esse conteúdo dentro do app, apenas para operar o serviço.'),
      p('Você é o único responsável pelo conteúdo que publica e garante ter os direitos necessários sobre ele (por exemplo, fotos que você mesmo tirou ou tem permissão para usar).'),
      p('É proibido publicar conteúdo que:'),
      ul([
        'seja ilegal, discriminatório, difamatório ou incite violência ou ódio;',
        'configure golpe, fraude ou spam;',
        'viole a privacidade ou a imagem de terceiros;',
        'contenha malware ou tentativas de comprometer a segurança do app;',
        'se faça passar por outra pessoa ou entidade.',
      ]),
      p('Conteúdos que se enquadrem em qualquer um desses casos estão sujeitos à remoção por parte da moderação do Daqui.')
    ],
  },
  {
    title: '6. Moderação e denúncias',
    blocks: [
      p('Qualquer post, comentário ou perfil pode ser denunciado pelo botão "Denunciar". A denúncia é analisada pela moderação, que tomará a providência que julgar cabível à situação em questão.'),
      p('O Daqui não modera negociações entre vizinhos: posts de venda, troca ou serviço são combinados diretamente entre as partes. O Daqui não intermedia pagamentos, entregas ou garantias e não se responsabiliza por eventuais golpes ou má conduta nessas negociações. Denuncie o conteúdo ou o perfil se isso acontecer.'),
    ],
  },
  {
    title: '7. Grupos e mensagens',
    blocks: [
      p('Grupos podem ser públicos, por aprovação ou fechados, conforme configurado por quem os cria. Donos e administradores de grupo são responsáveis por moderar as mensagens e membros do próprio grupo, dentro destes Termos.'),
      p('Mensagens diretas não têm restrição de bairro; encaminhar um post para alguém de outro bairro é bloqueado quando o post pertence a um bairro diferente do seu.'),
    ],
  },
  {
    title: '8. Anúncios e conteúdo patrocinado',
    blocks: [
      p('O Daqui exibe anúncios de terceiros no feed, no mapa, nas Mensagens, em Novidades e na Busca, sempre identificados como "Anúncio" ou "Patrocinado". A contratação de anúncios é feita por um serviço separado, com pagamento processado por um provedor de pagamentos externo (Stripe).'),
      p('O Daqui não se responsabiliza pelos produtos, serviços ou informações veiculados por anunciantes — a relação comercial eventualmente originada por um anúncio é exclusivamente entre o usuário e o anunciante.'),
    ],
  },
  {
    title: '9. Notificações',
    blocks: [
      p('O app pode enviar notificações push sobre atividade relevante (mensagens, menções, curtidas, novidades). Você pode silenciar conversas e grupos específicos, ou desativar notificações do dispositivo a qualquer momento nas configurações do sistema.'),
    ],
  },
  {
    title: '10. Propriedade intelectual',
    blocks: [
      p('A marca "Daqui", o logotipo e o design do app são de propriedade dos seus responsáveis. Nenhuma disposição destes Termos transfere esses direitos a você.'),
    ],
  },
  {
    title: '11. Isenções e limitação de responsabilidade',
    blocks: [
      p('O Daqui é fornecido "como está". Não verificamos a veracidade do conteúdo publicado pelos usuários e não garantimos disponibilidade ininterrupta do serviço. Na máxima medida permitida por lei, o Daqui não se responsabiliza por danos indiretos decorrentes do uso do app ou de interações combinadas entre usuários fora da plataforma.'),
    ],
  },
  {
    title: '12. Alterações destes Termos',
    blocks: [
      p('Podemos atualizar estes Termos para refletir mudanças no app ou na legislação aplicável. Mudanças relevantes serão comunicadas dentro do app. O uso continuado do Daqui após uma atualização representa aceite dos novos Termos.'),
    ],
  },
  {
    title: '13. Lei aplicável',
    blocks: [
      p('Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca do Rio de Janiro/RJ para dirimir eventuais controvérsias, ressalvado foro de domicílio do consumidor quando aplicável.'),
    ],
  },
  {
    title: '14. Contato',
    blocks: [
      p(`Dúvidas sobre estes Termos podem ser enviadas para ${LEGAL_CONTACT_EMAIL} ou por um chamado em "Ajuda e suporte", dentro do app.`),
    ],
  },
];

export const PRIVACY_INTRO =
  'Esta Política de Privacidade explica quais dados o Daqui coleta, para que servem e quais são os seus direitos, ' +
  'em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).';

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: '1. Quem trata os seus dados',
    blocks: [
      p(`Os responsáveis pelo Daqui são os controladores dos dados tratados no app. Para exercer seus direitos de titular ou tirar dúvidas sobre privacidade, envie um chamado na aba "Ajuda e suporte" ou entre em contato por ${LEGAL_CONTACT_EMAIL}.`),
    ],
  },
  {
    title: '2. Dados que coletamos',
    blocks: [
      p('Dados de cadastro:'),
      ul([
        "Nome;",
        "Nome de usuário;",
        "E-mail;",
        "Senha (criptografada);",
        "Bairro;"
      ]),
      p('Dados de perfil:'),
      ul([
        "Foto;",
        "Biografia;",
        "Demais informações que você opte por adicionar."
      ]),
      p('Dados de localização:'), 
      ul([
        "Coordenadas do dispositivo;",
        "Usadas para resolver o bairro mais próximo (\"Perto de mim\");",
        "Posicionar avisos no mapa;",
        "Sugerir bairros vizinhos — nunca exibidas como endereço exato a outros usuários."
      ]),
      p('Conteúdo gerado por você:'),
      ul([
        "Posts;",
        "Comentários;",
        "Enquetes e votos;",
        "Mensagens diretas e de grupo;",
        "Denúncias e avaliações que você registrar."
      ]),
      p('Dados técnicos:'),
      ul([
        "Sessões de login (dispositivo, navegador, IP e data/hora de cada acesso);",
        "Token de notificação push do dispositivo;",
        "Registros de suporte quando você abre um chamado."
      ]),
    ],
  },
  {
    title: '3. Para que usamos os dados',
    blocks: [
      ul([
        'Exibir o feed, o mapa e a busca baseados no seu bairro;',
        'Viabilizar mensagens diretas, grupos e menções;',
        'Enviar notificações push sobre atividade relevante para você;',
        'Moderar conteúdo e investigar denúncias, com registro de auditoria das ações de moderação;',
        'Manter a segurança da conta (sessões, detecção de acesso indevido);',
        'Responder chamados de suporte;',
        'Selecionar os anúncios que aparecerão para você.',
      ]),
    ],
  },
  {
    title: '4. Base legal (LGPD)',
    blocks: [
      p('Tratamos seus dados com base na execução do contrato de uso do app (cadastro, feed, mensagens), no legítimo interesse do Daqui e da comunidade (moderação, segurança, prevenção de fraude) e, quando aplicável, no seu consentimento (por exemplo, ao autorizar o uso da localização do dispositivo ou ativar notificações push).'),
    ],
  },
  {
    title: '5. Com quem compartilhamos dados',
    blocks: [
      p('Não vendemos seus dados pessoais. Compartilhamos dados apenas na medida necessária para operar o serviço:'),
      ul([
        'Provedores de infraestrutura de notificação (Expo Push Service), para entregar notificações no seu dispositivo;',
        'Serviços de geocodificação (OpenStreetMap/Nominatim), para converter coordenadas em nome de bairro/endereço, sem identificar você para esses serviços;',
        'Processador de pagamentos (Stripe), somente quando você mesmo contrata um anúncio como anunciante — dados de pagamento não passam pelos servidores do Daqui;',
        'Outros usuários, apenas o que é inerentemente público no app (nome, usuário, foto, bairro, posts e comentários visíveis) — e, se você vincular sua conta a um anúncio próprio, essas mesmas informações públicas passam a aparecer também no cartão do anúncio.',
      ]),
    ],
  },
  {
    title: '6. Retenção e exclusão',
    blocks: [
      p('Mantemos seus dados enquanto sua conta estiver ativa. Você pode solicitar a exclusão da sua conta e dos seus dados abrindo um chamado em "Ajuda e suporte" — o pedido é processado pela nossa equipe dentro de um prazo razoável, ressalvado o que a lei exigir manter (por exemplo, registros de segurança ou obrigações legais).'),
    ],
  },
  {
    title: '7. Segurança',
    blocks: [
      p('Senhas são armazenadas com hash (bcrypt), nunca em texto puro. O acesso é protegido por token de sessão (JWT), e você pode revogar remotamente qualquer dispositivo conectado em Configurações. Contas de moderação e de administração contam ainda com verificação em duas etapas (2FA).'),
    ],
  },
  {
    title: '8. Seus direitos como titular',
    blocks: [
      p('Nos termos da LGPD, você pode solicitar a qualquer momento:'),
      ul([
        'Confirmação de que tratamos seus dados e acesso a eles;',
        'Correção de dados incompletos, inexatos ou desatualizados;',
        'Exclusão dos seus dados pessoais;',
        'Portabilidade dos dados a outro fornecedor;',
        'Revogação do consentimento dado (por exemplo, para localização ou notificações);',
        'Informação sobre com quem compartilhamos seus dados.',
      ]),
      p(`Para exercer qualquer um desses direitos, use "Ajuda e suporte" dentro do app ou escreva para ${LEGAL_CONTACT_EMAIL}.`),
    ],
  },
  {
    title: '9. Cookies e armazenamento local',
    blocks: [
      p('Na versão web, usamos armazenamento local do navegador apenas para manter sua sessão logada e suas preferências de configuração da experiência do app. Não usamos cookies de rastreamento de terceiros nem publicidade comportamental entre sites.'),
    ],
  },
  {
    title: '10. Crianças e adolescentes',
    blocks: [
      p('O Daqui não é destinado a menores de 13 anos e não coleta intencionalmente dados de crianças. Usuários entre 13 e 18 anos devem usar o app sob supervisão de um responsável legal.'),
    ],
  },
  {
    title: '11. Alterações desta Política',
    blocks: [
      p('Podemos atualizar esta Política periodicamente. A data da última atualização fica sempre indicada no topo desta página; mudanças relevantes serão comunicadas dentro do app.'),
    ],
  },
  {
    title: '12. Contato e encarregado de dados',
    blocks: [
      p(`Dúvidas, solicitações de titular ou reclamações sobre privacidade podem ser enviadas para ${LEGAL_CONTACT_EMAIL}.`),
    ],
  },
];
