-- ==============================================================
-- SCRIPT PARA ASIGNAR ROLES A LOS USUARIOS
-- Copia y ejecuta este código en el "SQL Editor" de Supabase
-- ==============================================================

-- 1. Asignar rol de ADMINISTRADOR (Acceso total: Crear, Editar, Borrar)
-- Cambia el email por TU email de administrador
UPDATE auth.users 
SET raw_user_meta_data = 
  COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "Administrador"}'::jsonb
WHERE email = 'tu_email@ejemplo.com'; -- <--- PON AQUÍ TU EMAIL

-- 2. Asignar rol de TÉCNICO (Acceso parcial: Crear y Editar, pero NO Borrar)
UPDATE auth.users 
SET raw_user_meta_data = 
  COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "Técnico"}'::jsonb
WHERE email = 'manuelnunezprego@gmail.com';

-- 3. (Opcional) Verificar los roles actuales
-- Ejecuta esto para ver si se han aplicado correctamente
SELECT email, raw_user_meta_data->>'role' as rol_asignado
FROM auth.users;
