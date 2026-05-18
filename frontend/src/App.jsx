import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TimerProvider } from './context/TimerContext'
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute'
import TimerWidgetGlobal from './components/TimerWidgetGlobal'
import Login from './pages/Login.jsx'
import RecipeDetail from './pages/RecipeDetail.jsx'
import RecipeForm from './pages/RecipeForm.jsx'
import Recipes from './pages/Recipes.jsx'

export default function App() {
  return (
    <AuthProvider>
      <TimerProvider>
        <Routes>
          <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/" element={<ProtectedRoute><Recipes /></ProtectedRoute>} />
          <Route path="/recipes/new" element={<ProtectedRoute><RecipeForm /></ProtectedRoute>} />
          <Route path="/recipes/:id/edit" element={<ProtectedRoute><RecipeForm /></ProtectedRoute>} />
          <Route path="/recipes/:id" element={<ProtectedRoute><RecipeDetail /></ProtectedRoute>} />
        </Routes>
        <TimerWidgetGlobal />
      </TimerProvider>
    </AuthProvider>
  )
}
