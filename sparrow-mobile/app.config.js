// Load .env file based on NODE_ENV or default to .env.dev
// If .env exists, use it; otherwise use .env.dev or .env.prod based on NODE_ENV
const fs = require('fs');
let envFile = '.env';
if (!fs.existsSync('.env')) {
  envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env.dev';
}
require('dotenv').config({ path: envFile });

module.exports = {
  expo: {
    name: 'sparrow-mobile',
    slug: 'sparrow-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'sparrowmobile',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      // Environment variables from .env file
      env: process.env.ENV || 'dev',
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
      socketUrl: process.env.SOCKET_URL || 'ws://localhost:5000',
    },
  },
};

