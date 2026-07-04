import { router, useLocalSearchParams } from 'expo-router';
import FeedLayout from '../../../components/FeedLayout';
import ChatView from '../../../components/ChatView';

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <FeedLayout showMobileMenu={false}>
      <ChatView target={{ kind: 'group', id: id! }} onBack={() => router.back()} />
    </FeedLayout>
  );
}
