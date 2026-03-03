import type { SystemInfo, ModelInfo, ModelDownloadStatus, GalleryEntry, AppSettings } from './types';

export class ForgeApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorBody}`
      );
    }

    return response.json();
  }

  // Health
  async health(): Promise<{ status: string }> {
    return this.request('/health');
  }

  // System
  async getSystemInfo(): Promise<SystemInfo> {
    return this.request('/system');
  }

  // Models
  async getModels(): Promise<ModelInfo[]> {
    return this.request('/models');
  }

  async loadModel(modelId: string): Promise<void> {
    await this.request(`/models/${encodeURIComponent(modelId)}/load`, {
      method: 'POST',
    });
  }

  async downloadModel(modelId: string): Promise<void> {
    await this.request(`/models/${encodeURIComponent(modelId)}/download`, {
      method: 'POST',
    });
  }

  async deleteModel(modelId: string): Promise<void> {
    await this.request(`/models/${encodeURIComponent(modelId)}`, {
      method: 'DELETE',
    });
  }

  async getModelDownloadStatus(modelId: string): Promise<ModelDownloadStatus> {
    return this.request(`/models/${encodeURIComponent(modelId)}/download-status`);
  }

  async unloadModel(modelId: string): Promise<void> {
    await this.request(`/models/${encodeURIComponent(modelId)}/unload`, {
      method: 'POST',
    });
  }

  // Gallery
  async getGallery(page?: number, limit?: number): Promise<GalleryEntry[]> {
    const params = new URLSearchParams();
    if (page !== undefined) params.set('page', String(page));
    if (limit !== undefined) params.set('limit', String(limit));
    const query = params.toString();
    const data = await this.request<{ entries: GalleryEntry[] }>(
      `/gallery${query ? `?${query}` : ''}`
    );
    return data.entries;
  }

  async searchGallery(query: string): Promise<GalleryEntry[]> {
    const data = await this.request<{ entries: GalleryEntry[] }>(
      `/gallery/search?q=${encodeURIComponent(query)}`
    );
    return data.entries;
  }

  async deleteGalleryEntry(id: string): Promise<void> {
    await this.request(`/gallery/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // Gallery image URL
  getGalleryImageUrl(imagePath: string): string {
    // If the path is already absolute URL, return as-is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // Extract just the filename from the full filesystem path
    const filename = imagePath.split('/').pop() ?? imagePath;
    return `${this.baseUrl}/api/v1/images/${encodeURIComponent(filename)}`;
  }

  // Settings
  async getSettings(): Promise<AppSettings> {
    return this.request('/settings');
  }

  async updateSettings(settings: { hf_token?: string }): Promise<AppSettings> {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Generation (WebSocket)
  createGenerationSocket(): WebSocket {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws');
    return new WebSocket(`${wsUrl}/api/v1/ws/generate`);
  }

  async cancelGeneration(): Promise<void> {
    await this.request('/generate/cancel', { method: 'POST' });
  }
}
