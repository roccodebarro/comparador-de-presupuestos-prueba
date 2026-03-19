import React, { useEffect, useCallback, useRef, useState } from 'react';
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
            // ── Ya NO bloqueamos el scroll del fondo ──────────────────────
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, handleEscape]);

    // ── Drag & Drop ────────────────────────────────────────────────────────
    const dialogRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

    // Resetear posición al abrir
    useEffect(() => {
        if (isOpen) setPosition(null);
    }, [isOpen]);

    const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        // Solo arrastrar desde el header, no desde botones
        if ((e.target as HTMLElement).closest('button')) return;
        isDragging.current = true;
        const rect = dialogRef.current?.getBoundingClientRect();
        dragStart.current = {
            x: e.clientX - (rect?.left ?? 0),
            y: e.clientY - (rect?.top ?? 0),
        };
        e.preventDefault();
    };

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            setPosition({
                x: e.clientX - dragStart.current.x,
                y: e.clientY - dragStart.current.y,
            });
        };
        const onMouseUp = () => { isDragging.current = false; };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    if (!isOpen) return null;

    // Estilo de posición: si ha sido arrastrado usa posición absoluta, si no centrado
    const dialogStyle: React.CSSProperties = position
        ? {
            position: 'fixed',
            left: position.x,
            top: position.y,
            transform: 'none',
            margin: 0,
          }
        : {};

    return createPortal(
        <>
            {/* ── Overlay muy sutil — permite ver el fondo ── */}
            <div
                className="fixed inset-0 z-[9999] bg-slate-900/20"
                onClick={onClose}
            />

            {/* ── Diálogo flotante ── */}
            <div
                ref={dialogRef}
                style={dialogStyle}
                className={`
                    fixed z-[10000] w-full ${maxWidth}
                    ${!position ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : ''}
                    bg-white/95 dark:bg-[#1a202c]/95
                    backdrop-blur-xl
                    rounded-2xl shadow-2xl shadow-slate-900/20
                    border border-slate-200/80 dark:border-slate-700/80
                    flex flex-col
                    animate-in fade-in zoom-in-95 duration-150
                `}
                role="dialog"
                aria-modal="true"
            >
                {/* Header — zona de drag */}
                {(title || onClose) && (
                    <div
                        className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center rounded-t-2xl cursor-grab active:cursor-grabbing select-none bg-white/80 dark:bg-slate-900/80"
                        onMouseDown={onMouseDown}
                    >
                        <div className="flex items-center gap-3">
                            {/* Indicador visual de que es arrastrable */}
                            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-lg">drag_indicator</span>
                            {title && (
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                                    {title}
                                </h3>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="overflow-y-auto custom-scrollbar max-h-[80vh]">
                    {children}
                </div>
            </div>
        </>,
        document.body
    );
};

export default Modal;
