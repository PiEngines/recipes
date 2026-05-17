import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute'
import Login from './pages/Login.jsx'
import Recipes from './pages/Recipes.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/" element={<ProtectedRoute><Recipes /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  )
}
