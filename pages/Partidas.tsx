
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Partida } from '../types';
import { simplifyText } from '../utils/textSimilarity';
import NuevaPartidaForm from '../components/Partidas/NuevaPartidaForm';
import EditarPartidaForm from '../components/Partidas/EditarPartidaForm';

const Partidas: React.FC = () => {
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [userRole, setUserRole] = useState<string>('Técnico');

  // Estados para filtros e selección
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas las categorías');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  const [formData, setFormData] = useState({

    codigo: '',
    unidad: 'ud',
    descripcion: '',
    precioUnitario: '',
    categoria: ''
  });


  // Cargar datos al montar y suscribir a cambios en tiempo real
  useEffect(() => {
    const init = async () => {
      await fetchUserRole();
      await fetchPartidas();
    };
    init();

    // Suscripción Realtime para la tabla partidas
    const channel = supabase
      .channel('public:partidas')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'partidas' },
        (payload) => {
          console.log('Cambio detectado en partidas:', payload);
          fetchPartidas(); // Re-fetch para simplificar y asegurar consistencia
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const role = String(user.user_metadata?.role || 'Técnico').toLowerCase();
        if (role.includes('admin')) setUserRole('Administrador');
        else if (role.includes('téc') || role.includes('tec')) setUserRole('Técnico');
        else setUserRole('Técnico');
      }
    } catch (error) {
      console.error('Error fetching role:', error);
    }
  };

  const fetchPartidas = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('partidas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedPartidas: Partida[] = ((data as any[]) || []).map(p => ({
        id: p.id,
        codigo: p.codigo,
        descripcion: p.descripcion,
        categoria: p.categoria || 'General',
        unidad: p.unidad || undefined,
        precioUnitario: Number(p.precio_unitario)
      }));

      setPartidas(mappedPartidas);

      // Extraer categorías únicas
      const uniqueCategories = Array.from(new Set(mappedPartidas.map(p => p.categoria))).sort();
      setAvailableCategories(uniqueCategories);

    } catch (error: any) {
      console.error('Error fetching data:', error);
      showNotification('Error al cargar datos: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      codigo: '',
      unidad: 'ud',
      descripcion: '',
      precioUnitario: '',
      categoria: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, partida: Partida) => {
    e.stopPropagation();
    setEditingId(partida.id);
    setFormData({
      codigo: partida.codigo,
      unidad: partida.unidad || 'ud',
      descripcion: partida.descripcion,
      precioUnitario: partida.precioUnitario.toString(),
      categoria: partida.categoria
    });
    setIsModalOpen(true);
  };


  const initiateDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setItemToDelete(id);
  };

  const handleSelectToggle = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = (filteredItems: Partida[]) => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(p => p.id)));
    }
  };

  const confirmDelete = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showNotification('Sesión expirada', 'error');
      return;
    }

    if (itemToDelete) {
      // Caso eliminación individual
      if (userRole !== 'Administrador') {
        showNotification('No tiene permisos para eliminar partidas', 'error');
        return;
      }
      try {
        const { error } = await supabase.from('partidas').delete().eq('id', itemToDelete);
        if (error) throw error;

        // Log activity
        await (supabase.from('activity_log') as any).insert({
          user_id: user.id,
          action: `eliminó la partida con id "${itemToDelete}"`,
          type: 'Crítico'
        });

        showNotification('Partida eliminada correctamente');
        setItemToDelete(null);
        fetchPartidas(); // Actualizar lista
      } catch (error: any) {
        showNotification('Error al eliminar: ' + error.message, 'error');
      }
    } else if (selectedIds.size > 0) {
      // Caso eliminación masiva
      if (userRole !== 'Administrador') {
        showNotification('No tiene permisos para eliminar partidas', 'error');
        return;
      }
      try {
        const { error } = await supabase.from('partidas').delete().in('id', Array.from(selectedIds));
        if (error) throw error;

        // Log activity
        await (supabase.from('activity_log') as any).insert({
          user_id: user.id,
          action: `eliminó masivamente ${selectedIds.size} partidas`,
          type: 'Crítico'
        });

        showNotification(`${selectedIds.size} partidas eliminadas correctamente`);
        setSelectedIds(new Set());
        fetchPartidas();
      } catch (error: any) {
        showNotification('Error en eliminación masiva: ' + error.message, 'error');
      } finally {
        setShowBatchDeleteConfirm(false);
      }
    }
  };

  const handleSubmitForm = async (newData: any, finalCategory: string) => {
    if (userRole !== 'Administrador' && userRole !== 'Técnico') {
      showNotification('No tiene permisos para modificar la base de datos', 'error');
      setIsModalOpen(false);
      return;
    }

    if (!finalCategory) {
      showNotification('La categoría es obligatoria', 'error');
      return;
    }


    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showNotification('Sesión expirada', 'error');
      return;
    }

    try {
      if (editingId) {
        // UPDATE
        const { error } = await (supabase.from('partidas') as any)
          .update({

            codigo: newData.codigo,
            descripcion: newData.descripcion,
            categoria: finalCategory,
            unidad: newData.unidad,
            precio_unitario: parseFloat(newData.precioUnitario)
          })

          .eq('id', editingId);

        if (error) throw error;

        // Log activity
        await (supabase.from('activity_log') as any).insert({

          user_id: user.id,
          action: `actualizó la partida "${newData.codigo}"`,
          type: 'Info'
        });


        showNotification('Partida actualizada');
      } else {
        // INSERT/UPSERT
        // Usamos upsert con onConflict para que si el código ya existe, se actualice en lugar de duplicar
        const { error } = await (supabase.from('partidas') as any)
          .upsert({

            codigo: newData.codigo,
            descripcion: newData.descripcion,
            categoria: finalCategory,
            unidad: newData.unidad,
            precio_unitario: parseFloat(newData.precioUnitario),
            user_id: user.id
          }, {

            onConflict: 'user_id, codigo'
          });

        if (error) throw error;

        // Log activity
        await (supabase.from('activity_log') as any).insert({

          user_id: user.id,
          action: `creó/actualizó la partida "${newData.codigo}"`,
          type: 'Info'
        });


        showNotification('Partida guardada correctamente');
      }

      // Recargar datos para estar sincronizados
      await fetchPartidas();
      setIsModalOpen(false);

    } catch (error: any) {
      console.error('Error saving:', error);
      showNotification('Error al guardar: ' + error.message, 'error');
    }
  };

  // Lógica de filtrado
  const filteredPartidas = useMemo(() => {
    const simplifiedSearch = simplifyText(searchTerm);

    return partidas.filter(partida => {
      const simplifiedCodigo = simplifyText(partida.codigo);
      const simplifiedDesc = simplifyText(partida.descripcion);

      const matchesSearch =
        simplifiedCodigo.includes(simplifiedSearch) ||
        simplifiedDesc.includes(simplifiedSearch);

      const matchesCategory =
        selectedCategory === 'Todas las categorías' ||
        partida.categoria === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [partidas, searchTerm, selectedCategory]);



  // Helper para asignar colores dinámicos y consistentes
  const getCategoryColor = (category: string) => {
    if (!category) return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

    const colors = [
      'bg-blue-50 text-blue-600 border border-blue-100',
      'bg-emerald-50 text-emerald-600 border border-emerald-100',
      'bg-amber-50 text-amber-600 border border-amber-100',
      'bg-purple-50 text-purple-600 border border-purple-100',
      'bg-rose-50 text-rose-600 border border-rose-100',
      'bg-cyan-50 text-cyan-600 border border-cyan-100',
      'bg-indigo-50 text-indigo-600 border border-indigo-100',
      'bg-lime-50 text-lime-600 border border-lime-100',
      'bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100',
      'bg-orange-50 text-orange-600 border border-orange-100',
      'bg-teal-50 text-teal-600 border border-teal-100',
      'bg-violet-50 text-violet-600 border border-violet-100'
    ];

    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  return (
    <div className="p-8 fade-in relative min-h-full">
      {/* Sistema de Notificaciones Flotantes */}
      {notification && (
        <div className={`fixed top-8 right-8 z-[200] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border fade-in ${notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
          <span className="material-symbols-outlined">{notification.type === 'success' ? 'check_circle' : 'error'}</span>
          <span className="font-bold">{notification.message}</span>
        </div>
      )}

      <header className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">Mi Base de Datos</h2>
            <p className="text-slate-500 dark:text-slate-400">Gestione su catálogo maestro de precios y partidas.</p>
          </div>
          {isLoading && (
            <div className="flex items-center gap-2 text-primary font-bold bg-primary/5 px-4 py-2 rounded-lg">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span>Sincronizando...</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              placeholder="Buscar por código o nombre..."
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <select
              className="pl-3 pr-10 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option>Todas las categorías</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
          </div>
        </div>
        {(userRole === 'Administrador' || userRole === 'Técnico') && (
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && userRole === 'Administrador' && (
              <button
                onClick={() => setShowBatchDeleteConfirm(true)}
                className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-500 hover:text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 animate-in fade-in slide-in-from-right-4"
              >
                <span className="material-symbols-outlined text-lg">delete_sweep</span>
                Eliminar seleccionadas ({selectedIds.size})
              </button>
            )}
            <button
              onClick={openCreateModal}
              className="bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Nueva Partida
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="px-4 py-5 w-10">
                <div className="flex justify-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                    checked={selectedIds.size === filteredPartidas.length && filteredPartidas.length > 0}
                    onChange={() => handleSelectAll(filteredPartidas)}
                  />
                </div>
              </th>
              <th className="px-6 py-5">Código</th>
              <th className="px-6 py-5">Descripción</th>
              <th className="px-6 py-5">Categoría</th>
              <th className="px-6 py-5 text-right">P. Unitario</th>
              <th className="px-6 py-5 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredPartidas.map((item) => (
              <tr key={item.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group ${selectedIds.has(item.id) ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                <td className="px-4 py-5">
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                      checked={selectedIds.has(item.id)}
                      onChange={() => handleSelectToggle(item.id)}
                    />
                  </div>
                </td>
                <td className="px-6 py-5 font-mono text-xs text-slate-500 dark:text-slate-400 uppercase">
                  {item.codigo}
                </td>
                <td
                  className="px-6 py-5 text-sm font-bold text-slate-700 dark:text-slate-200 max-w-sm lg:max-w-xl"
                  title={item.descripcion}
                >
                  <div className="truncate mb-1">{item.descripcion}</div>
                  <div className="flex gap-2">
                    {item.unidad && (
                      <span className="text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{item.unidad}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-5">
                  <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider ${getCategoryColor(item.categoria)}`}>
                    {item.categoria}
                  </span>
                </td>
                <td className="px-6 py-5 text-sm font-black text-right whitespace-nowrap text-slate-900 dark:text-white">
                  {item.precioUnitario.toFixed(2)} €
                </td>
                <td className="px-6 py-5 text-center">
                  <div className="flex justify-center gap-1">
                    <button
                      onClick={(e) => openEditModal(e, item)}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                      title="Editar partida"
                    >
                      <span className="material-symbols-outlined text-xl">edit</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredPartidas.length === 0 && !isLoading && (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center text-slate-400">
                  <span className="material-symbols-outlined text-5xl mb-2 block">search_off</span>
                  <p className="font-medium">No se encontraron partidas</p>
                  <button
                    onClick={() => { setSearchTerm(''); setSelectedCategory('Todas las categorías'); }}
                    className="text-primary font-bold mt-2 hover:underline text-xs uppercase tracking-widest"
                  >
                    Limpiar filtros
                  </button>
                </td>
              </tr>
            )}
            {filteredPartidas.length === 0 && isLoading && (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-sm">Cargando base de datos...</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Confirmación de Borrado (Individual o Masiva) */}
      {(itemToDelete || showBatchDeleteConfirm) && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 fade-in">
          <div className="bg-white dark:bg-[#1a202c] w-full max-w-md rounded-[2rem] shadow-2xl p-8 border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-5xl">delete_forever</span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
              {itemToDelete ? '¿Eliminar Partida?' : `¿Eliminar ${selectedIds.size} Partidas?`}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">
              {itemToDelete
                ? 'Esta acción es permanente y eliminará la partida de tu base de datos maestra. No podrá ser recuperada.'
                : `Se eliminarán permanentemente las ${selectedIds.size} partidas seleccionadas. Esta acción no se puede deshacer.`}
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => { setItemToDelete(null); setShowBatchDeleteConfirm(false); }}
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-4 bg-red-500 text-white font-black rounded-2xl hover:bg-red-600 shadow-xl shadow-red-500/20 transition-all active:scale-95 text-sm uppercase tracking-widest"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modales Compartidos */}
      {!editingId ? (
        <NuevaPartidaForm
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmitForm}
          availableCategories={availableCategories}
        />
      ) : (
        <EditarPartidaForm
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmitForm}
          availableCategories={availableCategories}
          initialData={formData}
        />
      )}
    </div>
  );
};


export default Partidas;
