/**
 * Twilio Voice Service
 * Handles phone calls, webhooks, and telephony operations
 */

const log = require('../../utils/logger');

class TwilioService {
  constructor(config = {}) {
    this.accountSid = config.accountSid || process.env.TWILIO_ACCOUNT_SID;
    this.authToken = config.authToken || process.env.TWILIO_AUTH_TOKEN;
    this.client = null;

    if (this.accountSid && this.authToken) {
      try {
        const twilio = require('twilio');
        this.client = twilio(this.accountSid, this.authToken);
      } catch (err) {
        log.warn('Twilio SDK not available', { error: err.message });
      }
    }
  }

  /**
   * Check if Twilio is configured
   */
  isConfigured() {
    return !!this.client;
  }

  /**
   * List available phone numbers for purchase
   */
  async searchAvailableNumbers(countryCode = 'US', options = {}) {
    if (!this.client) {
      return { success: false, error: 'Twilio not configured' };
    }

    try {
      const numbers = await this.client.availablePhoneNumbers(countryCode)
        .local
        .list({
          voiceEnabled: true,
          limit: options.limit || 20,
          areaCode: options.areaCode,
          contains: options.contains
        });

      return {
        success: true,
        numbers: numbers.map(n => ({
          phoneNumber: n.phoneNumber,
          friendlyName: n.friendlyName,
          locality: n.locality,
          region: n.region,
          capabilities: n.capabilities
        }))
      };
    } catch (error) {
      log.error('Error searching available numbers', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Purchase a phone number
   */
  async purchaseNumber(phoneNumber, webhookUrl) {
    if (!this.client) {
      return { success: false, error: 'Twilio not configured' };
    }

    try {
      const number = await this.client.incomingPhoneNumbers.create({
        phoneNumber: phoneNumber,
        voiceUrl: webhookUrl,
        voiceMethod: 'POST',
        statusCallback: `${webhookUrl}/status`,
        statusCallbackMethod: 'POST'
      });

      return {
        success: true,
        number: {
          sid: number.sid,
          phoneNumber: number.phoneNumber,
          friendlyName: number.friendlyName,
          capabilities: number.capabilities
        }
      };
    } catch (error) {
      log.error('Error purchasing number', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Release a phone number
   */
  async releaseNumber(phoneSid) {
    if (!this.client) {
      return { success: false, error: 'Twilio not configured' };
    }

    try {
      await this.client.incomingPhoneNumbers(phoneSid).remove();
      return { success: true };
    } catch (error) {
      log.error('Error releasing number', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Make an outbound call
   */
  async makeCall(from, to, webhookUrl, options = {}) {
    if (!this.client) {
      return { success: false, error: 'Twilio not configured' };
    }

    try {
      const call = await this.client.calls.create({
        from: from,
        to: to,
        url: webhookUrl,
        method: 'POST',
        statusCallback: `${webhookUrl}/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        record: options.record || false,
        timeout: options.timeout || 30,
        machineDetection: options.machineDetection || 'Enable'
      });

      return {
        success: true,
        call: {
          sid: call.sid,
          status: call.status,
          direction: call.direction,
          from: call.from,
          to: call.to
        }
      };
    } catch (error) {
      log.error('Error making call', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get call details
   */
  async getCall(callSid) {
    if (!this.client) {
      return { success: false, error: 'Twilio not configured' };
    }

    try {
      const call = await this.client.calls(callSid).fetch();
      return {
        success: true,
        call: {
          sid: call.sid,
          status: call.status,
          direction: call.direction,
          from: call.from,
          to: call.to,
          duration: call.duration,
          startTime: call.startTime,
          endTime: call.endTime
        }
      };
    } catch (error) {
      log.error('Error getting call', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * End a call
   */
  async endCall(callSid) {
    if (!this.client) {
      return { success: false, error: 'Twilio not configured' };
    }

    try {
      const call = await this.client.calls(callSid).update({ status: 'completed' });
      return { success: true, status: call.status };
    } catch (error) {
      log.error('Error ending call', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get call recording
   */
  async getRecording(callSid) {
    if (!this.client) {
      return { success: false, error: 'Twilio not configured' };
    }

    try {
      const recordings = await this.client.recordings.list({ callSid: callSid, limit: 1 });

      if (recordings.length === 0) {
        return { success: false, error: 'No recording found' };
      }

      const recording = recordings[0];
      return {
        success: true,
        recording: {
          sid: recording.sid,
          duration: recording.duration,
          url: `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`
        }
      };
    } catch (error) {
      log.error('Error getting recording', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate TwiML for voice response
   */
  generateTwiML(options = {}) {
    const VoiceResponse = require('twilio').twiml.VoiceResponse;
    const response = new VoiceResponse();

    if (options.say) {
      response.say({
        voice: options.voice || 'Polly.Amy',
        language: options.language || 'en-US'
      }, options.say);
    }

    if (options.gather) {
      const gather = response.gather({
        input: options.gather.input || 'speech',
        action: options.gather.action,
        method: 'POST',
        speechTimeout: options.gather.speechTimeout || 'auto',
        language: options.gather.language || 'en-US',
        hints: options.gather.hints
      });

      if (options.gather.say) {
        gather.say({
          voice: options.voice || 'Polly.Amy',
          language: options.language || 'en-US'
        }, options.gather.say);
      }
    }

    if (options.play) {
      response.play(options.play);
    }

    if (options.hangup) {
      response.hangup();
    }

    return response.toString();
  }

  /**
   * Validate Twilio webhook signature
   */
  validateWebhook(signature, url, params) {
    try {
      const twilio = require('twilio');
      return twilio.validateRequest(this.authToken, signature, url, params);
    } catch (error) {
      log.error('Error validating webhook', { error: error.message });
      return false;
    }
  }
}

module.exports = TwilioService;
