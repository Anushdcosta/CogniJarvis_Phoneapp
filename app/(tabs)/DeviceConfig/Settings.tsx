import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Slider from '@react-native-community/slider';
import { router, useFocusEffect } from "expo-router";
import React, { useState } from 'react';
import { Alert, Animated, KeyboardAvoidingView, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { btService } from '../../../services/BluetoothService';




const CustomToggle = ({ label, icon, value, onToggle }: any) => {
    const [animatedValue] = useState(new Animated.Value(value ? 1 : 0));

    React.useEffect(() => {
        Animated.timing(animatedValue, {
            toValue: value ? 1 : 0,
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [value]);

    const translateX = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [2, 22],
    });

    const backgroundColor = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['#333333', '#00AEEF'],
    });

    return (
        <View style={styles.toggleRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <FontAwesome6 name={icon} size={20} color="#888" style={styles.inputIcon} />
                <Text style={styles.toggleLabel}>{label}</Text>
            </View>
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onToggle(!value)}
            >
                <Animated.View style={[styles.toggleContainer, { backgroundColor }]}>
                    <Animated.View style={[styles.toggleThumb, { transform: [{ translateX }] }]} />
                </Animated.View>
            </TouchableOpacity>
        </View>
    );
};

const CustomDropdown = ({ label, size, icon, selectedValue, onValueChange, items }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedItem = items.find((i: any) => i.value === selectedValue);

    return (
        <>
            <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setIsOpen(true)}
                activeOpacity={0.7}
            >
                <FontAwesome6 name={icon} size={size} color="#888" style={styles.inputIcon} />
                <Text style={[styles.input, { color: selectedItem ? '#FFF' : '#888' }]}>
                    {selectedItem ? selectedItem.label : `Select ${label}`}
                </Text>
                <FontAwesome6 name={isOpen ? "angle-up" : "angle-down"} size={20} color="#888" />
            </TouchableOpacity>

            <Modal
                transparent
                visible={isOpen}
                animationType="fade"
                onRequestClose={() => setIsOpen(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsOpen(false)}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{label}</Text>
                        {items.map((item: any) => (
                            <TouchableOpacity
                                key={item.value}
                                style={[
                                    styles.itemButton,
                                    selectedValue === item.value && styles.itemButtonActive
                                ]}
                                onPress={() => {
                                    onValueChange(item.value);
                                    setIsOpen(false);
                                }}
                            >
                                <Text style={[
                                    styles.itemText,
                                    selectedValue === item.value && styles.itemTextActive
                                ]}>
                                    {item.label}
                                </Text>
                                {selectedValue === item.value && (
                                    <FontAwesome6 name="check" size={16} color="#00AEEF" />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
};

const CustomSlider = ({ value, onValueChange, min = 0, max = 100, step = 10 }: any) => {
    const steps = Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => min + i * step);

    return (
        <View style={styles.sliderWrapper}>
            <View style={styles.tickContainer}>
                {steps.map((s) => (
                    <View key={s} style={styles.tickMark} />
                ))}
            </View>
            <Slider
                style={styles.slider}
                minimumValue={min}
                maximumValue={max}
                step={step}
                value={value}
                onValueChange={onValueChange}
                minimumTrackTintColor="#00AEEF"
                maximumTrackTintColor="#333333"
                thumbTintColor="#00AEEF"
            />
        </View>
    );
};

const ITEM_HEIGHT = 50;
const VISIBLE_ITEMS = 3;

const WheelColumn = ({ items, value, onValueChange, isLast }: { items: any[], value: any, onValueChange: (val: any) => void, isLast?: boolean }) => {
    const scrollViewRef = React.useRef<ScrollView>(null);
    const paddedItems = [null, ...items, null];

    const handleScroll = (event: any) => {
        const y = event.nativeEvent.contentOffset.y;
        const index = Math.round(y / ITEM_HEIGHT);
        if (items[index] !== undefined && items[index] !== value) {
            onValueChange(items[index]);
        }
    };

    React.useEffect(() => {
        const initialIndex = items.indexOf(value);
        if (initialIndex !== -1) {
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: initialIndex * ITEM_HEIGHT, animated: false });
            }, 100);
        }
    }, []);

    return (
        <View style={[styles.wheelColumn, !isLast && styles.wheelBorder]}>
            <ScrollView
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                onMomentumScrollEnd={handleScroll}
                nestedScrollEnabled={true}
                contentContainerStyle={{ paddingVertical: 0 }}
            >
                {paddedItems.map((item, index) => (
                    <View key={index} style={styles.wheelItem}>
                        <Text style={[
                            styles.wheelText,
                            value === item && styles.wheelTextActive
                        ]}>
                            {item !== null ? item : ""}
                        </Text>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const BirthdayWheelPicker = ({ onAgeChange, onDOBChange, initialAge }: { onAgeChange: (age: string) => void, onDOBChange: (dob: string) => void, initialAge: string }) => {
    const currentYear = new Date().getFullYear();
    const [day, setDay] = useState(1);
    const [month, setMonth] = useState("Jan");
    const [year, setYear] = useState(currentYear - (parseInt(initialAge) || 8));

    const monthIndex = MONTHS.indexOf(month);
    const maxDays = new Date(year, monthIndex + 1, 0).getDate();

    React.useEffect(() => {
        if (day > maxDays) {
            setDay(maxDays);
        }
    }, [maxDays, day]);

    const days = Array.from({ length: maxDays }, (_, i) => i + 1);
    const years = Array.from({ length: 31 }, (_, i) => currentYear - 30 + i);

    React.useEffect(() => {
        const today = new Date();
        const birthDate = new Date(year, monthIndex, day);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        onAgeChange(age.toString());
        
        const monthNum = monthIndex + 1;
        const monthStr = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
        const dayStr = day < 10 ? `0${day}` : `${day}`;
        onDOBChange(`${year}-${monthStr}-${dayStr}`);
    }, [day, month, year]);

    return (
        <View style={styles.birthdayWheelWrapper}>
            <View style={styles.wheelHighlight} pointerEvents="none" />
            <View style={styles.wheelColumnsRow}>
                <WheelColumn items={days} value={day} onValueChange={setDay} />
                <WheelColumn items={MONTHS} value={month} onValueChange={setMonth} />
                <WheelColumn items={years} value={year} onValueChange={setYear} isLast />
            </View>
        </View>
    );
};

export default function DeviceConfigScreen() {
    const [ssid, setSsid] = useState('');
    const [password, setPassword] = useState('');
    const [studentName, setStudentName] = useState('');
    const [ageGroup, setAgeGroup] = useState('');
    const [supportLevel, setSupportLevel] = useState('2');
    const [ADHDType, setADHDType] = useState('1');
    const [ledBrightness, setLedBrightness] = useState('100');
    const [adhdEnabled, setAdhdEnabled] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [userType, setUserType] = useState<'student' | 'parent'>('student');
    const [settingsData, setSettingsData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(!!btService.connectedDevice);
    const [dob, setDOB] = useState('');

    useFocusEffect(
        React.useCallback(() => {
            // 1. Set up the listener for when the Pi finishes sending chunks
            const listener = (data: any) => {
                setSettingsData(data);
                console.log("Settings Data is: ", data);

                // Set initial parameters from the DB
                if (data && data.length > 0) {
                    const mode = data[0].current_mode?.toLowerCase();
                    if (mode === 'student' || mode === 'parent') {
                        setUserType(mode);
                    }

                    if (data[0].student_name !== undefined) setStudentName(data[0].student_name);
                    if (data[0].age_group !== undefined) setAgeGroup(data[0].age_group.toString());
                    if (data[0].support_level !== undefined) setSupportLevel(data[0].support_level.toString());
                    if (data[0].led_brightness !== undefined) setLedBrightness(data[0].led_brightness.toString());
                    if (data[0].support_level !== undefined) {
                        setSupportLevel(data[0].support_level.toString());
                    }
                    if (data[0].adhd_type !== undefined) {
                        setADHDType(data[0].adhd_type.toString());
                        setAdhdEnabled(parseInt(data[0].adhd_type) !== 0);
                    }

                    console.log("User Type is: ", data[0].current_mode?.toLowerCase());
                    console.log("Name is: ", data[0].student_name);
                    console.log("age_group is: ", data[0].age_group);
                    console.log("Support Level is: ", data[0].support_level);
                    console.log("LED brightness is: ", data[0].led_brightness);
                    console.log("ADHD Type is: ", data[0].adhd_type);
                }

                setLoading(false);
            };

            btService.onSettingsUpdateListeners.push(listener);


            // 2. TRIGGER: Send the command to the Pi to start the DB query
            console.log("Requesting settings from Pi...");
            btService.sendMessage("GET_SETTING");

            // 3. LISTEN FOR DISCONNECTS ACTIVELY
            const checkDisconnect = setInterval(async () => {
                const isConnected = await btService.checkConnection();
                if (!isConnected) {
                    clearInterval(checkDisconnect);
                    Alert.alert("Connection Lost", "The device has been disconnected.");
                    router.replace('/');
                }
            }, 2000);

            // 4. Cleanup: Remove listener when leaving the screen
            return () => {
                btService.onSettingsUpdateListeners = btService.onSettingsUpdateListeners.filter(l => l !== listener);
                clearInterval(checkDisconnect);
            };
        }, [])
    );



    const handleSave = async () => {
        // Pre-flight connection check
        const isStillConnected = await btService.checkConnection();
        if (!isStillConnected) {
            Alert.alert("Connection Failed", "Cannot apply settings, device is disconnected.");
            return;
        }

        setIsSaving(true);
        // Construct a simple payload, in a real app this might be JSON
        const payload = JSON.stringify({
            ssid, password,
            student_name: studentName,
            age_group: parseInt(ageGroup) || 0,
            dob,
            support_level: parseInt(supportLevel) || 0,
            led_brightness: parseInt(ledBrightness) || 100,
            adhd_type: adhdEnabled ? (parseInt(ADHDType) || 3) : 0,
            current_mode: userType
        });

        try {
            await btService.sendMessage(payload);

            // Send webhook trigger to n8n
            fetch('http://100.104.205.24:5678/webhook/update_data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: payload
            }).catch(err => console.log('Failed to trigger webhook:', err.message));

            // Optionally, we could show a success message here before navigating back
            setTimeout(() => {
                setIsSaving(false);
                router.back();
            }, 600);
        } catch (error) {
            console.error(error);
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <FontAwesome6 name="angle-left" size={32} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Device Settings</Text>
                <View style={{ width: 32 }} />
            </View>
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'android' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.formSection}>
                        <Text style={styles.label}>Profile Type</Text>
                        <View style={styles.roleContainer}>
                            <TouchableOpacity
                                style={[styles.roleButton, userType === 'student' && styles.roleButtonActive]}
                                onPress={() => setUserType('student')}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.roleButtonText, userType === 'student' && styles.roleButtonTextActive]}>Student</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.roleButton, userType === 'parent' && styles.roleButtonActive]}
                                onPress={() => setUserType('parent')}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.roleButtonText, userType === 'parent' && styles.roleButtonTextActive]}>Parent</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Name of Child</Text>
                        <View style={styles.inputContainer}>
                            <FontAwesome6 name="user" size={20} color="#888" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Enter child's name"
                                placeholderTextColor="#888"
                                value={studentName}
                                onChangeText={setStudentName}
                            />
                        </View>

                        <Text style={styles.label}>Date of Birth</Text>
                        <BirthdayWheelPicker
                            initialAge={ageGroup}
                            onAgeChange={setAgeGroup}
                            onDOBChange={setDOB}
                        />

                        <Text style={styles.label}>Does the child have ADHD</Text>
                        <CustomToggle
                            label="ADHD Present"
                            icon="brain"
                            value={adhdEnabled}
                            onToggle={(val: boolean) => {
                                setAdhdEnabled(val);
                                if (!val) setSupportLevel('0');
                                else if (supportLevel === '0') setSupportLevel('2'); // Default to Medium if enabled
                            }}
                        />

                        {adhdEnabled && (
                            <>
                                <Text style={styles.label}>ADHD Support Level</Text>
                                <CustomDropdown
                                    label="ADHD Level"
                                    icon="fly"
                                    size={30}
                                    selectedValue={ADHDType}
                                    onValueChange={setADHDType}
                                    items={[
                                        { label: 'Predominantly Inattentive Presentation', value: '1' },
                                        { label: 'Predominantly Hyperactive-Impulsive Presentation', value: '2' },
                                        { label: 'Combined Presentation', value: '3' },
                                    ]}
                                />
                            </>
                        )}

                        <Text style={styles.label}>ASD Level (DSM-5)</Text>
                        <CustomDropdown
                            label="ASD Level"
                            icon="infinity"
                            size={15}
                            selectedValue={supportLevel}
                            onValueChange={setSupportLevel}
                            items={[
                                { label: 'None', value: '0' },
                                { label: 'Least Support (Level 1)', value: '1' },
                                { label: 'Medium Support (Level 2)', value: '2' },
                                { label: 'High Support (Level 3)', value: '3' },
                            ]}
                        />

                        <Text style={styles.label}>LED Brightness (%)</Text>
                        <View style={[styles.inputContainer, { paddingHorizontal: 0, paddingRight: 8, gap: 8 }]}>
                            <View style={{ width: 44, alignItems: 'center' }}>
                                <FontAwesome6 name="lightbulb" size={25} color="#888" />
                            </View>
                            <CustomSlider
                                value={parseInt(ledBrightness) || 0}
                                onValueChange={(val: number) => setLedBrightness(val.toString())}
                                min={0}
                                max={100}
                                step={10}
                            />
                            <TextInput
                                style={[styles.input, { flex: 0, width: 50, textAlign: 'center', backgroundColor: '#111', borderRadius: 8, height: 38 }]}
                                placeholder="0"
                                placeholderTextColor="#888"
                                value={ledBrightness}
                                onChangeText={(text) => {
                                    // Make sure it stays within 0-100 range and strips non-numbers
                                    const numStr = text.replace(/[^0-9]/g, '');
                                    const num = parseInt(numStr) || 0;
                                    setLedBrightness(Math.min(100, num).toString());
                                }}
                                keyboardType="numeric"
                                maxLength={3}
                            />
                        </View>

                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={isSaving}
                        activeOpacity={0.8}
                    >
                        {isSaving ? (
                            <Text style={styles.saveButtonText}>Saving...</Text>
                        ) : (
                            <>
                                <FontAwesome6 name="save" size={20} color="#FFFFFF" style={styles.saveIcon} />
                                <Text style={styles.saveButtonText}>Apply Configuration</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#000000",
    },
    keyboardAvoid: {
        flex: 1,
    },
    picker: {
        color: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 40,
    },
    iconContainer: {
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 40,
    },
    subtitle: {
        color: '#888888',
        fontSize: 15,
        textAlign: 'center',
        marginTop: 16,
        lineHeight: 22,
        paddingHorizontal: 10,
    },
    formSection: {
        backgroundColor: '#111111',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: '#222222',
    },
    label: {
        color: '#E0E0E0',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 16,
    },
    roleContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 8,
    },
    roleButton: {
        flex: 1,
        height: 54,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333333',
        backgroundColor: '#1A1A1A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    roleButtonActive: {
        backgroundColor: 'rgba(0, 174, 239, 0.1)',
        borderColor: '#00AEEF',
    },
    roleButtonText: {
        color: '#888888',
        fontSize: 16,
        fontWeight: '600',
    },
    roleButtonTextActive: {
        color: '#00AEEF',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 63,
        borderWidth: 1,
        borderColor: '#333333',
    },
    inputIcon: {
        marginRight: 12,
        width: 20,
        textAlign: 'center',
    },
    input: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 16,
    },
    footer: {
        padding: 24,
        paddingBottom: 32,
        backgroundColor: '#000000',
        borderTopWidth: 1,
        borderTopColor: '#1A1A1A',
    },
    saveButton: {
        flexDirection: 'row',
        backgroundColor: '#00AEEF',
        borderRadius: 30,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#00AEEF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonDisabled: {
        backgroundColor: '#005f85',
        shadowOpacity: 0,
    },
    saveIcon: {
        marginRight: 10,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#333333',
    },
    modalTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#333333',
    },
    itemButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 4,
    },
    itemButtonActive: {
        backgroundColor: 'rgba(0, 174, 239, 0.1)',
    },
    itemText: {
        color: '#E0E0E0',
        fontSize: 16,
    },
    itemTextActive: {
        color: '#00AEEF',
        fontWeight: '600',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 54,
        borderWidth: 1,
        borderColor: '#333333',
        marginBottom: 8,
    },
    toggleLabel: {
        color: '#FFFFFF',
        fontSize: 16,
    },
    toggleContainer: {
        width: 50,
        height: 28,
        borderRadius: 14,
        padding: 2,
    },
    toggleThumb: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    sliderWrapper: {
        flex: 1,
        height: 40,
        justifyContent: 'center',
    },
    tickContainer: {
        position: 'absolute',
        left: 10,
        right: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        // paddingHorizontal: 2, // Adjust slightly to align with slider track
    },
    tickMark: {
        width: 2,
        height: 8,
        backgroundColor: '#333333',
        borderRadius: 1,
    },
    slider: {
        flex: 1,
        height: 40,
    },
    wheelWrapper: {
        height: ITEM_HEIGHT * VISIBLE_ITEMS,
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333333',
        overflow: 'hidden',
        marginVertical: 8,
    },
    birthdayWheelWrapper: {
        height: ITEM_HEIGHT * VISIBLE_ITEMS,
        backgroundColor: '#0A1220',
        borderRadius: 20,
        marginVertical: 12,
        overflow: 'hidden',
    },
    wheelColumnsRow: {
        flexDirection: 'row',
        flex: 1,
    },
    wheelColumn: {
        flex: 1,
    },
    wheelBorder: {
        borderRightWidth: 1,
        borderRightColor: '#1e2a3a',
    },
    wheelHighlight: {
        position: 'absolute',
        top: ITEM_HEIGHT,
        left: 10,
        right: 10,
        height: ITEM_HEIGHT,
        borderWidth: 1.5,
        borderColor: '#00AEEF',
        borderRadius: 10,
        zIndex: 1,
    },
    wheelItem: {
        height: ITEM_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    wheelText: {
        color: '#4A5A70',
        fontSize: 16,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    wheelTextActive: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
});