document.addEventListener("DOMContentLoaded", () => {
    // --- DOM Elements ---
    const authView = document.getElementById("auth-view");
    const chatView = document.getElementById("chat-view");

    const authTitle = document.getElementById("auth-title");
    const authForm = document.getElementById("auth-form");
    const authButton = document.getElementById("auth-button");
    const authToggleLink = document.getElementById("auth-toggle-link");
    const authToggleText = document.getElementById("auth-toggle-text");
    const authError = document.getElementById("auth-error");

    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");

    const chatMessages = document.getElementById("chat-messages");
    const chatForm = document.getElementById("chat-form");
    const messageInput = document.getElementById("message-input");
    const logoutButton = document.getElementById("logout-button");

    // --- State ---
    let isLogin = true;
    let token = localStorage.getItem("token");
    let socket;

    // --- Functions ---
    const setView = (view) => {
        authView.classList.remove("active");
        chatView.classList.remove("active");
        document.getElementById(view).classList.add("active");
    };

    const toggleAuthMode = () => {
        isLogin = !isLogin;
        authTitle.textContent = isLogin ? "Login" : "Register";
        authButton.textContent = isLogin ? "Login" : "Register";
        authToggleText.textContent = isLogin ? "Don't have an account?" : "Already have an account?";
        authToggleLink.textContent = isLogin ? "Register" : "Login";
        authError.textContent = "";
    };

    const displayAuthError = (message) => {
        authError.textContent = message;
    };

    const addMessageToChat = (role, content) => {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message", role);
        messageDiv.textContent = content;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const handleAuth = async (event) => {
        event.preventDefault();
        const username = usernameInput.value;
        const password = passwordInput.value;
        const endpoint = isLogin ? "/token" : "/register";

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "An error occurred.");
            }

            if (isLogin) {
                const data = await response.json();
                token = data.access_token;
                localStorage.setItem("token", token);
                await connectWebSocket();
            } else {
                // Automatically switch to login form after successful registration
                toggleAuthMode();
                usernameInput.value = username; // pre-fill username
                passwordInput.value = "";
                alert("Registration successful! Please log in.");
            }
        } catch (error) {
            displayAuthError(error.message);
        }
    };
    
    const connectWebSocket = async () => {
        if (!token) return;

        // Clear previous chat messages
        chatMessages.innerHTML = '';
        
        // Transition to chat view
        setView("chat-view");

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(`${wsProtocol}//${window.location.host}/ws/${token}`);

        socket.onopen = () => {
            console.log("WebSocket connection established.");
        };

        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            addMessageToChat(message.role, message.content);
        };

        socket.onclose = () => {
            console.log("WebSocket connection closed.");
            handleLogout();
            alert("Session ended. Please log in again.");
        };

        socket.onerror = (error) => {
            console.error("WebSocket error:", error);
            handleLogout();
            alert("An error occurred with the connection. Please log in again.");
        };
    };

    const handleChatMessage = (event) => {
        event.preventDefault();
        const message = messageInput.value;
        if (message.trim() && socket && socket.readyState === WebSocket.OPEN) {
            // The user message is sent to the server, and the server broadcasts
            // both the user message and the AI response back.
            // We'll let the onmessage handler display it.
            socket.send(message);
            messageInput.value = "";
        }
    };

    const handleLogout = () => {
        if (socket) {
            socket.close();
        }
        token = null;
        localStorage.removeItem("token");
        usernameInput.value = "";
        passwordInput.value = "";
        setView("auth-view");
    };

    // --- Event Listeners ---
    authForm.addEventListener("submit", handleAuth);
    authToggleLink.addEventListener("click", (e) => {
        e.preventDefault();
        toggleAuthMode();
    });
    chatForm.addEventListener("submit", handleChatMessage);
    logoutButton.addEventListener("click", handleLogout);

    // --- Initial Check ---
    if (token) {
        connectWebSocket();
    } else {
        setView("auth-view");
    }
});
