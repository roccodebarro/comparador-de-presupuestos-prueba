-- =====================================================
-- REFUERZO DE SEGURIDAD POR ROLES (RLS) - VERSION 2
-- Permite CREAR y EDITAR a Técnicos, pero NO ELIMINAR
-- =====================================================

-- 1. Eliminar políticas antiguas para resetear
DROP POLICY IF EXISTS "Users can view own partidas" ON partidas;
DROP POLICY IF EXISTS "Admins can insert own partidas" ON partidas;
DROP POLICY IF EXISTS "Admins can update own partidas" ON partidas;
DROP POLICY IF EXISTS "Admins can delete own partidas" ON partidas;
DROP POLICY IF EXISTS "Users can insert own partidas" ON partidas;
DROP POLICY IF EXISTS "Users can update own partidas" ON partidas;
DROP POLICY IF EXISTS "Users can delete own partidas" ON partidas;

-- 2. Crear nuevas políticas refinadas

-- LECTURA: Todos los usuarios autenticados pueden ver todas las partidas (Base Maestra Compartida)
CREATE POLICY "Public read for all users" ON partidas
  FOR SELECT TO authenticated USING (true);

-- INSERCIÓN: Administradores y Técnicos pueden crear (Cualquier user_id, la base es compartida)
CREATE POLICY "Staff insert partidas" ON partidas
  FOR INSERT TO authenticated WITH CHECK (
    LOWER(auth.jwt() -> 'user_metadata' ->> 'role') IN ('administrador', 'admin', 'técnico', 'tecnico')
  );

-- ACTUALIZACIÓN: Administradores y Técnicos pueden editar cualquier partida
CREATE POLICY "Staff update partidas" ON partidas
  FOR UPDATE TO authenticated USING (
    LOWER(auth.jwt() -> 'user_metadata' ->> 'role') IN ('administrador', 'admin', 'técnico', 'tecnico')
  );

-- BORRADO: ESTRICTAMENTE solo Administradores
CREATE POLICY "Only admins delete partidas" ON partidas
  FOR DELETE TO authenticated USING (
    LOWER(auth.jwt() -> 'user_metadata' ->> 'role') IN ('administrador', 'admin')
  );
