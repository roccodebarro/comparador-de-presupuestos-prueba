// Supabase Edge Function: admin-user-manager
// Gestión centralizada de usuarios (Invite, Update, Delete, Toggle Status)
// Desplegar con: supabase functions deploy admin-user-manager

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

        // 1. Cliente Admin (Service Role) - Para acciones privilegiadas
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        })

        // 2. Verificar autenticación del llamante
        const authHeader = req.headers.get('Authorization')!
        const supabaseClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser()

        if (authError || !caller) {
            return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 3. Verificar que el llamante sea Admin
        if (caller.app_metadata?.role !== 'Admin') {
            return new Response(JSON.stringify({ error: 'Permisos insuficientes. Solo administradores pueden gestionar usuarios.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { action, payload } = await req.json()

        if (!action || !payload) {
            return new Response(JSON.stringify({ error: 'Faltan action o payload' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        let resultData = {}
        let logAction = ''
        let logType: 'Info' | 'Alerta' | 'Crítico' = 'Info'

        switch (action) {
            case 'INVITE': {
                const { email, full_name, role, password } = payload
                // Usamos createUser con auto-confirmación para simplificar el flujo interno
                const { data, error } = await supabaseAdmin.auth.admin.createUser({
                    email,
                    password: password || Math.random().toString(36).slice(-10), // Random pwd if none provided
                    email_confirm: true,
                    user_metadata: { full_name },
                    app_metadata: { role: role || 'Técnico' }
                })
                if (error) throw error
                resultData = data.user
                logAction = `Invitó al usuario ${email} como ${role || 'Técnico'}`
                break
            }

            case 'UPDATE': {
                const { user_id, email, full_name, role } = payload
                const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
                    email,
                    email_confirm: true,
                    user_metadata: { full_name },
                    app_metadata: { role }
                })
                if (error) throw error
                resultData = data.user
                logAction = `Actualizó datos del usuario ${email || user_id}`
                break
            }

            case 'DELETE': {
                const { user_id, email } = payload
                const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id)
                if (error) throw error
                resultData = { success: true }
                logAction = `ELIMINÓ al usuario ${email || user_id}`
                logType = 'Crítico'
                break
            }

            case 'TOGGLE_STATUS': {
                const { user_id, email, ban } = payload
                // En Supabase, "banear" significa impedir el login
                const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
                    ban_duration: ban ? '876000h' : 'none', // Banea por 100 años o quita ban
                    email_confirm: true // Asegurar que esté confirmado al activar
                })
                if (error) throw error
                resultData = data.user
                logAction = `${ban ? 'Desactivó' : 'Activó'} al usuario ${email || user_id}`
                logType = 'Alerta'
                break
            }

            default:
                return new Response(JSON.stringify({ error: 'Acción no soportada' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 4. Registrar en el log
        await supabaseAdmin.from('activity_log').insert({
            user_id: caller.id,
            action: logAction,
            type: logType,
            created_at: new Date().toISOString()
        })

        return new Response(JSON.stringify({ success: true, data: resultData }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
