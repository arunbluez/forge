import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  Loader2,
  ExternalLink,
  KeyRound,
  Info,
} from 'lucide-react';
import { ForgeApiClient } from '@/lib/api/client';
import type { AppSettings } from '@/lib/api/types';
import { useServerStore } from '@/stores/serverStore';
import { cn } from '@/lib/utils';

export default function Settings() {
  const serverUrl = useServerStore((s) => s.serverUrl);
  const queryClient = useQueryClient();
  const apiClient = useMemo(() => new ForgeApiClient(serverUrl), [serverUrl]);

  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: () => apiClient.getSettings(),
  });

  const saveMutation = useMutation({
    mutationFn: (hf_token: string) => apiClient.updateSettings({ hf_token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setTokenInput('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => apiClient.updateSettings({ hf_token: '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setTokenInput('');
    },
  });

  const handleSave = () => {
    if (tokenInput.trim()) {
      saveMutation.mutate(tokenInput.trim());
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
          Settings
        </h2>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Configure your Forge application preferences.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
          <span className="text-sm text-[hsl(var(--muted-foreground))]">
            Loading settings...
          </span>
        </div>
      ) : (
        <>
          {/* HuggingFace Token Section */}
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">
                HuggingFace Token
              </h3>
            </div>

            {/* Info box */}
            <div className="mb-4 flex gap-2 rounded-md bg-blue-500/10 border border-blue-500/20 px-3 py-2.5">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
              <div className="text-xs text-blue-300 leading-relaxed">
                <p>
                  A HuggingFace token enables faster downloads and access to
                  gated models. Some models require authentication to download.
                </p>
                <a
                  href="https://huggingface.co/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 font-medium text-blue-400 hover:text-blue-300 underline underline-offset-2"
                >
                  Get your token at huggingface.co/settings/tokens
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Current status */}
            {settings && (
              <div className="mb-4">
                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                  Status:{' '}
                </span>
                {settings.hf_token_set ? (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Token set ({settings.hf_token_preview})
                  </span>
                ) : (
                  <span className="text-sm font-medium text-amber-400">
                    Not configured
                  </span>
                )}
              </div>
            )}

            {/* Token input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={
                    settings?.hf_token_set
                      ? 'Enter new token to replace...'
                      : 'hf_xxxxxxxxxxxxxxxxxxxx'
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                  }}
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 pr-10 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  {showToken ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              <button
                onClick={handleSave}
                disabled={!tokenInput.trim() || saveMutation.isPending}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  saveSuccess
                    ? 'bg-green-600 text-white'
                    : 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90',
                  'disabled:pointer-events-none disabled:opacity-50'
                )}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : saveSuccess ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saveSuccess ? 'Saved' : 'Save'}
              </button>
            </div>

            {/* Clear token */}
            {settings?.hf_token_set && (
              <button
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
                className="mt-3 text-xs text-red-400 hover:text-red-300 underline underline-offset-2 disabled:opacity-50"
              >
                {clearMutation.isPending ? 'Clearing...' : 'Clear saved token'}
              </button>
            )}

            {/* Error display */}
            {(saveMutation.error || clearMutation.error) && (
              <p className="mt-2 text-xs text-red-400">
                {(saveMutation.error ?? clearMutation.error) instanceof Error
                  ? (
                      (saveMutation.error ?? clearMutation.error) as Error
                    ).message
                  : 'Failed to save settings'}
              </p>
            )}
          </div>

          {/* Manual Model Download Section */}
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <h3 className="text-base font-semibold text-[hsl(var(--foreground))] mb-3">
              Manual Model Downloads
            </h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
              If in-app downloads are slow or failing, you can download models
              manually from HuggingFace and place them in the cache directory.
              The app will detect them automatically.
            </p>

            <div className="rounded-md bg-[hsl(var(--muted))] px-3 py-2 mb-4">
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                HuggingFace cache directory:
              </p>
              <code className="text-xs font-mono text-[hsl(var(--foreground))]">
                ~/.cache/huggingface/hub
              </code>
            </div>

            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Use{' '}
              <code className="rounded bg-[hsl(var(--muted))] px-1 py-0.5 font-mono">
                huggingface-cli download &lt;repo_id&gt;
              </code>{' '}
              to download via the command line, or visit the model page links
              on the Models tab.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
