"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckIcon } from "../ui/icons/CheckIcon";
import { XIcon } from "../ui/icons/XIcon";

interface ConfirmationModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  isDangerous?: boolean;
  icon?: ReactNode;
  resolve?: (confirmed: boolean) => void;
}

interface ConfirmationModalContextType {
  openConfirmation: (options: Omit<ConfirmationModalState, "isOpen" | "resolve">) => Promise<boolean>;
}

const ConfirmationModalContext = createContext<ConfirmationModalContextType | null>(null);

export function ConfirmationModalProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<ConfirmationModalState>({
    isOpen: false,
    title: "",
    message: "",
  });

  const openConfirmation = useCallback(
    (options: Omit<ConfirmationModalState, "isOpen" | "resolve">): Promise<boolean> => {
      return new Promise((resolve) => {
        setModalState({
          ...options,
          isOpen: true,
          resolve,
        });
      });
    },
    []
  );

  const handleConfirm = useCallback(async () => {
    // Call old onConfirm if provided
    if (modalState.onConfirm) {
      await modalState.onConfirm();
    }
    // Resolve the promise as confirmed
    if (modalState.resolve) {
      modalState.resolve(true);
    }
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }, [modalState]);

  const handleCancel = useCallback(() => {
    // Resolve the promise as not confirmed
    if (modalState.resolve) {
      modalState.resolve(false);
    }
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }, [modalState]);

  return (
    <ConfirmationModalContext.Provider value={{ openConfirmation }}>
      {children}

      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={handleCancel}
          ></div>
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-xl z-10">
            <div className="flex items-start gap-4 mb-4">
              {modalState.icon && (
                <div className={`p-3 rounded-full ${modalState.isDangerous ? 'bg-red-100' : 'bg-primary-blue/10'}`}>
                  {modalState.icon}
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-xl font-dm-serif text-dark-text mb-2">
                  {modalState.title}
                </h3>
                <p className="text-sm font-inter text-dark-text/70">
                  {modalState.message}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 text-sm font-poppins text-dark-text/70 hover:text-dark-text border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <XIcon className="w-4 h-4" />
                {modalState.cancelText || "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-poppins text-white transition-all ${
                  modalState.isDangerous 
                    ? "bg-error-red hover:bg-error-red/90" 
                    : "bg-gradient-to-r from-primary-blue to-lavender hover:opacity-90"
                }`}
              >
                <CheckIcon className="w-4 h-4" />
                {modalState.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmationModalContext.Provider>
  );
}

export function useConfirmation() {
  const context = useContext(ConfirmationModalContext);
  if (!context) {
    throw new Error("useConfirmation must be used within a ConfirmationModalProvider");
  }
  return context;
}
