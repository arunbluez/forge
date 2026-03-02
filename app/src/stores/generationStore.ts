import { create } from 'zustand';

interface GenerationState {
  prompt: string;
  negativePrompt: string;
  selectedModelId: string | null;
  width: number;
  height: number;
  steps: number;
  seed: number;
  guidanceScale: number;
  isGenerating: boolean;
  progress: number;
  currentStep: number;
  totalSteps: number;
  previewImage: string | null;
  finalImage: string | null;
  sourceImages: string[];

  // Actions
  setPrompt: (prompt: string) => void;
  setNegativePrompt: (prompt: string) => void;
  setSelectedModelId: (id: string | null) => void;
  setDimensions: (w: number, h: number) => void;
  setSteps: (steps: number) => void;
  setSeed: (seed: number) => void;
  setGuidanceScale: (scale: number) => void;
  setIsGenerating: (generating: boolean) => void;
  setProgress: (step: number, total: number) => void;
  setPreviewImage: (image: string | null) => void;
  setFinalImage: (image: string | null) => void;
  addSourceImage: (image: string) => void;
  removeSourceImage: (index: number) => void;
  clearSourceImages: () => void;
  reset: () => void;
}

const initialState = {
  prompt: '',
  negativePrompt: '',
  selectedModelId: null as string | null,
  width: 512,
  height: 512,
  steps: 20,
  seed: -1,
  guidanceScale: 7.5,
  isGenerating: false,
  progress: 0,
  currentStep: 0,
  totalSteps: 0,
  previewImage: null as string | null,
  finalImage: null as string | null,
  sourceImages: [] as string[],
};

export const useGenerationStore = create<GenerationState>((set) => ({
  ...initialState,

  setPrompt: (prompt) => set({ prompt }),

  setNegativePrompt: (negativePrompt) => set({ negativePrompt }),

  setSelectedModelId: (selectedModelId) => set({ selectedModelId }),

  setDimensions: (width, height) => set({ width, height }),

  setSteps: (steps) => set({ steps }),

  setSeed: (seed) => set({ seed }),

  setGuidanceScale: (guidanceScale) => set({ guidanceScale }),

  setIsGenerating: (isGenerating) => set({ isGenerating }),

  setProgress: (currentStep, totalSteps) =>
    set({
      currentStep,
      totalSteps,
      progress: totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0,
    }),

  setPreviewImage: (previewImage) => set({ previewImage }),

  setFinalImage: (finalImage) => set({ finalImage }),

  addSourceImage: (image) =>
    set((state) => ({ sourceImages: [...state.sourceImages, image] })),

  removeSourceImage: (index) =>
    set((state) => ({
      sourceImages: state.sourceImages.filter((_, i) => i !== index),
    })),

  clearSourceImages: () => set({ sourceImages: [] }),

  reset: () => set(initialState),
}));
