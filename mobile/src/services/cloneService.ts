import api from './api';

export interface Clone {
  id: string;
  name: string;
  description: string;
  type: 'personality' | 'voice' | 'style';
  status: 'training' | 'ready' | 'failed' | 'draft';
  trainingProgress?: number;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  config: CloneConfig;
  stats: CloneStats;
  trainingData?: {
    samples: number;
    lastUpdated: string;
  };
}

export interface CloneConfig {
  personality?: {
    traits: string[];
    tone: string;
    formality: number;
  };
  voice?: {
    provider: string;
    voiceId: string;
    speed: number;
    pitch: number;
  };
  style?: {
    writingStyle: string;
    vocabulary: string;
    emoticons: boolean;
  };
}

export interface CloneStats {
  conversations: number;
  messages: number;
  avgRating: number;
  responseTime: number;
}

export interface CreateCloneData {
  name: string;
  description: string;
  type: 'personality' | 'voice' | 'style';
  config: CloneConfig;
}

class CloneService {
  // Clone CRUD
  async getClones(params?: {
    type?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Clone[]; total: number }> {
    const response = await api.get('/clones', { params });
    return response.data;
  }

  async getClone(id: string): Promise<Clone> {
    const response = await api.get(`/clones/${id}`);
    return response.data;
  }

  async createClone(data: CreateCloneData): Promise<Clone> {
    const response = await api.post('/clones', data);
    return response.data;
  }

  async updateClone(id: string, data: Partial<Clone>): Promise<Clone> {
    const response = await api.put(`/clones/${id}`, data);
    return response.data;
  }

  async deleteClone(id: string): Promise<void> {
    await api.delete(`/clones/${id}`);
  }

  // Training
  async startTraining(id: string): Promise<{ status: string }> {
    const response = await api.post(`/clones/${id}/train`);
    return response.data;
  }

  async getTrainingStatus(id: string): Promise<{
    status: string;
    progress: number;
    estimatedTime?: number;
  }> {
    const response = await api.get(`/clones/${id}/training-status`);
    return response.data;
  }

  async cancelTraining(id: string): Promise<void> {
    await api.post(`/clones/${id}/cancel-training`);
  }

  async uploadTrainingData(id: string, data: FormData): Promise<{
    samples: number;
    status: string;
  }> {
    const response = await api.post(`/clones/${id}/training-data`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  // Testing
  async testClone(id: string, message: string): Promise<{ message: string }> {
    const response = await api.post(`/clones/${id}/test`, { message });
    return response.data;
  }

  // Voice Preview (for voice clones)
  async previewVoice(id: string, text: string): Promise<{ audioUrl: string }> {
    const response = await api.post(`/clones/${id}/preview-voice`, { text });
    return response.data;
  }

  // Sharing
  async shareClone(id: string, options: {
    public: boolean;
    allowCopy?: boolean;
    expiresAt?: string;
  }): Promise<{ shareUrl: string }> {
    const response = await api.post(`/clones/${id}/share`, options);
    return response.data;
  }

  async getSharedClone(shareId: string): Promise<Clone> {
    const response = await api.get(`/clones/shared/${shareId}`);
    return response.data;
  }

  async copySharedClone(shareId: string, name: string): Promise<Clone> {
    const response = await api.post(`/clones/shared/${shareId}/copy`, { name });
    return response.data;
  }

  // Export/Import
  async exportClone(id: string): Promise<Blob> {
    const response = await api.get(`/clones/${id}/export`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async importClone(data: FormData): Promise<Clone> {
    const response = await api.post('/clones/import', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  // Templates
  async getCloneTemplates(): Promise<{ data: Clone[] }> {
    const response = await api.get('/clones/templates');
    return response.data;
  }

  async createFromTemplate(templateId: string, name: string): Promise<Clone> {
    const response = await api.post(`/clones/templates/${templateId}/create`, { name });
    return response.data;
  }

  // Analytics
  async getCloneAnalytics(id: string, params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    conversations: number;
    messages: number;
    avgRating: number;
    ratingTrend: number[];
    messageTrend: number[];
  }> {
    const response = await api.get(`/clones/${id}/analytics`, { params });
    return response.data;
  }

  // Personality specific
  async analyzePersonality(text: string): Promise<{
    traits: string[];
    tone: string;
    formality: number;
    suggestions: string[];
  }> {
    const response = await api.post('/clones/analyze-personality', { text });
    return response.data;
  }

  // Voice specific
  async getAvailableVoices(provider?: string): Promise<{
    voices: Array<{
      id: string;
      name: string;
      language: string;
      gender: string;
      preview?: string;
    }>;
  }> {
    const response = await api.get('/clones/voices', { params: { provider } });
    return response.data;
  }

  // Style specific
  async analyzeWritingStyle(samples: string[]): Promise<{
    style: string;
    vocabulary: string;
    avgSentenceLength: number;
    emoticons: boolean;
    suggestions: string[];
  }> {
    const response = await api.post('/clones/analyze-style', { samples });
    return response.data;
  }
}

export const cloneService = new CloneService();
export default cloneService;
