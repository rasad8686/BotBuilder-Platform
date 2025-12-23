/**
 * Webhook Payload Snapshot Tests
 * Tests webhook payload structure consistency for Telegram and WhatsApp
 * Uses Jest snapshots to detect unintended payload structure changes
 */

// ========================================
// MOCKS
// ========================================

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// ========================================
// TELEGRAM PAYLOAD STRUCTURES
// ========================================

const telegramPayloads = {
  // Text message from user
  textMessage: {
    update_id: 123456789,
    message: {
      message_id: 1001,
      from: {
        id: 987654321,
        is_bot: false,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        language_code: 'en'
      },
      chat: {
        id: 987654321,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        type: 'private'
      },
      date: 1705312800,
      text: 'Hello, bot!'
    }
  },

  // Photo message
  photoMessage: {
    update_id: 123456790,
    message: {
      message_id: 1002,
      from: {
        id: 987654321,
        is_bot: false,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        language_code: 'en'
      },
      chat: {
        id: 987654321,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        type: 'private'
      },
      date: 1705312801,
      photo: [
        { file_id: 'AgACAgIAA-small', file_unique_id: 'ABC123', file_size: 1024, width: 90, height: 90 },
        { file_id: 'AgACAgIAA-medium', file_unique_id: 'ABC124', file_size: 5120, width: 320, height: 320 },
        { file_id: 'AgACAgIAA-large', file_unique_id: 'ABC125', file_size: 20480, width: 800, height: 800 }
      ],
      caption: 'Check out this image!'
    }
  },

  // Document message
  documentMessage: {
    update_id: 123456791,
    message: {
      message_id: 1003,
      from: {
        id: 987654321,
        is_bot: false,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        language_code: 'en'
      },
      chat: {
        id: 987654321,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        type: 'private'
      },
      date: 1705312802,
      document: {
        file_id: 'BQACAgIAAxkBAA-doc',
        file_unique_id: 'DOC123',
        file_name: 'report.pdf',
        mime_type: 'application/pdf',
        file_size: 102400
      },
      caption: 'Here is the report'
    }
  },

  // Callback query (button click)
  callbackQuery: {
    update_id: 123456792,
    callback_query: {
      id: 'callback-123',
      from: {
        id: 987654321,
        is_bot: false,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        language_code: 'en'
      },
      message: {
        message_id: 1000,
        from: {
          id: 123456789,
          is_bot: true,
          first_name: 'Test Bot',
          username: 'testbot'
        },
        chat: {
          id: 987654321,
          first_name: 'John',
          last_name: 'Doe',
          username: 'johndoe',
          type: 'private'
        },
        date: 1705312700,
        text: 'Please select an option:',
        reply_markup: {
          inline_keyboard: [[
            { text: 'Option A', callback_data: 'option_a' },
            { text: 'Option B', callback_data: 'option_b' }
          ]]
        }
      },
      chat_instance: 'chat-instance-123',
      data: 'option_a'
    }
  },

  // Voice message
  voiceMessage: {
    update_id: 123456793,
    message: {
      message_id: 1004,
      from: {
        id: 987654321,
        is_bot: false,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        language_code: 'en'
      },
      chat: {
        id: 987654321,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        type: 'private'
      },
      date: 1705312803,
      voice: {
        file_id: 'AwACAgIAAxkBAA-voice',
        file_unique_id: 'VOICE123',
        duration: 5,
        mime_type: 'audio/ogg',
        file_size: 15360
      }
    }
  },

  // Location message
  locationMessage: {
    update_id: 123456794,
    message: {
      message_id: 1005,
      from: {
        id: 987654321,
        is_bot: false,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        language_code: 'en'
      },
      chat: {
        id: 987654321,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        type: 'private'
      },
      date: 1705312804,
      location: {
        latitude: 40.7128,
        longitude: -74.0060
      }
    }
  },

  // Contact message
  contactMessage: {
    update_id: 123456795,
    message: {
      message_id: 1006,
      from: {
        id: 987654321,
        is_bot: false,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        language_code: 'en'
      },
      chat: {
        id: 987654321,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        type: 'private'
      },
      date: 1705312805,
      contact: {
        phone_number: '+1234567890',
        first_name: 'Jane',
        last_name: 'Smith',
        user_id: 111222333
      }
    }
  }
};

