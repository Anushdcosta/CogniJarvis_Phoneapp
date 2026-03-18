import FontAwesome from '@expo/vector-icons/FontAwesome';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BleManager, State } from 'react-native-ble-plx';
import { SafeAreaView } from 'react-native-safe-area-context';
import { btService } from '../services/BluetoothService';
// Initialize Manager outside the component to avoid re-renders
const manager = new BleManager();

const { width } = Dimensions.get('window');
const scanAreaSize = width * 0.7;

export default function QRcodeScanner() {
    const [permission, requestPermission] = useCameraPermissions();
    const [isConnecting, setIsConnecting] = useState(false);
    const [scanned, setScanned] = useState(false);
    const router = useRouter();
    const isScanning = useRef(false);
    const requestBluetoothPermissions = async () => {
        if (Platform.OS === 'android') {
            // Android 12 (API 31) and above require specific Bluetooth permissions
            if (Platform.Version >= 31) {
                const result = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                ]);

                return (
                    result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
                    result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED
                );
            } else {
                // Android 11 and below only need Location to scan
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
                );
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            }
        }
        return true;
    };


    useEffect(() => {
        const checkPermissions = async () => {
            const granted = await requestBluetoothPermissions();
            if (!granted) {
                Alert.alert(
                    "Permission Denied",
                    "This app needs Bluetooth and Location permissions to connect to your laptop."
                );
            }
        };

        checkPermissions();
    }, []);

    // Animation value for the frame closing in
    const animValue = useRef(new Animated.Value(0)).current;

    if (!permission) {
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.permissionScreen}>
                <View style={styles.permissionContainer}>
                    <FontAwesome name="camera" size={64} color="#ff7b00ff" style={styles.permissionIcon} />
                    <Text style={styles.permissionTitle}>Camera Access Required</Text>
                    <Text style={styles.permissionMessage}>
                        We need your permission to use the camera to scan the machine's QR code.
                    </Text>
                    <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                        <Text style={styles.permissionButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
                        <Text style={styles.cancelButtonText}>Cancel Setup</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const resetScan = () => {
        setScanned(false);
        Animated.timing(animValue, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    // 1. Add this at the top of your component


    // 2. Update the function
    const handleBarcodeScanned = async ({ data }: { data: string }) => {
        // IMMEDIATE LOCK using the Ref
        if (isScanning.current) return;
        isScanning.current = true;

        setScanned(true); // For UI
        setIsConnecting(true);

        console.log("--- SCAN LOCK ACTIVE ---");

        try {
            const btState = await manager.state();
            if (btState !== State.PoweredOn) {
                console.log(`Scan Error: Bluetooth is currently ${btState}. Cannot start scan.`);
                isScanning.current = false;
                setIsConnecting(false);
                setScanned(false);
                return;
            }
        } catch (e) {
            console.log("Error checking Bluetooth state:", e);
        }

        manager.startDeviceScan(null, null, async (error, device) => {
            if (error) {
                console.log("Scan Error:", error);
                isScanning.current = false;
                setIsConnecting(false);
                return;
            }

            if (device && (device.id === data || device.name === "PiProject")) {
                manager.stopDeviceScan();

                try {
                    console.log("--- STARTING CONNECTION ---");
                    const connectedDevice = await device.connect();

                    // 1. Force the phone to wait for the service map
                    console.log("Step 1: Discovering Services...");
                    await connectedDevice.discoverAllServicesAndCharacteristics();

                    const services = await connectedDevice.services();
                    console.log("Services found:", services.map(s => s.uuid));

                    const characteristics = await connectedDevice.characteristicsForService("0000beef-0000-1000-8000-00805f9b34fb");
                    console.log("Characteristics found:", characteristics.map(c => c.uuid));

                    // 2. Add a 'Settling' delay (Crucial for Linux/BlueZ)
                    // This gives the Raspberry Pi a moment to stabilize the GATT table
                    console.log("Step 2: Waiting for stability...");
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    // 3. Store the device globally
                    btService.setDevice(connectedDevice);

                    // 4. Finally, send the handshake
                    console.log("Step 3: Sending Handshake...");
                    await btService.sendMessage("Hello");

                    console.log("SUCCESS! Connection is rock solid.");
                    router.replace('/(tabs)');
                } catch (err) {
                    console.log("Connection failed at some stage:", err);
                    isScanning.current = false;
                    setIsConnecting(false);
                }
            }
        });
    };

    const offset = scanAreaSize / 4; // The distance to move inwards

    const topLeftStyle = {
        transform: [
            { translateX: animValue.interpolate({ inputRange: [0, 1], outputRange: [0, offset] }) },
            { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [0, offset] }) },
        ]
    };
    const topRightStyle = {
        transform: [
            { translateX: animValue.interpolate({ inputRange: [0, 1], outputRange: [0, -offset] }) },
            { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [0, offset] }) },
        ]
    };
    const bottomLeftStyle = {
        transform: [
            { translateX: animValue.interpolate({ inputRange: [0, 1], outputRange: [0, offset] }) },
            { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [0, -offset] }) },
        ]
    };
    const bottomRightStyle = {
        transform: [
            { translateX: animValue.interpolate({ inputRange: [0, 1], outputRange: [0, -offset] }) },
            { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [0, -offset] }) },
        ]
    };

    return (
        <View style={styles.container}>
            {/* Camera is now a standalone background layer */}
            <CameraView
                style={StyleSheet.absoluteFillObject}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                }}
            />

            {/* The UI Overlay is now explicitly on top */}
            <View style={styles.overlay} pointerEvents="box-none">
                {isConnecting && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#ff7b00ff" />
                        <Text style={styles.loadingText}>Connecting to Pi...</Text>
                    </View>
                )}

                {/* Top Header */}
                <View style={styles.headerContainer}>
                    <SafeAreaView edges={['top']}>
                        <View style={styles.header}>
                            <TouchableOpacity onPress={() => router.replace("/Instructions")}>
                                <FontAwesome name="angle-left" size={32} color="#FFFFFF" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>Scan QR Code</Text>
                            <View style={{ width: 32 }} />
                        </View>
                    </SafeAreaView>
                </View>

                {/* Middle Scanning Frame */}
                <View style={styles.focusedContainer}>
                    <Animated.View style={[styles.corner, styles.topLeftCorner, topLeftStyle]} />
                    <Animated.View style={[styles.corner, styles.topRightCorner, topRightStyle]} />
                    <Animated.View style={[styles.corner, styles.bottomLeftCorner, bottomLeftStyle]} />
                    <Animated.View style={[styles.corner, styles.bottomRightCorner, bottomRightStyle]} />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    loadingText: {
        color: '#FFFFFF',
        marginTop: 10,
        fontSize: 18,
        fontWeight: '600',
    },
    headerContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    permissionScreen: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    permissionIcon: {
        marginBottom: 24,
    },
    permissionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 12,
        textAlign: 'center',
    },
    permissionMessage: {
        fontSize: 16,
        color: '#4B5563',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    permissionButton: {
        backgroundColor: '#ff7b00ff',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 14,
        alignItems: 'center',
        width: '100%',
        marginBottom: 16,
        shadowColor: '#ff7b00ff',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    permissionButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
    cancelButton: {
        paddingVertical: 16,
        width: '100%',
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#6B7280',
        fontSize: 16,
        fontWeight: '600',
    },
    camera: {
        flex: 1,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cutout: {
        width: scanAreaSize,
        height: scanAreaSize,
        borderColor: 'rgba(0,0,0,0.65)',
        borderWidth: width,
        position: 'absolute'
    },
    focusedContainer: {
        width: scanAreaSize,
        height: scanAreaSize,
        position: 'relative',
        borderRadius: 20, // ensure the inside corners are respected
        overflow: 'hidden'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    corner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderColor: '#ff7b00ff',
    },
    topLeftCorner: {
        top: 0,
        left: 0,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopLeftRadius: 16,
    },
    topRightCorner: {
        top: 0,
        right: 0,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderTopRightRadius: 16,
    },
    bottomLeftCorner: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderBottomLeftRadius: 16,
    },
    bottomRightCorner: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomRightRadius: 16,
    },
    instructionText: {
        color: '#FFFFFF',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 40,
        fontWeight: '500',
        paddingHorizontal: 32,
        lineHeight: 24,
    },
    rescanButton: {
        flexDirection: 'row',
        backgroundColor: '#ff7b00ff',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 24,
        alignItems: 'center',
        alignSelf: 'center',
        marginTop: 32,
    },
    rescanIcon: {
        marginRight: 8,
    },
    rescanButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
