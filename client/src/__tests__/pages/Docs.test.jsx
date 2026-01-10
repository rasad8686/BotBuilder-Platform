import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Docs from '../../pages/Docs';

// Mock child components
vi.mock('../../components/docs/DocsSidebar', () => ({
  default: ({ activeCategory, activeSection, onCategoryChange, onSectionChange }) => (
    <div data-testid="docs-sidebar">
      <button onClick={() => onCategoryChange('bots')}>Change Category</button>
      <button onClick={() => onSectionChange('create-bot')}>Change Section</button>
      <span data-testid="active-category">{activeCategory}</span>
      <span data-testid="active-section">{activeSection}</span>
    </div>
  )
}));

vi.mock('../../components/docs/DocsContent', () => ({
  default: ({ category, section, onPrevious, onNext }) => (
    <div data-testid="docs-content">
      <span data-testid="category-title">{category?.title}</span>
      <span data-testid="section-title">{section?.title}</span>
      <button onClick={onPrevious} data-testid="prev-btn">Previous</button>
      <button onClick={onNext} data-testid="next-btn">Next</button>
    </div>
  )
}));

vi.mock('../../components/docs/CodePanel', () => ({
  default: ({ category, section }) => (
    <div data-testid="code-panel">
      <span data-testid="code-category">{category}</span>
      <span data-testid="code-section">{section}</span>
    </div>
  )
}));

vi.mock('../../components/docs/DocsAI', () => ({
  default: () => <div data-testid="docs-ai">DocsAI</div>
}));

const renderWithRouter = (component) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  );
};

describe('Docs', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      renderWithRouter(<Docs />);
      expect(screen.getByTestId('docs-sidebar')).toBeInTheDocument();
    });

    it('renders DocsSidebar component', () => {
      renderWithRouter(<Docs />);
      expect(screen.getByTestId('docs-sidebar')).toBeInTheDocument();
    });

    it('renders DocsContent component', () => {
      renderWithRouter(<Docs />);
      expect(screen.getByTestId('docs-content')).toBeInTheDocument();
    });

    it('renders CodePanel component', () => {
      renderWithRouter(<Docs />);
      const codePanels = screen.getAllByTestId('code-panel');
      expect(codePanels.length).toBeGreaterThan(0);
    });

    it('renders DocsAI component', () => {
      renderWithRouter(<Docs />);
      expect(screen.getByTestId('docs-ai')).toBeInTheDocument();
    });
  });

  describe('Initial State', () => {
    it('starts with getting-started category', () => {
      renderWithRouter(<Docs />);
      expect(screen.getByTestId('active-category').textContent).toBe('getting-started');
    });

    it('starts with overview section', () => {
      renderWithRouter(<Docs />);
      expect(screen.getByTestId('active-section').textContent).toBe('overview');
    });

    it('displays Getting Started title', () => {
      renderWithRouter(<Docs />);
      expect(screen.getByTestId('category-title').textContent).toBe('Getting Started');
    });
  });

  describe('Category Navigation', () => {
    it('changes category when onCategoryChange is called', () => {
      renderWithRouter(<Docs />);

      fireEvent.click(screen.getByText('Change Category'));

      expect(screen.getByTestId('active-category').textContent).toBe('bots');
    });

    it('updates CodePanel category prop', () => {
      renderWithRouter(<Docs />);

      fireEvent.click(screen.getByText('Change Category'));

      const codePanels = screen.getAllByTestId('code-category');
      expect(codePanels[0].textContent).toBe('bots');
    });
  });

  describe('Section Navigation', () => {
    it('changes section when onSectionChange is called', () => {
      renderWithRouter(<Docs />);

      // First change category to bots
      fireEvent.click(screen.getByText('Change Category'));

      // Then change section
      fireEvent.click(screen.getByText('Change Section'));

      expect(screen.getByTestId('active-section').textContent).toBe('create-bot');
    });
  });

  describe('Previous/Next Navigation', () => {
    it('navigates to next section', () => {
      renderWithRouter(<Docs />);

      fireEvent.click(screen.getByTestId('next-btn'));

      // Should move from overview to quickstart
      expect(screen.getByTestId('active-section').textContent).toBe('quickstart');
    });

    it('navigates to previous section', () => {
      renderWithRouter(<Docs />);

      // First go to next
      fireEvent.click(screen.getByTestId('next-btn'));

      // Then go back
      fireEvent.click(screen.getByTestId('prev-btn'));

      expect(screen.getByTestId('active-section').textContent).toBe('overview');
    });
  });

  describe('Mobile Menu Button', () => {
    it('renders mobile menu button', () => {
      renderWithRouter(<Docs />);
      const mobileButton = document.querySelector('.lg\\:hidden');
      expect(mobileButton).toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('has flex layout', () => {
      renderWithRouter(<Docs />);
      const mainContainer = document.querySelector('.flex');
      expect(mainContainer).toBeInTheDocument();
    });

    it('has min-h-screen', () => {
      renderWithRouter(<Docs />);
      const container = document.querySelector('.min-h-screen');
      expect(container).toBeInTheDocument();
    });
  });
});
