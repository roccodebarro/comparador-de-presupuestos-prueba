import React, { useState } from 'react';

interface PartidaFormData {
    codigo: string;
    unidad: string;
    descripcion: string;
    precioUnitario: string;
    categoria: string;
}

interface PartidaFormProps {
    initialData?: PartidaFormData;
    onSubmit: (data: PartidaFormData, finalCategory: string) => Promise<void>;
    onCancel: () => void;
    availableCategories: string[];
    title: string;
    submitLabel: string;
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

    const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
    const [newCategoryInput, setNewCategoryInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const finalCategory = isAddingNewCategory ? newCategoryInput.trim() : formData.categoria;
            await onSubmit(formData, finalCategory);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
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
                <div className="space-y-2">
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

            <div className="space-y-2">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Descripción *</label>
                <textarea
                    required
                    rows={4}
                    placeholder="Detalle los materiales y mano de obra incluidos..."
                    value={formData.descripcion}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                ></textarea>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Precio Unitario (€) *</label>
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
                <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Categoría *</label>
                    <div className="flex flex-col gap-2">
                        {isAddingNewCategory ? (
                            <div className="relative group">
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Nombre de la nueva categoría"
                                    value={newCategoryInput}
                                    className="w-full pl-4 pr-10 py-3 rounded-xl border-2 border-primary bg-primary/5 text-slate-900 dark:text-white outline-none transition-all font-bold"
                                    onChange={(e) => setNewCategoryInput(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => { setIsAddingNewCategory(false); setNewCategoryInput(''); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors"
                                    title="Cancelar nueva categoría"
                                >
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
                                        if (e.target.value === 'ADD_NEW') {
                                            setIsAddingNewCategory(true);
                                            setFormData({ ...formData, categoria: '' });
                                        } else {
                                            setFormData({ ...formData, categoria: e.target.value });
                                        }
                                    }}
                                >
                                    <option value="">Seleccionar...</option>
                                    {availableCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                    <option value="ADD_NEW" className="text-primary font-black">+ Añadir nueva categoría...</option>
                                </select>
                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">expand_more</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="pt-4 flex gap-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest"
                    disabled={isSubmitting}
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    className="flex-[2] py-4 bg-primary text-white font-black rounded-2xl hover:bg-primary-dark shadow-xl shadow-primary/20 transition-all active:scale-95 text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                    disabled={isSubmitting}
                >
                    {isSubmitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    {submitLabel}
                </button>
            </div>
        </form>
    );
};

export default PartidaForm;
