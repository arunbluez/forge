export interface SystemInfo {
  total_ram_gb: number;
  gpu_type: string;
  recommended_model_id: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  type: string;
  min_ram_gb: number;
  rec_ram_gb: number;
  default_steps: number;
  default_cfg: number;
  supports_img2img: boolean;
  is_downloaded: boolean;
  is_loaded: boolean;
  disk_size_bytes: number;
}

export interface GalleryEntry {
  id: string;
  prompt: string;
  negative_prompt: string;
  model_id: string;
  seed: number;
  width: number;
  height: number;
  steps: number;
  guidance_scale: number;
  created_at: string;
  image_path: string;
  source_images: string[];
  generation_time_ms: number;
}

export interface GenerateRequest {
  prompt: string;
  negative_prompt: string;
  model_id: string;
  width: number;
  height: number;
  steps: number;
  seed: number;
  guidance_scale: number;
  source_images: string[];
}

export interface GenerateProgress {
  type: 'preview' | 'complete';
  step: number;
  total_steps: number;
  image_base64: string;
  seed: number;
  generation_time_ms: number;
}
