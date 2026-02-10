# Chat & Video Calling App

A real-time chat and video calling web application built with Node.js, Socket.io, and PeerJS.

## Features

- 💬 Real-time Chat with multiple users
- 📞 Video Calling capability
- 🎤 Microphone toggle
- 📹 Camera toggle
- 👥 User online list
- 🔊 Audio/Video support
- 🔐 **Google Sign-In Support** (optional authentication)

## Technologies Used

- **Backend:** Node.js, Express, Socket.io
- **Frontend:** HTML5, CSS3, JavaScript
- **Video Calling:** PeerJS (WebRTC)
- **Real-time Communication:** Socket.io

## Project Structure

```
chat-call-app/
├── server.js              # Node.js/Socket.io server
├── package.json           # Dependencies and scripts
└── public/
    ├── index.html         # Main HTML file
    └── script.js          # Client-side JavaScript
```

## Installation & Setup

### Step 1: Navigate to the project folder

```bash
cd "z:\year3\WEB PROJECT\chat-call-app"
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install:
- `express` - Web server framework
- `socket.io` - Real-time communication library
- `uuid` - Generate unique IDs
- `nodemon` - Auto-restart server (development)

### Step 3: Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will start on http://localhost:3000

## Google Sign-In Setup (Optional)

This app now supports Google Sign-In for authentication! 

**To enable Google Sign-In:**

1. Create a Google Cloud project and get a Client ID
2. Update `GOOGLE_CLIENT_ID` in `public/script.js`
3. Update `GOOGLE_CLIENT_ID` in `server.js`
4. Run `npm install` to install `google-auth-library`

📘 **Full Setup Guide:** See [GOOGLE_AUTH_SETUP.md](./GOOGLE_AUTH_SETUP.md) for detailed instructions.

**Without Google Sign-In Configured:** The app works with manual username entry (no authentication required)

## How to Use

1. **Open the Application**
   - Go to http://localhost:3000 in your browser

2. **Join a Room**
   - Enter your name
   - Enter a Room ID or click "Generate Room ID" to create a unique one
   - Click "Join Room"

3. **Chat**
   - Type a message and click "Send" or press Enter
   - See all users currently in the room

4. **Start Video Call**
   - Click the "Call" button next to any user's name
   - Accept/Reject the incoming call
   - Use the controls:
     - 🎤 Toggle Microphone
     - 📹 Toggle Camera
     - ☎️ Hang Up (End Call)

## Terminal Commands Summary

| Task | Command |
|------|---------|
| Navigate to app folder | `cd "z:\year3\WEB PROJECT\chat-call-app"` |
| Install dependencies | `npm install` |
| Start server (normal) | `npm start` |
| Start server (dev mode) | `npm run dev` |
| Stop server | `Ctrl + C` |

## Testing Multi-User Chat/Call

1. Open http://localhost:3000 in **Browser 1**
2. Open http://localhost:3000 in **Browser 2**
3. Use the same or different Room IDs
4. Enter different names
5. Send messages and initiate video calls

## Browser Requirements

- Modern browser with WebRTC support:
  - Chrome/Edge 48+
  - Firefox 45+
  - Safari 11+
- Camera and Microphone access

## Troubleshooting

### Port 3000 already in use?
```bash
# Change port in server.js or set PORT environment variable
set PORT=3001
npm start
```

### Camera/Microphone not working?
- Check browser permissions
- Ensure HTTPS (required for some browsers)
- Verify camera/microphone are connected

### PeerJS connection fails?
- The app falls back to Socket.io signaling
- Both methods support video calling

## Dependencies in package.json

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.5.4",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.20"
  }
}
```

## Notes

- Each user gets a unique ID automatically
- Users in the same room can chat and call each other
- All communication is real-time
- Messages and calls don't persist (restart resets everything)

## Future Enhancements

- Screen sharing
- Group video calls
- Message history/database
- User authentication
- Call recording
- Emoji support