// ========================================
// WHATSAPP PAYLOAD STRUCTURES
// ========================================

const whatsappPayloads = {
  // Text message
  textMessage: {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '+1234567890',
            phone_number_id: 'PHONE_NUMBER_ID'
          },
          contacts: [{
            profile: { name: 'John Doe' },
            wa_id: '987654321'
          }],
          messages: [{
            from: '987654321',
            id: 'wamid.123456789',
            timestamp: '1705312800',
            text: { body: 'Hello, bot!' },
            type: 'text'
          }]
        },
        field: 'messages'
      }]
    }]
  },

  // Image message
  imageMessage: {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '+1234567890',
            phone_number_id: 'PHONE_NUMBER_ID'
          },
          contacts: [{
            profile: { name: 'John Doe' },
            wa_id: '987654321'
          }],
          messages: [{
            from: '987654321',
            id: 'wamid.123456790',
            timestamp: '1705312801',
            image: {
              caption: 'Check out this image!',
              mime_type: 'image/jpeg',
              sha256: 'abc123def456',
              id: 'IMAGE_ID_123'
            },
            type: 'image'
          }]
        },
        field: 'messages'
      }]
    }]
  },

  // Document message
  documentMessage: {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '+1234567890',
            phone_number_id: 'PHONE_NUMBER_ID'
          },
          contacts: [{
            profile: { name: 'John Doe' },
            wa_id: '987654321'
          }],
          messages: [{
            from: '987654321',
            id: 'wamid.123456791',
            timestamp: '1705312802',
            document: {
              caption: 'Here is the report',
              filename: 'report.pdf',
              mime_type: 'application/pdf',
              sha256: 'xyz789abc012',
              id: 'DOC_ID_123'
            },
            type: 'document'
          }]
        },
        field: 'messages'
      }]
    }]
  },

  // Interactive button reply
  interactiveButtonReply: {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '+1234567890',
            phone_number_id: 'PHONE_NUMBER_ID'
          },
          contacts: [{
            profile: { name: 'John Doe' },
            wa_id: '987654321'
          }],
          messages: [{
            from: '987654321',
            id: 'wamid.123456792',
            timestamp: '1705312803',
            interactive: {
              type: 'button_reply',
              button_reply: {
                id: 'option_a',
                title: 'Option A'
              }
            },
            type: 'interactive'
          }]
        },
        field: 'messages'
      }]
    }]
  },

  // Interactive list reply
  interactiveListReply: {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '+1234567890',
            phone_number_id: 'PHONE_NUMBER_ID'
          },
          contacts: [{
            profile: { name: 'John Doe' },
            wa_id: '987654321'
          }],
          messages: [{
            from: '987654321',
            id: 'wamid.123456793',
            timestamp: '1705312804',
            interactive: {
              type: 'list_reply',
              list_reply: {
                id: 'product_1',
                title: 'Product One',
                description: 'First product in the list'
              }
            },
            type: 'interactive'
          }]
        },
        field: 'messages'
      }]
    }]
  },

  // Location message
  locationMessage: {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '+1234567890',
            phone_number_id: 'PHONE_NUMBER_ID'
          },
          contacts: [{
            profile: { name: 'John Doe' },
            wa_id: '987654321'
          }],
          messages: [{
            from: '987654321',
            id: 'wamid.123456794',
            timestamp: '1705312805',
            location: {
              latitude: 40.7128,
              longitude: -74.0060,
              name: 'New York City',
              address: 'New York, NY, USA'
            },
            type: 'location'
          }]
        },
        field: 'messages'
      }]
    }]
  },

  // Message status update
  statusUpdate: {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '+1234567890',
            phone_number_id: 'PHONE_NUMBER_ID'
          },
          statuses: [{
            id: 'wamid.123456789',
            status: 'delivered',
            timestamp: '1705312806',
            recipient_id: '987654321'
          }]
        },
        field: 'messages'
      }]
    }]
  }
};

// ========================================
// SNAPSHOT TESTS
// ========================================

