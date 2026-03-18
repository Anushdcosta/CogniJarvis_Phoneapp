import AsyncStorage from '@react-native-async-storage/async-storage'; // Ensure this is installed
import { Buffer } from 'buffer'; // Better to import at the top
import { BleManager, Device, State } from 'react-native-ble-plx';

const SERVICE_UUID = "0000beef-0000-1000-8000-00805f9b34fb";
const CHAR_UUID = "0000bef1-0000-1000-8000-00805f9b34fb";
const STORAGE_KEY = "@last_device_id";

class BluetoothService {
    onScheduleUpdate: ((schedule: any) => void) | null = null;
    onSettingsUpdateListeners: ((setting: any) => void)[] = [];
    manager: BleManager;
    connectedDevice: Device | null = null;
    lastDeviceId: string | null = null;
    deviceStats = { temp: '0', ram: '0', battery: '0' };
    private disconnectSubscription: any = null;
    private connectionCheckInterval: ReturnType<typeof setInterval> | null = null;
    onStatsUpdate: ((stats: any) => void) | null = null;
    scheduleBuffer = "";
    settingsBuffer = "";
    offBuffer = "";

    constructor() {
        this.manager = new BleManager();
        // Load the ID from the "external file" (AsyncStorage) immediately on startup
        this.initService();
    }

