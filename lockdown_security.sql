-- ==============================================================
-- LOCKDOWN DE SEGURIDAD: CONTROL TOTAL DE BORRADO
-- Objetivo: Garantizar que NINGUNA política antigua permita borrar a técnicos.
-- Ejecutar en el SQL Editor de Supabase.
-- ==============================================================

-- 1. Desactivar y reactivar RLS para limpiar el estado de la tabla
ALTER TABLE partidas DISABLE ROW LEVEL SECURITY;
ALTER TABLE partidas ENABLE ROW LEVEL SECURITY;

-- 2. BLOQUEO TOTAL: Dropear absolutamente todas las políticas existentes en 'partidas'
-- Esto elimina cualquier política "fantasma" o antigua que pudiera dar permisos extra.
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'partidas') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON partidas', pol.policyname);
    END LOOP;
END $$;

-- 3. REAPLICAR PERMISOS LIMPIOS Y SEGUROS

-- LECTURA: Todos los autenticados pueden ver la base maestra
CREATE POLICY "RLS_PARTIDAS_SELECT" ON partidas
  FOR SELECT TO authenticated USING (true);

-- CREACIÓN: Administradores y Técnicos (case-insensitive)
CREATE POLICY "RLS_PARTIDAS_INSERT" ON partidas
  FOR INSERT TO authenticated WITH CHECK (
    LOWER(auth.jwt() -> 'user_metadata' ->> 'role') IN ('administrador', 'admin', 'técnico', 'tecnico')
  );

-- EDICIÓN: Administradores y Técnicos (case-insensitive)
CREATE POLICY "RLS_PARTIDAS_UPDATE" ON partidas
  FOR UPDATE TO authenticated USING (
    LOWER(auth.jwt() -> 'user_metadata' ->> 'role') IN ('administrador', 'admin', 'técnico', 'tecnico')
  );

-- BORRADO: ESTRICTAMENTE EXCLUSIVO PARA ADMINISTRADORES
-- No depende de quién creó la partida (auth.uid() = user_id), sino solo del ROL.
CREATE POLICY "RLS_PARTIDAS_DELETE" ON partidas
  FOR DELETE TO authenticated USING (
    LOWER(auth.jwt() -> 'user_metadata' ->> 'role') IN ('administrador', 'admin')
  );

-- 4. VERIFICACIÓN: Mostrar políticas activas
SELECT policyname, cmd, qualify, roles FROM pg_policies WHERE tablename = 'partidas';
