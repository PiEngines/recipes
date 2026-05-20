import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, ScrollRestoration, useLocation, Outlet } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './context/AuthContext.jsx'
import { TimerProvider } from './context/TimerContext.jsx'
import { NavigationProvider } from './context/NavigationContext.jsx'
import { AdminRoute, ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute.jsx'
import Navbar from './components/Navbar.jsx'
import TimerWidgetGlobal from './components/TimerWidgetGlobal.jsx'
import NotificationsModal from './components/NotificationsModal.jsx'
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

const NO_NAVBAR_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email']

function Layout() {
  const { pathname } = useLocation()
  const showNavbar = !NO_NAVBAR_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
    && !pathname.startsWith('/users/')
  return (
    <>
      <ScrollRestoration />
      {showNavbar && <Navbar />}
      <Outlet />
      <TimerWidgetGlobal />
      <NotificationsModal />
    </>
  )
}

const router = createBrowserRouter([
  {
    element: (
      <AuthProvider>
        <TimerProvider>
          <NavigationProvider>
            <Layout />
          </NavigationProvider>
        </TimerProvider>
      </AuthProvider>
    ),
    children: [
      { path: '/login', element: <PublicOnlyRoute><Login /></PublicOnlyRoute> },
      { path: '/register', element: <PublicOnlyRoute><Register /></PublicOnlyRoute> },
      { path: '/forgot-password', element: <PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute> },
      { path: '/reset-password', element: <PublicOnlyRoute><ResetPassword /></PublicOnlyRoute> },
      { path: '/verify-email', element: <PublicOnlyRoute><VerifyEmail /></PublicOnlyRoute> },
      { path: '/', element: <ProtectedRoute><Recipes /></ProtectedRoute> },
      { path: '/recipes/new', element: <ProtectedRoute><RecipeForm /></ProtectedRoute> },
      { path: '/recipes/:id/edit', element: <ProtectedRoute><RecipeForm /></ProtectedRoute> },
      { path: '/recipes/:id', element: <ProtectedRoute><RecipeDetail /></ProtectedRoute> },
      { path: '/profile', element: <ProtectedRoute><Profile /></ProtectedRoute> },
      { path: '/admin', element: <AdminRoute><AdminDashboard /></AdminRoute> },
      { path: '/admin/users', element: <AdminRoute><AdminUsers /></AdminRoute> },
      { path: '/admin/recipes', element: <AdminRoute><AdminRecipes /></AdminRoute> },
      { path: '/users/:id', element: <PublicProfile /> },
    ]
  }
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