describe('Webhook Payload Snapshots', () => {

  // ----------------------------------------
  // Telegram Payloads
  // ----------------------------------------
  describe('Telegram Webhook Payloads', () => {
    it('should match snapshot for text message', () => {
      expect(telegramPayloads.textMessage).toMatchSnapshot();
    });

    it('should match snapshot for photo message', () => {
      expect(telegramPayloads.photoMessage).toMatchSnapshot();
    });

    it('should match snapshot for document message', () => {
      expect(telegramPayloads.documentMessage).toMatchSnapshot();
    });

    it('should match snapshot for callback query', () => {
      expect(telegramPayloads.callbackQuery).toMatchSnapshot();
    });

    it('should match snapshot for voice message', () => {
      expect(telegramPayloads.voiceMessage).toMatchSnapshot();
    });

    it('should match snapshot for location message', () => {
      expect(telegramPayloads.locationMessage).toMatchSnapshot();
    });

    it('should match snapshot for contact message', () => {
      expect(telegramPayloads.contactMessage).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // WhatsApp Payloads
  // ----------------------------------------
  describe('WhatsApp Webhook Payloads', () => {
    it('should match snapshot for text message', () => {
      expect(whatsappPayloads.textMessage).toMatchSnapshot();
    });

    it('should match snapshot for image message', () => {
      expect(whatsappPayloads.imageMessage).toMatchSnapshot();
    });

    it('should match snapshot for document message', () => {
      expect(whatsappPayloads.documentMessage).toMatchSnapshot();
    });

    it('should match snapshot for interactive button reply', () => {
      expect(whatsappPayloads.interactiveButtonReply).toMatchSnapshot();
    });

    it('should match snapshot for interactive list reply', () => {
      expect(whatsappPayloads.interactiveListReply).toMatchSnapshot();
    });

    it('should match snapshot for location message', () => {
      expect(whatsappPayloads.locationMessage).toMatchSnapshot();
    });

    it('should match snapshot for status update', () => {
      expect(whatsappPayloads.statusUpdate).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // Payload Structure Validation
  // ----------------------------------------
  describe('Payload Structure Validation', () => {
    describe('Telegram', () => {
      it('should have required update_id field', () => {
        expect(telegramPayloads.textMessage).toHaveProperty('update_id');
        expect(typeof telegramPayloads.textMessage.update_id).toBe('number');
      });

      it('should have message or callback_query', () => {
        const hasMessage = 'message' in telegramPayloads.textMessage;
        const hasCallback = 'callback_query' in telegramPayloads.callbackQuery;
        expect(hasMessage || hasCallback).toBe(true);
      });

      it('should have from field in message', () => {
        expect(telegramPayloads.textMessage.message).toHaveProperty('from');
        expect(telegramPayloads.textMessage.message.from).toHaveProperty('id');
      });

      it('should have chat field in message', () => {
        expect(telegramPayloads.textMessage.message).toHaveProperty('chat');
        expect(telegramPayloads.textMessage.message.chat).toHaveProperty('id');
        expect(telegramPayloads.textMessage.message.chat).toHaveProperty('type');
      });
    });

    describe('WhatsApp', () => {
      it('should have object field set to whatsapp_business_account', () => {
        expect(whatsappPayloads.textMessage.object).toBe('whatsapp_business_account');
      });

      it('should have entry array', () => {
        expect(Array.isArray(whatsappPayloads.textMessage.entry)).toBe(true);
        expect(whatsappPayloads.textMessage.entry.length).toBeGreaterThan(0);
      });

      it('should have changes array in entry', () => {
        const entry = whatsappPayloads.textMessage.entry[0];
        expect(Array.isArray(entry.changes)).toBe(true);
      });

      it('should have messaging_product set to whatsapp', () => {
        const value = whatsappPayloads.textMessage.entry[0].changes[0].value;
        expect(value.messaging_product).toBe('whatsapp');
      });

      it('should have metadata with phone info', () => {
        const value = whatsappPayloads.textMessage.entry[0].changes[0].value;
        expect(value.metadata).toHaveProperty('display_phone_number');
        expect(value.metadata).toHaveProperty('phone_number_id');
      });
    });
  });
});
