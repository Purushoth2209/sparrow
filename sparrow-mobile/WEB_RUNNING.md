# Running the App in Browser

This guide explains how to run the Sparrow mobile app in your web browser without an emulator.

## Quick Start

### 1. Setup Environment (First Time Only)

```bash
# Navigate to the mobile app directory
cd sparrow-mobile

# Copy the development environment file
cp .env.dev .env
```

### 2. Install Dependencies (If Not Already Done)

```bash
npm install
```

### 3. Run in Browser

```bash
# Development mode (uses .env.dev)
npm run web

# Or production mode (uses .env.prod)
npm run web:prod
```

The app will automatically open in your default browser at `http://localhost:8081` (or the next available port).

## Accessing the App

Once running, you can access:

- **Login Screen**: `http://localhost:8081/login`
- **Register Screen**: `http://localhost:8081/register`
- **Home/Tabs**: `http://localhost:8081/` (default)

## Available Routes

- `/` - Home screen (tabs)
- `/login` - Login screen
- `/register` - Registration screen
- `/modal` - Modal screen (example)

## Troubleshooting

### Port Already in Use

If port 8081 is already in use, Expo will automatically use the next available port. Check the terminal output for the actual URL.

### Environment Variables Not Loading

1. Make sure you have a `.env` file:

   ```bash
   cp .env.dev .env
   ```

2. Restart the development server:
   ```bash
   npm run web
   ```

### CORS Issues with API

If you see CORS errors when calling the API:

1. Make sure your backend server is running
2. Check that `API_BASE_URL` in `.env` matches your backend URL
3. Ensure your backend has CORS configured to allow requests from `http://localhost:8081`

### Browser Console Errors

- Check the browser console (F12) for any errors
- Make sure all dependencies are installed: `npm install`
- Clear browser cache and reload

## Development Tips

### Hot Reload

The app supports hot reload - changes to your code will automatically refresh in the browser.

### Responsive Testing

Use browser DevTools to test different screen sizes:

- Press `F12` to open DevTools
- Click the device toolbar icon (or press `Ctrl+Shift+M`)
- Select different device presets (iPhone, iPad, etc.)

### Network Tab

Use the Network tab in DevTools to:

- Monitor API calls
- Check request/response data
- Debug API issues

## Stopping the Server

Press `Ctrl+C` in the terminal to stop the development server.

## Next Steps

- Test the login and registration flows
- Verify API connections
- Test responsive design at different screen sizes
- Check mobile-specific features (some may not work in browser)
