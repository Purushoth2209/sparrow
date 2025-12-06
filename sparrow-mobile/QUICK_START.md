# Quick Start Guide - Run App on Emulator

## ✅ Step 1: Make sure emulator is running

Check if emulator is ready:
```bash
adb devices
```

You should see: `emulator-5554    device`

If not, start the emulator:
```bash
./start-emulator.sh
# OR
~/Android/Sdk/emulator/emulator -avd Medium_Phone_API_36.1
```

## ✅ Step 2: Run the app

Navigate to the project directory and run:
```bash
cd sparrow-mobile
npm run android
```

This will:
1. ✅ Load your development environment (`.env.dev`)
2. ✅ Start Expo development server
3. ✅ Automatically detect the emulator
4. ✅ Install and launch the app on the emulator

## What you'll see

1. **Terminal**: Expo development server starts
2. **QR Code**: Appears in terminal (for physical devices)
3. **Emulator**: App automatically opens and installs
4. **Login Screen**: Your login page appears on the emulator

## Alternative: If Expo is already running

If you already ran `npm run web` or `npm start`:

1. Make sure emulator is running (`adb devices`)
2. In the Expo terminal, press **`a`** (lowercase)
3. App will automatically open on emulator

## Troubleshooting

### Emulator not detected?
```bash
# Restart ADB
adb kill-server
adb start-server
adb devices
```

### App not installing?
- Wait for emulator to fully boot (home screen visible)
- Make sure emulator has internet connection
- Try pressing `r` in Expo terminal to reload

### Need to reload app?
- Press `r` in Expo terminal (reload)
- Press `r` twice for full reload
- Or shake emulator (Ctrl+M) → Reload

