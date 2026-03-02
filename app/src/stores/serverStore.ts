import { create } from 'zustand';

type BackendStatus = 'starting' | 'healthy' | 'error' | 'stopped';

interface ServerState {
  serverUrl: string;
  isConnected: boolean;
  isStarting: boolean;
  backendStatus: BackendStatus;
  setServerUrl: (url: string) => void;
  setConnected: (connected: boolean) => void;
  setBackendStatus: (status: BackendStatus) => void;
}

export const useServerStore = create<ServerState>((set) => ({
  serverUrl: 'http://127.0.0.1:8188',
  isConnected: false,
  isStarting: false,
  backendStatus: 'stopped',

  setServerUrl: (url) => set({ serverUrl: url }),

  setConnected: (connected) =>
    set({
      isConnected: connected,
      backendStatus: connected ? 'healthy' : 'stopped',
    }),

  setBackendStatus: (status) =>
    set({
      backendStatus: status,
      isConnected: status === 'healthy',
      isStarting: status === 'starting',
    }),
}));
