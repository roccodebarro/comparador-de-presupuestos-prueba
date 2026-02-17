// Supabase Edge Function: update-user-email
// Actualizar email de un usuario existente
// Desplegar con: supabase functions deploy update-user-email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
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

        // Verificar autenticación
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

        // Solo Admin puede actualizar emails
        if (caller.user_metadata?.role !== 'Admin') {
            return new Response(
                JSON.stringify({ error: 'Solo administradores pueden actualizar emails' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { user_id, old_email, new_email } = await req.json()

        if (!user_id || !new_email) {
            return new Response(
                JSON.stringify({ error: 'user_id y new_email son requeridos' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Actualizar email
        const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user_id,
            { email: new_email }
        )

        if (updateError) {
            return new Response(
                JSON.stringify({ error: updateError.message }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Registrar en activity_log
        await supabaseAdmin.from('activity_log').insert({
            user_id: user_id,
            action: `Email actualizado: ${old_email || 'N/A'} → ${new_email}`,
            type: 'USER_UPDATED',
            created_at: new Date().toISOString()
        })

        return new Response(
            JSON.stringify({
                success: true,
                user_id,
                old_email,
                new_email,
                updated_at: updatedUser.user.updated_at
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
