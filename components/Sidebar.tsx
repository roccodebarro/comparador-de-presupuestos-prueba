
import React from 'react';
import { NavLink } from 'react-router-dom';
import LogoIcon from './Common/LogoIcon';

import { User } from '@supabase/supabase-js';

const SidebarLink = ({ to, icon, label, isCollapsed, onClick }: { to: string, icon: string, label: string, isCollapsed: boolean, onClick?: () => void }) => (
  <NavLink
    to={to}
    onClick={onClick}
    title={isCollapsed ? label : ''}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all ${isActive ? 'bg-white/10 text-white border-l-4 border-primary' : ''
      } ${isCollapsed ? 'justify-center px-0' : ''}`
    }
  >
    <span className="material-symbols-outlined text-[22px] shrink-0">{icon}</span>
    {!isCollapsed && <span className="text-sm font-medium truncate">{label}</span>}
  </NavLink>
);

interface SidebarProps {
  onLogout: () => void;
  user: User;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, user, onClose, isCollapsed = false, onToggleCollapse }) => {
  const getUserColor = (identifier: string) => {
    const colors = [
      'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
      'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
      'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
      'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
    ];
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Logic to get a short, displayable name
  const getDisplayingName = () => {
    if (user.user_metadata?.full_name) return user.user_metadata.full_name;
    const emailPrefix = user.email?.split('@')[0] || '';
    if (emailPrefix) {
      // Format email prefix: manuel.nunez -> Manuel Nunez
      return emailPrefix
        .replace(/[._-]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    return 'Usuario';
  };
  const displayName = getDisplayingName();

  // Logic for role
  const rawRole = user.user_metadata?.role || 'Técnico';
  const displayRole = rawRole.toUpperCase();
  const roleColor = displayRole === 'ADMIN' ? 'text-purple-400' : 'text-blue-400';

  const initials = displayName.substring(0, 2).toUpperCase();
  const avatarColor = getUserColor(user.email || displayName);

  return (
    <aside className={`bg-[#111827] text-white flex flex-col shrink-0 h-full border-r border-slate-800 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className={`p-6 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        <div className="flex items-center gap-3 overflow-hidden">
          <LogoIcon className="w-9 h-9 shrink-0" />
          {!isCollapsed && (
            <div className="fade-in">
              <h1 className="font-black text-[10px] leading-tight uppercase tracking-tighter">Comparador de Presupuestos</h1>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <button onClick={onClose} className="lg:hidden text-slate-400">
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>

      <nav className="flex-1 mt-4 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        <SidebarLink to="/" icon="grid_view" label="Panel General" isCollapsed={isCollapsed} onClick={onClose} />
        <SidebarLink to="/mis-partidas" icon="database" label="Mi Base de Datos" isCollapsed={isCollapsed} onClick={onClose} />
        <SidebarLink to="/importar-bd" icon="post_add" label="Importar a BD" isCollapsed={isCollapsed} onClick={onClose} />

        <div className={`h-px bg-slate-700/50 my-4 ${isCollapsed ? 'mx-2' : ''}`}></div>

        <SidebarLink to="/importar-simple" icon="upload_file" label="Importar Presupuesto" isCollapsed={isCollapsed} onClick={onClose} />
        <SidebarLink to="/comparativa-detallada" icon="compare_arrows" label="Comparativa" isCollapsed={isCollapsed} onClick={onClose} />
        <SidebarLink to="/export-hub" icon="ios_share" label="Exportación" isCollapsed={isCollapsed} onClick={onClose} />

        <div className={`h-px bg-slate-700/50 my-4 ${isCollapsed ? 'mx-2' : ''}`}></div>

        <SidebarLink to="/gestion-usuarios" icon="group" label="Usuarios" isCollapsed={isCollapsed} onClick={onClose} />
        <SidebarLink to="/roles" icon="admin_panel_settings" label="Roles y Permisos" isCollapsed={isCollapsed} onClick={onClose} />
        <SidebarLink to="/actividad" icon="history" label="Registro de Actividad" isCollapsed={isCollapsed} onClick={onClose} />
        <SidebarLink to="/configuracion" icon="settings" label="Configuración" isCollapsed={isCollapsed} onClick={onClose} />

      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50 space-y-4">
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={`w-9 h-9 ${avatarColor} text-white rounded-full flex items-center justify-center font-black text-xs shrink-0 select-none shadow-lg shadow-black/20 ring-2 ring-white/10`}>
              {initials}
            </div>
            {!isCollapsed && (
              <div className="text-sm fade-in min-w-0">
                <p className="font-bold text-slate-100 truncate max-w-[140px]" title={user.user_metadata?.full_name || user.email || ''}>{displayName}</p>
                <p className={`text-[10px] ${roleColor} font-black uppercase tracking-widest`}>{displayRole}</p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={onLogout}
              className="text-slate-400 hover:text-red-400 p-2 rounded-lg hover:bg-red-400/10 transition-colors shrink-0"
              title="Cerrar sesión"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex w-full items-center justify-center p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors border border-slate-700/50"
          title={isCollapsed ? "Expandir menú" : "Contraer menú"}
        >
          <span className="material-symbols-outlined transition-transform duration-300" style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            keyboard_double_arrow_left
          </span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
