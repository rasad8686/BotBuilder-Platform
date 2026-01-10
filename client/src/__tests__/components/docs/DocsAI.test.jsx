import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DocsAI from '../../../components/docs/DocsAI';

// Mock the locales
vi.mock('../../../locales/docsAI', () => ({
  translations: {
    en: {
      title: 'AI Assistant',
      powered: 'Powered by AI',
      placeholder: 'Ask a question...',
      welcome: 'Welcome! How can I help?',
      clear: 'Clear',
      export: 'Export',
      error: {
        rateLimit: 'Rate limited',
        network: 'Network error',
        api: 'API error'
      }
    }
  },
  languageFlags: {
    en: { flag: '🇺🇸', name: 'English' },
    az: { flag: '🇦🇿', name: 'Azerbaijani' }
  }
}));

describe('DocsAI', () => {
  beforeEach(() => {
    window.localStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Floating Button', () => {
    it('renders floating button', () => {
      render(<DocsAI />);
      expect(screen.getByRole('button', { name: /open ai assistant/i })).toBeInTheDocument();
    });

    it('shows AI badge on button', () => {
      render(<DocsAI />);
      expect(screen.getByText('AI')).toBeInTheDocument();
    });

    it('opens modal when clicked', async () => {
      render(<DocsAI />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /open ai assistant/i }));
      });

      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    });
  });

  describe('Modal', () => {
    it('displays welcome message when no messages', async () => {
      render(<DocsAI />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /open ai assistant/i }));
      });

      expect(screen.getByText('Welcome! How can I help?')).toBeInTheDocument();
    });

    it('shows header with title and powered by text', async () => {
      render(<DocsAI />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /open ai assistant/i }));
      });

      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
      expect(screen.getByText('Powered by AI')).toBeInTheDocument();
    });
  });

  describe('Input', () => {
    it('renders textarea input', async () => {
      render(<DocsAI />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /open ai assistant/i }));
      });

      expect(screen.getByPlaceholderText('Ask a question...')).toBeInTheDocument();
    });
  });

  describe('Language Selector', () => {
    it('shows current language flag', async () => {
      render(<DocsAI />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /open ai assistant/i }));
      });

      expect(screen.getByText('🇺🇸')).toBeInTheDocument();
    });

    it('opens language menu when clicked', async () => {
      render(<DocsAI />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /open ai assistant/i }));
      });

      await act(async () => {
        fireEvent.click(screen.getByText('🇺🇸'));
      });

      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('Azerbaijani')).toBeInTheDocument();
    });
  });

  describe('LocalStorage', () => {
    it('loads messages from localStorage', () => {
      const savedMessages = JSON.stringify([
        { role: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00Z' }
      ]);
      window.localStorage.getItem.mockImplementation((key) => {
        if (key === 'docsai_messages') return savedMessages;
        return null;
      });

      render(<DocsAI />);

      expect(window.localStorage.getItem).toHaveBeenCalledWith('docsai_messages');
    });

    it('loads language from localStorage', () => {
      window.localStorage.getItem.mockImplementation((key) => {
        if (key === 'docsai_language') return 'az';
        return null;
      });

      render(<DocsAI />);

      expect(window.localStorage.getItem).toHaveBeenCalledWith('docsai_language');
    });
  });

  describe('Styling', () => {
    it('has gradient background on button', () => {
      render(<DocsAI />);
      const button = screen.getByRole('button', { name: /open ai assistant/i });
      expect(button.style.background).toContain('linear-gradient');
    });

    it('has animation on button', () => {
      render(<DocsAI />);
      const pulseSpan = document.querySelector('.animate-ping');
      expect(pulseSpan).toBeInTheDocument();
    });
  });
});
