import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                tabBarStyle: {
                    backgroundColor: '#000000',
                    borderTopWidth: 0,
                    elevation: 0,
                    shadowOpacity: 0,
                    height: 60 + insets.bottom,
                    paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
                    paddingTop: 10,
                },
                tabBarActiveTintColor: '#00AEEF',
                tabBarInactiveTintColor: '#888888',
                tabBarShowLabel: false,
            }}
        >
            <Tabs.Screen name="index" options={{ headerShown: false, tabBarIcon: ({ color, size }) => <FontAwesome name="microchip" size={24} color={color} /> }} />
            <Tabs.Screen name="about" options={{ headerShown: false, tabBarIcon: ({ color, size }) => <FontAwesome name="user-o" size={24} color={color} /> }} />
            <Tabs.Screen
                name="DeviceConfig"
                options={{
                    headerShown: false,
                    href: null,
                    tabBarStyle: { display: 'none' } // This hides the MAIN bar when SubWindow is active
                }}
            />
        </Tabs>
    );
}