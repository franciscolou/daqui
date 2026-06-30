import { Redirect } from 'expo-router';

export default function Index() {
  // In a real app, check auth state here
  return <Redirect href="/(auth)/welcome" />;
}
