import { io } from 'socket.io-client';

let socket = null;

/**
 * Resolves the backend origin URL for the Socket.IO connection.
 */
function getSocketUrl() {
  const apiBase = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (apiBase && (apiBase.startsWith('http://') || apiBase.startsWith('https://'))) {
    try {
      const url = new URL(apiBase);
      return url.origin;
    } catch (e) {
      // Fallback to origin
    }
  }
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000';
}

/**
 * Initializes and returns the authenticated Socket.IO singleton instance.
 */
export function initSocket() {
  const token = localStorage.getItem('token');
  if (!token) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    return null;
  }

  // If already connected with current token, return existing socket
  if (socket && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  const serverUrl = getSocketUrl();
  socket = io(serverUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect_error', (err) => {
    // If authentication expired, disconnect socket
    if (err.message && err.message.toLowerCase().includes('unauthorized')) {
      console.warn('Socket authentication error:', err.message);
    }
  });

  return socket;
}

/**
 * Disconnects the socket (e.g. on user logout).
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Returns current socket instance.
 */
export function getSocket() {
  return socket || initSocket();
}

export default {
  initSocket,
  disconnectSocket,
  getSocket
};
