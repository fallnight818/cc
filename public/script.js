// Socket.io connection
const socket = io();

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

// State management
let currentUser = null;
let currentFriend = null;
let friends = [];
let localStream = null;
let peer = null;
let callDuration = 0;
let callTimer = null;
let isMicEnabled = true;
let isCameraEnabled = true;

// DOM Elements
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const friendsList = document.getElementById('friends-list');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const homeView = document.getElementById('home-view');
const chatView = document.getElementById('chat-view');
const chatName = document.getElementById('chat-name');
const chatAvatar = document.getElementById('chat-avatar');
const chatStatus = document.getElementById('chat-status');
const addFriendModal = document.getElementById('add-friend-modal');
const friendEmail = document.getElementById('friend-email');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const videoEmpty = document.getElementById('video-empty');
const callInfo = document.getElementById('call-info');
const videoControls = document.getElementById('video-controls');
const micBtn = document.getElementById('mic-btn');
const cameraBtn = document.getElementById('camera-btn');
const hangUpBtn = document.getElementById('hang-up-btn');
const callName = document.getElementById('call-name');
const callDurationDisplay = document.getElementById('call-duration');

// Initialize Google Sign-In
window.addEventListener('load', () => {
    if (GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE')) {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleSignIn
        });
        google.accounts.id.renderButton(
            document.getElementById('google-signin-container'),
            { 
                theme: 'outline',
                size: 'large',
                width: '100%'
            }
        );
    }

    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showApp();
    }
});

// Google Sign-In Handler
function handleGoogleSignIn(response) {
    try {
        // Decode JWT to get user info
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        const decodedToken = JSON.parse(jsonPayload);
        
        currentUser = {
            id: decodedToken.sub,
            email: decodedToken.email,
            name: decodedToken.name,
            picture: decodedToken.picture,
            googleToken: response.credential
        };

        // Save to local storage
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        // Emit to server
        socket.emit('userLogin', currentUser);
        
        showApp();
    } catch (error) {
        console.error('Error handling Google Sign-In:', error);
        alert('Login failed. Please try again.');
    }
}

// Manual Login
function manualLogin() {
    const email = document.getElementById('login-email').value.trim();
    const name = document.getElementById('login-name').value.trim();

    if (!email || !name) {
        alert('Please enter both email and name');
        return;
    }

    currentUser = {
        id: email.split('@')[0] + '_' + Date.now(),
        email: email,
        name: name,
        picture: null,
        googleToken: null
    };

    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    socket.emit('userLogin', currentUser);
    
    showApp();
}

// Show App
function showApp() {
    loginContainer.style.display = 'none';
    appContainer.classList.add('active');
    loadFriends();
    initializePeerJS();
}

// Logout
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        currentUser = null;
        currentFriend = null;
        localStorage.removeItem('currentUser');
        socket.emit('userLogout');
        
        loginContainer.style.display = 'flex';
        appContainer.classList.remove('active');
        
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (peer) {
            peer.destroy();
        }
    }
}

