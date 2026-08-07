import { useLocalSearchParams } from 'expo-router';
import FeedLayout from '../../../components/FeedLayout';
import MediaGalleryView from '../../../components/MediaGalleryView';
import { goBack } from '../../../lib/navigation';

export default function GroupMediaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <FeedLayout showMobileMenu={false}>
      <MediaGalleryView target={{ kind: 'group', id: id! }} onBack={() => goBack(`/groups/${id}/info` as any)} />
    </FeedLayout>
  );
}
