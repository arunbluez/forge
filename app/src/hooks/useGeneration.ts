import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGenerationStore } from '@/stores/generationStore';
import { useServerStore } from '@/stores/serverStore';
import type { GenerateRequest } from '@/lib/api/types';
import { ForgeApiClient } from '@/lib/api/client';

interface GenerationMessage {
  type: 'preview' | 'progress' | 'complete' | 'error' | 'cancelled' | 'status';
  step?: number;
  total_steps?: number;
  image_base64?: string;
  seed?: number;
  generation_time_ms?: number;
  message?: string;
  image_path?: string;
}

export function useGeneration() {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    setIsGenerating,
    setProgress,
    setPreviewImage,
    setFinalImage,
  } = useGenerationStore();

  const serverUrl = useServerStore((s) => s.serverUrl);

  const startGeneration = useCallback(
    (params: GenerateRequest) => {
      // Clean up any existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Reset state
      setPreviewImage(null);
      setFinalImage(null);
      setProgress(0, 0);
      setIsGenerating(true);
      setStatusMessage(null);

      const client = new ForgeApiClient(serverUrl);
      const ws = client.createGenerationSocket();
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        ws.send(JSON.stringify(params));
      };

      ws.onmessage = (event) => {
        try {
          const msg: GenerationMessage = JSON.parse(event.data);

          switch (msg.type) {
            case 'preview':
              if (msg.image_base64) {
                setPreviewImage(`data:image/png;base64,${msg.image_base64}`);
              }
              if (msg.step !== undefined && msg.total_steps !== undefined) {
                setProgress(msg.step, msg.total_steps);
              }
              break;

            case 'progress':
              if (msg.step !== undefined && msg.total_steps !== undefined) {
                setProgress(msg.step, msg.total_steps);
              }
              break;

            case 'complete':
              if (msg.image_base64) {
                setFinalImage(`data:image/png;base64,${msg.image_base64}`);
              }
              if (msg.step !== undefined && msg.total_steps !== undefined) {
                setProgress(msg.step, msg.total_steps);
              }
              setIsGenerating(false);
              setStatusMessage(null);
              // Refresh gallery after successful generation
              queryClient.invalidateQueries({ queryKey: ['gallery'] });
              ws.close();
              break;

            case 'error':
              setIsGenerating(false);
              setStatusMessage(msg.message ?? 'Generation failed');
              ws.close();
              break;

            case 'cancelled':
              setIsGenerating(false);
              setStatusMessage('Generation cancelled');
              ws.close();
              break;

            case 'status':
              setStatusMessage(msg.message ?? null);
              break;
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        setIsGenerating(false);
        setStatusMessage('WebSocket connection error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
      };
    },
    [serverUrl, setIsGenerating, setProgress, setPreviewImage, setFinalImage, queryClient]
  );

  const cancelGeneration = useCallback(async () => {
    try {
      const client = new ForgeApiClient(serverUrl);
      await client.cancelGeneration();
    } catch {
      // If cancel request fails, force close WS
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsGenerating(false);
    setStatusMessage('Generation cancelled');
  }, [serverUrl, setIsGenerating]);

  return {
    startGeneration,
    cancelGeneration,
    isConnected,
    statusMessage,
  };
}
