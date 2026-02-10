const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// SQLite Database Setup
const db = new sqlite3.Database(path.join(__dirname, 'chat_app.db'), (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize Database Tables
function initializeDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Error creating users table:', err);
      else console.log('Users table ready');
    });

    // Friends table
    db.run(`
      CREATE TABLE IF NOT EXISTS friends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        friend_email TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_email, friend_email),
        FOREIGN KEY (user_email) REFERENCES users(email),
        FOREIGN KEY (friend_email) REFERENCES users(email)
      )
    `, (err) => {
      if (err) console.error('Error creating friends table:', err);
      else console.log('Friends table ready');
    });

    // Messages table
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_email TEXT NOT NULL,
        receiver_email TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_email) REFERENCES users(email),
        FOREIGN KEY (receiver_email) REFERENCES users(email)
      )
    `, (err) => {
      if (err) console.error('Error creating messages table:', err);
      else console.log('Messages table ready');
    });
  });
}

// Store active users and their socket IDs
const activeUsers = {};

// Database functions
function saveUser(email, name) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO users (email, name) VALUES (?, ?)',
      [email, name],
      (err) => {
        if (err) {
          console.error('Error saving user:', err);
          reject(err);
        } else {
          console.log(`User ${email} saved`);
          resolve();
        }
      }
    );
  });
}

function getFriends(email) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT f.friend_email, u.name 
       FROM friends f 
       JOIN users u ON f.friend_email = u.email 
       WHERE f.user_email = ?`,
      [email],
      (err, rows) => {
        if (err) {
          console.error('Error fetching friends:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      }
    );
  });
}

function addFriend(userEmail, friendEmail) {
  return new Promise((resolve, reject) => {
    // First check if friend exists
    db.get('SELECT name FROM users WHERE email = ?', [friendEmail], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!row) {
        reject(new Error('User not found'));
        return;
      }

      // Add friend (both directions)
      db.run(
        'INSERT OR IGNORE INTO friends (user_email, friend_email) VALUES (?, ?)',
        [userEmail, friendEmail],
        (err) => {
          if (err) {
            reject(err);
          } else {
            // Also add reverse friendship
            db.run(
              'INSERT OR IGNORE INTO friends (user_email, friend_email) VALUES (?, ?)',
              [friendEmail, userEmail],
              (err2) => {
                if (err2) {
                  reject(err2);
                } else {
                  resolve(row);
                }
              }
            );
          }
        }
      );
    });
  });
}

