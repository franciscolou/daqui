import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Palette } from '../constants/Colors';
import { User } from '../data/mock';
import { useTheme, useThemedStyles } from '../lib/theme';

interface StoryAvatarProps {
  user?: User;
  isAdd?: boolean;
  onPress?: () => void;
}

export default function StoryAvatar({ user, isAdd, onPress }: StoryAvatarProps) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (isAdd) {
    return (
      <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
        <View style={styles.addWrapper}>
          <LinearGradient colors={Colors.gradient.primary} style={styles.addGradient}>
            <Ionicons name="add" size={22} color="#fff" />
          </LinearGradient>
        </View>
        <Text style={styles.label} numberOfLines={1}>Publicar</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <LinearGradient
        colors={Colors.gradient.primary}
        style={styles.ring}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.avatarWrapper}>
          <Image source={{ uri: user?.avatar }} style={styles.avatar} />
        </View>
      </LinearGradient>
      <Text style={styles.label} numberOfLines={1}>
        {user?.name.split(' ')[0]}
      </Text>
    </TouchableOpacity>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 68,
    gap: 5,
  },
  ring: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2.5,
  },
  avatarWrapper: {
    backgroundColor: Colors.surface,
    borderRadius: 15,
    padding: 1.5,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
  },
  addWrapper: {
    width: 60,
    height: 60,
    borderRadius: 18,
    overflow: 'hidden',
  },
  addGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 60,
  },
});
