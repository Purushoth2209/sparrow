# Running on Android Emulator

## Quick Start

### 1. Start the Android Emulator

You can start the emulator in two ways:

**Option A: From Android Studio**

- Open Android Studio
- Go to Tools → Device Manager
- Click the ▶️ play button next to your AVD (Medium_Phone_API_36.1)

**Option B: From Terminal**

```bash
~/Android/Sdk/emulator/emulator -avd Medium_Phone_API_36.1 &
```

Wait for the emulator to fully boot (you'll see the Android home screen).

### 2. Verify Emulator is Running

```bash
adb devices
```

You should see something like:

```
List of devices attached
emulator-5554    device
```

If it shows "offline", wait a bit longer for the emulator to finish booting.

### 3. Run the App

```bash
# Development environment
npm run android

# Or production environment
npm run android:prod
```

This will:

- Load your `.env.dev` or `.env.prod` configuration
- Start Expo development server
- Automatically open the app on the Android emulator

## Alternative: Manual Start

If you already have Expo running (e.g., from `npm run web`):

1. Make sure the emulator is running
2. In the Expo terminal, press `a` to open on Android
3. The app will automatically install and launch on the emulator

## Troubleshooting

### Emulator Not Detected

If `adb devices` shows no devices:

1. **Check if emulator is fully booted**: Wait until you see the Android home screen
2. **Restart ADB**:
   ```bash
   adb kill-server
   adb start-server
   adb devices
   ```
3. **Check emulator status**: Make sure the emulator window is open and not minimized

### App Not Installing

- Make sure the emulator has internet connection
- Check that Expo development server is running
- Try pressing `r` in the Expo terminal to reload

### Performance Issues

- Close other applications to free up RAM
- Use a lighter AVD (lower API level or smaller screen)
- Increase emulator RAM in AVD settings

## Your Current Setup

- **AVD Name**: `Medium_Phone_API_36.1`
- **Emulator Path**: `~/Android/Sdk/emulator/emulator`
- **ADB**: Available and working

## Tips

- Keep the emulator running while developing (faster reloads)
- Use `Ctrl+M` in the emulator to open the developer menu
- Shake gesture: `Ctrl+M` or `Cmd+M` (Mac) in emulator
- Press `r` twice in Expo terminal to reload the app






