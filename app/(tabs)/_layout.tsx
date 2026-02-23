import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";

export default function TabLayout() {
    return (
        <Tabs>
            <Tabs.Screen name="index" options={{ headerShown: false, tabBarIcon: ({ color, size }) => <FontAwesome name="home" size={size} color={color} /> }} />
            <Tabs.Screen name="about" options={{ headerShown: false, tabBarIcon: ({ color, size }) => <FontAwesome name="info-circle" size={size} color={color} /> }} />
        </Tabs>
    );
}