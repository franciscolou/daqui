import { useLocalSearchParams } from 'expo-router';
import FeedLayout from '../../../components/FeedLayout';
import ChatView from '../../../components/ChatView';
import { goBack } from '../../../lib/navigation';

export default function ChatScreen() {
  const { id, messageId } = useLocalSearchParams<{ id: string; messageId?: string }>();
  return (
    <FeedLayout showMobileMenu={false}>
      <ChatView target={{ kind: 'dm', id: id! }} messageId={messageId} onBack={() => goBack('/(tabs)/messages' as any)} />
    </FeedLayout>
  );
}
