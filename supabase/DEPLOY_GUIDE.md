# Despliegue de Edge Functions - Gestión de Usuarios

## Prerrequisitos

1. **Supabase CLI instalado**:
   ```bash
   npm install -g supabase
   ```

2. **Login en Supabase**:
   ```bash
   supabase login
   ```

3. **Link del proyecto**:
   ```bash
   supabase link --project-ref hmqhdbtbkqrdcscpdkuo
   ```

## Despliegue de Functions

### 1. Desplegar create-users

```bash
supabase functions deploy create-users
```

**Output esperado**:
```
Deploying create-users (project ref: hmqhdbtbkqrdcscpdkuo)
✓ Deployed create-users
Function URL: https://hmqhdbtbkqrdcscpdkuo.supabase.co/functions/v1/create-users
```

### 2. Desplegar update-user-email

```bash
supabase functions deploy update-user-email
```

**Output esperado**:
```
Deploying update-user-email (project ref: hmqhdbtbkqrdcscpdkuo)
✓ Deployed update-user-email
Function URL: https://hmqhdbtbkqrdcscpdkuo.supabase.co/functions/v1/update-user-email
```

## Ejecución

### Opción A: Desde Frontend (Recomendado)

```typescript
import { executeUserManagement } from './scripts/manage-users';

// Ejecutar desde componente React con autenticación Admin
await executeUserManagement();
```

### Opción B: Curl directo (Testing)

**Crear usuarios**:
```bash
curl -X POST \
  'https://hmqhdbtbkqrdcscpdkuo.supabase.co/functions/v1/create-users' \
  -H 'Authorization: Bearer <USER_JWT_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "users": [
      {
        "email": "miguel@ofiberia.com",
        "password": "000000",
        "role": "Técnico",
        "full_name": "Miguel"
      },
      {
        "email": "lucia@ofiberia.com",
        "password": "000000",
        "role": "Técnico",
        "full_name": "Lucia"
      },
      {
        "email": "juan@ofiberia.com",
        "password": "000000",
        "role": "Técnico",
        "full_name": "Juan"
      }
    ]
  }'
```

**Actualizar email Pablo**:
```bash
curl -X POST \
  'https://hmqhdbtbkqrdcscpdkuo.supabase.co/functions/v1/update-user-email' \
  -H 'Authorization: Bearer <USER_JWT_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "07094a1c-ace5-4f45-ba2e-0b2fd943f29b",
    "old_email": "pablopablo@ofiberia.com",
    "new_email": "pablo@ofiberia.com"
  }'
```

### Opción C: Browser Console (Testing rápido)

```javascript
// En DevTools Console, con sesión de Admin activa
const { data, error } = await supabase.functions.invoke('create-users', {
  body: {
    users: [
      { email: 'miguel@ofiberia.com', password: '000000', role: 'Técnico', full_name: 'Miguel' },
      { email: 'lucia@ofiberia.com', password: '000000', role: 'Técnico', full_name: 'Lucia' },
      { email: 'juan@ofiberia.com', password: '000000', role: 'Técnico', full_name: 'Juan' }
    ]
  }
});
console.log(data);
```

## Verificación

### 1. Verificar en Supabase Dashboard

1. Ir a: https://supabase.com/dashboard/project/hmqhdbtbkqrdcscpdkuo/auth/users
2. Verificar que aparecen los 3 nuevos usuarios
3. Verificar que el email de Pablo cambió

### 2. Verificar activity_log

```sql
SELECT * FROM public.activity_log 
WHERE type IN ('USER_CREATED', 'USER_UPDATED')
ORDER BY created_at DESC
LIMIT 10;
```

## Rollback (si es necesario)

Para eliminar usuarios creados:

```typescript
// Ejecutar desde backend/Edge Function con Admin API
const emailsToDelete = [
  'miguel@ofiberia.com',
  'lucia@ofiberia.com',
  'juan@ofiberia.com'
];

for (const email of emailsToDelete) {
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const user = users.users.find(u => u.email === email);
  
  if (user) {
    await supabaseAdmin.auth.admin.deleteUser(user.id);
    console.log(`Deleted: ${email}`);
  }
}

// Revertir email de Pablo
await supabaseAdmin.auth.admin.updateUserById(
  '07094a1c-ace5-4f45-ba2e-0b2fd943f29b',
  { email: 'pablopablo@ofiberia.com' }
);
```

## Troubleshooting

### Error: "No autorizado"
- Verificar que estás logueado como Admin
- Verificar token JWT válido en header Authorization

### Error: "User already exists"
- Usuarios ya fueron creados
- Verificar en Dashboard

### Error: "Function not found"
- Functions no desplegadas correctamente
- Re-ejecutar `supabase functions deploy`
