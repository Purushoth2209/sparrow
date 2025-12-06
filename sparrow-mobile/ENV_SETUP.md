# Environment Configuration Guide

This guide explains how to configure different environments (development and production) for the Sparrow mobile app using `.env` files.

## Environment Setup

The app uses `.env` files for environment configuration. The configuration is loaded through `app.config.js` which reads from `.env` files and makes them available via `expo-constants`.

## Configuration Files

### `.env.example`
Template file with all available environment variables. **Copy this to create your own `.env` file.**

### `.env.dev`
Development environment configuration:
- **API Base URL**: `http://localhost:5000`
- **Socket URL**: `ws://localhost:5000`
- **Environment**: `dev`

### `.env.prod`
Production environment configuration:
- **API Base URL**: `https://api.sparrowchat.in`
- **Socket URL**: `wss://api.sparrowchat.in`
- **Environment**: `prod`

## How to Switch Environments

### Option 1: Use npm scripts (Recommended)

```bash
# Development (default)
npm run start:dev

# Production
npm run start:prod
```

### Option 2: Manually copy .env file

```bash
# For development
cp .env.dev .env

# For production
cp .env.prod .env
```

Then run:
```bash
npm start
```

### Option 3: Set NODE_ENV

```bash
# Production
NODE_ENV=production npm start
```

The `app.config.js` will automatically load `.env.prod` when `NODE_ENV=production`, otherwise it loads `.env.dev`.

## Environment Variables

Available variables in `.env` files:

```env
# Environment (dev or prod)
ENV=dev

# API Base URL
API_BASE_URL=http://localhost:5000

# Socket URL
SOCKET_URL=ws://localhost:5000
```

## Using the Configuration

Import and use the configuration in your code:

```javascript
import config, { API_URLS } from "../config";

// Use API URLs
const response = await fetch(`${API_URLS.MOBILE_AUTH}/login`, {
  method: "POST",
  // ...
});

// Access base URL
console.log(config.API_BASE_URL);

// Check environment
console.log(config.ENV);
```

## API Endpoints

All API endpoints are automatically configured based on the environment:

- **Auth**: `/api/auth`
- **Mobile Auth**: `/api/auth/mobile`
- **User**: `/api/user`
- **Friends**: `/api/friends`
- **Messages**: `/api/messages`
- **Notifications**: `/api/notifications`

## Socket Configuration

Socket connection is also environment-aware:

- **Development**: `ws://localhost:5000/socket.io`
- **Production**: `wss://api.sparrowchat.in/socket.io`

## How It Works

1. `app.config.js` uses `dotenv` to load the appropriate `.env` file
2. Environment variables are passed to Expo via the `extra` field
3. `src/config/env.js` reads from `expo-constants` to access the variables
4. The app uses these values throughout the codebase

## Notes

- `.env` files are gitignored (except `.env.example`)
- Always use `.env.example` as a template
- The configuration is loaded at app startup
- You may need to restart the Expo development server after changing `.env` files
- For production builds, ensure you're using `.env.prod` or set `NODE_ENV=production`

## Troubleshooting

If environment variables aren't loading:

1. Make sure you have a `.env` file (copy from `.env.dev` or `.env.prod`)
2. Check that `dotenv` is installed: `npm list dotenv`
3. Restart the Expo development server
4. Clear Expo cache: `expo start -c`