// Initialize PeerJS
function initializePeerJS() {
    try {
        peer = new Peer(currentUser.id, {
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        peer.on('open', (id) => {
            console.log('PeerJS ID:', id);
            socket.emit('peerIdUpdate', { email: currentUser.email, peerId: id });
        });

        peer.on('call', handleIncomingCall);
        peer.on('error', (err) => console.error('Peer error:', err));
    } catch (error) {
        console.error('PeerJS initialization error:', error);
    }
}

// Load Friends
function loadFriends() {
    socket.emit('getFriends', { email: currentUser.email });
}

// Add Friend Modal
function openAddFriendModal() {
    addFriendModal.classList.add('active');
}

function closeAddFriendModal() {
    addFriendModal.classList.remove('active');
    friendEmail.value = '';
}

// Add Friend
function addFriend() {
    const email = friendEmail.value.trim();
    
    if (!email) {
        alert('Please enter friend email');
        return;
    }

    if (email === currentUser.email) {
        alert('You cannot add yourself');
        return;
    }

    socket.emit('addFriend', {
        userEmail: currentUser.email,
        friendEmail: email
    });

    closeAddFriendModal();
}

// Display Friends List
function displayFriends(friendsData) {
    friends = friendsData;
    friendsList.innerHTML = '';

    if (friends.length === 0) {
        friendsList.innerHTML = '<div style="padding: 16px; color: #999; text-align: center;">No friends yet</div>';
        return;
    }

    friends.forEach((friend, index) => {
        const friendDiv = document.createElement('div');
        friendDiv.className = 'friend-item' + (currentFriend && currentFriend.email === friend.email ? ' active' : '');
        friendDiv.id = 'friend-' + index;
        
        const initial = friend.name.charAt(0).toUpperCase();
        const status = friend.online ? 'Online' : 'Offline';
        
        friendDiv.innerHTML = `
            <div class="friend-avatar">${initial}</div>
            <div class="friend-info">
                <div class="friend-name">${friend.name}</div>
                <div class="friend-status">${status}</div>
            </div>
            ${friend.online ? '<div class="status-dot"></div>' : ''}
        `;
        
        friendDiv.onclick = () => {
            document.querySelectorAll('.friend-item').forEach(el => el.classList.remove('active'));
            friendDiv.classList.add('active');
            selectFriend(friend);
        };
        friendsList.appendChild(friendDiv);
    });
}

// Select Friend
function selectFriend(friend) {
    currentFriend = friend;

    // Show chat view
    homeView.style.display = 'none';
    chatView.style.display = 'flex';

    // Update chat header
    const initial = friend.name.charAt(0).toUpperCase();
    chatAvatar.textContent = initial;
    chatName.textContent = friend.name;
    chatStatus.textContent = friend.online ? 'Online' : 'Offline';

    // Load messages
    loadMessages();
    
    // Clear input
    messageInput.value = '';
    messageInput.focus();
}

// Load Messages
function loadMessages() {
    socket.emit('getMessages', {
        userEmail: currentUser.email,
        friendEmail: currentFriend.email
    });
}

// Display Messages
function displayMessages(messages) {
    messagesContainer.innerHTML = '';
    
    messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ' + (msg.senderEmail === currentUser.email ? 'sent' : 'received');

        const time = new Date(msg.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageDiv.innerHTML = `
            <div class="message-bubble ${msg.senderEmail === currentUser.email ? 'sent' : 'received'}">
                ${msg.message}
            </div>
            <div class="message-time">${time}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send Message
function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message || !currentFriend) return;

    socket.emit('sendMessage', {
        senderEmail: currentUser.email,
        receiverEmail: currentFriend.email,
        message: message,
        timestamp: new Date().toISOString()
    });

    messageInput.value = '';
    messageInput.focus();
}

// Handle Message Keypress
function handleMessageKeypress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Search Friends
function searchFriends() {
    const searchTerm = document.getElementById('search-friends').value.toLowerCase();
    const items = document.querySelectorAll('.friend-item');
    
    items.forEach(item => {
        const name = item.querySelector('.friend-name').textContent.toLowerCase();
        item.style.display = name.includes(searchTerm) ? '' : 'none';
    });
}

// Get Local Stream
async function getLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true
        });
        localVideo.srcObject = localStream;
        return localStream;
    } catch (error) {
        console.error('Error accessing media:', error);
        alert('Please allow access to camera and microphone');
        return null;
    }
}

// Start Audio Call
function startAudioCall() {
    if (!currentFriend) {
        alert('Please select a friend first');
        return;
    }

    socket.emit('initiateCall', {
        callerEmail: currentUser.email,
        callerName: currentUser.name,
        receiverEmail: currentFriend.email,
        callType: 'audio'
    });
}

// Start Video Call
function startVideoCall() {
    if (!currentFriend) {
        alert('Please select a friend first');
        return;
    }

    socket.emit('initiateCall', {
        callerEmail: currentUser.email,
        callerName: currentUser.name,
        receiverEmail: currentFriend.email,
        callType: 'video'
    });
}

// Handle Incoming Call
async function handleIncomingCall(call) {
    const stream = await getLocalStream();
    if (stream) {
        call.answer(stream);
        call.on('stream', (stream) => {
            remoteVideo.srcObject = stream;
            videoEmpty.style.display = 'none';
            callInfo.style.display = 'flex';
            videoControls.style.display = 'flex';
            startCallTimer();
        });
        call.on('close', endCall);
    }
}

// Accept Call
async function acceptCall() {
    const stream = await getLocalStream();
    if (stream && currentFriend) {
        const call = peer.call(currentFriend.peerId, stream);
        call.on('stream', (stream) => {
            remoteVideo.srcObject = stream;
            videoEmpty.style.display = 'none';
            callInfo.style.display = 'flex';
            videoControls.style.display = 'flex';
            startCallTimer();
        });
        call.on('close', endCall);
    }
}

// End Call
function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
    }

    videoEmpty.style.display = 'flex';
    callInfo.style.display = 'none';
    videoControls.style.display = 'none';
    callDuration = 0;
    
    if (callTimer) {
        clearInterval(callTimer);
    }

    if (currentFriend) {
        socket.emit('endCall', {
            toEmail: currentFriend.email
        });
    }
}

// Toggle Mic
function toggleMic() {
    if (localStream) {
        isMicEnabled = !isMicEnabled;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = isMicEnabled;
        });
        micBtn.style.opacity = isMicEnabled ? '1' : '0.5';
    }
}

// Toggle Camera
function toggleCamera() {
    if (localStream) {
        isCameraEnabled = !isCameraEnabled;
        localStream.getVideoTracks().forEach(track => {
            track.enabled = isCameraEnabled;
        });
        cameraBtn.style.opacity = isCameraEnabled ? '1' : '0.5';
    }
}

// Start Call Timer
function startCallTimer() {
    callDuration = 0;
    callTimer = setInterval(() => {
        callDuration++;
        const minutes = Math.floor(callDuration / 60);
        const seconds = callDuration % 60;
        callDurationDisplay.textContent = 
            String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }, 1000);
}

// Socket Events
socket.on('friendsList', (data) => {
    displayFriends(data.friends);
});

socket.on('messages', (data) => {
    displayMessages(data.messages);
});

socket.on('newMessage', (data) => {
    if (currentFriend && data.senderEmail === currentFriend.email) {
        displayMessages(data.allMessages);
    }
});

socket.on('incomingCall', (data) => {
    if (currentFriend && currentFriend.email === data.callerEmail) {
        const accept = confirm(`${data.callerName} is calling you. Accept?`);
        if (accept) {
            acceptCall();
        }
    } else {
        const accept = confirm(`${data.callerName} is calling you. Accept?`);
        if (accept) {
            // Select this friend and accept
            const friend = friends.find(f => f.email === data.callerEmail);
            if (friend) {
                selectFriend(friend);
                setTimeout(acceptCall, 100);
            }
        }
    }
});

socket.on('callAccepted', (data) => {
    console.log('Call accepted by', data.senderEmail);
});

socket.on('callEnded', (data) => {
    endCall();
});

socket.on('friendAdded', (data) => {
    loadFriends();
    alert(`Friend added: ${data.friendName}`);
});

socket.on('friendAddError', (data) => {
    alert(data.message);
});

socket.on('friendOnline', (data) => {
    const friend = friends.find(f => f.email === data.email);
    if (friend) {
        friend.online = true;
        displayFriends(friends);
    }
});

socket.on('friendOffline', (data) => {
    const friend = friends.find(f => f.email === data.email);
    if (friend) {
        friend.online = false;
        displayFriends(friends);
    }
});

// Button Event Listeners
micBtn.addEventListener('click', toggleMic);
cameraBtn.addEventListener('click', toggleCamera);
hangUpBtn.addEventListener('click', endCall);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (peer) {
        peer.destroy();
    }
    if (currentUser) {
        socket.emit('userLogout');
    }
});
