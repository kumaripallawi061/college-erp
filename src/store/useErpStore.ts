import { create } from 'zustand';
import { ModuleKey } from '../types/erp';

export interface ToastNotificationItem {
  id: string;
  title: string;
  message?: string;
  description?: string;
  variant: 'success' | 'error' | 'warning' | 'info';
}

export interface ConfirmDialogRequest {
  title: string;
  message: string;
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'warning';
  requireTypedText?: string; // e.g. 'RESET' or 'DELETE'
  onConfirm: () => void | Promise<void>;
}

interface ErpUiStoreState {
  activeTab: ModuleKey | string;
  setActiveTab: (tab: ModuleKey | string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;
  isGlobalSearchOpen: boolean;
  setIsGlobalSearchOpen: (open: boolean) => void;
  globalSearchOpen: boolean;
  setGlobalSearchOpen: (open: boolean) => void;
  toasts: ToastNotificationItem[];
  pushToast: (toast: Omit<ToastNotificationItem, 'id'>) => void;
  dismissToast: (id: string) => void;
  confirmDialog: ConfirmDialogRequest | null;
  openConfirmDialog: (req: ConfirmDialogRequest) => void;
  closeConfirmDialog: () => void;
}

export const useErpStore = create<ErpUiStoreState>((set) => ({
  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebarCollapsed: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  globalSearchQuery: '',
  setGlobalSearchQuery: (query) => set({ globalSearchQuery: query }),
  isGlobalSearchOpen: false,
  setIsGlobalSearchOpen: (open) =>
    set({ isGlobalSearchOpen: open, globalSearchOpen: open }),
  globalSearchOpen: false,
  setGlobalSearchOpen: (open) =>
    set({ globalSearchOpen: open, isGlobalSearchOpen: open }),
  toasts: [],
  pushToast: (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }].slice(-5),
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4500);
  },
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  confirmDialog: null,
  openConfirmDialog: (req) => set({ confirmDialog: req }),
  closeConfirmDialog: () => set({ confirmDialog: null }),
}));
