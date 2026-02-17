
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';

interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  role: 'Admin' | 'Técnico';
  last_sign_in_at: string | null;
  status?: string; // Derivado o ficticio si no está en BD
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<'Admin' | 'Técnico'>('Técnico');
  const [isLoading, setIsLoading] = useState(true);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [newUserData, setNewUserData] = useState({ name: '', email: '', role: 'Técnico' as 'Admin' | 'Técnico' });
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const MAX_USERS = 5;
  const isLimitReached = users.length >= MAX_USERS;

  useEffect(() => {
    fetchUsers();
    checkCurrentUserRole();
  }, []);

  const checkCurrentUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const role = user.user_metadata?.role || 'Técnico';
      setCurrentUserRole(role as 'Admin' | 'Técnico');
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    // Llamada a la función RPC segura para obtener usuarios
    const { data, error } = await supabase.rpc('get_users_managed');

    if (error) {
      console.error('Error fetching users:', error);
      // Fallback visual si falla RPC (ej: falta el script SQL)
      // No mostramos nada o mostramos error
      showNotification('Error cargando usuarios: ' + error.message, 'error');
    } else if (data) {
      // Mapear datos recibidos
      const mappedUsers = (data as any[]).map((u: any) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name || 'Sin nombre',
        role: (u.role || 'Técnico') as 'Admin' | 'Técnico',
        last_sign_in_at: u.last_sign_in_at,
        status: 'Activo' // Por defecto active si están en auth
      }));
      setUsers(mappedUsers);
    }
    setIsLoading(false);
  };

  // Cerrar el menú si se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLimitReached) return;

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-user-manager', {
        body: {
          action: 'INVITE',
          payload: {
            email: newUserData.email,
            full_name: newUserData.name,
            role: newUserData.role
          }
        }
      });

      if (error) throw error;

      showNotification('Invitación enviada con éxito');
      fetchUsers(); // Recargar lista
      setIsInviteModalOpen(false);
      setNewUserData({ name: '', email: '', role: 'Técnico' });
    } catch (error: any) {
      console.error('Error inviting user:', error);
      showNotification('Error: ' + error.message, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('admin-user-manager', {
        body: {
          action: 'UPDATE',
          payload: {
            user_id: editingUser.id,
            email: editingUser.email,
            full_name: editingUser.full_name,
            role: editingUser.role
          }
        }
      });

      if (error) throw error;

      showNotification('Usuario actualizado correctamente');
      fetchUsers();
      setIsEditModalOpen(false);
      setEditingUser(null);
    } catch (error: any) {
      console.error('Error updating user:', error);
      showNotification('Error: ' + error.message, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const toggleMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  const initiateDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setUserToDelete(id);
    setActiveMenuId(null);
  };

  const confirmDelete = async () => {
    if (userToDelete) {
      setIsSending(true);
      try {
        const userToDeleteObj = users.find(u => u.id === userToDelete);
        const { error } = await supabase.functions.invoke('admin-user-manager', {
          body: {
            action: 'DELETE',
            payload: {
              user_id: userToDelete,
              email: userToDeleteObj?.email
            }
          }
        });

        if (error) throw error;

        showNotification('Usuario eliminado permanentemente', 'success');
        fetchUsers();
      } catch (error: any) {
        console.error('Error deleting user:', error);
        showNotification('Error al eliminar: ' + error.message, 'error');
      } finally {
        setIsSending(false);
        setUserToDelete(null);
      }
    }
  };

  const handleToggleStatus = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const userToToggle = users.find(u => u.id === id);
    if (!userToToggle) return;

    const newStatus = userToToggle.status === 'Activo' ? 'Inactivo' : 'Activo';
    const isBanning = newStatus === 'Inactivo';

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('admin-user-manager', {
        body: {
          action: 'TOGGLE_STATUS',
          payload: {
            user_id: id,
            email: userToToggle.email,
            ban: isBanning
          }
        }
      });

      if (error) throw error;

      showNotification(`Usuario ${isBanning ? 'desactivado' : 'activado'} correctamente`);
      fetchUsers();
    } catch (error: any) {
      console.error('Error toggling status:', error);
      showNotification('Error: ' + error.message, 'error');
    } finally {
      setIsSending(false);
      setActiveMenuId(null);
    }
  };

  const openEditModal = (e: React.MouseEvent, user: ManagedUser) => {
    e.stopPropagation();
    setEditingUser(user);
    setIsEditModalOpen(true);
    setActiveMenuId(null);
  };

  // Renderizado condicional de columnas y botones según permisos
  const canManage = currentUserRole === 'Admin';

  if (isLoading) return <div className="p-8"><div className="w-8 h-8 border-4 border-primary border-t-white rounded-full animate-spin"></div></div>;

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

      <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Gestión de Usuarios</h2>
          <p className="text-slate-500">
            {canManage
              ? 'Administre las cuentas de acceso y permisos de su equipo operativo.'
              : 'Listado de miembros del equipo.'}
          </p>
        </div>

        {/* BOOTN DE INVITAR: Solo visible para Admin */}
        {canManage && (
          <div className="flex flex-col items-end gap-2">
            {isLimitReached && (
              <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800 animate-pulse">
                Límite de {MAX_USERS} usuarios alcanzado
              </span>
            )}
            <button
              onClick={() => !isLimitReached && setIsInviteModalOpen(true)}
              disabled={isLimitReached}
              className={`font-bold py-2.5 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2 ${isLimitReached
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-primary text-white shadow-primary/20 hover:bg-primary-dark active:scale-95'
                }`}
            >
              <span className="material-symbols-outlined">{isLimitReached ? 'person_off' : 'person_add'}</span>
              Invitar Usuario
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-visible">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/30 dark:bg-slate-800/20">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Usuarios registrados: {users.length} / {MAX_USERS}
          </span>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest">Nombre</th>
              <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest">Email</th>
              <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest">Rol</th>
              <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Estado</th>
              {canManage && <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-5 text-sm font-bold text-slate-900 dark:text-white">{user.full_name}</td>
                <td className="px-6 py-5 text-sm text-slate-500 dark:text-slate-400">{user.email}</td>
                <td className="px-6 py-5">
                  <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider ${user.role === 'Admin' ? 'bg-slate-900 text-white' : 'bg-primary/10 text-primary'
                    }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-5 text-center">
                  <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider ${user.status === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                    {user.status}
                  </span>
                </td>
                {canManage && (
                  <td className="px-6 py-5 text-right relative">
                    <button
                      onClick={(e) => toggleMenu(e, user.id)}
                      className={`p-2 rounded-lg transition-all ${activeMenuId === user.id ? 'bg-slate-100 dark:bg-slate-700 text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'}`}
                    >
                      <span className="material-symbols-outlined">more_vert</span>
                    </button>

                    {/* Menú de Acciones Dropdown */}
                    {activeMenuId === user.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-6 top-14 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[60] overflow-hidden fade-in"
                      >
                        <button
                          onClick={(e) => openEditModal(e, user)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                          Editar
                        </button>
                        <button
                          onClick={(e) => handleToggleStatus(e, user.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">sync_alt</span>
                          {user.status === 'Activo' ? 'Desactivar' : 'Activar'}
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-700"></div>
                        <button
                          onClick={(e) => initiateDelete(e, user.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center text-slate-400">
                  <span className="material-symbols-outlined text-5xl mb-2 block">group_off</span>
                  <p className="font-medium">No se encontraron usuarios o no tienes permisos para verlos.</p>
                  <p className="text-xs mt-2 text-slate-500">Asegúrese de ejecutar el script RPC en Supabase.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Confirmación de Borrado */}
      {userToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 fade-in">
          <div className="bg-white dark:bg-[#1a202c] w-full max-w-md rounded-[2rem] shadow-2xl p-8 border border-slate-200 dark:border-slate-800 text-center">
            {/* ... Modal content is mostly static ... */}
            {/* Same as before but with updated logic in calls */}
            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-5xl">person_remove</span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">¿Eliminar Usuario?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">
              Esta operación requiere privilegios de administrador global.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-4 bg-red-500 text-white font-black rounded-2xl hover:bg-red-600 shadow-xl shadow-red-500/20 transition-all active:scale-95 text-sm uppercase tracking-widest"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Invitación - Mismo diseño, nueva lógica en submit */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 fade-in">
          <div className="bg-white dark:bg-card-dark w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Invitar Nuevo Usuario</h3>
              <button onClick={() => setIsInviteModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            <form onSubmit={handleInviteSubmit} className="p-8 space-y-5">
              {/* Form fields same as before... */}
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Nombre Completo</label>
                <input type="text" required value={newUserData.name} onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none" placeholder="Ej: Juan Pérez" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Correo Electrónico</label>
                <input type="email" required value={newUserData.email} onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none" placeholder="email@empresa.com" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Rol Asignado</label>
                <select value={newUserData.role} onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as 'Admin' | 'Técnico' })} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none appearance-none">
                  <option value="Técnico">Técnico (Acceso limitado)</option>
                  <option value="Admin">Administrador (Acceso total)</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsInviteModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl transition-colors">Cancelar</button>
                <button type="submit" disabled={isSending} className="flex-[2] py-3 bg-primary text-white font-black rounded-xl hover:bg-primary-dark shadow-lg transition-all">{isSending ? 'Enviando...' : 'Enviar Invitación'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edición - Similar */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 fade-in">
          <div className="bg-white dark:bg-card-dark w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Editar Usuario</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined text-3xl">close</span></button>
            </div>
            {/* Form */}
            <form onSubmit={handleEditSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Nombre Completo</label>
                <input type="text" readOnly value={editingUser.full_name} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Rol Asignado</label>
                <select value={editingUser.role} onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as 'Admin' | 'Técnico' })} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none appearance-none">
                  <option value="Técnico">Técnico</option>
                  <option value="Admin">Administrador</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl">Cancelar</button>
                <button type="submit" className="flex-[2] py-3 bg-primary text-white font-black rounded-xl">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
