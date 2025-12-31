/**
 * Facebook Messenger Provider
 * Full integration with Facebook Graph API
 */

const crypto = require('crypto');
const log = require('../../utils/logger');

class FacebookProvider {
  constructor(config = {}) {
    this.pageAccessToken = config.pageAccessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    this.appSecret = config.appSecret || process.env.FACEBOOK_APP_SECRET;
    this.verifyToken = config.verifyToken || process.env.FACEBOOK_VERIFY_TOKEN;
    this.apiVersion = config.apiVersion || 'v18.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  // ==========================================
  // WEBHOOK VERIFICATION
  // ==========================================

  /**
   * Verify webhook subscription
   */
  verifyWebhook(query) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === this.verifyToken) {
      log.info('Facebook webhook verified successfully');
      return { success: true, challenge };
    }

    log.warn('Facebook webhook verification failed', { mode, tokenMatch: token === this.verifyToken });
    return { success: false, error: 'Verification failed' };
  }

  /**
   * Validate request signature from Facebook
   */
  validateSignature(rawBody, signature) {
    if (!signature || !this.appSecret) {
      return false;
    }

    const signatureHash = signature.split('sha256=')[1];
    if (!signatureHash) {
      return false;
    }

    const expectedHash = crypto
      .createHmac('sha256', this.appSecret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signatureHash),
      Buffer.from(expectedHash)
    );
  }

  // ==========================================
  // MESSAGE SENDING
  // ==========================================

  /**
   * Send message to user
   */
  async sendMessage(recipientId, message, options = {}) {
    const url = `${this.baseUrl}/me/messages`;

    const payload = {
      recipient: { id: recipientId },
      message,
      messaging_type: options.messagingType || 'RESPONSE'
    };

    if (options.tag) {
      payload.tag = options.tag;
    }

    if (options.notificationType) {
      payload.notification_type = options.notificationType;
    }

    try {
      const response = await fetch(`${url}?access_token=${this.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        log.error('Facebook send message error', { error: data.error, recipientId });
        return { success: false, error: data.error };
      }

      return { success: true, messageId: data.message_id, recipientId: data.recipient_id };
    } catch (error) {
      log.error('Facebook send message exception', { error: error.message, recipientId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send text message
   */
  async sendText(recipientId, text, options = {}) {
    return this.sendMessage(recipientId, { text }, options);
  }

  /**
   * Send image attachment
   */
  async sendImage(recipientId, imageUrl, options = {}) {
    return this.sendMessage(recipientId, {
      attachment: {
        type: 'image',
        payload: {
          url: imageUrl,
          is_reusable: options.isReusable || true
        }
      }
    }, options);
  }

  /**
   * Send video attachment
   */
  async sendVideo(recipientId, videoUrl, options = {}) {
    return this.sendMessage(recipientId, {
      attachment: {
        type: 'video',
        payload: {
          url: videoUrl,
          is_reusable: options.isReusable || true
        }
      }
    }, options);
  }

  /**
   * Send audio attachment
   */
  async sendAudio(recipientId, audioUrl, options = {}) {
    return this.sendMessage(recipientId, {
      attachment: {
        type: 'audio',
        payload: {
          url: audioUrl,
          is_reusable: options.isReusable || true
        }
      }
    }, options);
  }

  /**
   * Send file attachment
   */
  async sendFile(recipientId, fileUrl, options = {}) {
    return this.sendMessage(recipientId, {
      attachment: {
        type: 'file',
        payload: {
          url: fileUrl,
          is_reusable: options.isReusable || true
        }
      }
    }, options);
  }

  // ==========================================
  // TEMPLATES
  // ==========================================

  /**
   * Send generic template (carousel)
   */
  async sendGenericTemplate(recipientId, elements, options = {}) {
    const formattedElements = elements.map(el => ({
      title: el.title,
      subtitle: el.subtitle,
      image_url: el.imageUrl,
      default_action: el.defaultAction ? {
        type: 'web_url',
        url: el.defaultAction.url,
        webview_height_ratio: el.defaultAction.webviewHeightRatio || 'tall'
      } : undefined,
      buttons: el.buttons ? this.formatButtons(el.buttons) : undefined
    }));

    return this.sendMessage(recipientId, {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: formattedElements.slice(0, 10) // Max 10 elements
        }
      }
    }, options);
  }

  /**
   * Send button template
   */
  async sendButtonTemplate(recipientId, text, buttons, options = {}) {
    return this.sendMessage(recipientId, {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text,
          buttons: this.formatButtons(buttons).slice(0, 3) // Max 3 buttons
        }
      }
    }, options);
  }

  /**
   * Send receipt template
   */
  async sendReceiptTemplate(recipientId, receipt, options = {}) {
    return this.sendMessage(recipientId, {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'receipt',
          recipient_name: receipt.recipientName,
          order_number: receipt.orderNumber,
          currency: receipt.currency || 'USD',
          payment_method: receipt.paymentMethod,
          order_url: receipt.orderUrl,
          timestamp: receipt.timestamp,
          address: receipt.address,
          summary: receipt.summary,
          adjustments: receipt.adjustments,
          elements: receipt.elements?.map(el => ({
            title: el.title,
            subtitle: el.subtitle,
            quantity: el.quantity,
            price: el.price,
            currency: el.currency || receipt.currency || 'USD',
            image_url: el.imageUrl
          }))
        }
      }
    }, options);
  }

  /**
   * Send airline boarding pass template
   */
  async sendAirlineBoardingPass(recipientId, boardingPass, options = {}) {
    return this.sendMessage(recipientId, {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'airline_boardingpass',
          intro_message: boardingPass.introMessage,
          locale: boardingPass.locale || 'en_US',
          boarding_pass: boardingPass.passes.map(pass => ({
            passenger_name: pass.passengerName,
            pnr_number: pass.pnrNumber,
            logo_image_url: pass.logoImageUrl,
            header_image_url: pass.headerImageUrl,
            header_text_field: pass.headerTextField,
            qr_code: pass.qrCode,
            barcode_image_url: pass.barcodeImageUrl,
            above_bar_code_image_url: pass.aboveBarCodeImageUrl,
            flight_info: {
              flight_number: pass.flightInfo.flightNumber,
              departure_airport: pass.flightInfo.departureAirport,
              arrival_airport: pass.flightInfo.arrivalAirport,
              flight_schedule: pass.flightInfo.flightSchedule
            },
            seat: pass.seat,
            auxiliary_fields: pass.auxiliaryFields,
            secondary_fields: pass.secondaryFields
          }))
        }
      }
    }, options);
  }

  /**
   * Send media template
   */
  async sendMediaTemplate(recipientId, mediaType, attachmentId, buttons = [], options = {}) {
    return this.sendMessage(recipientId, {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'media',
          elements: [{
            media_type: mediaType, // 'image' or 'video'
            attachment_id: attachmentId,
            buttons: buttons.length > 0 ? this.formatButtons(buttons).slice(0, 1) : undefined
          }]
        }
      }
    }, options);
  }

  /**
   * Format buttons for templates
   */
  formatButtons(buttons) {
    return buttons.map(btn => {
      if (btn.type === 'web_url' || btn.url) {
        return {
          type: 'web_url',
          url: btn.url,
          title: btn.title,
          webview_height_ratio: btn.webviewHeightRatio || 'full',
          messenger_extensions: btn.messengerExtensions || false
        };
      } else if (btn.type === 'postback' || btn.payload) {
        return {
          type: 'postback',
          title: btn.title,
          payload: btn.payload
        };
      } else if (btn.type === 'phone_number' || btn.phoneNumber) {
        return {
          type: 'phone_number',
          title: btn.title,
          payload: btn.phoneNumber || btn.payload
        };
      } else if (btn.type === 'account_link') {
        return {
          type: 'account_link',
          url: btn.url
        };
      } else if (btn.type === 'account_unlink') {
        return {
          type: 'account_unlink'
        };
      }
      return btn;
    });
  }

  // ==========================================
  // QUICK REPLIES
  // ==========================================

  /**
   * Send message with quick replies
   */
  async sendQuickReplies(recipientId, text, quickReplies, options = {}) {
    const formattedReplies = quickReplies.map(qr => {
      if (qr.contentType === 'location') {
        return { content_type: 'location' };
      } else if (qr.contentType === 'user_phone_number') {
        return { content_type: 'user_phone_number' };
      } else if (qr.contentType === 'user_email') {
        return { content_type: 'user_email' };
      }
      return {
        content_type: 'text',
        title: qr.title,
        payload: qr.payload,
        image_url: qr.imageUrl
      };
    });

    return this.sendMessage(recipientId, {
      text,
      quick_replies: formattedReplies.slice(0, 13) // Max 13 quick replies
    }, options);
  }

  // ==========================================
  // SENDER ACTIONS
  // ==========================================

  /**
   * Send sender action (typing indicator, mark seen)
   */
  async sendSenderAction(recipientId, action) {
    const url = `${this.baseUrl}/me/messages`;

    const payload = {
      recipient: { id: recipientId },
      sender_action: action
    };

    try {
      const response = await fetch(`${url}?access_token=${this.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        log.error('Facebook sender action error', { error: data.error });
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (error) {
      log.error('Facebook sender action exception', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Show typing indicator
   */
  async showTypingOn(recipientId) {
    return this.sendSenderAction(recipientId, 'typing_on');
  }

  /**
   * Hide typing indicator
   */
  async showTypingOff(recipientId) {
    return this.sendSenderAction(recipientId, 'typing_off');
  }

  /**
   * Mark message as seen
   */
  async markSeen(recipientId) {
    return this.sendSenderAction(recipientId, 'mark_seen');
  }

  // ==========================================
  // PERSISTENT MENU
  // ==========================================

  /**
   * Set persistent menu
   */
  async setPersistentMenu(menuItems, options = {}) {
    const url = `${this.baseUrl}/me/messenger_profile`;

    const payload = {
      persistent_menu: [{
        locale: options.locale || 'default',
        composer_input_disabled: options.composerInputDisabled || false,
        call_to_actions: this.formatMenuItems(menuItems)
      }]
    };

    try {
      const response = await fetch(`${url}?access_token=${this.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        log.error('Facebook set persistent menu error', { error: data.error });
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (error) {
      log.error('Facebook set persistent menu exception', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete persistent menu
   */
  async deletePersistentMenu() {
    const url = `${this.baseUrl}/me/messenger_profile`;

    try {
      const response = await fetch(`${url}?access_token=${this.pageAccessToken}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: ['persistent_menu'] })
      });

      const data = await response.json();

      if (!response.ok) {
        log.error('Facebook delete persistent menu error', { error: data.error });
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (error) {
      log.error('Facebook delete persistent menu exception', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Format menu items for persistent menu
   */
  formatMenuItems(items) {
    return items.map(item => {
      if (item.type === 'nested' && item.callToActions) {
        return {
          type: 'nested',
          title: item.title,
          call_to_actions: this.formatMenuItems(item.callToActions)
        };
      } else if (item.type === 'web_url' || item.url) {
        return {
          type: 'web_url',
          title: item.title,
          url: item.url,
          webview_height_ratio: item.webviewHeightRatio || 'full'
        };
      } else {
        return {
          type: 'postback',
          title: item.title,
          payload: item.payload
        };
      }
    });
  }

  // ==========================================
  // GET STARTED & GREETING
  // ==========================================

  /**
   * Set get started button
   */
  async setGetStartedButton(payload = 'GET_STARTED') {
    const url = `${this.baseUrl}/me/messenger_profile`;

    try {
      const response = await fetch(`${url}?access_token=${this.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          get_started: { payload }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        log.error('Facebook set get started error', { error: data.error });
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (error) {
      log.error('Facebook set get started exception', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Set greeting text
   */
  async setGreetingText(greetings) {
    const url = `${this.baseUrl}/me/messenger_profile`;

    const formattedGreetings = Array.isArray(greetings)
      ? greetings.map(g => ({ locale: g.locale || 'default', text: g.text }))
      : [{ locale: 'default', text: greetings }];

    try {
      const response = await fetch(`${url}?access_token=${this.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ greeting: formattedGreetings })
      });

      const data = await response.json();

      if (!response.ok) {
        log.error('Facebook set greeting error', { error: data.error });
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (error) {
      log.error('Facebook set greeting exception', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // USER & PAGE INFO
  // ==========================================

  /**
   * Get user profile
   */
  async getUserProfile(userId, fields = ['first_name', 'last_name', 'profile_pic', 'locale', 'timezone']) {
    const url = `${this.baseUrl}/${userId}`;

    try {
      const response = await fetch(`${url}?fields=${fields.join(',')}&access_token=${this.pageAccessToken}`);
      const data = await response.json();

      if (!response.ok) {
        log.error('Facebook get user profile error', { error: data.error });
        return { success: false, error: data.error };
      }

      return {
        success: true,
        profile: {
          id: data.id,
          firstName: data.first_name,
          lastName: data.last_name,
          profilePic: data.profile_pic,
          locale: data.locale,
          timezone: data.timezone,
          gender: data.gender
        }
      };
    } catch (error) {
      log.error('Facebook get user profile exception', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get page info
   */
  async getPageInfo(pageId = 'me', fields = ['id', 'name', 'about', 'picture', 'category', 'fan_count']) {
    const url = `${this.baseUrl}/${pageId}`;

    try {
      const response = await fetch(`${url}?fields=${fields.join(',')}&access_token=${this.pageAccessToken}`);
      const data = await response.json();

      if (!response.ok) {
        log.error('Facebook get page info error', { error: data.error });
        return { success: false, error: data.error };
      }

      return {
        success: true,
        page: {
          id: data.id,
          name: data.name,
          about: data.about,
          picture: data.picture?.data?.url,
          category: data.category,
          fanCount: data.fan_count
        }
      };
    } catch (error) {
      log.error('Facebook get page info exception', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // MESSAGE PARSING
  // ==========================================

  /**
   * Parse incoming webhook event
   */
  parseWebhookEvent(body) {
    const events = [];

    if (body.object !== 'page') {
      return events;
    }

    for (const entry of body.entry || []) {
      const pageId = entry.id;
      const timestamp = entry.time;

      for (const messaging of entry.messaging || []) {
        const senderId = messaging.sender?.id;
        const recipientId = messaging.recipient?.id;

        const event = {
          pageId,
          timestamp,
          senderId,
          recipientId,
          messageTimestamp: messaging.timestamp
        };

        // Text message
        if (messaging.message?.text) {
          event.type = 'text';
          event.text = messaging.message.text;
          event.messageId = messaging.message.mid;
          event.quickReply = messaging.message.quick_reply?.payload;
          event.nlp = messaging.message.nlp;
        }
        // Attachments
        else if (messaging.message?.attachments) {
          event.type = 'attachments';
          event.messageId = messaging.message.mid;
          event.attachments = messaging.message.attachments.map(att => ({
            type: att.type,
            url: att.payload?.url,
            title: att.payload?.title,
            coordinates: att.payload?.coordinates,
            stickerId: att.payload?.sticker_id
          }));
        }
        // Postback
        else if (messaging.postback) {
          event.type = 'postback';
          event.payload = messaging.postback.payload;
          event.title = messaging.postback.title;
          event.referral = messaging.postback.referral;
        }
        // Referral
        else if (messaging.referral) {
          event.type = 'referral';
          event.ref = messaging.referral.ref;
          event.source = messaging.referral.source;
          event.type_ref = messaging.referral.type;
          event.adId = messaging.referral.ad_id;
        }
        // Optin
        else if (messaging.optin) {
          event.type = 'optin';
          event.ref = messaging.optin.ref;
          event.userRef = messaging.optin.user_ref;
        }
        // Account linking
        else if (messaging.account_linking) {
          event.type = 'account_linking';
          event.status = messaging.account_linking.status;
          event.authorizationCode = messaging.account_linking.authorization_code;
        }
        // Message delivery
        else if (messaging.delivery) {
          event.type = 'delivery';
          event.mids = messaging.delivery.mids;
          event.watermark = messaging.delivery.watermark;
        }
        // Message read
        else if (messaging.read) {
          event.type = 'read';
          event.watermark = messaging.read.watermark;
        }
        // Reaction
        else if (messaging.reaction) {
          event.type = 'reaction';
          event.reaction = messaging.reaction.reaction;
          event.emoji = messaging.reaction.emoji;
          event.action = messaging.reaction.action;
          event.mid = messaging.reaction.mid;
        }
        // Echo (message sent by page)
        else if (messaging.message?.is_echo) {
          event.type = 'echo';
          event.messageId = messaging.message.mid;
          event.appId = messaging.message.app_id;
          event.metadata = messaging.message.metadata;
        }
        // Unknown
        else {
          event.type = 'unknown';
          event.raw = messaging;
        }

        events.push(event);
      }
    }

    return events;
  }

  // ==========================================
  // ATTACHMENT UPLOAD
  // ==========================================

  /**
   * Upload attachment for reuse
   */
  async uploadAttachment(type, url) {
    const apiUrl = `${this.baseUrl}/me/message_attachments`;

    const payload = {
      message: {
        attachment: {
          type,
          payload: {
            is_reusable: true,
            url
          }
        }
      }
    };

    try {
      const response = await fetch(`${apiUrl}?access_token=${this.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        log.error('Facebook upload attachment error', { error: data.error });
        return { success: false, error: data.error };
      }

      return { success: true, attachmentId: data.attachment_id };
    } catch (error) {
      log.error('Facebook upload attachment exception', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // BROADCAST API
  // ==========================================

  /**
   * Create message creative for broadcast
   */
  async createMessageCreative(message) {
    const url = `${this.baseUrl}/me/message_creatives`;

    try {
      const response = await fetch(`${url}?access_token=${this.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [message] })
      });

      const data = await response.json();

      if (!response.ok) {
        log.error('Facebook create message creative error', { error: data.error });
        return { success: false, error: data.error };
      }

      return { success: true, messageCreativeId: data.message_creative_id };
    } catch (error) {
      log.error('Facebook create message creative exception', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send broadcast message
   */
  async sendBroadcast(messageCreativeId, options = {}) {
    const url = `${this.baseUrl}/me/broadcast_messages`;

    const payload = {
      message_creative_id: messageCreativeId,
      notification_type: options.notificationType || 'REGULAR',
      messaging_type: 'MESSAGE_TAG',
      tag: options.tag || 'NON_PROMOTIONAL_SUBSCRIPTION'
    };

    if (options.customLabelId) {
      payload.custom_label_id = options.customLabelId;
    }

    try {
      const response = await fetch(`${url}?access_token=${this.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        log.error('Facebook send broadcast error', { error: data.error });
        return { success: false, error: data.error };
      }

      return { success: true, broadcastId: data.broadcast_id };
    } catch (error) {
      log.error('Facebook send broadcast exception', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // LABELS (Custom Labels for Broadcast)
  // ==========================================

  /**
   * Create custom label
   */
  async createLabel(name) {
    const url = `${this.baseUrl}/me/custom_labels`;

    try {
      const response = await fetch(`${url}?access_token=${this.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });

      const data = await response.json();

      if (!response.ok) {
        log.error('Facebook create label error', { error: data.error });
        return { success: false, error: data.error };
      }

      return { success: true, labelId: data.id };
    } catch (error) {
      log.error('Facebook create label exception', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Associate label with user
   */
  async associateLabelToUser(labelId, psid) {
    const url = `${this.baseUrl}/${labelId}/label`;

    try {
      const response = await fetch(`${url}?access_token=${this.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: psid })
      });

      const data = await response.json();

      if (!response.ok) {
        log.error('Facebook associate label error', { error: data.error });
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (error) {
      log.error('Facebook associate label exception', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // HANDOVER PROTOCOL
  // ==========================================

  /**
   * Pass thread control to another app
   */
  async passThreadControl(recipientId, targetAppId, metadata = '') {
    const url = `${this.baseUrl}/me/pass_thread_control`;

    try {
      const response = await fetch(`${url}?access_token=${this.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          target_app_id: targetAppId,
          metadata
        })
      });

      const data = await response.json();

      if (!response.ok) {
        log.error('Facebook pass thread control error', { error: data.error });
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (error) {
      log.error('Facebook pass thread control exception', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Take thread control from another app
   */
  async takeThreadControl(recipientId, metadata = '') {
    const url = `${this.baseUrl}/me/take_thread_control`;

    try {
      const response = await fetch(`${url}?access_token=${this.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          metadata
        })
      });

      const data = await response.json();

      if (!response.ok) {
        log.error('Facebook take thread control error', { error: data.error });
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (error) {
      log.error('Facebook take thread control exception', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Request thread control from primary receiver
   */
  async requestThreadControl(recipientId, metadata = '') {
    const url = `${this.baseUrl}/me/request_thread_control`;

    try {
      const response = await fetch(`${url}?access_token=${this.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          metadata
        })
      });

      const data = await response.json();

      if (!response.ok) {
        log.error('Facebook request thread control error', { error: data.error });
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (error) {
      log.error('Facebook request thread control exception', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = FacebookProvider;
