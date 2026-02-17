
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
                    <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 border border-red-100">
                        <div className="flex items-center gap-4 mb-6 text-red-600">
                            <span className="material-symbols-outlined text-4xl">bug_report</span>
                            <h1 className="text-2xl font-black">¡Oops! Algo salió mal</h1>
                        </div>
                        <p className="text-slate-600 mb-4">Se ha producido un error inesperado en la aplicación.</p>

                        <div className="bg-slate-900 rounded-xl p-6 overflow-auto max-h-64 mb-6">
                            <code className="text-red-300 font-mono text-xs">
                                {this.state.error?.toString()}
                            </code>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => window.location.assign('/')}
                                className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                            >
                                Volver al Inicio
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors"
                            >
                                Recargar Página
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
