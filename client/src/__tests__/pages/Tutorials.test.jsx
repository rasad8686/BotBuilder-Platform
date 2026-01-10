import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Tutorials from '../../pages/Tutorials';

// Mock tutorial components
vi.mock('../../components/tutorials', () => ({
  VideoCard: ({ tutorial, isCompleted, onClick }) => (
    <div data-testid={`video-card-${tutorial.id}`} onClick={onClick}>
      <span data-testid="card-title">{tutorial.title}</span>
      <span data-testid="card-completed">{isCompleted ? 'completed' : 'not-completed'}</span>
    </div>
  ),
  VideoPlayer: ({ tutorial, isCompleted, onMarkComplete }) => (
    <div data-testid="video-player">
      <span data-testid="player-title">{tutorial.title}</span>
      <button onClick={onMarkComplete} data-testid="mark-complete-btn">Mark Complete</button>
    </div>
  ),
  TutorialSidebar: ({ tutorials, currentTutorialId, completedTutorials }) => (
    <div data-testid="tutorial-sidebar">
      <span data-testid="sidebar-count">{tutorials.length}</span>
      <span data-testid="sidebar-current">{currentTutorialId}</span>
    </div>
  ),
  ProgressTracker: ({ completed, total, showCertificate }) => (
    <div data-testid="progress-tracker">
      <span data-testid="progress-completed">{completed}</span>
      <span data-testid="progress-total">{total}</span>
    </div>
  )
}));

const renderWithRouter = (initialRoute = '/academy') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/academy" element={<Tutorials />} />
        <Route path="/academy/:id" element={<Tutorials />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('Tutorials', () => {
  beforeEach(() => {
    window.localStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Grid View Rendering', () => {
    it('renders without crashing', () => {
      renderWithRouter();
      expect(screen.getByText('BotBuilder Academy')).toBeInTheDocument();
    });

    it('renders header with title', () => {
      renderWithRouter();
      expect(screen.getByText('BotBuilder Academy')).toBeInTheDocument();
    });

    it('renders description', () => {
      renderWithRouter();
      expect(screen.getByText(/Step-by-step video tutoriallarla/)).toBeInTheDocument();
    });

    it('renders ProgressTracker', () => {
      renderWithRouter();
      expect(screen.getByTestId('progress-tracker')).toBeInTheDocument();
    });

    it('renders search input', () => {
      renderWithRouter();
      expect(screen.getByPlaceholderText('Tutorial axtar...')).toBeInTheDocument();
    });

    it('renders category tabs', () => {
      renderWithRouter();
      // Use getAllByText since there are multiple "Hamısı" elements
      const allButtons = screen.getAllByText('Hamısı');
      expect(allButtons.length).toBeGreaterThan(0);
      expect(screen.getByText('Başlanğıc')).toBeInTheDocument();
      expect(screen.getByText('Kanallar')).toBeInTheDocument();
    });

    it('renders video cards', () => {
      renderWithRouter();
      expect(screen.getByTestId('video-card-1')).toBeInTheDocument();
    });

    it('shows correct tutorial count', () => {
      renderWithRouter();
      expect(screen.getByText(/8 tutorial tapıldı/)).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('filters tutorials by search query', async () => {
      renderWithRouter();

      fireEvent.change(screen.getByPlaceholderText('Tutorial axtar...'), {
        target: { value: 'Telegram' }
      });

      await waitFor(() => {
        expect(screen.getByText(/1 tutorial tapıldı/)).toBeInTheDocument();
      });
    });

    it('shows no results message when no match', async () => {
      renderWithRouter();

      fireEvent.change(screen.getByPlaceholderText('Tutorial axtar...'), {
        target: { value: 'nonexistent' }
      });

      await waitFor(() => {
        expect(screen.getByText('Tutorial tapılmadı')).toBeInTheDocument();
      });
    });

    it('shows reset button when no results', async () => {
      renderWithRouter();

      fireEvent.change(screen.getByPlaceholderText('Tutorial axtar...'), {
        target: { value: 'nonexistent' }
      });

      await waitFor(() => {
        expect(screen.getByText('Filterləri Sıfırla')).toBeInTheDocument();
      });
    });
  });

  describe('Category Filter', () => {
    it('filters by category when clicked', async () => {
      renderWithRouter();

      fireEvent.click(screen.getByText('Kanallar'));

      await waitFor(() => {
        expect(screen.getByText(/2 tutorial tapıldı/)).toBeInTheDocument();
      });
    });

    it('highlights selected category', async () => {
      renderWithRouter();

      fireEvent.click(screen.getByText('Kanallar'));

      const categoryBtn = screen.getByText('Kanallar');
      expect(categoryBtn.className).toContain('bg-purple-600');
    });
  });

  describe('Difficulty Filter', () => {
    it('has difficulty dropdown', () => {
      renderWithRouter();
      expect(screen.getByText('Səviyyə:')).toBeInTheDocument();
    });
  });

  describe('Sort Functionality', () => {
    it('has sort dropdown', () => {
      renderWithRouter();
      expect(screen.getByText('Sırala:')).toBeInTheDocument();
    });
  });

  describe('Progress Tracking', () => {
    it('loads completed tutorials from localStorage', () => {
      window.localStorage.getItem.mockImplementation((key) => {
        if (key === 'botbuilder_completed_tutorials') {
          return JSON.stringify([1, 2]);
        }
        return null;
      });

      renderWithRouter();

      expect(screen.getByTestId('progress-completed').textContent).toBe('2');
    });

    it('shows total tutorial count', () => {
      renderWithRouter();
      expect(screen.getByTestId('progress-total').textContent).toBe('8');
    });
  });

  describe('Certificate', () => {
    it('shows certificate when all tutorials complete', () => {
      window.localStorage.getItem.mockImplementation((key) => {
        if (key === 'botbuilder_completed_tutorials') {
          return JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]);
        }
        return null;
      });

      renderWithRouter();

      expect(screen.getByText('Təbrik edirik!')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('has gradient header', () => {
      renderWithRouter();
      const title = screen.getByText('BotBuilder Academy');
      expect(title.className).toContain('bg-gradient-to-r');
    });

    it('has white background container', () => {
      renderWithRouter();
      const container = document.querySelector('.bg-white');
      expect(container).toBeInTheDocument();
    });
  });
});
