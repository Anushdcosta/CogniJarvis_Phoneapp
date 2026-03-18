import { Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert, Linking, LogBox, Platform } from "react-native";
import { BleManager, State } from "react-native-ble-plx";

LogBox.ignoreAllLogs();

const manager = new BleManager();

export default function RootLayout() {
  const hasAlertedRef = useRef(false);

  useEffect(() => {
    const handleBluetoothState = async (state: State) => {
      // Ignore the 'Unknown' state that happens during initialization
      if (state === State.Unknown) return;

      if (state === State.PoweredOff || state === State.Unauthorized) {
        if (!hasAlertedRef.current) {
          hasAlertedRef.current = true;
          Alert.alert(
            "Bluetooth Required",
            "This app requires Bluetooth to connect to your project. Please turn it on in your settings.",
            [
              {
                text: "Open Settings",
                onPress: () => {
                  hasAlertedRef.current = false;
                  if (Platform.OS === 'android') {
                    // Fallback to try and auto-enable, but open settings if we can't
                    manager.enable().catch(() => {
                      Linking.sendIntent("android.settings.BLUETOOTH_SETTINGS").catch(() => { });
                    });
                  } else {
                    Linking.openURL('App-Prefs:Bluetooth');
                  }
                }
              },
              {
                text: "Cancel",
                style: "cancel",
                onPress: () => { hasAlertedRef.current = false; }
              }
            ]
          );
        }
      } else if (state === State.PoweredOn) {
        // Reset the alert lock if they turn it on
        hasAlertedRef.current = false;
      }
    };

    // 1. Immediately check current state
    manager.state().then(handleBluetoothState);

    // 2. Subscribe to any future changes (this also fires when transitioning from Unknown -> PoweredOff)
    const subscription = manager.onStateChange(handleBluetoothState, true);

    return () => subscription.remove();
  }, []);
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="Instructions" options={{ headerShown: false }} />
      <Stack.Screen name="QRcodeScanner" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