    private async initService() {
        try {
            const savedId = await AsyncStorage.getItem(STORAGE_KEY);
            if (savedId) {
                this.lastDeviceId = savedId;
                console.log("Recovered Device ID from storage:", savedId);
            }
        } catch (e) {
            console.log("Failed to load ID from storage:", e);
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

        if (device) {
            this.lastDeviceId = device.id;
            try {
                await AsyncStorage.setItem(STORAGE_KEY, device.id);
            } catch (e) {
                console.log("Failed to save ID:", e);
            }

            // --- ADD THIS LISTENER ---
            // This catches the physical hardware disconnect 
            // even if the "OFF" message is missed.
            this.disconnectSubscription = this.manager.onDeviceDisconnected(device.id, (error, disconnectedDevice) => {
                console.log("Physical Link Lost (Hardware Disconnect)");
                this.setDevice(null); // This forces the UI to update
            });

            // --- ADD ACTIVE POLLING ---
            // Sometimes the OS doesn't realize the device is gone if it just stops transmitting.
            this.connectionCheckInterval = setInterval(async () => {
                if (!this.connectedDevice) return;
                try {
                    const isStillConnected = await this.connectedDevice.isConnected();
                    if (!isStillConnected) {
                        console.log("Polling detected disconnect");
                        this.setDevice(null);
                    }
                } catch (e) {
                    // Ignore errors during check
                }
            }, 3000);
        }
    }

    // NEW: Active connection verification
    async checkConnection(): Promise<boolean> {
        if (!this.connectedDevice) {
            return false;
        }

        try {
            const isConnected = await this.connectedDevice.isConnected();
            if (!isConnected) {
                this.setDevice(null);
                return false;
            }
            return true;
        } catch (e) {
            this.setDevice(null);
            return false;
        }
    }

    async sendMessage(message: string): Promise<boolean> {
        const isConnected = await this.checkConnection();
        if (!isConnected) return false;

        if (message === "GET_SETTING") {
            this.settingsBuffer = ""; // Clear buffer preemptively before requesting
        }
        if (message === "GET_SCHED") {
            this.scheduleBuffer = ""; 
        }
        if (message === "GET_OFF") {
            this.offBuffer = "";
        }

        try {
            const base64Msg = Buffer.from(message).toString('base64');

            await this.connectedDevice?.writeCharacteristicWithResponseForService(
                SERVICE_UUID,
                CHAR_UUID,
                base64Msg
            );
            console.log("Sent successfully:", message);
            return true;
        } catch (error) {
            console.log("Send failed:", error);
            this.setDevice(null); // If write fails, it probably dropped
            return false;
        }
    }

    async connectToDevice(deviceId: string) {
        try {
            console.log("Connecting to:", deviceId);
            const device = await this.manager.connectToDevice(deviceId);

            console.log("Discovering services...");
            await device.discoverAllServicesAndCharacteristics();

            await this.setDevice(device);
            // Automatically start monitoring for the 'OFF' signal after discovery
            await this.monitorStatus();

            console.log("Connected and Services Mapped!");
        } catch (error) {
            console.log("Connection or Discovery failed:", error);
            throw error; // Throw so reconnect() can catch it
        }
    }

    async reconnect() {
        if (!this.lastDeviceId) {
            console.log("No device reference found to reconnect.");
            return;
        }

        try {
            const btState = await this.manager.state();
            if (btState !== State.PoweredOn) {
                console.log(`Bluetooth is currently ${btState}. Holding off on background reconnect.`);
                return;
            }

            console.log("Attempting reconnect to:", this.lastDeviceId);
            await this.connectToDevice(this.lastDeviceId);
        } catch (e) {
            console.log("Reconnect failed. Is the Pi script running?");
        }
    }

    async monitorStatus() {
        if (!this.connectedDevice) return;

        console.log("Subscribing to Pi notifications...");
        this.connectedDevice.monitorCharacteristicForService(
            SERVICE_UUID,
            CHAR_UUID,
            // Inside BluetoothService.ts -> monitorStatus()
            (error, char) => {
                if (error) {
                    console.log("Monitor Error:", error);
                    // Disconnect if the monitor drops
                    this.setDevice(null);
                    return;
                }
                if (char?.value) {
                    const msg = Buffer.from(char.value, 'base64').toString('utf-8');
                    // console.log("RAW MESSAGE FROM PI:", msg); // <--- Add this log

                    // If the Pi gracefully shuts down, it sends "OFF"
                    if (msg === 'OFF') {
                        console.log("Received OFF signal from Pi, disconnecting.");
                        this.setDevice(null);
                        return;
                    }

                    if (msg.includes('|')) {
                        const parts = msg.split('|');
                        // Check if parts exist before accessing indices
                        const newStats = {
                            temp: parts[0]?.split(':')[1] || '0',
                            ram: parts[1]?.split(':')[1] || '0',
                            battery: parts[2]?.split(':')[1] || '0',
                        };
                        this.deviceStats = newStats;
                        if (this.onStatsUpdate) this.onStatsUpdate(newStats);
                    }
                    // Inside monitorStatus callback
                    if (msg.startsWith("SCHED_START:")) {
                        this.scheduleBuffer = ""; // Clear buffer for new transfer
                        console.log("Receiving schedule chunks...");
                    }
                    else if (msg.startsWith("SCHED_PART:")) {
                        const chunk = msg.replace("SCHED_PART:", "");
                        // Guard against lost END signals or restarts: 
                        // Only clear if the chunk starts a new JSON array/object and we already have data
                        if (chunk.startsWith("[") && this.scheduleBuffer.length > 0) {
                            console.log("Found overlapping schedule chunk, clearing buffer!");
                            this.scheduleBuffer = "";
                        }
                        this.scheduleBuffer += chunk;
                    }
                    else if (msg === "SCHED_END") {
                        if (!this.scheduleBuffer) return; // Skip if buffer is already cleared (duplicate signal)
                        try {
                            console.log("Received schedule data:", this.scheduleBuffer);
                            const fullData = JSON.parse(this.scheduleBuffer);
                            if (this.onScheduleUpdate) this.onScheduleUpdate(fullData);
                            console.log("Schedule fully reassembled!");
                        } catch (e) {
                            console.log("Schedule parse error. Raw data:", this.scheduleBuffer);
                            console.log("JSON Parse Error: Check if all chunks arrived.");
                            console.log(e);
                        } finally {
                            this.scheduleBuffer = ""; // Always clear after attempt
                        }
                    }

                    if (msg.startsWith("Set_START:")) {
                        this.settingsBuffer = ""; // Clear buffer for new transfer
                        console.log("Receiving settings chunks...");
                    }
                    else if (msg.startsWith("Set_PART:")) {
                        const chunk = msg.replace("Set_PART:", "");
                        // Guard against redundant starts
                        if (chunk.startsWith("[") && this.settingsBuffer.length > 0) {
                            console.log("Found overlapping settings chunk, clearing buffer!");
                            this.settingsBuffer = "";
                        }
                        this.settingsBuffer += chunk;
                    }
                    else if (msg === "Set_END") {
                        if (!this.settingsBuffer) return; // Skip if already cleared
                        try {
                            const fullData = JSON.parse(this.settingsBuffer);
                            console.log("Received settings data:", this.settingsBuffer);
                            this.onSettingsUpdateListeners.forEach(listener => listener(fullData));
                            console.log("Settings fully reassembled!");
                        } catch (e) {
                            console.log("Settings parse error. Raw data:", this.settingsBuffer);
                            console.log("JSON Parse Error: Check if all chunks arrived.");
                            console.log(e);
                        } finally {
                            this.settingsBuffer = ""; // Always clear after attempt
                        }
                    }

                    if (msg.startsWith("OFF_START:")) {
                        this.offBuffer = ""; // Clear buffer for new transfer
                        console.log("Receiving OFF chunks...");
                    }
                    else if (msg.startsWith("OFF_PART:")) {
                        const chunk = msg.replace("OFF_PART:", "");
                        if (chunk.startsWith("[") && this.offBuffer.length > 0) {
                            console.log("Found overlapping OFF chunk, clearing buffer!");
                            this.offBuffer = "";
                        }
                        this.offBuffer += chunk;
                    }
                    else if (msg === "OFF_END") {
                        if (!this.offBuffer) return;
                        try {
                            const fullData = JSON.parse(this.offBuffer);
                            console.log("Received OFF data:", this.offBuffer);
                            this.onSettingsUpdateListeners.forEach(listener => listener(fullData));
                            console.log("OFF fully reassembled!");
                        } catch (e) {
                            console.log("OFF parse error. Raw data:", this.offBuffer);
                            console.log("JSON Parse Error: Check if all chunks arrived.");
                            console.log(e);
                        } finally {
                            this.offBuffer = ""; // Always clear after attempt
                        }
                    }
                }
            }
        );
    }

    async clearSavedDevice() {
        await AsyncStorage.removeItem(STORAGE_KEY);
        this.lastDeviceId = null;
        this.setDevice(null);
    }
}

export const btService = new BluetoothService();