function getMessages(email1, email2) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT sender_email, message, timestamp 
       FROM messages 
       WHERE (sender_email = ? AND receiver_email = ?) OR (sender_email = ? AND receiver_email = ?)
       ORDER BY timestamp ASC`,
      [email1, email2, email2, email1],
      (err, rows) => {
        if (err) {
          console.error('Error fetching messages:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      }
    );
  });
}

function saveMessage(senderEmail, receiverEmail, message) {
  return new Promise((resolve, reject) => {
    const messageId = uuidv4();
    db.run(
      'INSERT INTO messages (id, sender_email, receiver_email, message) VALUES (?, ?, ?, ?)',
      [messageId, senderEmail, receiverEmail, message],
      (err) => {
        if (err) {
          console.error('Error saving message:', err);
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

// Socket.io Events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User Login
  socket.on('userLogin', async (user) => {
    try {
      await saveUser(user.email, user.name);
      activeUsers[user.email] = {
        socketId: socket.id,
        name: user.name
      };
      
      // Notify all friends that this user is online
      const friends = await getFriends(user.email);
      friends.forEach(friend => {
        const friendSocket = activeUsers[friend.friend_email];
        if (friendSocket) {
          io.to(friendSocket.socketId).emit('friendOnline', {
            email: user.email,
            name: user.name
          });
        }
      });

      console.log(`${user.email} logged in`);
    } catch (error) {
      console.error('Error in userLogin:', error);
    }
  });

  // Get Friends List
  socket.on('getFriends', async (data) => {
    try {
      const friends = await getFriends(data.email);
      const friendsWithStatus = friends.map(f => ({
        email: f.friend_email,
        name: f.name,
        online: !!activeUsers[f.friend_email],
        peerId: activeUsers[f.friend_email]?.peerId || null
      }));

      socket.emit('friendsList', { friends: friendsWithStatus });
    } catch (error) {
      console.error('Error getting friends:', error);
      socket.emit('friendsList', { friends: [] });
    }
  });

  // Add Friend
  socket.on('addFriend', async (data) => {
    try {
      const friendUser = await addFriend(data.userEmail, data.friendEmail);
      socket.emit('friendAdded', {
        friendEmail: data.friendEmail,
        friendName: friendUser.name
      });

      // Notify the new friend
      const friendSocket = activeUsers[data.friendEmail];
      if (friendSocket) {
        io.to(friendSocket.socketId).emit('friendAdded', {
          friendEmail: data.userEmail,
          friendName: data.userEmail
        });
      }
    } catch (error) {
      socket.emit('friendAddError', { message: error.message });
    }
  });

  // Get Messages
  socket.on('getMessages', async (data) => {
    try {
      const messages = await getMessages(data.userEmail, data.friendEmail);
      socket.emit('messages', { messages });
    } catch (error) {
      console.error('Error getting messages:', error);
      socket.emit('messages', { messages: [] });
    }
  });

  // Send Message
  socket.on('sendMessage', async (data) => {
    try {
      await saveMessage(data.senderEmail, data.receiverEmail, data.message);
      
      // Send to receiver if online
      const receiverSocket = activeUsers[data.receiverEmail];
      if (receiverSocket) {
        const messages = await getMessages(data.senderEmail, data.receiverEmail);
        io.to(receiverSocket.socketId).emit('newMessage', {
          senderEmail: data.senderEmail,
          allMessages: messages
        });
      }

      // Send back to sender
      const messages = await getMessages(data.senderEmail, data.receiverEmail);
      socket.emit('newMessage', {
        senderEmail: data.senderEmail,
        allMessages: messages
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  // Update Peer ID
  socket.on('peerIdUpdate', (data) => {
    if (activeUsers[data.email]) {
      activeUsers[data.email].peerId = data.peerId;
    }
  });

  // Initiate Call
  socket.on('initiateCall', (data) => {
    const callerData = activeUsers[data.callerEmail];
    const receiverSocket = activeUsers[data.receiverEmail];

    if (receiverSocket) {
      io.to(receiverSocket.socketId).emit('incomingCall', {
        callerEmail: data.callerEmail,
        callerName: data.callerName,
        callType: data.callType,
        callerPeerId: callerData?.peerId
      });
    }
  });

  // Call Accepted
  socket.on('callAccepted', (data) => {
    const callerSocket = activeUsers[data.callerEmail];
    if (callerSocket) {
      io.to(callerSocket.socketId).emit('callAccepted', {
        senderEmail: data.senderEmail
      });
    }
  });

  // End Call
  socket.on('endCall', (data) => {
    if (data.toEmail) {
      const toSocket = activeUsers[data.toEmail];
      if (toSocket) {
        io.to(toSocket.socketId).emit('callEnded', {
          fromEmail: data.fromEmail
        });
      }
    }
  });

  // User Logout
  socket.on('userLogout', () => {
    // Find and remove user
    for (const email in activeUsers) {
      if (activeUsers[email].socketId === socket.id) {
        // Notify friends that user is offline
        getFriends(email).then(friends => {
          friends.forEach(friend => {
            const friendSocket = activeUsers[friend.friend_email];
            if (friendSocket) {
              io.to(friendSocket.socketId).emit('friendOffline', {
                email: email
              });
            }
          });
        });

        delete activeUsers[email];
        console.log(`${email} logged out`);
        break;
      }
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    // Find and remove user
    for (const email in activeUsers) {
      if (activeUsers[email].socketId === socket.id) {
        // Notify friends that user is offline
        getFriends(email).then(friends => {
          friends.forEach(friend => {
            const friendSocket = activeUsers[friend.friend_email];
            if (friendSocket) {
              io.to(friendSocket.socketId).emit('friendOffline', {
                email: email
              });
            }
          });
        });

        delete activeUsers[email];
        console.log(`${email} disconnected`);
        break;
      }
    }
  });
});

// REST API endpoint for testing
app.get('/api/users', (req, res) => {
  db.all('SELECT email, name FROM users', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ChatApp server running on http://localhost:${PORT}`);
});
