-- ==============================================================
-- SCRIPT DE CORRECCIÓN DE USUARIOS
-- Copia y ejecuta TODO este contenido en el "SQL Editor" de Supabase
-- ==============================================================

-- 1. Crear la función para que la lista de usuarios sea visible
-- Sin esto, la aplicación no tiene permiso de leer la lista de usuarios.
CREATE OR REPLACE FUNCTION get_users_managed()
RETURNS TABLE (
  id uuid,
  email varchar,
  full_name jsonb,
  role jsonb,
  last_sign_in_at timestamptz
) SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id, 
    au.email::varchar, 
    au.raw_user_meta_data->'full_name', 
    au.raw_user_meta_data->'role',
    au.last_sign_in_at
  FROM auth.users au;
END;
$$ LANGUAGE plpgsql;

-- 2. Eliminar el usuario antiguo 'mara@mara.com'
DELETE FROM auth.users WHERE email = 'mara@mara.com';

-- 3. Asignar rol de ADMIN a tu usuario actual
-- Esto busca cualquier usuario con 'pablo' en el email o nombre y lo hace Admin.
-- Si tu email es distinto, cámbialo abajo.
UPDATE auth.users 
SET raw_user_meta_data = 
  COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "Admin"}'::jsonb
WHERE email LIKE '%pablo%' OR raw_user_meta_data->>'full_name' LIKE '%pablo%';

-- 4. Asegurar que 'manuelnupregpo' (si existe con otro email) también sea visible
-- (La función del paso 1 ya lo hará visible automáticamente)
