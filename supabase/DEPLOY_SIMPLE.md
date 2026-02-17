# Guía de Despliegue Simplificada - Edge Functions

## ⚠️ Método Alternativo (Sin CLI) - Recomendado

Si tienes problemas con el CLI de Supabase, usa el **Supabase Dashboard** para desplegar:

### Paso 1: Ir al Dashboard

1. Abre: https://supabase.com/dashboard/project/hmqhdbtbkqrdcscpdkuo/functions
2. Haz login con tu cuenta

### Paso 2: Crear Function "create-users"

1. Click en **"Create a new function"**
2. Nombre: `create-users`
3. Copia y pega el contenido de: `supabase/functions/create-users/index.ts`
4. Click **"Deploy function"**

### Paso 3: Crear Function "update-user-email"

1. Click en **"Create a new function"**
2. Nombre: `update-user-email`
3. Copia y pega el contenido de: `supabase/functions/update-user-email/index.ts`
4. Click **"Deploy function"**

### Paso 4: Ejecutar desde Browser Console

1. Abre tu app: http://localhost:3001
2. **Logueate como Admin** (pablopablo@ofiberia.com)
3. Abre DevTools (F12) → Console
4. Ejecuta:

```javascript
// Crear usuarios
const r1 = await supabase.functions.invoke('create-users', {
  body: {
    users: [
      { email: 'miguel@ofiberia.com', password: '000000', role: 'Técnico', full_name: 'Miguel' },
      { email: 'lucia@ofiberia.com', password: '000000', role: 'Técnico', full_name: 'Lucia' },
      { email: 'juan@ofiberia.com', password: '000000', role: 'Técnico', full_name: 'Juan' }
    ]
  }
});
console.log('Creados:', r1);

// Actualizar Pablo
const r2 = await supabase.functions.invoke('update-user-email', {
  body: {
    user_id: '07094a1c-ace5-4f45-ba2e-0b2fd943f29b',
    new_email: 'pablo@ofiberia.com'
  }
});
console.log('Actualizado:', r2);
```

---

## 📋 Método CLI (Si login funciona)

Si completaste el login exitosamente:

```bash
# Link proyecto
npx supabase link --project-ref hmqhdbtbkqrdcscpdkuo

# Deploy functions
npx supabase functions deploy create-users
npx supabase functions deploy update-user-email
```

---

## ✅ Verificación

Después de ejecutar, verifica en:
- Dashboard → Authentication → Users
- Deberías ver los 3 nuevos usuarios
- Email de Pablo actualizado
