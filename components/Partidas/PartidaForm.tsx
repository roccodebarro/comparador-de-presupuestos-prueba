import React, { useState } from 'react';

interface PartidaFormData {
    codigo: string;
    unidad: string;
    descripcion: string;
    precioUnitario: string;
    categoria: string;
}

export interface Componente {
    id: string;
    tipo: 'MO' | 'MAT' | 'MAQ' | 'CI' | 'AUX';
    codigo: string;
    resumen: string;
    unidad: string;
    precio: string;
    rendimiento: string;
}

export interface PartidaFormSubmitData extends PartidaFormData {
    componentes: Componente[];
}

interface PartidaFormProps {
    initialData?: PartidaFormData & { componentes?: Componente[] };
    onSubmit: (data: PartidaFormSubmitData, finalCategory: string) => Promise<void>;
    onCancel: () => void;
    availableCategories: string[];
    title: string;
    submitLabel: string;
}

const TIPO_LABELS: Record<Componente['tipo'], string> = {
    MO:  'Mano de Obra',
    MAT: 'Material',
    MAQ: 'Maquinaria',
    CI:  'Coste Indirecto',
    AUX: 'Auxiliar',
};

const TIPO_COLORS: Record<Componente['tipo'], string> = {
    MO:  'bg-blue-50 text-blue-700 border-blue-200',
    MAT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    MAQ: 'bg-amber-50 text-amber-700 border-amber-200',
    CI:  'bg-purple-50 text-purple-700 border-purple-200',
    AUX: 'bg-slate-50 text-slate-600 border-slate-200',
};

function newComponente(): Componente {
    return {
        id: Math.random().toString(36).slice(2),
        tipo: 'MAT',
        codigo: '',
        resumen: '',
        unidad: 'ud',
        precio: '',
        rendimiento: '',
    };
}

