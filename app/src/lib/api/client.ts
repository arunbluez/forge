import type { SystemInfo, ModelInfo, GalleryEntry } from './types';

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
    return this.request('/system/info');
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

  // Gallery
  async getGallery(page?: number, limit?: number): Promise<GalleryEntry[]> {
    const params = new URLSearchParams();
    if (page !== undefined) params.set('page', String(page));
    if (limit !== undefined) params.set('limit', String(limit));
    const query = params.toString();
    return this.request(`/gallery${query ? `?${query}` : ''}`);
  }

  async searchGallery(query: string): Promise<GalleryEntry[]> {
    return this.request(
      `/gallery/search?q=${encodeURIComponent(query)}`
    );
  }

  async deleteGalleryEntry(id: string): Promise<void> {
    await this.request(`/gallery/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // Generation (WebSocket)
  createGenerationSocket(): WebSocket {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws');
    return new WebSocket(`${wsUrl}/api/v1/generate/ws`);
  }

  async cancelGeneration(): Promise<void> {
    await this.request('/generate/cancel', { method: 'POST' });
  }
}
