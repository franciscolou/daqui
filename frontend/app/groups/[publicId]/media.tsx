import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import FeedLayout from '../../../components/FeedLayout';
import MediaGalleryView from '../../../components/MediaGalleryView';
import { api } from '../../../lib/api';
import { useT } from '../../../lib/i18n';
import { useTheme } from '../../../lib/theme';
import { goBack } from '../../../lib/navigation';

export default function GroupMediaScreen() {
  // Resolve publicId → id numérico interno, mesmo padrão de index.tsx.
  const { publicId } = useLocalSearchParams<{ publicId: string }>();
  const { t } = useT();
  const Colors = useTheme();
  const [groupId, setGroupId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!publicId) return;
    setGroupId(null);
    setNotFound(false);
    api.getGroupByPublicId(publicId).then((g) => setGroupId(g.id)).catch(() => setNotFound(true));
  }, [publicId]);

  if (notFound) {
    return (
      <FeedLayout showMobileMenu={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 14, color: Colors.textTertiary }}>{t('groupInfo.notFound')}</Text>
        </View>
      </FeedLayout>
    );
  }

  if (!groupId) {
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
      <MediaGalleryView target={{ kind: 'group', id: groupId }} onBack={() => goBack(`/groups/${publicId}/info` as any)} />
    </FeedLayout>
  );
}
