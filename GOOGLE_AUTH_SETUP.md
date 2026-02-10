# Google Sign-In Setup Guide

## Overview
Your chat-call-app now supports Google Sign-In authentication. Follow these steps to enable it.

## Step 1: Get Your Google Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the "Google+ API"
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Choose **Web application**
6. Add authorized JavaScript origins:
   - `http://localhost:3000` (for local development)
   - Your production domain (e.g., `https://yourdomain.com`)
7. Add authorized redirect URIs:
   - `http://localhost:3000` (for local development)
   - Your production domain (e.g., `https://yourdomain.com`)
8. Copy your **Client ID** (looks like: `123456789-abc...apps.googleusercontent.com`)

## Step 2: Configure Your App

### Frontend Configuration
Edit `public/script.js` and replace:
```javascript
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
```
with your actual Client ID:
```javascript
const GOOGLE_CLIENT_ID = '123456789-abc...apps.googleusercontent.com';
```

### Backend Configuration
Edit `server.js` and replace:
```javascript
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
```
with the same Client ID.

## Step 3: Install Dependencies

Run the following command in your project directory:
```bash
npm install
```

This will install the new `google-auth-library` package needed for token verification.

## Step 4: Run Your Application

Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

Then visit `http://localhost:3000` in your browser.

## How It Works

1. **Sign-In Button**: Users see a Google Sign-In button on the login page
2. **Manual Fallback**: Users can still login manually with their name
3. **Token Verification**: On the backend, Google tokens are verified for security
4. **Session**: Once signed in, the user's information is stored in the room

## Testing

### Test with Google Sign-In:
1. Click the Google Sign-In button
2. Sign in with your Google account
3. Your name will be auto-filled from your Google profile
4. Enter a room ID and join

### Test Manual Sign-In:
1. If Google Sign-In is not configured, only the manual login appears
2. Enter your name and room ID
3. Join the room

## Troubleshooting

### Google Sign-In button not appearing?
- Make sure you've updated the `GOOGLE_CLIENT_ID` in `script.js`
- Check browser console for errors (F12 → Console tab)

### "Invalid Client ID" error?
- Verify you copied the correct Client ID from Google Cloud Console
- Make sure the Client ID is the same in both `script.js` and `server.js`
- Check that your domain is in the authorized list in Google Cloud Console

### Button appears but doesn't work?
- Check that you're accessing the app from an authorized origin
- For local testing, use `http://localhost:3000` (not `127.0.0.1`)

## Security Notes

- **Never share your Client ID publicly** - it's only for identifying your app
- Token verification happens on the backend for security
- Each token has an expiration time
- In production, use HTTPS only

## Environment Variables (Optional)

For better security in production, you can use environment variables:

```bash
# .env file
GOOGLE_CLIENT_ID=your_client_id_here
PORT=3000
```

Then update your code to read from environment variables:
```javascript
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
```
