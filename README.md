# Cogni-Jarvis Config App

This repository contains the mobile configuration app for the Cogni-Jarvis device platform.

The app is built with Expo and React Native, and it provides a setup workflow for pairing a Cogni-Jarvis machine via QR code scanning and Bluetooth.

## What this app does

- Presents a welcome screen for the Cogni-Jarvis config experience
- Guides users through machine setup and Bluetooth pairing
- Scans the device QR code to identify the machine
- Connects to the device over BLE and stores the last paired device
- Provides a device dashboard for connection status and configuration access

## Key screens

- **Welcome**: Start the setup flow for Cogni-Jarvis
- **Instructions**: Step-by-step device pairing and setup instructions
- **QR Code Scanner**: Scan the device QR code and connect to the machine
- **Device dashboard**: View connected device status and enter configuration

## Run locally

Install dependencies:

```bash
npm install
```

Start the Expo development server:

```bash
npx expo start
```

## Project structure

- `app/`: Expo Router screens and UI components
- `app/(tabs)/`: main app dashboard and device configuration screens
- `app/Instructions.tsx`: setup guide and pairing workflow
- `app/QRcodeScanner.tsx`: QR scanner plus BLE connection logic
- `services/BluetoothService.ts`: shared BLE helper service
- `app.json`: Expo app metadata and bundle configuration
- `package.json`: dependencies and scripts

## Notes

- The app uses Expo Router for file-based routing
- Bluetooth and camera permissions are required for QR scanning and device connection
- Some device interactions rely on a backend webhook or local endpoint configured in the app

## Useful commands

- `npm install` — install dependencies
- `npx expo start` — launch the Expo development server
- `npm run android` — run on Android device/emulator
- `npm run ios` — run on iOS simulator/device
- `npm run web` — run in a web browser
- `npm run lint` — check code with ESLint

## Contact

If you need to update the app behavior or device workflow, modify the screens in `app/` and the Bluetooth flow in `services/BluetoothService.ts`.
