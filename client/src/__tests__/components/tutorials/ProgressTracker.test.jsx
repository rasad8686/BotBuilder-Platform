import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressTracker from '../../../components/tutorials/ProgressTracker';

describe('ProgressTracker', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<ProgressTracker completed={0} total={10} />);
      expect(screen.getByText('0 / 10 tamamlandı')).toBeInTheDocument();
    });

    it('displays correct completed/total count', () => {
      render(<ProgressTracker completed={5} total={10} />);
      expect(screen.getByText('5 / 10 tamamlandı')).toBeInTheDocument();
    });

    it('displays remaining count when not complete', () => {
      render(<ProgressTracker completed={3} total={10} />);
      expect(screen.getByText('7 video qaldı')).toBeInTheDocument();
    });
  });

  describe('Percentage Calculation', () => {
    it('shows 0% when no tutorials completed', () => {
      render(<ProgressTracker completed={0} total={10} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('shows correct percentage for partial completion', () => {
      render(<ProgressTracker completed={5} total={10} />);
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('handles 0 total gracefully', () => {
      render(<ProgressTracker completed={0} total={0} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('rounds percentage correctly', () => {
      render(<ProgressTracker completed={1} total={3} />);
      expect(screen.getByText('33%')).toBeInTheDocument();
    });
  });

  describe('Completion State', () => {
    it('shows completion message when all done', () => {
      render(<ProgressTracker completed={10} total={10} />);
      expect(screen.getByText('Bütün videolar tamamlandı!')).toBeInTheDocument();
    });

    it('shows checkmark icon when complete', () => {
      render(<ProgressTracker completed={10} total={10} />);
      const svg = document.querySelector('.text-green-500 svg');
      expect(svg).toBeInTheDocument();
    });

    it('does not show percentage when complete', () => {
      render(<ProgressTracker completed={10} total={10} />);
      expect(screen.queryByText('100%')).not.toBeInTheDocument();
    });
  });

  describe('Size Props', () => {
    it('uses medium size by default', () => {
      render(<ProgressTracker completed={5} total={10} />);
      const container = document.querySelector('.w-24');
      expect(container).toBeInTheDocument();
    });

    it('applies small size when size="sm"', () => {
      render(<ProgressTracker completed={5} total={10} size="sm" />);
      const container = document.querySelector('.w-16');
      expect(container).toBeInTheDocument();
    });

    it('applies large size when size="lg"', () => {
      render(<ProgressTracker completed={5} total={10} size="lg" />);
      const container = document.querySelector('.w-32');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Certificate Badge', () => {
    it('does not show certificate by default', () => {
      render(<ProgressTracker completed={10} total={10} />);
      expect(screen.queryByText('Sertifikat')).not.toBeInTheDocument();
    });

    it('shows certificate when showCertificate=true and complete', () => {
      render(<ProgressTracker completed={10} total={10} showCertificate={true} />);
      expect(screen.getByText('Sertifikat')).toBeInTheDocument();
    });

    it('does not show certificate when incomplete even if showCertificate=true', () => {
      render(<ProgressTracker completed={5} total={10} showCertificate={true} />);
      expect(screen.queryByText('Sertifikat')).not.toBeInTheDocument();
    });
  });

  describe('SVG Progress Circle', () => {
    it('renders SVG element', () => {
      render(<ProgressTracker completed={5} total={10} />);
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('has two circle elements (background and progress)', () => {
      render(<ProgressTracker completed={5} total={10} />);
      const circles = document.querySelectorAll('circle');
      expect(circles.length).toBe(2);
    });

    it('has gradient definition', () => {
      render(<ProgressTracker completed={5} total={10} />);
      const gradient = document.querySelector('#progressGradient');
      expect(gradient).toBeInTheDocument();
    });
  });
});
