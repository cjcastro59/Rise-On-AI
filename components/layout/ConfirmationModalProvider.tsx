"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface ConfirmationModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  isDangerous?: boolean;
}

interface ConfirmationModalContextType {
  openConfirmation: (options: Omit<ConfirmationModalState, "isOpen">) => void;
}

const ConfirmationModalContext = createContext<ConfirmationModalContextType | null>(null);

export function ConfirmationModalProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<ConfirmationModalState>({
    isOpen: false,
    title: "",
    message: "",
  });

  const openConfirmation = useCallback(
    (options: Omit<ConfirmationModalState, "isOpen">) => {
      setModalState({
        ...options,
        isOpen: true,
      });
    },
    []
  );

  const handleConfirm = useCallback(async () => {
    if (modalState.onConfirm) {
      await modalState.onConfirm();
    }
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }, [modalState]);

  const handleCancel = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }, []);

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
            <h3 className="text-xl font-dm-serif text-dark-text mb-2">
              {modalState.title}
            </h3>
            <p className="text-sm font-inter text-dark-text/70 mb-6">
              {modalState.message}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-poppins text-dark-text/70 hover:text-dark-text"
              >
                {modalState.cancelText || "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-full text-sm font-poppins text-white transition-all ${
                  modalState.isDangerous 
                    ? "bg-soft-red hover:bg-soft-red/90" 
                    : "bg-primary-blue hover:bg-primary-blue/90"
                }`}
              >
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
