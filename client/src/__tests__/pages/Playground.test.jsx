import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Playground from '../../pages/Playground';

// Mock child components
vi.mock('../../components/playground/EndpointSelector', () => ({
  default: ({ selectedEndpoint, onSelect }) => (
    <div data-testid="endpoint-selector">
      <button
        onClick={() => onSelect({ method: 'GET', path: '/api/bots', name: 'List Bots' })}
        data-testid="select-get-bots"
      >
        Select GET /api/bots
      </button>
      <span data-testid="selected-endpoint">{selectedEndpoint?.path || 'none'}</span>
    </div>
  )
}));

vi.mock('../../components/playground/RequestBuilder', () => ({
  default: ({ endpoint, isLoading, onSend, apiKey, useTestKey, onApiKeyChange, onUseTestKeyChange }) => (
    <div data-testid="request-builder">
      <span data-testid="builder-endpoint">{endpoint?.path || 'none'}</span>
      <span data-testid="is-loading">{isLoading ? 'loading' : 'idle'}</span>
      <button onClick={onSend} data-testid="send-btn">Send</button>
      <input
        data-testid="api-key-input"
        value={apiKey}
        onChange={(e) => onApiKeyChange(e.target.value)}
      />
      <input
        type="checkbox"
        data-testid="use-test-key"
        checked={useTestKey}
        onChange={(e) => onUseTestKeyChange(e.target.checked)}
      />
    </div>
  )
}));

vi.mock('../../components/playground/ResponseViewer', () => ({
  default: ({ response, responseTime, error, history }) => (
    <div data-testid="response-viewer">
      <span data-testid="response-status">{response?.status || 'no-response'}</span>
      <span data-testid="response-time">{responseTime || 0}</span>
      <span data-testid="error">{error || 'no-error'}</span>
      <span data-testid="history-count">{history.length}</span>
    </div>
  )
}));

const renderWithRouter = (component) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  );
};

describe('Playground', () => {
  beforeEach(() => {
    window.localStorage.getItem.mockReturnValue(null);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      renderWithRouter(<Playground />);
      expect(screen.getByText('API Playground')).toBeInTheDocument();
    });

    it('renders header with title', () => {
      renderWithRouter(<Playground />);
      expect(screen.getByText('API Playground')).toBeInTheDocument();
    });

    it('renders header description', () => {
      renderWithRouter(<Playground />);
      expect(screen.getByText('Test and explore the API endpoints interactively')).toBeInTheDocument();
    });

    it('renders EndpointSelector', () => {
      renderWithRouter(<Playground />);
      expect(screen.getByTestId('endpoint-selector')).toBeInTheDocument();
    });

    it('renders RequestBuilder', () => {
      renderWithRouter(<Playground />);
      expect(screen.getByTestId('request-builder')).toBeInTheDocument();
    });

    it('renders ResponseViewer', () => {
      renderWithRouter(<Playground />);
      expect(screen.getByTestId('response-viewer')).toBeInTheDocument();
    });

    it('renders API Docs link', () => {
      renderWithRouter(<Playground />);
      expect(screen.getByText('API Docs')).toBeInTheDocument();
    });
  });

  describe('Endpoint Selection', () => {
    it('starts with no endpoint selected', () => {
      renderWithRouter(<Playground />);
      expect(screen.getByTestId('selected-endpoint').textContent).toBe('none');
    });

    it('updates selected endpoint when onSelect is called', () => {
      renderWithRouter(<Playground />);
      fireEvent.click(screen.getByTestId('select-get-bots'));
      expect(screen.getByTestId('selected-endpoint').textContent).toBe('/api/bots');
    });

    it('passes selected endpoint to RequestBuilder', () => {
      renderWithRouter(<Playground />);
      fireEvent.click(screen.getByTestId('select-get-bots'));
      expect(screen.getByTestId('builder-endpoint').textContent).toBe('/api/bots');
    });
  });

  describe('API Key Management', () => {
    it('starts with empty API key', () => {
      renderWithRouter(<Playground />);
      expect(screen.getByTestId('api-key-input').value).toBe('');
    });

    it('updates API key when changed', () => {
      renderWithRouter(<Playground />);
      fireEvent.change(screen.getByTestId('api-key-input'), { target: { value: 'my-api-key' } });
      expect(screen.getByTestId('api-key-input').value).toBe('my-api-key');
    });

    it('starts with useTestKey unchecked', () => {
      renderWithRouter(<Playground />);
      expect(screen.getByTestId('use-test-key').checked).toBe(false);
    });

    it('toggles useTestKey when clicked', () => {
      renderWithRouter(<Playground />);
      fireEvent.click(screen.getByTestId('use-test-key'));
      expect(screen.getByTestId('use-test-key').checked).toBe(true);
    });
  });

  describe('Request Sending', () => {
    it('starts in idle state', () => {
      renderWithRouter(<Playground />);
      expect(screen.getByTestId('is-loading').textContent).toBe('idle');
    });

    it('does not send request when no endpoint selected', () => {
      renderWithRouter(<Playground />);
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Response Display', () => {
    it('shows no-response initially', () => {
      renderWithRouter(<Playground />);
      expect(screen.getByTestId('response-status').textContent).toBe('no-response');
    });

    it('shows no-error initially', () => {
      renderWithRouter(<Playground />);
      expect(screen.getByTestId('error').textContent).toBe('no-error');
    });

    it('shows empty history initially', () => {
      renderWithRouter(<Playground />);
      expect(screen.getByTestId('history-count').textContent).toBe('0');
    });
  });

  describe('History', () => {
    it('loads history from localStorage on mount', () => {
      window.localStorage.getItem.mockImplementation((key) => {
        if (key === 'playground_history') {
          return JSON.stringify([{ endpoint: { path: '/test' }, response: { status: 200 } }]);
        }
        return null;
      });

      renderWithRouter(<Playground />);
      expect(window.localStorage.getItem).toHaveBeenCalledWith('playground_history');
    });
  });

  describe('Layout', () => {
    it('has full screen height', () => {
      renderWithRouter(<Playground />);
      const container = document.querySelector('.h-screen');
      expect(container).toBeInTheDocument();
    });

    it('has flex layout', () => {
      renderWithRouter(<Playground />);
      const container = document.querySelector('.flex');
      expect(container).toBeInTheDocument();
    });

    it('has dark background', () => {
      renderWithRouter(<Playground />);
      const container = document.querySelector('.bg-gray-900');
      expect(container).toBeInTheDocument();
    });
  });
});
