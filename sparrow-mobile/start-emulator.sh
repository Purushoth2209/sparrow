#!/bin/bash
# Script to start Android Emulator

# Start the emulator in the background
~/Android/Sdk/emulator/emulator -avd Medium_Phone_API_36.1 &

echo "Starting Android Emulator..."
echo "Please wait 30-60 seconds for the emulator to boot..."
echo ""
echo "To check if it's ready, run: adb devices"
echo "You should see 'emulator-5554    device' when ready"

