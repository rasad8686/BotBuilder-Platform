/**
 * BotBuilder Ticket Widget
 * Embeddable support ticket widget for customer websites
 *
 * Usage:
 * <script src="https://your-domain.com/ticket-widget.js"></script>
 * <script>
 *   BotBuilderTicketWidget.init({
 *     workspaceId: 'your-workspace-id',
 *     position: 'bottom-right',
 *     primaryColor: '#7c3aed'
 *   });
 * </script>
 */

(function(window, document) {
  'use strict';

  // Prevent multiple initializations
  if (window.BotBuilderTicketWidget && window.BotBuilderTicketWidget._initialized) {
    console.warn('BotBuilder Ticket Widget is already initialized');
    return;
  }

  // Configuration
  const DEFAULT_CONFIG = {
    workspaceId: null,
    apiEndpoint: '/api/public/tickets',
    position: 'bottom-right', // bottom-right, bottom-left, top-right, top-left
    primaryColor: '#7c3aed',
    buttonText: 'Support',
    showIcon: true,
    zIndex: 999999,
    locale: 'en',
  };

  // State
  let config = { ...DEFAULT_CONFIG };
  let isOpen = false;
  let isMinimized = false;
  let portalConfig = null;
  let container = null;

  // Styles
  const STYLES = `
    .bb-ticket-widget {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      box-sizing: border-box;
    }
    .bb-ticket-widget *, .bb-ticket-widget *::before, .bb-ticket-widget *::after {
      box-sizing: border-box;
    }
    .bb-ticket-widget-button {
      position: fixed;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 20px;
      border: none;
      border-radius: 28px;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      transition: all 0.2s ease;
    }
    .bb-ticket-widget-button:hover {
      transform: scale(1.05);
      box-shadow: 0 8px 25px rgba(0,0,0,0.25);
    }
    .bb-ticket-widget-button svg {
      width: 20px;
      height: 20px;
    }
    .bb-ticket-widget-modal {
      position: fixed;
      width: 380px;
      max-width: calc(100vw - 40px);
      max-height: calc(100vh - 100px);
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: bb-slide-up 0.2s ease;
    }
    @keyframes bb-slide-up {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .bb-ticket-widget-header {
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #fff;
    }
    .bb-ticket-widget-header-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .bb-ticket-widget-logo {
      width: 36px;
      height: 36px;
      background: rgba(255,255,255,0.2);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bb-ticket-widget-title {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
    }
    .bb-ticket-widget-subtitle {
      font-size: 12px;
      opacity: 0.9;
      margin: 0;
    }
    .bb-ticket-widget-header-actions {
      display: flex;
      gap: 4px;
    }
    .bb-ticket-widget-header-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.1);
      border: none;
      border-radius: 8px;
      color: #fff;
      cursor: pointer;
      transition: background 0.2s;
    }
    .bb-ticket-widget-header-btn:hover {
      background: rgba(255,255,255,0.2);
    }
    .bb-ticket-widget-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }
    .bb-ticket-widget-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .bb-ticket-widget-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .bb-ticket-widget-label {
      font-size: 13px;
      font-weight: 500;
      color: #374151;
    }
    .bb-ticket-widget-input,
    .bb-ticket-widget-select,
    .bb-ticket-widget-textarea {
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }
    .bb-ticket-widget-input:focus,
    .bb-ticket-widget-select:focus,
    .bb-ticket-widget-textarea:focus {
      border-color: var(--bb-primary-color);
    }
    .bb-ticket-widget-textarea {
      min-height: 80px;
      resize: vertical;
    }
    .bb-ticket-widget-error {
      font-size: 12px;
      color: #ef4444;
    }
    .bb-ticket-widget-submit {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 20px;
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .bb-ticket-widget-submit:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    .bb-ticket-widget-submit svg {
      width: 16px;
      height: 16px;
    }
    .bb-ticket-widget-success {
      text-align: center;
      padding: 20px 0;
    }
    .bb-ticket-widget-success-icon {
      width: 64px;
      height: 64px;
      background: #ecfdf5;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #10b981;
      margin: 0 auto 16px;
    }
    .bb-ticket-widget-success-title {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      margin: 0 0 8px;
    }
    .bb-ticket-widget-success-text {
      font-size: 14px;
      color: #6b7280;
      margin: 0 0 24px;
    }
    .bb-ticket-widget-success-btn {
      padding: 12px 20px;
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 8px;
      width: 100%;
    }
    .bb-ticket-widget-close-btn {
      padding: 12px 20px;
      background: transparent;
      border: none;
      color: #6b7280;
      font-size: 14px;
      cursor: pointer;
      width: 100%;
    }
    .bb-ticket-widget-footer {
      padding: 12px 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
    }
    .bb-ticket-widget-footer-text {
      font-size: 11px;
      color: #9ca3af;
      margin: 0;
    }
    .bb-ticket-widget-footer-text a {
      color: var(--bb-primary-color);
      text-decoration: none;
    }
    .bb-ticket-widget-minimized {
      position: fixed;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 24px;
      color: #fff;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .bb-ticket-widget-minimized span {
      font-size: 14px;
      font-weight: 500;
    }
    .bb-ticket-widget-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: bb-spin 1s linear infinite;
    }
    @keyframes bb-spin {
      to { transform: rotate(360deg); }
    }
    @media (max-width: 480px) {
      .bb-ticket-widget-modal {
        width: calc(100vw - 20px);
        max-height: calc(100vh - 80px);
        border-radius: 12px;
      }
    }
  `;

  // Icons
  const ICONS = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    minimize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    chevronUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>',
  };

  // Helper functions
  function createElement(tag, className, innerHTML) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
  }

  function getPositionStyles(position) {
    const positions = {
      'bottom-right': { bottom: '20px', right: '20px' },
      'bottom-left': { bottom: '20px', left: '20px' },
      'top-right': { top: '20px', right: '20px' },
      'top-left': { top: '20px', left: '20px' },
    };
    return positions[position] || positions['bottom-right'];
  }

  function applyPositionStyles(element, position) {
    const styles = getPositionStyles(position);
    Object.assign(element.style, styles);
  }

  // Initialize styles
  function initStyles() {
    if (document.getElementById('bb-ticket-widget-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'bb-ticket-widget-styles';
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);
  }

  // Load portal config
  async function loadConfig() {
    try {
      const response = await fetch(`${config.apiEndpoint}/widget/${config.workspaceId}/config`);
      if (response.ok) {
        portalConfig = await response.json();
      }
    } catch (error) {
      console.error('Failed to load widget config:', error);
    }
  }

  // Create button
  function createButton() {
    const button = createElement('button', 'bb-ticket-widget-button');
    button.style.backgroundColor = config.primaryColor;
    button.style.zIndex = config.zIndex;
    applyPositionStyles(button, config.position);

    if (config.showIcon) {
      button.innerHTML = ICONS.chat;
    }
    if (config.buttonText) {
      const text = createElement('span');
      text.textContent = config.buttonText;
      button.appendChild(text);
    }

    button.addEventListener('click', open);
    return button;
  }

  // Create modal
  function createModal() {
    const modal = createElement('div', 'bb-ticket-widget-modal');
    modal.style.setProperty('--bb-primary-color', config.primaryColor);
    modal.style.zIndex = config.zIndex + 1;
    applyPositionStyles(modal, config.position);

    // Header
    const header = createElement('div', 'bb-ticket-widget-header');
    header.style.backgroundColor = config.primaryColor;
    header.innerHTML = `
      <div class="bb-ticket-widget-header-content">
        <div class="bb-ticket-widget-logo">${ICONS.chat}</div>
        <div>
          <h3 class="bb-ticket-widget-title">${portalConfig?.name || 'Support'}</h3>
          <p class="bb-ticket-widget-subtitle">How can we help?</p>
        </div>
      </div>
      <div class="bb-ticket-widget-header-actions">
        <button class="bb-ticket-widget-header-btn" data-action="minimize" title="Minimize">${ICONS.minimize}</button>
        <button class="bb-ticket-widget-header-btn" data-action="close" title="Close">${ICONS.close}</button>
      </div>
    `;

    // Body
    const body = createElement('div', 'bb-ticket-widget-body');
    body.appendChild(createForm());

    // Footer
    const footer = createElement('div', 'bb-ticket-widget-footer');
    footer.innerHTML = `
      <p class="bb-ticket-widget-footer-text">
        Powered by <a href="https://botbuilder.app" target="_blank" rel="noopener noreferrer">BotBuilder</a>
      </p>
    `;

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);

    // Event listeners
    modal.querySelector('[data-action="minimize"]').addEventListener('click', minimize);
    modal.querySelector('[data-action="close"]').addEventListener('click', close);

    return modal;
  }

  // Create form
  function createForm() {
    const form = createElement('form', 'bb-ticket-widget-form');

    const categories = portalConfig?.categories || [
      { id: 'general', name: 'General' },
      { id: 'technical', name: 'Technical' },
      { id: 'billing', name: 'Billing' },
      { id: 'other', name: 'Other' },
    ];

    form.innerHTML = `
      <div class="bb-ticket-widget-field">
        <label class="bb-ticket-widget-label">Name</label>
        <input type="text" name="name" class="bb-ticket-widget-input" placeholder="Your name" required>
      </div>
      <div class="bb-ticket-widget-field">
        <label class="bb-ticket-widget-label">Email</label>
        <input type="email" name="email" class="bb-ticket-widget-input" placeholder="you@example.com" required>
      </div>
      <div class="bb-ticket-widget-field">
        <label class="bb-ticket-widget-label">Subject</label>
        <input type="text" name="subject" class="bb-ticket-widget-input" placeholder="Brief description" required>
      </div>
      <div class="bb-ticket-widget-field">
        <label class="bb-ticket-widget-label">Category</label>
        <select name="category" class="bb-ticket-widget-select">
          <option value="">Select a category</option>
          ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="bb-ticket-widget-field">
        <label class="bb-ticket-widget-label">Message</label>
        <textarea name="message" class="bb-ticket-widget-textarea" placeholder="How can we help you?" required></textarea>
      </div>
      <button type="submit" class="bb-ticket-widget-submit" style="background-color: ${config.primaryColor}">
        ${ICONS.send}
        <span>Submit Ticket</span>
      </button>
    `;

    form.addEventListener('submit', handleSubmit);
    return form;
  }

  // Create success view
  function createSuccessView(ticketNumber) {
    const view = createElement('div', 'bb-ticket-widget-success');
    view.innerHTML = `
      <div class="bb-ticket-widget-success-icon">${ICONS.check}</div>
      <h4 class="bb-ticket-widget-success-title">Thank you!</h4>
      <p class="bb-ticket-widget-success-text">Your ticket #${ticketNumber} has been submitted. We'll get back to you soon.</p>
      <button class="bb-ticket-widget-success-btn" style="background-color: ${config.primaryColor}">Submit Another Ticket</button>
      <button class="bb-ticket-widget-close-btn">Close</button>
    `;

    view.querySelector('.bb-ticket-widget-success-btn').addEventListener('click', () => {
      const body = container.querySelector('.bb-ticket-widget-body');
      body.innerHTML = '';
      body.appendChild(createForm());
    });

    view.querySelector('.bb-ticket-widget-close-btn').addEventListener('click', close);

    return view;
  }

  // Handle form submit
  async function handleSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('.bb-ticket-widget-submit');
    const formData = new FormData(form);

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="bb-ticket-widget-spinner"></div><span>Submitting...</span>';

    try {
      const response = await fetch(`${config.apiEndpoint}/widget/${config.workspaceId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          subject: formData.get('subject'),
          category: formData.get('category'),
          description: formData.get('message'),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit ticket');
      }

      const data = await response.json();
      const body = container.querySelector('.bb-ticket-widget-body');
      body.innerHTML = '';
      body.appendChild(createSuccessView(data.ticket.number));

      // Emit event
      window.dispatchEvent(new CustomEvent('bb-ticket-submitted', { detail: data.ticket }));
    } catch (error) {
      console.error('Ticket submission error:', error);
      alert('Failed to submit ticket. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `${ICONS.send}<span>Submit Ticket</span>`;
    }
  }

  // Create minimized bar
  function createMinimizedBar() {
    const bar = createElement('div', 'bb-ticket-widget-minimized');
    bar.style.backgroundColor = config.primaryColor;
    bar.style.zIndex = config.zIndex;
    applyPositionStyles(bar, config.position);
    bar.innerHTML = `
      ${ICONS.chat}
      <span>Continue with support</span>
      ${ICONS.chevronUp}
    `;
    bar.addEventListener('click', restore);
    return bar;
  }

  // Public methods
  function init(userConfig) {
    if (!userConfig.workspaceId) {
      console.error('BotBuilder Ticket Widget: workspaceId is required');
      return;
    }

    config = { ...DEFAULT_CONFIG, ...userConfig };

    initStyles();

    loadConfig().then(() => {
      render();
    });

    window.BotBuilderTicketWidget._initialized = true;
  }

  function render() {
    if (container) {
      container.remove();
    }

    container = createElement('div', 'bb-ticket-widget');
    container.appendChild(createButton());
    document.body.appendChild(container);
  }

  function open() {
    if (isOpen) return;
    isOpen = true;

    container.innerHTML = '';
    container.appendChild(createModal());
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    isMinimized = false;

    container.innerHTML = '';
    container.appendChild(createButton());
  }

  function minimize() {
    if (!isOpen || isMinimized) return;
    isMinimized = true;

    container.innerHTML = '';
    container.appendChild(createMinimizedBar());
  }

  function restore() {
    if (!isMinimized) return;
    isMinimized = false;

    container.innerHTML = '';
    container.appendChild(createModal());
  }

  function destroy() {
    if (container) {
      container.remove();
      container = null;
    }
    isOpen = false;
    isMinimized = false;
    window.BotBuilderTicketWidget._initialized = false;
  }

  // Expose API
  window.BotBuilderTicketWidget = {
    init,
    open,
    close,
    minimize,
    restore,
    destroy,
    _initialized: false,
  };

})(window, document);
