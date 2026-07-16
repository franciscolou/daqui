import { useLocalSearchParams } from 'expo-router';
import FeedLayout from '../../../components/FeedLayout';
import ChatView from '../../../components/ChatView';
import { goBack } from '../../../lib/navigation';

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <FeedLayout showMobileMenu={false}>
      <ChatView target={{ kind: 'group', id: id! }} onBack={() => goBack('/groups')} />
    </FeedLayout>
  );
}
