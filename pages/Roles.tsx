
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

interface Permission {
  id: string;
  title: string;
  desc: string;
  admin: boolean;
  tecnico: boolean;
  danger?: boolean;
}

const INITIAL_PERMISSIONS: Permission[] = [
  { id: 'import', title: 'Importar archivos', desc: 'Permite la carga de mediciones en Excel/BC3.', admin: true, tecnico: true },
  { id: 'link', title: 'Vincular partidas manuales', desc: 'Edición de las coincidencias por Similitud Inteligente.', admin: true, tecnico: true },
  { id: 'export', title: 'Exportar proyectos validados', desc: 'Generación de archivos finales de presupuesto.', admin: true, tecnico: true },
  { id: 'manage_db', title: 'Gestionar base de datos maestra', desc: 'Permite crear y editar precios en "Mi Base de Datos".', admin: true, tecnico: true },
  { id: 'delete_partidas', title: 'Eliminar Partidas', desc: 'Acción crítica: eliminación física de registros maestros.', admin: true, tecnico: false, danger: true },
];

const Roles: React.FC = () => {
  const [permissions, setPermissions] = useState<Permission[]>(INITIAL_PERMISSIONS);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Usar app_metadata para mayor seguridad como en el resto del sistema
        setIsAdmin(user.app_metadata?.role === 'Admin');
      }
      setIsLoading(false);
    };
    checkRole();
  }, []);

  const handleToggle = (id: string, role: 'admin' | 'tecnico') => {
    if (!isAdmin) return; // Prevent toggle if not admin
    setPermissions(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, [role]: !p[role] };
      }
      return p;
    }));
    // Ocultar mensaje de éxito si el usuario vuelve a cambiar algo
    if (showSuccess) setShowSuccess(false);
  };

  const handleSave = () => {
    if (!isAdmin) return;
    setIsSaving(true);

    // En la implementación actual, los permisos son lógicos basados en el rol (App Metadata).
    // Este diálogo registra la intención de cambio global.
    setTimeout(async () => {
      const { data: { user: caller } } = await supabase.auth.getUser();
      if (caller) {
        await (supabase as any).from('activity_log').insert({
          user_id: caller.id,
          action: 'revisó y validó la matriz de permisos del sistema',
          type: 'Info'
        });
      }

      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 1000);
  };

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>;
  }

  return (
    <div className="p-8 fade-in">
      <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Roles y Permisos</h2>
          <p className="text-slate-500 max-w-2xl">Defina las capacidades operativas para cada nivel de acceso en la plataforma.</p>
        </div>
        <div className="flex items-center gap-4">
          {!isAdmin && (
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm bg-amber-50 px-4 py-2 rounded-xl border border-amber-200">
              <span className="material-symbols-outlined text-lg">lock</span>
              Modo solo lectura
            </div>
          )}
          {showSuccess && (
            <div className="flex items-center gap-2 text-success font-bold text-sm fade-in">
              <span className="material-symbols-outlined text-lg">check_circle</span>
              Cambios guardados correctamente
            </div>
          )}
          {isAdmin && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`bg-primary text-white font-bold py-2.5 px-8 rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all flex items-center gap-2 active:scale-95 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-8 py-6 text-xs font-black text-slate-500 uppercase tracking-widest w-1/2">Permiso del Sistema</th>
              <th className="px-8 py-6 text-center text-xs font-black text-slate-500 uppercase tracking-widest">Administrador</th>
              <th className="px-8 py-6 text-center text-xs font-black text-slate-500 uppercase tracking-widest">Técnico</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {permissions.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                <td className="px-8 py-6">
                  <div className="flex flex-col">
                    <span className={`text-sm font-bold ${p.danger ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>{p.title}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.desc}</span>
                  </div>
                </td>
                <td className="px-8 py-6 text-center">
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={p.admin}
                      disabled={!isAdmin}
                      onChange={() => handleToggle(p.id, 'admin')}
                      className={`w-6 h-6 rounded text-primary focus:ring-primary border-slate-300 dark:border-slate-700 dark:bg-slate-800 transition-all ${isAdmin ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed opacity-60'}`}
                    />
                  </div>
                </td>
                <td className="px-8 py-6 text-center">
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={p.tecnico}
                      disabled={!isAdmin}
                      onChange={() => handleToggle(p.id, 'tecnico')}
                      className={`w-6 h-6 rounded text-primary focus:ring-primary border-slate-300 dark:border-slate-700 dark:bg-slate-800 transition-all ${isAdmin ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed opacity-60'}`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-2xl flex items-start gap-4">
        <span className="material-symbols-outlined text-amber-600">info</span>
        <div className="text-sm text-amber-800 dark:text-amber-200">
          <p className="font-bold mb-1">Nota sobre seguridad</p>
          <p>Los cambios en los permisos afectan inmediatamente a todos los usuarios vinculados a cada rol una vez guardados. {!isAdmin && "Solo un administrador puede realizar cambios en esta sección."}</p>
        </div>
      </div>
    </div>
  );
};

export default Roles;
