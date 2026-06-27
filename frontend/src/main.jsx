import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, ScrollRestoration, useLocation, Outlet } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './context/AuthContext.jsx'
import { FavoritesProvider } from './context/FavoritesContext.jsx'
import { TimerProvider } from './context/TimerContext.jsx'
import { NavigationProvider } from './context/NavigationContext.jsx'
import { AdminRoute, ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute.jsx'
import Navbar from './components/Navbar.jsx'
import BottomNav from './components/BottomNav.jsx'
import TimerWidgetGlobal from './components/TimerWidgetGlobal.jsx'
import NotificationsModal from './components/NotificationsModal.jsx'
import UsernameOnboardingModal from './components/UsernameOnboardingModal.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminRecipes from './pages/AdminRecipes.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import Favorites from './pages/Favorites.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Home from './pages/Home.jsx'
import IngredientReview from './pages/IngredientReview.jsx'
import Login from './pages/Login.jsx'
import Profile from './pages/Profile.jsx'
import PublicProfile from './pages/PublicProfile.jsx'
import RecipeDetail from './pages/RecipeDetail.jsx'
import RecipeForm from './pages/RecipeForm.jsx'
import Recipes from './pages/Recipes.jsx'
import Register from './pages/Register.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Seasonal from './pages/Seasonal.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'

const NO_NAVBAR_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email']

function Layout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'page_view',
      page_path: pathname,
      page_title: document.title,
    })
  }, [pathname])

  const showNavbar = !NO_NAVBAR_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
    && !pathname.startsWith('/users/')
  return (
    <>
      <ScrollRestoration getKey={(location) => {
        if (location.pathname === '/') return 'no-restore'
        return location.key
      }} />
      {showNavbar && <Navbar />}
      <Outlet />
      {showNavbar && <BottomNav />}
      <TimerWidgetGlobal />
      <NotificationsModal />
      <UsernameOnboardingModal />
    </>
  )
}

const router = createBrowserRouter([
  {
    element: (
      <AuthProvider>
        <FavoritesProvider>
          <TimerProvider>
            <NavigationProvider>
              <Layout />
            </NavigationProvider>
          </TimerProvider>
        </FavoritesProvider>
      </AuthProvider>
    ),
    children: [
      { path: '/login', element: <PublicOnlyRoute><Login /></PublicOnlyRoute> },
      { path: '/register', element: <PublicOnlyRoute><Register /></PublicOnlyRoute> },
      { path: '/forgot-password', element: <PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute> },
      { path: '/reset-password', element: <PublicOnlyRoute><ResetPassword /></PublicOnlyRoute> },
      { path: '/verify-email', element: <PublicOnlyRoute><VerifyEmail /></PublicOnlyRoute> },
      { path: '/recipes', element: <ProtectedRoute><Recipes /></ProtectedRoute> },
      { path: '/', element: <ProtectedRoute><Home /></ProtectedRoute> },
      { path: '/recipes/new', element: <ProtectedRoute><RecipeForm /></ProtectedRoute> },
      { path: '/recipes/:id/edit', element: <ProtectedRoute><RecipeForm /></ProtectedRoute> },
      { path: '/recipes/:id/review', element: <ProtectedRoute><IngredientReview /></ProtectedRoute> },
      { path: '/recipes/:id', element: <ProtectedRoute><RecipeDetail /></ProtectedRoute> },
      { path: '/favorites', element: <ProtectedRoute><Favorites /></ProtectedRoute> },
      { path: '/seasonal', element: <ProtectedRoute><Seasonal /></ProtectedRoute> },
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
