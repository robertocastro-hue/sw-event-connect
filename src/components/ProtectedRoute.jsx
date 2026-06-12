import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Layout from './Layout'

export function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Layout>{children}</Layout>
}

export function AdminRoute({ children }) {
  const { session, isAdmin, loading } = useAuth()

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Layout>{children}</Layout>
}
