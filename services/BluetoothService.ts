import AsyncStorage from '@react-native-async-storage/async-storage';
import ForegroundService from '@voximplant/react-native-foreground-service';
import { Buffer } from 'buffer';
import * as TaskManager from 'expo-task-manager';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';

const SERVICE_UUID = "0000beef-0000-1000-8000-00805f9b34fb";
const CHAR_UUID = "0000bef1-0000-1000-8000-00805f9b34fb";
const STORAGE_KEY = "@last_device_id";
const BLUETOOTH_KEEPALIVE_TASK = 'jarvis-ble-keepalive';

class BluetoothService {
    onScheduleUpdate: ((schedule: any) => void) | null = null;
    onSettingsUpdateListeners: ((setting: any) => void)[] = [];
    onStatsUpdate: ((stats: any) => void) | null = null;

    manager: BleManager;
    connectedDevice: Device | null = null;
    lastDeviceId: string | null = null;
    deviceStats = { temp: '0', ram: '0', battery: '0' };

    private disconnectSubscription: any = null;
    private connectionCheckInterval: ReturnType<typeof setInterval> | null = null;
    private isServiceRunning = false;

    scheduleBuffer = "";
    settingsBuffer = "";
    offBuffer = "";

    constructor() {
        this.manager = new BleManager({
            restoreStateIdentifier: 'JarvisBleState'
        });
        this.initService();
    }

    private async initService() {
        try {
            if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {
                await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
                ]);
            }

            const savedId = await AsyncStorage.getItem(STORAGE_KEY);
            if (savedId) {
                this.lastDeviceId = savedId;
            }

            // Check for devices restored by the OS (State Restoration)
            const connectedDevices = await this.manager.connectedDevices([SERVICE_UUID]);

