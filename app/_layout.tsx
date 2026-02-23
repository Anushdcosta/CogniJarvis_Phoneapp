import { Stack } from "expo-router";
import { LogBox } from "react-native";

LogBox.ignoreAllLogs();

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="Instructions" options={{ headerShown: false }} />
      <Stack.Screen name="QRcodeScanner" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
