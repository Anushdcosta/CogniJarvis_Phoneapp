import FontAwesome from '@expo/vector-icons/FontAwesome';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Animated, Dimensions, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BleManager } from 'react-native-ble-plx';

// Initialize Manager outside the component to avoid re-renders
const manager = new BleManager();

const { width } = Dimensions.get('window');
const scanAreaSize = width * 0.7;

export default function QRcodeScanner() {
    const [permission, requestPermission] = useCameraPermissions();
    const [isConnecting, setIsConnecting] = useState(false);
    const [scanned, setScanned] = useState(false);
    const router = useRouter();

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

    const handleBarcodeScanned = async ({ data }: { data: string }) => {
        if (scanned) return;
        setScanned(true);
        setIsConnecting(true);

        try {
            // 1. Validate if data is a MAC Address (Optional but recommended)
            console.log("Connecting to:", data);

            // 2. Connect to the device scanned from QR
            // 'data' should be the MAC address from your Ubuntu/Pi script
            const device = await manager.connectToDevice(data);

            // 3. Discover services and characteristics
            await device.discoverAllServicesAndCharacteristics();

            console.log("Connected Successfully!");

            // 4. Trigger success animation
            Animated.timing(animValue, {
                toValue: 1,
                duration: 350,
                useNativeDriver: true,
            }).start(() => {
                router.replace({
                    pathname: '/(tabs)',
                    params: { deviceId: device.id } // Pass ID to manage it in the next screen
                });
            });

        } catch (error) {
            console.error("Connection failed", error);
            alert("Could not connect to the device. Make sure Bluetooth is on.");
            setScanned(false);
            setIsConnecting(false);
        }
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
            <CameraView
                style={styles.camera}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                }}
            >
                {/* Full screen overlay */}
                <View style={styles.overlay}>

                    {/* Top Overlay Section */}
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: 20 }}>
                        <SafeAreaView>
                            <View style={styles.header}>
                                <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/Instructions")}>
                                    <FontAwesome name="angle-left" size={32} color="#FFFFFF" />
                                </TouchableOpacity>
                                <Text style={styles.headerTitle}>Scan QR Code</Text>
                                <View style={styles.backButton} /> {/* Placeholder for centering */}
                            </View>
                        </SafeAreaView>
                    </View>

                    {/* Middle Cutout Section (Target) */}
                    <View style={styles.focusedContainer}>
                        {/* Target Frame Corners Animated */}
                        <Animated.View style={[styles.corner, styles.topLeftCorner, topLeftStyle]} />
                        <Animated.View style={[styles.corner, styles.topRightCorner, topRightStyle]} />
                        <Animated.View style={[styles.corner, styles.bottomLeftCorner, bottomLeftStyle]} />
                        <Animated.View style={[styles.corner, styles.bottomRightCorner, bottomRightStyle]} />
                    </View>

                    {/* Bottom Overlay Section */}
                    <View style={{ position: 'absolute', bottom: 100, left: 0, right: 0, paddingHorizontal: 32 }}>
                        <Text style={styles.instructionText}>
                            Align the machine's QR code within the frame to scan
                        </Text>

                        {scanned && (
                            <TouchableOpacity
                                style={styles.rescanButton}
                                onPress={resetScan}
                            >
                                <FontAwesome name="refresh" size={20} color="#FFFFFF" style={styles.rescanIcon} />
                                <Text style={styles.rescanButtonText}>Tap to Scan Again</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                </View>
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
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
