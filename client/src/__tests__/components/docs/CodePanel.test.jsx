import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CodePanel from '../../../components/docs/CodePanel';

describe('CodePanel', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<CodePanel category="getting-started" section="overview" />);
      expect(screen.getByText('cURL')).toBeInTheDocument();
    });

    it('displays language tabs', () => {
      render(<CodePanel category="getting-started" section="overview" />);
      expect(screen.getByText('cURL')).toBeInTheDocument();
      expect(screen.getByText('JavaScript')).toBeInTheDocument();
      expect(screen.getByText('Python')).toBeInTheDocument();
    });

    it('displays code content', () => {
      render(<CodePanel category="getting-started" section="overview" />);
      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument();
    });

    it('shows footer text', () => {
      render(<CodePanel category="getting-started" section="overview" />);
      expect(screen.getByText('Copy code examples to get started quickly')).toBeInTheDocument();
    });
  });

  describe('Tab Switching', () => {
    it('starts with cURL tab active', () => {
      render(<CodePanel category="getting-started" section="overview" />);
      const curlTab = screen.getByText('cURL');
      expect(curlTab.className).toContain('border-purple-500');
    });

    it('switches to JavaScript tab when clicked', () => {
      render(<CodePanel category="getting-started" section="overview" />);

      fireEvent.click(screen.getByText('JavaScript'));

      const jsTab = screen.getByText('JavaScript');
      expect(jsTab.className).toContain('border-purple-500');
    });

    it('switches to Python tab when clicked', () => {
      render(<CodePanel category="getting-started" section="overview" />);

      fireEvent.click(screen.getByText('Python'));

      const pythonTab = screen.getByText('Python');
      expect(pythonTab.className).toContain('border-purple-500');
    });
  });

  describe('Code Content', () => {
    it('displays curl code for getting-started overview', () => {
      render(<CodePanel category="getting-started" section="overview" />);
      const code = screen.getByTestId('syntax-highlighter');
      expect(code.textContent).toContain('curl');
    });

    it('displays fallback message for unknown section', () => {
      render(<CodePanel category="unknown" section="unknown" />);
      const code = screen.getByTestId('syntax-highlighter');
      expect(code.textContent).toContain('No example available');
    });

    it('changes code when tab is switched', () => {
      render(<CodePanel category="getting-started" section="overview" />);

      // Initially shows curl
      let code = screen.getByTestId('syntax-highlighter');
      expect(code.textContent).toContain('curl');

      // Switch to JavaScript
      fireEvent.click(screen.getByText('JavaScript'));

      code = screen.getByTestId('syntax-highlighter');
      expect(code.textContent).toContain('import');
    });
  });

  describe('CopyButton Integration', () => {
    it('renders copy button', () => {
      render(<CodePanel category="getting-started" section="overview" />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Different Sections', () => {
    it('displays bots create-bot code', () => {
      render(<CodePanel category="bots" section="create-bot" />);
      const code = screen.getByTestId('syntax-highlighter');
      expect(code.textContent).toContain('Create bot');
    });

    it('displays api authentication code', () => {
      render(<CodePanel category="api" section="authentication" />);
      const code = screen.getByTestId('syntax-highlighter');
      expect(code.textContent).toContain('Login');
    });

    it('displays channels telegram code', () => {
      render(<CodePanel category="channels" section="telegram" />);
      const code = screen.getByTestId('syntax-highlighter');
      expect(code.textContent).toContain('Telegram');
    });
  });

  describe('Styling', () => {
    it('has dark background', () => {
      render(<CodePanel category="getting-started" section="overview" />);
      const container = document.querySelector('[style*="background-color: rgb(30, 30, 30)"]');
      expect(container).toBeInTheDocument();
    });

    it('tabs have hover effect', () => {
      render(<CodePanel category="getting-started" section="overview" />);
      const inactiveTab = screen.getByText('Python');
      expect(inactiveTab.className).toContain('hover:text-white');
    });
  });
});
