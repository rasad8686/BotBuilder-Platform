import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CopyButton from '../../../components/docs/CopyButton';

describe('CopyButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<CopyButton text="test" />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders copy icon initially', () => {
      render(<CopyButton text="test" />);
      const button = screen.getByRole('button');
      expect(button.querySelector('svg')).toBeInTheDocument();
    });

    it('has correct initial title', () => {
      render(<CopyButton text="test" />);
      expect(screen.getByTitle('Copy to clipboard')).toBeInTheDocument();
    });
  });

  describe('Copy Functionality', () => {
    it('copies text to clipboard when clicked', async () => {
      const textToCopy = 'Hello World';
      render(<CopyButton text={textToCopy} />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(textToCopy);
    });

    it('shows copied state after clicking', async () => {
      render(<CopyButton text="test" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(screen.getByTitle('Copied!')).toBeInTheDocument();
    });

    it('shows checkmark icon after copying', async () => {
      render(<CopyButton text="test" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      const svg = screen.getByRole('button').querySelector('svg');
      expect(svg.getAttribute('class')).toContain('text-green-400');
    });
  });

  describe('Error Handling', () => {
    it('handles clipboard error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Clipboard error'));

      render(<CopyButton text="test" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalled();
      });
      consoleError.mockRestore();
    });
  });

  describe('Styling', () => {
    it('has hover styles', () => {
      render(<CopyButton text="test" />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('hover:bg-gray-700');
    });

    it('has transition effect', () => {
      render(<CopyButton text="test" />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('transition-colors');
    });

    it('has padding', () => {
      render(<CopyButton text="test" />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('p-2');
    });
  });
});
