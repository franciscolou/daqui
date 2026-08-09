import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import FeedLayout from '../../../components/FeedLayout';
import ChatView from '../../../components/ChatView';
import { api } from '../../../lib/api';
import { useT } from '../../../lib/i18n';
import { useTheme } from '../../../lib/theme';
import { goBack } from '../../../lib/navigation';

export default function ChatScreen() {
  // URL pública `/messages/{username}` — resolve pro id numérico interno
  // (usado por ChatView/api de mensagens) uma única vez ao entrar na tela,
  // mesmo padrão de `/{username}/post/{publicId}`.
  const { username, messageId } = useLocalSearchParams<{ username: string; messageId?: string }>();
  const { t } = useT();
  const Colors = useTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;
    setUserId(null);
    setNotFound(false);
    api.getUserByUsername(username)
      .then((u) => setUserId(u.id))
      .catch(() => setNotFound(true));
  }, [username]);

  if (notFound) {
    return (
      <FeedLayout showMobileMenu={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 14, color: Colors.textTertiary }}>{t('conversationInfo.notFound')}</Text>
        </View>
      </FeedLayout>
    );
  }

  if (!userId) {
    return (
      <FeedLayout showMobileMenu={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </FeedLayout>
    );
  }

  return (
    <FeedLayout showMobileMenu={false}>
      <ChatView target={{ kind: 'dm', id: userId }} messageId={messageId} onBack={() => goBack('/(tabs)/messages' as any)} />
    </FeedLayout>
  );
}
