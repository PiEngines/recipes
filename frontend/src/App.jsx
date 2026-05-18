import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TimerProvider } from './context/TimerContext'
import { NavigationProvider } from './context/NavigationContext'
import { AdminRoute, ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute'
import TimerWidgetGlobal from './components/TimerWidgetGlobal'
import NotificationsModal from './components/NotificationsModal'
// import OnboardingPopup from './components/OnboardingPopup'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminRecipes from './pages/AdminRecipes.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Login from './pages/Login.jsx'
import Profile from './pages/Profile.jsx'
import PublicProfile from './pages/PublicProfile.jsx'
import RecipeDetail from './pages/RecipeDetail.jsx'
import RecipeForm from './pages/RecipeForm.jsx'
import Recipes from './pages/Recipes.jsx'
import Register from './pages/Register.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'

export default function App() {
  return (
    <AuthProvider>
      <TimerProvider>
        <NavigationProvider>
          <Routes>
            <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
            <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
            <Route path="/reset-password" element={<PublicOnlyRoute><ResetPassword /></PublicOnlyRoute>} />
            <Route path="/verify-email" element={<PublicOnlyRoute><VerifyEmail /></PublicOnlyRoute>} />
            <Route path="/" element={<ProtectedRoute><Recipes /></ProtectedRoute>} />
            <Route path="/recipes/new" element={<ProtectedRoute><RecipeForm /></ProtectedRoute>} />
            <Route path="/recipes/:id/edit" element={<ProtectedRoute><RecipeForm /></ProtectedRoute>} />
            <Route path="/recipes/:id" element={<ProtectedRoute><RecipeDetail /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
            <Route path="/admin/recipes" element={<AdminRoute><AdminRecipes /></AdminRoute>} />
            <Route path="/users/:id" element={<PublicProfile />} />
          </Routes>
          <TimerWidgetGlobal />
          <NotificationsModal />
          {/* <OnboardingPopup /> */}
        </NavigationProvider>
      </TimerProvider>
    </AuthProvider>
  )
}
