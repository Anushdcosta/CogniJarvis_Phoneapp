import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SubTabLayout() {
    const insets = useSafeAreaInsets();
    return (
        <Tabs screenOptions={{
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
        }}>
            <Tabs.Screen name="index" options={{ title: 'Logs', headerShown: false, tabBarIcon: ({ color, size }) => <FontAwesome name="microchip" size={24} color={color} /> }} />
            <Tabs.Screen name="Settings" options={{ title: 'Settings', headerShown: false, tabBarIcon: ({ color, size }) => <FontAwesome name="gears" size={24} color={color} /> }} />
            <Tabs.Screen
                name="Schedule"
                options={{
                    href: null,
                    headerShown: false
                }}
            />
            <Tabs.Screen name="AgentChat" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="OfftimeModify" options={{ href: null, headerShown: false }} />
        </Tabs>
    );
}