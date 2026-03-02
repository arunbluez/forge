import { useState, useMemo } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import Studio from '@/pages/Studio';
import Gallery from '@/pages/Gallery';
import ModelManager from '@/pages/ModelManager';
import ErrorBoundary from '@/components/app/ErrorBoundary';
import StartupScreen from '@/components/app/StartupScreen';
import ErrorScreen from '@/components/app/ErrorScreen';
import OnboardingFlow, {
  isOnboardingComplete,
} from '@/components/onboarding/OnboardingFlow';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import { ForgeApiClient } from '@/lib/api/client';
import { useServerStore } from '@/stores/serverStore';
import type { ModelInfo } from '@/lib/api/types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// ---------------------------------------------------------------------------
// Inner app — has access to QueryClient context and router
// ---------------------------------------------------------------------------

function AppShell() {
  const { isConnected, isStarting, error, retry } = useBackendHealth();

  // Show startup screen while backend is starting
  if (!isConnected && !error) {
    return <StartupScreen />;
  }

  // Show error screen if backend failed to start
  if (error) {
    return <ErrorScreen onRetry={retry} />;
  }

  // Backend is connected — proceed to onboarding check and main app
  return <ConnectedApp />;
}

// ---------------------------------------------------------------------------
// Connected app — backend is healthy, check for first-run
// ---------------------------------------------------------------------------

function ConnectedApp() {
  const serverUrl = useServerStore((s) => s.serverUrl);

  const apiClient = useMemo(
    () => new ForgeApiClient(serverUrl),
    [serverUrl]
  );

  // Check if any models are downloaded (for onboarding detection)
  const { data: models, isLoading: modelsLoading } = useQuery<ModelInfo[]>({
    queryKey: ['models'],
    queryFn: () => apiClient.getModels(),
  });

  const [onboardingDismissed, setOnboardingDismissed] = useState(
    isOnboardingComplete()
  );

  // While checking model state, show a brief loading screen
  if (modelsLoading) {
    return <StartupScreen />;
  }

  // Determine if this is a first run: no models downloaded and onboarding not yet completed
  const hasDownloadedModels = models ? models.some((m) => m.is_downloaded) : false;
  const showOnboarding = !onboardingDismissed && !hasDownloadedModels;

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Studio />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/models" element={<ModelManager />} />
        </Route>
      </Routes>

      {showOnboarding && (
        <OnboardingFlow onComplete={() => setOnboardingDismissed(true)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Root App component
// ---------------------------------------------------------------------------

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