            if (connectedDevices.length > 0) {
                console.log("Restoring active connection found by OS");
                const device = connectedDevices[0];
                await this.setDevice(device);
                await device.discoverAllServicesAndCharacteristics();
                this.startJarvisForegroundService();
                this.monitorStatus();
            } else if (this.lastDeviceId) {
                this.reconnect();
            }
        } catch (e) {
            console.log("Init service error:", e);
        }
    }

    async setDevice(device: Device | null) {
        this.connectedDevice = device;

        if (this.disconnectSubscription) {
            this.disconnectSubscription.remove();
            this.disconnectSubscription = null;
        }

        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
        // if device exists, set the device id and save it to async storage
        if (device) {
            this.lastDeviceId = device.id;
            try {
                await AsyncStorage.setItem(STORAGE_KEY, device.id);
            } catch (e) {
                console.log("Failed to save ID:", e);
            }

            this.disconnectSubscription = this.manager.onDeviceDisconnected(device.id, (error, disconnectedDevice) => {
                console.log("Physical Link Lost (Hardware Disconnect)");
                this.handleDisconnect();
            });
            this.connectionCheckInterval = setInterval(async () => {
                if (!this.connectedDevice) return;
                try {
                    const isStillConnected = await this.connectedDevice.isConnected();
                    if (!isStillConnected) {
                        console.log("Polling detected disconnect");
                        this.handleDisconnect();
                    }
                } catch (e) {
                    // Ignore errors during check
                }
            }, 5000);
        } else {
            this.stopJarvisForegroundService();
        }
    }

    private handleDisconnect() {
        this.setDevice(null);
        this.stopJarvisForegroundService();
    }

    async startJarvisForegroundService() {
        if (Platform.OS !== 'android' || this.isServiceRunning) return;

        try {
            if (Platform.Version >= 33) {
                await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
            }

            const channelConfig = {
                id: 'jarvis_channel',
                name: 'Jarvis Connection',
                description: 'Maintains link to Jarvis machine',
                enableVibration: false,
                importance: 2 // Low importance to avoid annoying sounds
            };

            await ForegroundService.getInstance().createNotificationChannel(channelConfig);

            await ForegroundService.getInstance().startService({
                id: 3456,
                title: 'Jarvis Online',
                text: 'Maintaining secure connection to your machine...',
                icon: 'ic_launcher',
                channelId: 'jarvis_channel',
            });

            this.isServiceRunning = true;
            console.log("Foreground Service Started");
        } catch (e) {
            console.error("Failed to start Foreground Service:", e);
        }
    }

    async stopJarvisForegroundService() {
        if (Platform.OS === 'android' && this.isServiceRunning) {
            try {
                await ForegroundService.getInstance().stopService();
                this.isServiceRunning = false;
                console.log("Foreground Service Stopped");
            } catch (e) {
                console.error("Error stopping service:", e);
            }
        }
    }

    async checkConnection(): Promise<boolean> {
        if (!this.connectedDevice) return false;
        try {
            const isConnected = await this.connectedDevice.isConnected();
            if (!isConnected) {
                this.handleDisconnect();
                return false;
            }
            return true;
        } catch (e) {
            this.handleDisconnect();
            return false;
        }
    }

    async sendMessage(message: string): Promise<boolean> {
        const isConnected = await this.checkConnection();
        if (!isConnected) return false;

        if (message === "GET_SETTING") this.settingsBuffer = "";
        if (message === "GET_SCHED") this.scheduleBuffer = "";
        if (message === "GET_OFF") this.offBuffer = "";

        try {
            const base64Msg = Buffer.from(message).toString('base64');
            await this.connectedDevice?.writeCharacteristicWithResponseForService(
                SERVICE_UUID,
                CHAR_UUID,
                base64Msg
            );
            return true;
        } catch (error) {
            this.handleDisconnect();
            return false;
        }
    }

    async connectToDevice(deviceId: string) {
        try {
            console.log("Connecting to:", deviceId);
            const device = await this.manager.connectToDevice(deviceId);
            await device.discoverAllServicesAndCharacteristics();
            await this.setDevice(device);

            // Start the "Immortal" service
            await this.startJarvisForegroundService();
            await this.monitorStatus();

            console.log("Connected and Foreground Service Active!");
        } catch (error: any) {
            console.log("Connection failed:", error);
            if (error?.reason) console.log("BleError Reason:", error.reason);
            throw error;
        }
    }

    async reconnect() {
        if (!this.lastDeviceId) return;

        try {
            const btState = await this.manager.state();
            if (btState !== State.PoweredOn) return;

            console.log("Attempting reconnect to:", this.lastDeviceId);
            await this.connectToDevice(this.lastDeviceId);
        } catch (e) {
            console.log("Reconnect failed.");
        }
    }

    async monitorStatus() {
        if (!this.connectedDevice) return;

        this.connectedDevice.monitorCharacteristicForService(
            SERVICE_UUID,
            CHAR_UUID,
            (error, char) => {
                if (error) {
                    this.handleDisconnect();
                    return;
                }
                if (char?.value) {
                    const msg = Buffer.from(char.value, 'base64').toString('utf-8');

                    if (msg === 'OFF') {
                        console.log("Received OFF signal");
                        this.handleDisconnect();
                        return;
                    }

                    // Stats parsing
                    if (msg.includes('|')) {
                        const parts = msg.split('|');
                        const newStats = {
                            temp: parts[0]?.split(':')[1] || '0',
                            ram: parts[1]?.split(':')[1] || '0',
                            battery: parts[2]?.split(':')[1] || '0',
                        };
                        this.deviceStats = newStats;
                        if (this.onStatsUpdate) this.onStatsUpdate(newStats);
                    }

                    this.handleBufferedMessages(msg);
                }
            }
        );
    }

    private handleBufferedMessages(msg: string) {
        // Schedule Reassembly
        if (msg.startsWith("SCHED_START:")) {
            this.scheduleBuffer = "";
        } else if (msg.startsWith("SCHED_PART:")) {
            this.scheduleBuffer += msg.replace("SCHED_PART:", "");
        } else if (msg === "SCHED_END") {
            if (this.scheduleBuffer.trim() !== "") {
                try {
                    const data = JSON.parse(this.scheduleBuffer);
                    if (this.onScheduleUpdate) this.onScheduleUpdate(data);
                } catch (e) {
                    console.log("JSON Parse Error: Sched. Buffer was:", this.scheduleBuffer);
                }
            }
            this.scheduleBuffer = "";
        }

        // Settings Reassembly
        if (msg.startsWith("Set_START:")) {
            this.settingsBuffer = "";
        } else if (msg.startsWith("Set_PART:")) {
            this.settingsBuffer += msg.replace("Set_PART:", "");
        } else if (msg === "Set_END") {
            if (this.settingsBuffer.trim() !== "") {
                try {
                    const data = JSON.parse(this.settingsBuffer);
                    this.onSettingsUpdateListeners.forEach(l => l(data));
                } catch (e) {
                    console.log("JSON Parse Error: Settings. Buffer was:", this.settingsBuffer);
                }
            }
            this.settingsBuffer = "";
        }

        if (msg.startsWith("OFF_START:")) {
            this.offBuffer = "";
        } else if (msg.startsWith("OFF_PART:")) {
            this.offBuffer += msg.replace("OFF_PART:", "");
        } else if (msg === "OFF_END") {
            if (this.offBuffer.trim() !== "") {
                try {
                    const data = JSON.parse(this.offBuffer);
                    this.onSettingsUpdateListeners.forEach(l => l(data));
                } catch (e) {
                    console.log("JSON Parse Error: Off data. Buffer was:", this.offBuffer);
                }
            }
            this.offBuffer = "";
        }
    }

    async clearSavedDevice() {
        await AsyncStorage.removeItem(STORAGE_KEY);
        this.lastDeviceId = null;
        this.handleDisconnect();
    }
}

// Export Singleton
export const btService = new BluetoothService();

// Register Background Task
TaskManager.defineTask(BLUETOOTH_KEEPALIVE_TASK, async () => {
    try {
        const isConnected = await btService.checkConnection();
        if (!isConnected && btService.lastDeviceId) {
            await btService.reconnect();
        }
        return { shouldContinue: true };
    } catch (error) {
        return { shouldContinue: false };
    }
});