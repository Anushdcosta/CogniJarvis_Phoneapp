import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Instructions() {
    const [hasDevice, setHasDevice] = useState(false);

    useEffect(() => {
        const checkDevice = async () => {
            try {
                const savedId = await AsyncStorage.getItem('@last_device_id');
                if (savedId) {
                    setHasDevice(true);
                }
            } catch (e) {
                console.log(e);
            }
        };
        checkDevice();
    }, []);

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Device Setup Guide</Text>
                <Text style={styles.description}>
                    Follow these steps to establish a connection between your phone and the machine for configuration.
                </Text>
            </View>

            <View style={styles.contentContainer}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. Prepare the Machine</Text>
                    <View style={styles.list}>
                        <View style={styles.listItem}>
                            <Text style={styles.bullet}>•</Text>
                            <Text style={styles.listText}>Power the machine using the provided power adapter.</Text>
                        </View>
                        <View style={styles.listItem}>
                            <Text style={styles.bullet}>•</Text>
                            <Text style={styles.listText}>Double click the button on the machine to enter pairing mode. The LED light will start blinking blue.</Text>
                        </View>
                        <View style={styles.listItem}>
                            <Text style={styles.bullet}>•</Text>
                            <Text style={styles.listText}>To cancel pairing mode, double click the button on the machine again. The LED light will turn off.</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. Prepare the Phone</Text>
                    <View style={styles.list}>
                        <View style={styles.listItem}>
                            <Text style={styles.bullet}>•</Text>
                            <Text style={styles.listText}>
                                Enable <Text style={styles.strongText}>Bluetooth</Text> in your phone settings.
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. Establishing Connection</Text>
                    <View style={styles.orderedListContainer}>
                        <View style={styles.listItem}>
                            <Text style={styles.bulletNumber}>1.</Text>
                            <Text style={styles.listText}>
                                On the next screen, click on the button to start the QR code scanning process.
                            </Text>
                        </View>
                        <View style={styles.listItem}>
                            <Text style={styles.bulletNumber}>2.</Text>
                            <Text style={styles.listText}>
                                Scan the QR code shown on the screen of the machine.
                            </Text>
                        </View>
                        <View style={styles.listItem}>
                            <Text style={styles.bulletNumber}>2.</Text>
                            <Text style={styles.listText}>The app will automatically detect the machine and display its name.</Text>
                        </View>
                        <View style={styles.listItem}>
                            <Text style={styles.bulletNumber}>3.</Text>
                            <Text style={styles.listText}>Wait for the "Connected" status to appear before proceeding with configuration.</Text>
                        </View>
                    </View>
                </View>
            </View>
            <TouchableOpacity
                style={styles.button}
                onPress={() => {
                    if (hasDevice) {
                        router.replace('/(tabs)');
                    } else {
                        router.replace('/QRcodeScanner');
                    }
                }}
                activeOpacity={0.8}
            >
                <Text style={styles.buttonText}>{hasDevice ? "Start App" : "Scan QR Code"}</Text>
            </TouchableOpacity>
            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Troubleshooting: If there is any issue with the connection, please contact the support team.
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 32,
        backgroundColor: '#FFFFFF',
    },
    header: {
        marginBottom: 32,
    },
    title: {
        fontSize: 30,
        fontWeight: 'bold',
        color: '#111827',
    },
    description: {
        marginTop: 8,
        fontSize: 18,
        color: '#4B5563',
        lineHeight: 26,
    },
    contentContainer: {
        marginBottom: 16,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 16,
    },
    list: {
        paddingLeft: 8,
    },
    listItem: {
        flexDirection: 'row',
        marginBottom: 12,
        alignItems: 'flex-start',
    },
    bullet: {
        fontSize: 16,
        color: '#374151',
        marginRight: 8,
        lineHeight: 24,
    },
    bulletNumber: {
        fontSize: 16,
        color: '#374151',
        marginRight: 8,
        lineHeight: 24,
        fontWeight: '600',
    },
    listText: {
        flex: 1,
        fontSize: 16,
        color: '#374151',
        lineHeight: 24,
    },
    strongText: {
        fontWeight: 'bold',
        color: '#111827',
    },
    orderedListContainer: {
        backgroundColor: '#F9FAFB',
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    footer: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 24,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingBottom: 32,
    },
    footerText: {
        alignSelf: 'center',
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
    },
    button: {
        backgroundColor: '#ff7b00ff',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        shadowColor: '#ff7b00ff',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
        marginBottom: 10,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
});