import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    maxWidth = 'max-w-xl'
}) => {
    const handleEscape = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleEscape]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div
                className="absolute inset-0"
                onClick={onClose}
            />
            <div
                className={`relative bg-white dark:bg-[#1a202c] w-full ${maxWidth} rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 z-10 flex flex-col`}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                {(title || onClose) && (
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                        {title && (
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                                {title}
                            </h3>
                        )}
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar max-h-[80vh]">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};




export default Modal;
