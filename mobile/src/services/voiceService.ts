import api from './api';

export interface VoiceBot {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'busy';
  phoneNumber?: string;
  provider: 'twilio' | 'vonage' | 'custom';
  language: string;
  voiceType: string;
  totalCalls: number;
  avgCallDuration: number;
  lastCallAt?: string;
}

export interface VoiceCall {
  id: string;
  botId: string;
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'failed';
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  duration: number;
  startedAt: string;
  endedAt?: string;
  recordingUrl?: string;
  transcription?: string;
}

export interface CallStats {
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  avgDuration: number;
  successRate: number;
  missedCalls: number;
}

class VoiceService {
  // Voice Bots
  async getVoiceBots(): Promise<{ data: VoiceBot[] }> {
    const response = await api.get('/voice/bots');
    return response.data;
  }

  async getVoiceBot(id: string): Promise<VoiceBot> {
    const response = await api.get(`/voice/bots/${id}`);
    return response.data;
  }

  async createVoiceBot(data: Partial<VoiceBot>): Promise<VoiceBot> {
    const response = await api.post('/voice/bots', data);
    return response.data;
  }

  async updateVoiceBot(id: string, data: Partial<VoiceBot>): Promise<VoiceBot> {
    const response = await api.put(`/voice/bots/${id}`, data);
    return response.data;
  }

  async deleteVoiceBot(id: string): Promise<void> {
    await api.delete(`/voice/bots/${id}`);
  }

  // Calls
  async getCalls(params?: {
    botId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: VoiceCall[]; total: number }> {
    const response = await api.get('/voice/calls', { params });
    return response.data;
  }

  async getCall(id: string): Promise<VoiceCall> {
    const response = await api.get(`/voice/calls/${id}`);
    return response.data;
  }

  async startTestCall(botId: string): Promise<{ callId: string }> {
    const response = await api.post(`/voice/bots/${botId}/test-call`);
    return response.data;
  }

  async endCall(callId: string): Promise<void> {
    await api.post(`/voice/calls/${callId}/end`);
  }

  async setMute(callId: string, muted: boolean): Promise<void> {
    await api.post(`/voice/calls/${callId}/mute`, { muted });
  }

  async setHold(callId: string, held: boolean): Promise<void> {
    await api.post(`/voice/calls/${callId}/hold`, { held });
  }

  async sendDTMF(callId: string, digits: string): Promise<void> {
    await api.post(`/voice/calls/${callId}/dtmf`, { digits });
  }

  async transferCall(callId: string, destination: string): Promise<void> {
    await api.post(`/voice/calls/${callId}/transfer`, { destination });
  }

  // Recordings
  async getRecordings(params?: {
    callId?: string;
    botId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number }> {
    const response = await api.get('/voice/recordings', { params });
    return response.data;
  }

  async getRecording(id: string): Promise<any> {
    const response = await api.get(`/voice/recordings/${id}`);
    return response.data;
  }

  async deleteRecording(id: string): Promise<void> {
    await api.delete(`/voice/recordings/${id}`);
  }

  async transcribeRecording(id: string): Promise<{ transcription: string }> {
    const response = await api.post(`/voice/recordings/${id}/transcribe`);
    return response.data;
  }

  // Statistics
  async getCallStats(params?: {
    botId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<CallStats> {
    const response = await api.get('/voice/stats', { params });
    return response.data;
  }

  // Phone Numbers
  async getPhoneNumbers(): Promise<{ data: any[] }> {
    const response = await api.get('/voice/phone-numbers');
    return response.data;
  }

  async searchAvailableNumbers(params: {
    country: string;
    type?: string;
    areaCode?: string;
  }): Promise<{ data: any[] }> {
    const response = await api.get('/voice/phone-numbers/available', { params });
    return response.data;
  }

  async purchaseNumber(phoneNumber: string): Promise<any> {
    const response = await api.post('/voice/phone-numbers/purchase', { phoneNumber });
    return response.data;
  }

  async releaseNumber(id: string): Promise<void> {
    await api.delete(`/voice/phone-numbers/${id}`);
  }

  async assignNumberToBot(numberId: string, botId: string): Promise<void> {
    await api.post(`/voice/phone-numbers/${numberId}/assign`, { botId });
  }
}

export const voiceService = new VoiceService();
export default voiceService;
