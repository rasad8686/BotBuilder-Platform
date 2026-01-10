import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ConfirmModal,
  AlertModal
} from '../Modal';

describe('Modal Component', () => {
  // Basic Rendering
  describe('Rendering', () => {
    it('renders when open', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <ModalBody>Modal content</ModalBody>
        </Modal>
      );
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(
        <Modal isOpen={false} onClose={() => {}}>
          <ModalBody>Modal content</ModalBody>
        </Modal>
      );
      expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
    });

    it('renders with dialog role', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <ModalBody>Content</ModalBody>
        </Modal>
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal attribute', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <ModalBody>Content</ModalBody>
        </Modal>
      );
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });
  });

  // Sizes
  describe('Sizes', () => {
    it('renders small modal', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} size="sm">
          <ModalBody>Content</ModalBody>
        </Modal>
      );
      expect(screen.getByRole('dialog').className).toContain('max-w-sm');
    });

    it('renders medium modal', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} size="md">
          <ModalBody>Content</ModalBody>
        </Modal>
      );
      expect(screen.getByRole('dialog').className).toContain('max-w-lg');
    });

    it('renders large modal', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} size="lg">
          <ModalBody>Content</ModalBody>
        </Modal>
      );
      expect(screen.getByRole('dialog').className).toContain('max-w-2xl');
    });

    it('renders xl modal', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} size="xl">
          <ModalBody>Content</ModalBody>
        </Modal>
      );
      expect(screen.getByRole('dialog').className).toContain('max-w-4xl');
    });
  });

  // Close Button
  describe('Close Button', () => {
    it('shows close button by default', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <ModalBody>Content</ModalBody>
        </Modal>
      );
      expect(screen.getByRole('button', { name: /close modal/i })).toBeInTheDocument();
    });

    it('hides close button when showCloseButton is false', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} showCloseButton={false}>
          <ModalBody>Content</ModalBody>
        </Modal>
      );
      expect(screen.queryByRole('button', { name: /close modal/i })).not.toBeInTheDocument();
    });

    it('calls onClose when close button clicked', async () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          <ModalBody>Content</ModalBody>
        </Modal>
      );

      await userEvent.click(screen.getByRole('button', { name: /close modal/i }));
      expect(handleClose).toHaveBeenCalled();
    });
  });

  // Keyboard Events
  describe('Keyboard Events', () => {
    it('closes on Escape key by default', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          <ModalBody>Content</ModalBody>
        </Modal>
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalled();
    });

    it('does not close on Escape when closeOnEscape is false', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} closeOnEscape={false}>
          <ModalBody>Content</ModalBody>
        </Modal>
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  // Dark Mode
  describe('Dark Mode', () => {
    it('has dark mode classes', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <ModalBody>Content</ModalBody>
        </Modal>
      );
      expect(screen.getByRole('dialog').className).toContain('dark:bg-slate-800');
    });
  });
});

describe('Modal Sub-components', () => {
  describe('ModalHeader', () => {
    it('renders header', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <ModalHeader>
            <ModalTitle>Test Title</ModalTitle>
          </ModalHeader>
        </Modal>
      );
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });
  });

  describe('ModalTitle', () => {
    it('renders as h2', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <ModalHeader>
            <ModalTitle>Test Title</ModalTitle>
          </ModalHeader>
        </Modal>
      );
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Test Title');
    });
  });

  describe('ModalDescription', () => {
    it('renders description text', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <ModalHeader>
            <ModalTitle>Title</ModalTitle>
            <ModalDescription>This is a description</ModalDescription>
          </ModalHeader>
        </Modal>
      );
      expect(screen.getByText('This is a description')).toBeInTheDocument();
    });
  });

  describe('ModalBody', () => {
    it('renders body content', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <ModalBody>Body content here</ModalBody>
        </Modal>
      );
      expect(screen.getByText('Body content here')).toBeInTheDocument();
    });
  });

  describe('ModalFooter', () => {
    it('renders footer with buttons', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <ModalBody>Content</ModalBody>
          <ModalFooter>
            <button>Cancel</button>
            <button>Confirm</button>
          </ModalFooter>
        </Modal>
      );
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });
  });
});

describe('ConfirmModal Component', () => {
  it('renders with default props', () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
  });

  it('renders with custom title and description', () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Delete Item"
        description="This action cannot be undone."
      />
    );
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('renders cancel and confirm buttons', () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('calls onClose when cancel clicked', async () => {
    const handleClose = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        onClose={handleClose}
        onConfirm={() => {}}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(handleClose).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm clicked', async () => {
    const handleConfirm = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={handleConfirm}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(handleConfirm).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        loading={true}
      />
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders danger variant', () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        variant="danger"
      />
    );
    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    expect(confirmBtn.className).toContain('bg-red-600');
  });
});

describe('AlertModal Component', () => {
  it('renders with default props', () => {
    render(
      <AlertModal
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('Alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it('renders with custom title and description', () => {
    render(
      <AlertModal
        isOpen={true}
        onClose={() => {}}
        title="Success!"
        description="Your action was successful."
      />
    );
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Your action was successful.')).toBeInTheDocument();
  });

  it('calls onClose when OK clicked', async () => {
    const handleClose = vi.fn();
    render(
      <AlertModal
        isOpen={true}
        onClose={handleClose}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(handleClose).toHaveBeenCalled();
  });

  it('renders different variants', () => {
    const { rerender } = render(
      <AlertModal isOpen={true} onClose={() => {}} variant="success" />
    );
    expect(document.querySelector('.bg-emerald-100')).toBeInTheDocument();

    rerender(<AlertModal isOpen={true} onClose={() => {}} variant="warning" />);
    expect(document.querySelector('.bg-amber-100')).toBeInTheDocument();

    rerender(<AlertModal isOpen={true} onClose={() => {}} variant="error" />);
    expect(document.querySelector('.bg-red-100')).toBeInTheDocument();
  });
});
