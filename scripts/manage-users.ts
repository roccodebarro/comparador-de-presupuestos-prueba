/**
 * Script de invocación de Edge Functions para gestión de usuarios
 * Este script se puede ejecutar desde el frontend o como script Node.js
 */

import { supabase } from '../utils/supabase';

/**
 * Crear 3 usuarios técnicos: Miguel, Lucia, Juan
 */
export async function createTechnicalUsers() {
    try {
        const { data, error } = await supabase.functions.invoke('create-users', {
            body: {
                users: [
                    {
                        email: 'miguel@ofiberia.com',
                        password: '000000',
                        role: 'Técnico',
                        full_name: 'Miguel'
                    },
                    {
                        email: 'lucia@ofiberia.com',
                        password: '000000',
                        role: 'Técnico',
                        full_name: 'Lucia'
                    },
                    {
                        email: 'juan@ofiberia.com',
                        password: '000000',
                        role: 'Técnico',
                        full_name: 'Juan'
                    }
                ]
            }
        });

        if (error) {
            console.error('Error creando usuarios:', error);
            return { success: false, error };
        }

        console.log('✅ Usuarios creados:', data);
        return { success: true, data };
    } catch (err) {
        console.error('Error invocando Edge Function:', err);
        return { success: false, error: err };
    }
}

/**
 * Actualizar email de Pablo: pablopablo@ofiberia.com → pablo@ofiberia.com
 */
export async function updatePabloEmail() {
    try {
        const PABLO_ID = '07094a1c-ace5-4f45-ba2e-0b2fd943f29b';

        const { data, error } = await supabase.functions.invoke('update-user-email', {
            body: {
                user_id: PABLO_ID,
                old_email: 'pablopablo@ofiberia.com',
                new_email: 'pablo@ofiberia.com'
            }
        });

        if (error) {
            console.error('Error actualizando email:', error);
            return { success: false, error };
        }

        console.log('✅ Email actualizado:', data);
        return { success: true, data };
    } catch (err) {
        console.error('Error invocando Edge Function:', err);
        return { success: false, error: err };
    }
}

/**
 * Ejecutar ambas operaciones en secuencia
 */
export async function executeUserManagement() {
    console.log('🚀 Iniciando gestión de usuarios...\n');

    // Paso 1: Crear usuarios técnicos
    console.log('📝 Paso 1/2: Creando usuarios técnicos...');
    const createResult = await createTechnicalUsers();

    if (!createResult.success) {
        console.error('❌ Error en creación de usuarios. Abortando.');
        return;
    }

    console.log(`✅ ${createResult.data.created}/${createResult.data.total} usuarios creados correctamente\n`);

    // Paso 2: Actualizar email de Pablo
    console.log('📝 Paso 2/2: Actualizando email de Pablo...');
    const updateResult = await updatePabloEmail();

    if (!updateResult.success) {
        console.error('❌ Error actualizando email de Pablo.');
        return;
    }

    console.log('✅ Email de Pablo actualizado correctamente\n');

    console.log('🎉 Gestión de usuarios completada exitosamente');
}

// Si se ejecuta directamente (no como módulo)
if (import.meta.main) {
    executeUserManagement();
}
