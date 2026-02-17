// Supabase Edge Function: create-users
// Crear múltiples usuarios técnicos con Supabase Admin API
// Desplegar con: supabase functions deploy create-users

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers para permitir llamadas desde frontend
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Inicializar cliente admin con service_role key
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // Verificar autenticación del usuario que invoca (solo Admin puede crear usuarios)
        const authHeader = req.headers.get('Authorization')!
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: { headers: { Authorization: authHeader } }
            }
        )

        const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser()

        if (authError || !caller) {
            return new Response(
                JSON.stringify({ error: 'No autorizado' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verificar que el usuario que llama es Admin
        const callerRole = caller.user_metadata?.role
        if (callerRole !== 'Admin') {
            return new Response(
                JSON.stringify({ error: 'Solo administradores pueden crear usuarios' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Parsear request body
        const { users } = await req.json()

        if (!Array.isArray(users) || users.length === 0) {
            return new Response(
                JSON.stringify({ error: 'Se requiere array de usuarios' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Crear usuarios
        const results = []

        for (const user of users) {
            const { email, password, role, full_name } = user

            // Validaciones
            if (!email || !password) {
                results.push({
                    email,
                    success: false,
                    error: 'Email y password son requeridos'
                })
                continue
            }

            // Crear usuario con Admin API
            const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password, // Supabase hashea automáticamente con bcrypt
                email_confirm: true, // Auto-confirmar email
                user_metadata: {
                    role: role || 'Técnico',
                    full_name: full_name || email.split('@')[0]
                }
            })

            if (createError) {
                results.push({
                    email,
                    success: false,
                    error: createError.message
                })
                continue
            }

            // Registrar en activity_log
            await supabaseAdmin.from('activity_log').insert({
                user_id: createdUser.user.id,
                action: `Usuario creado: ${email} - Rol: ${role || 'Técnico'}`,
                type: 'USER_CREATED',
                created_at: new Date().toISOString()
            })

            results.push({
                email,
                success: true,
                user_id: createdUser.user.id,
                created_at: createdUser.user.created_at
            })
        }

        return new Response(
            JSON.stringify({
                success: true,
                results,
                total: results.length,
                created: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
