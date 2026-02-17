
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabase/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Partidas from './pages/Partidas';
import ImportSimple from './pages/ImportSimple';
import ImportSummary from './pages/ImportSummary';
import ImportDatabase from './pages/ImportDatabase';
import DetailedComparison from './pages/DetailedComparison';
import Users from './pages/Users';
import Roles from './pages/Roles';
import Activity from './pages/Activity';
import Settings from './pages/Settings';
import ExportHub from './pages/ExportHub';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';



const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session on mount
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        console.log('Session checked:', session ? 'Found' : 'Not found');
        setSession(session);
      })
      .catch(err => {
        console.error('Error checking session:', err);
      })
      .finally(() => {
        setLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      // Registrar log de inicio de sesión de forma asíncrona para no bloquear
      if (event === 'SIGNED_IN' && session?.user) {
        (supabase as any).from('activity_log').insert({
          user_id: session.user.id,
          action: 'ha iniciado sesión en el sistema',
          type: 'Info'
        }).then(({ error }) => {
          if (error) console.warn('No se pudo registrar log de acceso:', error.message);
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/login" element={
            !session ? <Login onLogin={() => { }} /> : <Navigate to="/" replace />
          } />

          {/* Protected Routes */}
          <Route element={session ? <Layout onLogout={handleLogout} user={session.user} /> : <Navigate to="/login" replace />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/mis-partidas" element={<Partidas />} />
            <Route path="/importar-simple" element={<ImportSimple />} />
            <Route path="/importar-resumen" element={<ImportSummary />} />
            <Route path="/importar-bd" element={<ImportDatabase />} />
            <Route path="/detalles" element={<DetailedComparison />} />
            <Route path="/comparativa-detallada" element={<DetailedComparison />} />
            <Route path="/gestion-usuarios" element={<Users />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/actividad" element={<Activity />} />
            <Route path="/configuracion" element={<Settings />} />

            <Route path="/export-hub" element={<ExportHub />} />
          </Route>

          {/* Catch all redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
