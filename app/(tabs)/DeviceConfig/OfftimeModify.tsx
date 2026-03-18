import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { btService } from '../../../services/BluetoothService';

export default function OfftimeModify() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const msg = params.msg as string | undefined;
    const [offtimeData, setOfftimeData] = useState<any>(null);
    const [selectedMode, setSelectedMode] = useState<'weekday' | 'weekend'>('weekday');

    useFocusEffect(React.useCallback(() => {
        const listener = (data: any) => {
            // Self-remove on first response
            btService.onSettingsUpdateListeners = btService.onSettingsUpdateListeners.filter(l => l !== listener);
            console.log('OfftimeModify received GET_OFF data:', data);

            // Expected format: [{day_type: "Weekday", hour_of_day: 0}, ...]
            // The data is already the array we need
            setOfftimeData(data);
        };

        btService.onSettingsUpdateListeners.push(listener);
        console.log('OfftimeModify: sending GET_OFF to Pi...');
        btService.sendMessage('GET_OFF');

        return () => {
            btService.onSettingsUpdateListeners = btService.onSettingsUpdateListeners.filter(l => l !== listener);
        };
    }, []));

    const isOff = (hour: number) => {
        if (!offtimeData || !Array.isArray(offtimeData)) return false;

        // Find if there's an entry for this hour in the selected mode
        // Note: selectedMode is 'weekday'/'weekend' (lowercase)
        // data.day_type is 'Weekday'/'Weekend' (capitalized)
        const targetDayType = selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1);

        return offtimeData.some(item =>
            item.day_type === targetDayType && item.hour_of_day === hour
        );
    };

    const toggleHour = async (hour: number) => {
        const targetDayType = selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1);
        const currentIsOff = isOff(hour);
        const status = currentIsOff ? 1 : 0;
        const previousData = offtimeData; // Capture for reversion

        // Optimistic UI update
        const updatedData = currentIsOff
            ? offtimeData.filter((item: any) => !(item.day_type === targetDayType && item.hour_of_day === hour))
            : [...(offtimeData || []), { day_type: targetDayType, hour_of_day: hour }];

        setOfftimeData(updatedData);

        try {
            console.log(`Sending offtime update: ${targetDayType} ${hour}:00 -> ${status}`);
            const body = JSON.stringify({
                day_type: targetDayType,
                hour_of_day: hour,
                status: status
            })
            console.log(body)
            const response = await fetch('http://100.104.205.24:5678/webhook/update_offtimes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    day_type: targetDayType,
                    hour_of_day: hour,
                    status: status
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update offtime');
            }
            console.log('Offtime update successful');
        } catch (error) {
            console.error('Error updating offtime:', error);
            // Revert optimistic update on failure
            setOfftimeData(previousData);
        }
    };

    const renderHours = () => {
        const hours = [];
        for (let i = 0; i < 24; i++) {
            const off = isOff(i);
            hours.push(
                <TouchableOpacity
                    key={i}
                    style={[styles.hourSlot, off && styles.offSlot]}
                    onPress={() => toggleHour(i)}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.hourText, off && styles.offText]}>
                        {i}:00
                    </Text>
                </TouchableOpacity>
            );
        }
        return hours;
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <FontAwesome name="chevron-left" size={20} color="#ff7b00" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Modify Off Times</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {msg && <Text style={styles.msgText}>{msg}</Text>}

                <View style={styles.modeSelector}>
                    <TouchableOpacity
                        style={[styles.modeBtn, selectedMode === 'weekday' && styles.activeModeBtn]}
                        onPress={() => setSelectedMode('weekday')}
                    >
                        <Text style={[styles.modeBtnText, selectedMode === 'weekday' && styles.activeModeText]}>
                            Weekday
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeBtn, selectedMode === 'weekend' && styles.activeModeBtn]}
                        onPress={() => setSelectedMode('weekend')}
                    >
                        <Text style={[styles.modeBtnText, selectedMode === 'weekend' && styles.activeModeText]}>
                            Weekend
                        </Text>
                    </TouchableOpacity>
                </View>

                {!offtimeData && !msg && (
                    <Text style={styles.placeholderText}>Loading off-time settings...</Text>
                )}

                <View style={styles.gridContainer}>
                    {renderHours()}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#1e1e1e',
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    msgText: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
        marginVertical: 15,
        lineHeight: 24,
    },
    modeSelector: {
        flexDirection: 'row',
        backgroundColor: '#1e1e1e',
        borderRadius: 12,
        padding: 4,
        marginBottom: 25,
    },
    modeBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 10,
    },
    activeModeBtn: {
        backgroundColor: '#ff7b00',
    },
    modeBtnText: {
        color: '#888',
        fontSize: 16,
        fontWeight: '600',
    },
    activeModeText: {
        color: '#fff',
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    hourSlot: {
        width: '23%',
        backgroundColor: '#1e1e1e',
        borderRadius: 8,
        paddingVertical: 15,
        marginBottom: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    offSlot: {
        backgroundColor: '#ff4444',
        borderColor: '#ff4444',
    },
    hourText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    offText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    placeholderText: {
        color: '#888',
        fontSize: 15,
        textAlign: 'center',
        marginTop: 20,
    },
});
