import { useEffect, useRef } from 'react';

interface UseModalFocusTrapOptions {
  isOpen: boolean;
  onClose?: () => void;
  preventEscape?: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Custom hook to enforce strict accessible focus trapping and Escape-to-close
 * on modal dialogs (WCAG 2.1 AA Compliance).
 * Keeps onClose in a ref so inline callbacks do not tear down and re-focus on every render,
 * and stops immediate propagation on Escape so stacked modals close one layer at a time.
 */
export function useModalFocusTrap<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  preventEscape = false,
}: UseModalFocusTrapOptions) {
  const containerRef = useRef<T | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const preventEscapeRef = useRef(preventEscape);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    preventEscapeRef.current = preventEscape;
  }, [preventEscape]);

  useEffect(() => {
    if (!isOpen) return;

    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      triggerRef.current = document.activeElement;
    }

    const container = containerRef.current;
    if (container) {
      const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusableElements.length > 0) {
        requestAnimationFrame(() => {
          focusableElements[0]?.focus();
        });
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!preventEscapeRef.current && onCloseRef.current) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          onCloseRef.current();
        }
        return;
      }

      if (e.key === 'Tab') {
        if (!container) return;
        const focusable = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !container.contains(document.activeElement)) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last || !container.contains(document.activeElement)) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        try {
          triggerRef.current.focus();
        } catch {}
      }
    };
  }, [isOpen]);

  return containerRef;
}
