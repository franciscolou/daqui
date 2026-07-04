import { router, useLocalSearchParams } from 'expo-router';
import FeedLayout from '../../components/FeedLayout';
import ChatView from '../../components/ChatView';

export default function ChatScreen() {
  const { id, messageId } = useLocalSearchParams<{ id: string; messageId?: string }>();
  return (
    <FeedLayout showMobileMenu={false}>
      <ChatView target={{ kind: 'dm', id: id! }} messageId={messageId} onBack={() => router.back()} />
    </FeedLayout>
  );
}