const PartidaForm: React.FC<PartidaFormProps> = ({
    initialData,
    onSubmit,
    onCancel,
    availableCategories,
    title,
    submitLabel
}) => {
    const [formData, setFormData] = useState<PartidaFormData>(initialData || {
        codigo: '',
        unidad: 'ud',
        descripcion: '',
        precioUnitario: '',
        categoria: ''
    });

    const [componentes, setComponentes] = useState<Componente[]>(
        initialData?.componentes || []
    );
    const [showDescomp, setShowDescomp] = useState(
        (initialData?.componentes?.length ?? 0) > 0
    );
    const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
    const [newCategoryInput, setNewCategoryInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const finalCategory = isAddingNewCategory ? newCategoryInput.trim() : formData.categoria;
            await onSubmit({ ...formData, componentes }, finalCategory);
        } finally {
            setIsSubmitting(false);
        }
    };

    const addComponente = () => setComponentes(prev => [...prev, newComponente()]);
    const removeComponente = (id: string) => setComponentes(prev => prev.filter(c => c.id !== id));
    const updateComponente = (id: string, field: keyof Componente, value: string) =>
        setComponentes(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));

    const precioCalculado = componentes.reduce((sum, c) => {
        const p = parseFloat(c.precio) || 0;
        const r = parseFloat(c.rendimiento) || 0;
        return sum + p * r;
    }, 0);

    return (
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

            {/* ── Datos principales ── */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Código *</label>
                    <input
                        type="text"
                        required
                        placeholder="Ej: EL-001"
                        value={formData.codigo}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                        onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Unidad</label>
                    <div className="relative">
                        <select
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none"
                            onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
                            value={formData.unidad}
                        >
                            <option value="ud">Unidades (ud)</option>
                            <option value="m">Metros (m)</option>
                            <option value="m2">Metros cuadrados (m2)</option>
                            <option value="m3">Metros cúbicos (m3)</option>
                            <option value="kg">Kilogramos (kg)</option>
                            <option value="h">Horas (h)</option>
                            <option value="l">Litros (l)</option>
                            <option value="p.a">Partida Alzada (p.a)</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">expand_more</span>
                    </div>
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Descripción *</label>
                <textarea
                    required
                    rows={3}
                    placeholder="Detalle los materiales y mano de obra incluidos..."
                    value={formData.descripcion}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Precio Unitario (€) *</label>
                        {componentes.length > 0 && precioCalculado > 0 && (
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, precioUnitario: precioCalculado.toFixed(2) })}
                                className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest"
                            >
                                ↑ Usar {precioCalculado.toFixed(2)}€
                            </button>
                        )}
                    </div>
                    <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={formData.precioUnitario}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                        onChange={(e) => setFormData({ ...formData, precioUnitario: e.target.value })}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Categoría *</label>
                    {isAddingNewCategory ? (
                        <div className="relative">
                            <input
                                type="text"
                                autoFocus
                                placeholder="Nueva categoría"
                                value={newCategoryInput}
                                className="w-full pl-4 pr-10 py-3 rounded-xl border-2 border-primary bg-primary/5 text-slate-900 dark:text-white outline-none font-bold"
                                onChange={(e) => setNewCategoryInput(e.target.value)}
                            />
                            <button type="button" onClick={() => { setIsAddingNewCategory(false); setNewCategoryInput(''); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500">
                                <span className="material-symbols-outlined">cancel</span>
                            </button>
                        </div>
                    ) : (
                        <div className="relative">
                            <select
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none"
                                value={formData.categoria}
                                required
                                onChange={(e) => {
                                    if (e.target.value === 'ADD_NEW') { setIsAddingNewCategory(true); setFormData({ ...formData, categoria: '' }); }
                                    else setFormData({ ...formData, categoria: e.target.value });
                                }}
                            >
                                <option value="">Seleccionar...</option>
                                {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                <option value="ADD_NEW">+ Añadir nueva categoría...</option>
                            </select>
                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">expand_more</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Descomposición de costes ── */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                <button
                    type="button"
                    onClick={() => setShowDescomp(!showDescomp)}
                    className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400 text-lg">account_tree</span>
                        <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                            Descomposición de costes
                        </span>
                        {componentes.length > 0 && (
                            <span className="text-[10px] font-black px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                                {componentes.length} comp.
                            </span>
                        )}
                    </div>
                    <span className="material-symbols-outlined text-slate-400 text-lg" style={{ transform: showDescomp ? 'rotate(180deg)' : 'none' }}>
                        expand_more
                    </span>
                </button>

                {showDescomp && (
                    <div className="p-4 space-y-3">
                        <p className="text-xs text-slate-400">
                            Mano de obra, materiales y maquinaria. Invisible en la comparativa — solo aparece al exportar BC3.
                        </p>

                        {componentes.map((comp, idx) => (
                            <div key={comp.id} className="border border-slate-100 dark:border-slate-700 rounded-xl p-4 space-y-3 bg-white dark:bg-slate-900">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-slate-400">#{idx + 1}</span>
                                        <select
                                            value={comp.tipo}
                                            onChange={e => updateComponente(comp.id, 'tipo', e.target.value)}
                                            className={`text-[10px] font-black px-2 py-1 rounded-lg border appearance-none outline-none cursor-pointer ${TIPO_COLORS[comp.tipo]}`}
                                        >
                                            {(Object.keys(TIPO_LABELS) as Componente['tipo'][]).map(t => (
                                                <option key={t} value={t}>{TIPO_LABELS[t]}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button type="button" onClick={() => removeComponente(comp.id)}
                                        className="text-slate-300 hover:text-red-500 transition-colors">
                                        <span className="material-symbols-outlined text-lg">close</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Código</label>
                                        <input type="text" placeholder="MO001" value={comp.codigo}
                                            onChange={e => updateComponente(comp.id, 'codigo', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:ring-2 focus:ring-primary/30" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unidad</label>
                                        <select value={comp.unidad} onChange={e => updateComponente(comp.id, 'unidad', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none appearance-none focus:ring-2 focus:ring-primary/30">
                                            {['ud','h','m','m2','m3','kg','l','%'].map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Descripción</label>
                                    <input type="text" placeholder="Descripción del componente" value={comp.resumen}
                                        onChange={e => updateComponente(comp.id, 'resumen', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:ring-2 focus:ring-primary/30" />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Precio (€)</label>
                                        <input type="number" step="0.0001" placeholder="0.00" value={comp.precio}
                                            onChange={e => updateComponente(comp.id, 'precio', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:ring-2 focus:ring-primary/30" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rendimiento</label>
                                        <input type="number" step="0.000001" placeholder="1.000" value={comp.rendimiento}
                                            onChange={e => updateComponente(comp.id, 'rendimiento', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:ring-2 focus:ring-primary/30" />
                                    </div>
                                </div>

                                {comp.precio && comp.rendimiento && (
                                    <div className="text-right text-[10px] font-black text-slate-400">
                                        Subtotal: <span className="text-primary">{(parseFloat(comp.precio) * parseFloat(comp.rendimiento)).toFixed(4)}€</span>
                                    </div>
                                )}
                            </div>
                        ))}

                        <button type="button" onClick={addComponente}
                            className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-400 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-lg">add</span>
                            Añadir componente
                        </button>
                    </div>
                )}
            </div>

            {/* ── Botones ── */}
            <div className="pt-2 flex gap-4">
                <button type="button" onClick={onCancel} disabled={isSubmitting}
                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest">
                    Cancelar
                </button>
                <button type="submit" disabled={isSubmitting}
                    className="flex-[2] py-4 bg-primary text-white font-black rounded-2xl hover:bg-primary-dark shadow-xl shadow-primary/20 transition-all active:scale-95 text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                    {isSubmitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {submitLabel}
                </button>
            </div>
        </form>
    );
};

export default PartidaForm;
