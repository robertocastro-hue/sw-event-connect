import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

async function requireAdmin(event, adminClient) {
  const authHeader = event.headers.authorization || event.headers.Authorization
  if (!authHeader) return { error: jsonResponse(401, { error: 'Missing authorization header.' }) }

  const token = authHeader.replace('Bearer ', '')
  const { data: userData, error: userError } = await adminClient.auth.getUser(token)

  if (userError || !userData?.user) {
    return { error: jsonResponse(401, { error: 'Invalid session.' }) }
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile?.is_admin) {
    return { error: jsonResponse(403, { error: 'Admin access required.' }) }
  }

  return { user: userData.user }
}

export const handler = async (event) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'Server is missing Supabase configuration.' })
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { error: authError } = await requireAdmin(event, adminClient)
  if (authError) return authError

  try {
    if (event.httpMethod === 'GET') {
      const { data: authUsers, error: listError } = await adminClient.auth.admin.listUsers({
        perPage: 200
      })
      if (listError) throw listError

      const { data: profiles, error: profilesError } = await adminClient
        .from('profiles')
        .select('id, full_name, is_admin, created_at')
      if (profilesError) throw profilesError

      const profileMap = new Map(profiles.map((p) => [p.id, p]))

      const users = authUsers.users.map((u) => {
        const profile = profileMap.get(u.id) || {}
        return {
          id: u.id,
          email: u.email,
          full_name: profile.full_name || u.user_metadata?.full_name || '',
          is_admin: !!profile.is_admin,
          created_at: u.created_at
        }
      })

      return jsonResponse(200, { users })
    }

    if (event.httpMethod === 'POST') {
      const { email, full_name, is_admin } = JSON.parse(event.body || '{}')
      if (!email) return jsonResponse(400, { error: 'Email is required.' })

      const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        { data: { full_name: full_name || '' } }
      )
      if (inviteError) throw inviteError

      const { error: profileError } = await adminClient
        .from('profiles')
        .update({ full_name: full_name || null, is_admin: !!is_admin })
        .eq('id', invited.user.id)

      if (profileError) throw profileError

      return jsonResponse(200, { success: true, user_id: invited.user.id })
    }

    if (event.httpMethod === 'PATCH') {
      const { user_id, is_admin } = JSON.parse(event.body || '{}')
      if (!user_id) return jsonResponse(400, { error: 'user_id is required.' })

      const { error } = await adminClient
        .from('profiles')
        .update({ is_admin: !!is_admin })
        .eq('id', user_id)

      if (error) throw error
      return jsonResponse(200, { success: true })
    }

    if (event.httpMethod === 'DELETE') {
      const { user_id } = JSON.parse(event.body || '{}')
      if (!user_id) return jsonResponse(400, { error: 'user_id is required.' })

      const { error } = await adminClient.auth.admin.deleteUser(user_id)
      if (error) throw error

      return jsonResponse(200, { success: true })
    }

    return jsonResponse(405, { error: 'Method not allowed.' })
  } catch (err) {
    return jsonResponse(500, { error: err.message || 'Unexpected error.' })
  }
}
