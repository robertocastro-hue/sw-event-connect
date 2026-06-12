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
    return { error: jsonResponse(401, { error: 'Invalid session.', debug: { userError } }) }
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single()

  console.log('DEBUG admin check', {
    userId: userData.user.id,
    email: userData.user.email,
    profile,
    profileError
  })

  if (profileError || !profile?.is_admin) {
    return {
      error: jsonResponse(403, {
        error: 'Admin access required.',
        debug: { userId: userData.user.id, email: userData.user.email, profile, profileError }
      })
    }
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
      const { email, full_name, is_admin, password } = JSON.parse(event.body || '{}')
      if (!email) return jsonResponse(400, { error: 'Email is required.' })
      if (!password || password.length < 8) {
        return jsonResponse(400, { error: 'Password must be at least 8 characters.' })
      }

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || '' }
      })
      if (createError) throw createError

      const { error: profileError } = await adminClient
        .from('profiles')
        .update({ full_name: full_name || null, is_admin: !!is_admin })
        .eq('id', created.user.id)

      if (profileError) throw profileError

      return jsonResponse(200, { success: true, user_id: created.user.id })
    }

    if (event.httpMethod === 'PATCH') {
      const { user_id, is_admin, full_name, password } = JSON.parse(event.body || '{}')
      if (!user_id) return jsonResponse(400, { error: 'user_id is required.' })

      const profileUpdates = {}
      if (typeof is_admin === 'boolean') profileUpdates.is_admin = is_admin
      if (typeof full_name === 'string') profileUpdates.full_name = full_name || null

      if (Object.keys(profileUpdates).length > 0) {
        const { error } = await adminClient.from('profiles').update(profileUpdates).eq('id', user_id)
        if (error) throw error
      }

      if (typeof password === 'string' && password.length > 0) {
        if (password.length < 8) {
          return jsonResponse(400, { error: 'Password must be at least 8 characters.' })
        }
        const { error } = await adminClient.auth.admin.updateUserById(user_id, { password })
        if (error) throw error
      }

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
