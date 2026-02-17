import React from 'react';
import Modal from '../Common/Modal';
import { Partida, ComparisonItem } from '../../types';

interface VincularPartidaFormProps {
    isOpen: boolean;
    onClose: () => void;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    filteredDB: Partida[];
    onSelectPartida: (p: Partida) => void;
    currentItem?: ComparisonItem | null;
}

const VincularPartidaForm: React.FC<VincularPartidaFormProps> = ({
    isOpen,
    onClose,
    searchTerm,
    onSearchChange,
    filteredDB,
    onSelectPartida,
    currentItem
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Vincular Partida" maxWidth="max-w-2xl">
            <div className="p-8">

                <div className="mb-4">
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest opacity-60">Buscar en Base de Datos Maestra</p>
                </div>

                <div className="relative mb-6 group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por código o descripción..."
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/30 transition-all font-medium"
                        value={searchTerm}
                        onChange={e => onSearchChange(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {filteredDB.map(p => (
                        <button
                            key={p.id}
                            onClick={() => onSelectPartida(p)}
                            title={p.descripcion}
                            className="w-full text-left p-5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-primary/50 hover:bg-primary/5 transition-all flex justify-between items-center group relative overflow-hidden"
                        >
                            <div className="pr-4 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-[10px] font-mono font-black text-slate-400 group-hover:text-primary transition-colors tracking-wider uppercase">
                                        {p.codigo}
                                    </p>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded font-bold uppercase tracking-widest">{p.categoria}</span>
                                </div>
                                <p className="text-sm font-bold text-slate-800 dark:text-white leading-relaxed group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                    {p.descripcion}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="font-black text-xl text-primary">{(p.precioUnitario || 0).toFixed(2)}€</p>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-primary/70 transition-colors">Seleccionar</span>
                            </div>
                        </button>
                    ))}
                    {filteredDB.length === 0 && (
                        <div className="text-center py-16 text-slate-400 font-medium italic border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-30">manage_search</span>
                            <p className="text-sm">No se encontraron partidas...</p>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default VincularPartidaForm;
