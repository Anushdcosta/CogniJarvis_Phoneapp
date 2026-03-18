import { btService } from '@/services/BluetoothService';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width;

export default function Dashboard() {
    const [stats, setStats] = useState(btService.deviceStats);
    const [tempHistory, setTempHistory] = useState([60, 61, 62, 62, 63, 62]); // Initial dummy data
    const [isConnected, setIsConnected] = useState(!!btService.connectedDevice);

    useEffect(() => {
        btService.onStatsUpdate = (newStats) => {
            setStats(newStats);
            // Update graph: keep last 6 readings
            setTempHistory(prev => [...prev.slice(-5), parseFloat(newStats.temp)]);
        };

        const checkDisconnect = setInterval(async () => {
            const isStillConnected = await btService.checkConnection();
            setIsConnected(isStillConnected);

            if (!isStillConnected) {
                clearInterval(checkDisconnect);
                Alert.alert("Connection Lost", "The device is no longer reachable.");
                router.replace('/');
            }
        }, 2000);

        return () => {
            btService.onStatsUpdate = null;
            clearInterval(checkDisconnect);
        };
    }, []);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* 1. TOP STATS ROW */}
            <View style={styles.statsRow}>
                <StatBox label="CPU Temp" value={`${stats.temp}°`} icon="thermometer-half" color="#ff4444" />
                <StatBox label="RAM" value={`${stats.ram}%`} icon="microchip" color="#44bbff" />
                <StatBox label="Charge" value={`${stats.battery}%`} icon="battery-full" color="#44ff44" />
            </View>

            {/* 2. CENTER GRAPH */}
            <View style={styles.graphContainer}>
                <Text style={styles.graphTitle}>CPU TEMP HISTORY</Text>
                <LineChart
                    data={{
                        labels: ["-5m", "-4m", "-3m", "-2m", "-1m", "Now"],
                        datasets: [{ data: tempHistory }]
                    }}
                    width={screenWidth - 40}
                    height={220}
                    chartConfig={chartConfig}
                    segments={10}
                    formatYLabel={(value) => `${Math.round(eval(value))}°`}
                    bezier
                    style={styles.chart}
                />
            </View>

            {/* 3. BOTTOM ACTION BUTTONS */}
            <View style={styles.buttonRow}>
                <ActionButton label="View Schedule" icon="calendar" onPress={() => router.push('/DeviceConfig/Schedule')} />
                <ActionButton label="Speak to Agent" icon="commenting" onPress={() => router.push('/DeviceConfig/AgentChat')} />
            </View>
        </ScrollView>
    );
}

// Helper Components
type IconName = React.ComponentProps<typeof FontAwesome>['name'];

const StatBox = ({ label, value, icon, color }: { label: string; value: string; icon: IconName; color: string }) => (
    <View style={styles.statBox}>
        <FontAwesome name={icon} size={20} color={color} />
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

const ActionButton = ({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) => (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
        <FontAwesome name={icon} size={30} color="#ff7b00" />
        <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
);

const chartConfig = {
    backgroundGradientFrom: "#1e1e1e",
    backgroundGradientTo: "#1e1e1e",
    color: (opacity = 1) => `rgba(255, 123, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    strokeWidth: 3,
    propsForDots: { r: "4", strokeWidth: "2", stroke: "#ff7b00" }
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' },
    content: { padding: 20, paddingTop: 60 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
    statBox: { backgroundColor: '#1e1e1e', width: '30%', padding: 15, borderRadius: 12, alignItems: 'center' },
    statValue: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginVertical: 5 },
    statLabel: { color: '#888', fontSize: 10, textTransform: 'uppercase' },
    graphContainer: { backgroundColor: '#1e1e1e', padding: 15, borderRadius: 20, marginBottom: 25 },
    graphTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
    chart: { borderRadius: 16, marginTop: 10 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between' },
    actionButton: { backgroundColor: '#1e1e1e', width: '48%', height: 120, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    actionLabel: { color: '#fff', marginTop: 10, fontWeight: '600', textAlign: 'center' }
});