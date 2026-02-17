-- ==============================================================
-- DIAGNÓSTICO Y ARREGLO DE ACCESO PARA PABLO
-- Ejecuta esto en el SQL Editor de Supabase
-- ==============================================================

-- 1. Verificar si el usuario existe y su estado
SELECT 
  id, 
  email, 
  email_confirmed_at, 
  raw_user_meta_data->>'role' as rol,
  last_sign_in_at
FROM auth.users
WHERE email = 'pablopablo@ofiberia.com';

-- 2. SI NO APARECE NADA ARRIBA:
-- El usuario aún no se ha registrado en la aplicación. 
-- Debe ir a la pantalla de "Regístrate" y crear su cuenta.

-- 3. SI APARECE PERO NO TIENE ROL O NO PUEDE ENTRAR:
-- Ejecuta este bloque para forzar su confirmación y asignarle el rol de Admin.
UPDATE auth.users 
SET 
  email_confirmed_at = NOW(), -- Forzar confirmación si no lo estaba
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "Administrador"}'::jsonb
WHERE email = 'pablopablo@ofiberia.com';

-- 4. REINICIAR CONTRASEÑA (Solo si sigue sin poder entrar)
-- Si ha olvidado la contraseña o quieres forzar una nueva (ej: 123456)
-- UPDATE auth.users SET encrypted_password = crypt('123456', gen_salt('bf')) WHERE email = 'pablopablo@ofiberia.com';
