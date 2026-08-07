import { useLocalSearchParams } from 'expo-router';
import FeedLayout from '../../../components/FeedLayout';
import MediaGalleryView from '../../../components/MediaGalleryView';
import { goBack } from '../../../lib/navigation';

export default function DmMediaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <FeedLayout showMobileMenu={false}>
      <MediaGalleryView target={{ kind: 'dm', id: id! }} onBack={() => goBack(`/messages/${id}/info` as any)} />
    </FeedLayout>
  );
}
