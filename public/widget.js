/**
 * BotBuilder Chat Widget
 * Embeddable widget script for external websites
 */
(function() {
  'use strict';

  // Prevent multiple initializations
  if (window.BotBuilderWidgetLoaded) return;
  window.BotBuilderWidgetLoaded = true;

  var config = {
    botId: null,
    serverUrl: null,
    primaryColor: '#8b5cf6',
    position: 'right',
    size: 'medium',
    welcomeMessage: 'Hello! How can I help you today?',
    botName: 'Assistant',
    botAvatar: '🤖',
    placeholder: 'Type a message...',
    offlineMessage: 'We are currently offline. Leave a message!'
  };

  var SIZES = {
    small: { width: 320, height: 400 },
    medium: { width: 380, height: 500 },
    large: { width: 420, height: 600 }
  };

  var state = {
    isOpen: false,
    messages: [],
    sessionId: null,
    isOnline: true,
    isTyping: false,
    socket: null
  };

  var elements = {};

  // Initialize widget
  function init(options) {
    if (!options || !options.botId) {
      console.error('BotBuilder Widget: botId is required');
      return;
    }

    // Merge options with config
    Object.keys(options).forEach(function(key) {
      if (config.hasOwnProperty(key)) {
        config[key] = options[key];
      }
    });

    // Detect server URL from script source
    if (!config.serverUrl) {
      var scripts = document.getElementsByTagName('script');
      for (var i = 0; i < scripts.length; i++) {
        if (scripts[i].src && scripts[i].src.indexOf('widget.js') !== -1) {
          config.serverUrl = scripts[i].src.replace('/widget.js', '');
          break;
        }
      }
    }

    // Generate session ID
    state.sessionId = localStorage.getItem('bb_session_' + config.botId);
    if (!state.sessionId) {
      state.sessionId = 'ws_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('bb_session_' + config.botId, state.sessionId);
    }

    // Load saved messages
    var savedMessages = localStorage.getItem('bb_messages_' + config.botId);
    if (savedMessages) {
      try {
        state.messages = JSON.parse(savedMessages);
      } catch (e) {
        state.messages = [];
      }
    }

    // Add welcome message if no messages
    if (state.messages.length === 0) {
      state.messages.push({
        id: 'welcome',
        type: 'bot',
        content: config.welcomeMessage,
        timestamp: new Date().toISOString()
      });
    }

    // Inject styles
    injectStyles();

    // Create widget elements
    createWidget();

    // Connect to socket
    connectSocket();
  }

  // Inject CSS styles
  function injectStyles() {
    // Try to load external stylesheet first, fallback to inline
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = config.serverUrl + '/widget.css';
    link.onerror = function() {
      // Fallback: inject style tag if CSS file not found
      injectInlineStyles();
    };
    document.head.appendChild(link);
  }

  // Fallback inline styles (used when CSP allows or CSS file missing)
  function injectInlineStyles() {
    var style = document.createElement('style');
    style.textContent = [
      '.bb-widget-container { position: fixed; bottom: 20px; z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
      '.bb-widget-container.bb-right { right: 20px; }',
      '.bb-widget-container.bb-left { left: 20px; }',
      '.bb-chat-window { background: #ffffff; border-radius: 16px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15); display: none; flex-direction: column; overflow: hidden; margin-bottom: 16px; animation: bbSlideUp 0.3s ease; }',
      '.bb-chat-window.bb-open { display: flex; }',
      '@keyframes bbSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }',
      '@keyframes bbBounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }',
      '.bb-header { padding: 16px 20px; color: white; display: flex; align-items: center; gap: 12px; }',
      '.bb-avatar { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 20px; }',
      '.bb-header-info { flex: 1; }',
      '.bb-header-name { font-weight: 600; font-size: 16px; }',
      '.bb-header-status { font-size: 12px; opacity: 0.9; }',
      '.bb-close-btn { background: rgba(255,255,255,0.2); border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; color: white; font-size: 18px; display: flex; align-items: center; justify-content: center; }',
      '.bb-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: #f9fafb; }',
      '.bb-message { display: flex; }',
      '.bb-message.bb-user { justify-content: flex-end; }',
      '.bb-message.bb-bot { justify-content: flex-start; }',
      '.bb-bubble { max-width: 80%; padding: 12px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }',
      '.bb-message.bb-user .bb-bubble { border-radius: 16px 16px 4px 16px; color: white; }',
      '.bb-message.bb-bot .bb-bubble { border-radius: 16px 16px 16px 4px; background: #ffffff; color: #1f2937; }',
      '.bb-bubble-content { font-size: 14px; line-height: 1.5; white-space: pre-wrap; }',
      '.bb-bubble-time { font-size: 10px; opacity: 0.7; margin-top: 4px; }',
      '.bb-message.bb-user .bb-bubble-time { text-align: right; }',
      '.bb-typing { display: flex; gap: 4px; padding: 12px 16px; background: #ffffff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }',
      '.bb-typing-dot { width: 8px; height: 8px; border-radius: 50%; opacity: 0.6; animation: bbBounce 1.4s ease-in-out infinite; }',
      '.bb-typing-dot:nth-child(2) { animation-delay: 0.2s; }',
      '.bb-typing-dot:nth-child(3) { animation-delay: 0.4s; }',
      '.bb-input-area { padding: 12px 16px; border-top: 1px solid #e5e7eb; background: #ffffff; display: flex; gap: 8px; align-items: center; }',
      '.bb-file-btn { background: none; border: none; cursor: pointer; font-size: 20px; padding: 4px; }',
      '.bb-input { flex: 1; padding: 10px 14px; border: 1px solid #e5e7eb; border-radius: 20px; outline: none; font-size: 14px; }',
      '.bb-send-btn { width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer; color: white; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: background 0.2s; }',
      '.bb-send-btn:disabled { background: #e5e7eb !important; cursor: default; }',
      '.bb-toggle-btn { width: 60px; height: 60px; border-radius: 50%; border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2); display: flex; align-items: center; justify-content: center; font-size: 28px; color: white; transition: transform 0.2s, box-shadow 0.2s; }',
      '.bb-toggle-btn:hover { transform: scale(1.1); box-shadow: 0 6px 25px rgba(0, 0, 0, 0.25); }',
      '.bb-widget-container.bb-right .bb-toggle-btn { margin-left: auto; }',
      '@media (max-width: 480px) { .bb-chat-window { position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100% !important; height: 100% !important; border-radius: 0; margin-bottom: 0; } .bb-widget-container { bottom: 10px; } .bb-widget-container.bb-right { right: 10px; } .bb-widget-container.bb-left { left: 10px; } }'
    ].join('\n');
    document.head.appendChild(style);
  }

  // Create widget DOM elements
  function createWidget() {
    var size = SIZES[config.size] || SIZES.medium;

    // Container
    var container = document.createElement('div');
    container.className = 'bb-widget-container bb-' + config.position;
    elements.container = container;

    // Chat window
    var chatWindow = document.createElement('div');
    chatWindow.className = 'bb-chat-window';
    chatWindow.style.width = size.width + 'px';
    chatWindow.style.height = size.height + 'px';
    elements.chatWindow = chatWindow;

    // Header
    var header = document.createElement('div');
    header.className = 'bb-header';
    header.style.backgroundColor = config.primaryColor;
    header.innerHTML = [
      '<div class="bb-avatar">' + config.botAvatar + '</div>',
      '<div class="bb-header-info">',
      '  <div class="bb-header-name">' + escapeHtml(config.botName) + '</div>',
      '  <div class="bb-header-status bb-status-text">' + (state.isOnline ? '● Online' : '○ Offline') + '</div>',
      '</div>',
      '<button class="bb-close-btn">✕</button>'
    ].join('');
    elements.header = header;
    elements.statusText = header.querySelector('.bb-status-text');

    header.querySelector('.bb-close-btn').onclick = toggleWidget;
    chatWindow.appendChild(header);

    // Messages container
    var messages = document.createElement('div');
    messages.className = 'bb-messages';
    elements.messages = messages;
    chatWindow.appendChild(messages);

    // Input area
    var inputArea = document.createElement('div');
    inputArea.className = 'bb-input-area';

    var fileBtn = document.createElement('button');
    fileBtn.className = 'bb-file-btn';
    fileBtn.innerHTML = '📎';
    fileBtn.onclick = function() { elements.fileInput.click(); };
    inputArea.appendChild(fileBtn);

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';
    fileInput.accept = 'image/*,.pdf,.doc,.docx';
    fileInput.onchange = handleFileUpload;
    elements.fileInput = fileInput;
    inputArea.appendChild(fileInput);

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'bb-input';
    input.placeholder = config.placeholder;
    input.onkeypress = function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    };
    elements.input = input;
    inputArea.appendChild(input);

    var sendBtn = document.createElement('button');
    sendBtn.className = 'bb-send-btn';
    sendBtn.style.backgroundColor = config.primaryColor;
    sendBtn.innerHTML = '➤';
    sendBtn.disabled = true;
    sendBtn.onclick = sendMessage;
    elements.sendBtn = sendBtn;
    inputArea.appendChild(sendBtn);

    input.oninput = function() {
      sendBtn.disabled = !input.value.trim();
    };

    chatWindow.appendChild(inputArea);
    container.appendChild(chatWindow);

    // Toggle button
    var toggleBtn = document.createElement('button');
    toggleBtn.className = 'bb-toggle-btn';
    toggleBtn.style.backgroundColor = config.primaryColor;
    toggleBtn.innerHTML = '💬';
    toggleBtn.onclick = toggleWidget;
    elements.toggleBtn = toggleBtn;
    container.appendChild(toggleBtn);

    document.body.appendChild(container);

    // Render initial messages
    renderMessages();
  }

  // Toggle widget open/close
  function toggleWidget() {
    state.isOpen = !state.isOpen;
    elements.chatWindow.classList.toggle('bb-open', state.isOpen);
    elements.toggleBtn.innerHTML = state.isOpen ? '✕' : '💬';

    if (state.isOpen) {
      scrollToBottom();
      elements.input.focus();
    }
  }

  // Render all messages
  function renderMessages() {
    elements.messages.innerHTML = '';

    state.messages.forEach(function(msg) {
      addMessageToDOM(msg);
    });

    scrollToBottom();
  }

  // Add single message to DOM
  function addMessageToDOM(msg) {
    var div = document.createElement('div');
    div.className = 'bb-message bb-' + msg.type;

    var bubble = document.createElement('div');
    bubble.className = 'bb-bubble';
    if (msg.type === 'user') {
      bubble.style.backgroundColor = config.primaryColor;
    }

    var content = document.createElement('div');
    content.className = 'bb-bubble-content';
    content.textContent = msg.content;
    bubble.appendChild(content);

    var time = document.createElement('div');
    time.className = 'bb-bubble-time';
    time.textContent = formatTime(msg.timestamp);
    bubble.appendChild(time);

    div.appendChild(bubble);
    elements.messages.appendChild(div);
  }

  // Show typing indicator
  function showTyping() {
    state.isTyping = true;
    var div = document.createElement('div');
    div.className = 'bb-message bb-bot';
    div.id = 'bb-typing-indicator';

    var typing = document.createElement('div');
    typing.className = 'bb-typing';
    for (var i = 0; i < 3; i++) {
      var dot = document.createElement('div');
      dot.className = 'bb-typing-dot';
      dot.style.backgroundColor = config.primaryColor;
      typing.appendChild(dot);
    }
    div.appendChild(typing);
    elements.messages.appendChild(div);
    scrollToBottom();
  }

  // Hide typing indicator
  function hideTyping() {
    state.isTyping = false;
    var indicator = document.getElementById('bb-typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  // Send message
  function sendMessage() {
    var text = elements.input.value.trim();
    if (!text) return;

    var msg = {
      id: Date.now(),
      type: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    state.messages.push(msg);
    saveMessages();
    addMessageToDOM(msg);
    scrollToBottom();

    elements.input.value = '';
    elements.sendBtn.disabled = true;

    showTyping();

    if (state.socket && state.socket.connected) {
      state.socket.emit('widget:message', {
        botId: config.botId,
        sessionId: state.sessionId,
        message: text
      });
    } else {
      // Offline mode - send via HTTP
      sendMessageHTTP(text);
    }
  }

  // Send message via HTTP (fallback)
  function sendMessageHTTP(text) {
    fetch(config.serverUrl + '/api/widget/' + config.botId + '/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.sessionId,
        message: text
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      hideTyping();
      if (data.message) {
        var msg = {
          id: Date.now(),
          type: 'bot',
          content: data.message,
          timestamp: new Date().toISOString()
        };
        state.messages.push(msg);
        saveMessages();
        addMessageToDOM(msg);
        scrollToBottom();
      }
    })
    .catch(function() {
      hideTyping();
      var msg = {
        id: Date.now(),
        type: 'bot',
        content: config.offlineMessage,
        timestamp: new Date().toISOString()
      };
      state.messages.push(msg);
      saveMessages();
      addMessageToDOM(msg);
      scrollToBottom();
    });
  }

  // Handle file upload
  function handleFileUpload(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

    var formData = new FormData();
    formData.append('file', file);
    formData.append('botId', config.botId);
    formData.append('sessionId', state.sessionId);

    fetch(config.serverUrl + '/api/widget/upload', {
      method: 'POST',
      body: formData
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        var msg = {
          id: Date.now(),
          type: 'user',
          content: '📎 ' + file.name,
          fileUrl: data.url,
          timestamp: new Date().toISOString()
        };
        state.messages.push(msg);
        saveMessages();
        addMessageToDOM(msg);
        scrollToBottom();
      }
    })
    .catch(function() {
      // Silent fail
    })
    .finally(function() {
      elements.fileInput.value = '';
    });
  }

  // Connect to Socket.IO
  function connectSocket() {
    // Load Socket.IO client from CDN (more reliable)
    var script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
    script.onload = function() {
      state.socket = io(config.serverUrl, {
        path: '/ws',
        transports: ['polling'],
        upgrade: false,
        query: { botId: config.botId, sessionId: state.sessionId }
      });

      state.socket.on('connect', function() {
        state.isOnline = true;
        updateStatus();
        state.socket.emit('widget:join', {
          botId: config.botId,
          sessionId: state.sessionId
        });
      });

      state.socket.on('disconnect', function() {
        state.isOnline = false;
        updateStatus();
      });

      state.socket.on('widget:typing', function() {
        showTyping();
      });

      state.socket.on('widget:message', function(data) {
        hideTyping();
        var msg = {
          id: Date.now(),
          type: 'bot',
          content: data.message,
          timestamp: new Date().toISOString()
        };
        state.messages.push(msg);
        saveMessages();
        addMessageToDOM(msg);
        scrollToBottom();
      });

      state.socket.on('widget:error', function() {
        hideTyping();
      });
    };
    script.onerror = function() {
      // Socket.IO not available, use HTTP fallback
      state.isOnline = true;
      updateStatus();
    };
    document.head.appendChild(script);
  }

  // Update online status display
  function updateStatus() {
    if (elements.statusText) {
      elements.statusText.textContent = state.isOnline ? '● Online' : '○ Offline';
    }
  }

  // Save messages to localStorage
  function saveMessages() {
    try {
      localStorage.setItem('bb_messages_' + config.botId, JSON.stringify(state.messages));
    } catch (e) {
      // Storage full or unavailable
    }
  }

  // Scroll messages to bottom
  function scrollToBottom() {
    if (elements.messages) {
      elements.messages.scrollTop = elements.messages.scrollHeight;
    }
  }

  // Format timestamp
  function formatTime(timestamp) {
    var date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Escape HTML
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public API
  window.bbWidget = function(action, options) {
    switch (action) {
      case 'init':
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function() { init(options); });
        } else {
          init(options);
        }
        break;
      case 'open':
        if (!state.isOpen) toggleWidget();
        break;
      case 'close':
        if (state.isOpen) toggleWidget();
        break;
      case 'toggle':
        toggleWidget();
        break;
    }
  };

  // Process queued commands
  if (window.bbWidget && window.bbWidget.q) {
    window.bbWidget.q.forEach(function(args) {
      window.bbWidget.apply(null, args);
    });
  }
})();
