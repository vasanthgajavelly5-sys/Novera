import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <Stack>
      <StatusBar style="auto" />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="reader" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
    </Stack>
  );
}