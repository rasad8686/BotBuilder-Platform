import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VideoCard from '../../../components/tutorials/VideoCard';

// Wrap component with router for Link
const renderWithRouter = (component) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  );
};

const mockTutorial = {
  id: 1,
  title: 'Test Tutorial',
  category: 'getting-started',
  duration: '5:30',
  difficulty: 'Beginner',
  description: 'This is a test tutorial description',
  thumbnail: '/test-thumbnail.jpg'
};

describe('VideoCard', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      renderWithRouter(<VideoCard tutorial={mockTutorial} />);
      expect(screen.getByText('Test Tutorial')).toBeInTheDocument();
    });

    it('displays tutorial title', () => {
      renderWithRouter(<VideoCard tutorial={mockTutorial} />);
      expect(screen.getByText('Test Tutorial')).toBeInTheDocument();
    });

    it('displays tutorial description', () => {
      renderWithRouter(<VideoCard tutorial={mockTutorial} />);
      expect(screen.getByText('This is a test tutorial description')).toBeInTheDocument();
    });

    it('displays tutorial duration', () => {
      renderWithRouter(<VideoCard tutorial={mockTutorial} />);
      expect(screen.getByText('5:30')).toBeInTheDocument();
    });

    it('displays difficulty badge', () => {
      renderWithRouter(<VideoCard tutorial={mockTutorial} />);
      expect(screen.getByText('Beginner')).toBeInTheDocument();
    });

    it('displays category label', () => {
      renderWithRouter(<VideoCard tutorial={mockTutorial} />);
      expect(screen.getByText('Başlanğıc')).toBeInTheDocument();
    });
  });

  describe('Thumbnail', () => {
    it('renders thumbnail image when provided', () => {
      renderWithRouter(<VideoCard tutorial={mockTutorial} />);
      const img = screen.getByAltText('Test Tutorial');
      expect(img).toBeInTheDocument();
      expect(img.src).toContain('test-thumbnail.jpg');
    });

    it('renders placeholder when no thumbnail', () => {
      const tutorialWithoutThumb = { ...mockTutorial, thumbnail: null };
      renderWithRouter(<VideoCard tutorial={tutorialWithoutThumb} />);
      expect(screen.queryByAltText('Test Tutorial')).not.toBeInTheDocument();
    });
  });

  describe('Completed State', () => {
    it('shows checkmark when completed', () => {
      renderWithRouter(<VideoCard tutorial={mockTutorial} isCompleted={true} />);
      const checkmark = document.querySelector('.bg-green-500');
      expect(checkmark).toBeInTheDocument();
    });

    it('does not show checkmark when not completed', () => {
      renderWithRouter(<VideoCard tutorial={mockTutorial} isCompleted={false} />);
      const checkmark = document.querySelector('.bg-green-500');
      expect(checkmark).not.toBeInTheDocument();
    });
  });

  describe('Click Handling', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      renderWithRouter(<VideoCard tutorial={mockTutorial} onClick={handleClick} />);

      fireEvent.click(screen.getByText('Test Tutorial'));
      expect(handleClick).toHaveBeenCalled();
    });

    it('links to correct academy URL', () => {
      renderWithRouter(<VideoCard tutorial={mockTutorial} />);
      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).toBe('/academy/1');
    });
  });

  describe('Difficulty Colors', () => {
    it('applies green color for Beginner', () => {
      renderWithRouter(<VideoCard tutorial={mockTutorial} />);
      const badge = screen.getByText('Beginner');
      expect(badge.className).toContain('bg-green-100');
    });

    it('applies yellow color for Intermediate', () => {
      const intermediateTutorial = { ...mockTutorial, difficulty: 'Intermediate' };
      renderWithRouter(<VideoCard tutorial={intermediateTutorial} />);
      const badge = screen.getByText('Intermediate');
      expect(badge.className).toContain('bg-yellow-100');
    });

    it('applies red color for Advanced', () => {
      const advancedTutorial = { ...mockTutorial, difficulty: 'Advanced' };
      renderWithRouter(<VideoCard tutorial={advancedTutorial} />);
      const badge = screen.getByText('Advanced');
      expect(badge.className).toContain('bg-red-100');
    });
  });

  describe('Category Colors', () => {
    it('applies correct color for channels category', () => {
      const channelsTutorial = { ...mockTutorial, category: 'channels' };
      renderWithRouter(<VideoCard tutorial={channelsTutorial} />);
      const badge = screen.getByText('Kanallar');
      expect(badge.className).toContain('bg-purple-100');
    });

    it('applies correct color for ai-features category', () => {
      const aiTutorial = { ...mockTutorial, category: 'ai-features' };
      renderWithRouter(<VideoCard tutorial={aiTutorial} />);
      const badge = screen.getByText('AI Features');
      expect(badge.className).toContain('bg-indigo-100');
    });
  });

  describe('Styling', () => {
    it('has shadow effect', () => {
      renderWithRouter(<VideoCard tutorial={mockTutorial} />);
      const card = screen.getByRole('link');
      expect(card.className).toContain('shadow-md');
    });

    it('has hover scale effect', () => {
      renderWithRouter(<VideoCard tutorial={mockTutorial} />);
      const card = screen.getByRole('link');
      expect(card.className).toContain('hover:scale-[1.02]');
    });

    it('has rounded corners', () => {
      renderWithRouter(<VideoCard tutorial={mockTutorial} />);
      const card = screen.getByRole('link');
      expect(card.className).toContain('rounded-xl');
    });
  });
});
