import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ForgeApiClient } from '@/lib/api/client';
import { useServerStore } from '@/stores/serverStore';

const POLL_INTERVAL = 5_000;
const STARTUP_TIMEOUT = 30_000;

export function useBackendHealth() {
  const serverUrl = useServerStore((s) => s.serverUrl);
  const setBackendStatus = useServerStore((s) => s.setBackendStatus);
  const backendStatus = useServerStore((s) => s.backendStatus);
  const queryClient = useQueryClient();
  const startTimeRef = useRef<number>(Date.now());

  const {
    data,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const client = new ForgeApiClient(serverUrl);
      return client.health();
    },
    refetchInterval: POLL_INTERVAL,
    retry: false,
  });

  useEffect(() => {
    if (data?.status === 'ok') {
      setBackendStatus('healthy');
    } else if (error) {
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed >= STARTUP_TIMEOUT) {
        setBackendStatus('error');
      } else if (backendStatus !== 'healthy') {
        setBackendStatus('starting');
      }
    }
  }, [data, error, setBackendStatus, backendStatus]);

  const retry = useCallback(() => {
    startTimeRef.current = Date.now();
    setBackendStatus('starting');
    queryClient.resetQueries({ queryKey: ['health'] });
    refetch();
  }, [setBackendStatus, queryClient, refetch]);

  return {
    isConnected: backendStatus === 'healthy',
    isStarting: backendStatus === 'starting' || (isLoading && backendStatus !== 'healthy'),
    error: backendStatus === 'error' ? (error ?? new Error('Backend failed to start')) : null,
    retry,
  };
}
