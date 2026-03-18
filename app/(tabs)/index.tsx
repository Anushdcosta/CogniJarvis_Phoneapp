import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { btService } from '../../services/BluetoothService';

export default function Index() {
  const [isConnected, setIsConnected] = useState(!!btService.connectedDevice);
  const [deviceName, setDeviceName] = useState("PiProject");

  useEffect(() => {
    // Check initial state
    const checkStatus = async () => {
      const status = await btService.checkConnection();
      setIsConnected(status);
      if (status && btService.connectedDevice) {
        setDeviceName(btService.connectedDevice.name || "PiProject");
      }
    };
    checkStatus();

    // Set up polling interval to keep UI in sync
    const statusInterval = setInterval(checkStatus, 3000);

    return () => clearInterval(statusInterval);
  }, []);

  const handleDevicePress = () => {
    if (isConnected && btService.connectedDevice) {
      router.push('/DeviceConfig');
    } else {
      setIsConnected(false);
      btService.reconnect();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconWrapper} onPress={() => router.push('/QRcodeScanner')}>
          <FontAwesome name="qrcode" size={20} color="#E0E0E0" />
        </TouchableOpacity>

        <Text style={styles.logoText}>Cogni-Jarvis</Text>

        <TouchableOpacity style={styles.headerIconWrapper}>
          <FontAwesome name="user-o" size={20} color="#E0E0E0" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>My Devices</Text>

        <TouchableOpacity
          style={styles.deviceCard}
          onPress={handleDevicePress}
          activeOpacity={0.8}
        >
          <View style={styles.deviceIconContainer}>
            <FontAwesome name="microchip" size={40} color={isConnected ? "#00FF00" : "#6a6969ff"} />
          </View>
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName}>{deviceName}</Text>
            <Text style={styles.deviceStatus}>
              {isConnected ? "Connected" : "Not Connected"}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addDeviceButton}
          onPress={() => router.push('/Instructions')}
          activeOpacity={0.8}
        >
          <FontAwesome name="plus" size={16} color="#A0A0A0" style={styles.addIcon} />
          <Text style={styles.addDeviceText}>Add Device</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerIconWrapper: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF3B30',
  },
  logoText: {
    color: "#00AEEF",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  sectionTitle: {
    color: "#E0E0E0",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 16,
  },
  deviceCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 24,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  deviceIconContainer: {
    marginRight: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  deviceInfo: {
    flex: 1,
    justifyContent: "center",
  },
  deviceName: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 6,
  },
  deviceStatus: {
    color: "#888888",
    fontSize: 14,
  },
  addDeviceButton: {
    backgroundColor: "#2A2A2A",
    borderRadius: 30,
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  addIcon: {
    marginRight: 8,
  },
  addDeviceText: {
    color: "#E0E0E0",
    fontSize: 16,
    fontWeight: "500",
  },
});