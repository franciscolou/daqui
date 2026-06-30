import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../lib/auth';
import { Colors } from '../constants/Colors';

export default function Index() {
  const { loading, signedIn } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return <Redirect href={signedIn ? '/(tabs)' : '/(auth)/welcome'} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
