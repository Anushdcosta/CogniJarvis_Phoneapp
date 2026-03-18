import { btService } from '@/services/BluetoothService'; // Ensure this path is correct
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useState } from 'react'; // Added useEffect and useState
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ScheduleScreen() {
    const router = useRouter();
    const [scheduleData, setScheduleData] = useState([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        React.useCallback(() => {
            // 1. Set up the listener for when the Pi finishes sending chunks
            btService.onScheduleUpdate = (data) => {
                setScheduleData(data);
                setLoading(false);
            };

            // 2. TRIGGER: Send the command to the Pi to start the DB query
            console.log("Requesting schedule from Pi...");
            btService.sendMessage("GET_SCHED");

            // 3. Cleanup: Remove listener when leaving the screen
            return () => {
                btService.onScheduleUpdate = null;
            };
        }, [])
    );

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.scheduleItem}>
            {/* Shows the start time in orange on the left */}
            <View style={styles.timeContainer}>
                <Text style={styles.timeText}>{item.start_time}</Text>
                <Text style={styles.dateText}>{item.task_date}</Text>
            </View>

            <View style={styles.details}>
                <Text style={styles.taskText}>{item.task_name}</Text>
                <Text style={styles.subText}>
                    Block {item.block_number} • {item.is_completed ? "✅ Done" : "⏳ Pending"}
                </Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <FontAwesome name="chevron-left" size={24} color="#ff7b00" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Device Schedule</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                {loading ? (
                    <Text style={styles.emptyText}>Loading schedule...</Text>
                ) : scheduleData.length > 0 ? (
                    <FlatList
                        data={scheduleData}
                        renderItem={renderItem}
                        keyExtractor={(item, index) => index.toString()}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                ) : (
                    <Text style={styles.emptyText}>No events scheduled for today.</Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212', padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 20 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    content: { flex: 1 },
    emptyText: { color: '#888', fontSize: 16, textAlign: 'center', marginTop: 50 },
    subjectText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    infoText: { color: '#888', fontSize: 12 },
    scheduleItem: {
        backgroundColor: '#1e1e1e',
        padding: 15,
        borderRadius: 15,
        flexDirection: 'row',
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#ff7b00' // Orange accent
    },
    timeContainer: {
        width: 80,
        justifyContent: 'center',
    },
    timeText: { color: '#ff7b00', fontWeight: 'bold', fontSize: 16 },
    dateText: { color: '#666', fontSize: 10, marginTop: 2 },
    details: { flex: 1, paddingLeft: 10 },
    taskText: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 4 },
    subText: { color: '#888', fontSize: 12, fontStyle: 'italic' },
});