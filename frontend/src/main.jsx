import { StrictMode, useEffect, useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, ScrollRestoration, useLocation, Outlet } from 'react-router-dom'
import './index.css'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { CollectionSheetProvider } from './context/CollectionSheetContext.jsx'
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
import Categories from './pages/Categories.jsx'
import CollectionDetail from './pages/CollectionDetail.jsx'
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
import Fratcher from './pages/Fratcher.jsx'
import Garten from './pages/Garten.jsx'
import Kraeuterschule from './pages/Kraeuterschule.jsx'
import PflanzenDetail from './pages/PflanzenDetail.jsx'
import Netzwerk from './pages/Netzwerk.jsx'
import ShoppingList from './pages/ShoppingList.jsx'
import Social from './pages/Social.jsx'
import ZurListe from './pages/ZurListe.jsx'
import Seasonal from './pages/Seasonal.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'
import MobileSearchBar from './components/MobileSearchBar.jsx'

const NO_NAVBAR_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email']

// Screens mit eigenem Sticky-Footer-CTA. Die globale Suchleiste liegt fix bei
// bottom:78 und würde denselben Streifen belegen — Klicks landeten dann auf der
// Suche statt auf dem CTA. Auf solchen Screens ist eine Rezeptsuche ohnehin
// nicht das, was man sucht.
const NO_SEARCHBAR_PATTERNS = [/^\/recipes\/[^/]+\/zur-liste$/]

function Layout() {
  const { pathname } = useLocation()
  const { pendingNotifications } = useAuth()
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'page_view',
      page_path: pathname,
      page_title: document.title,
    })
  }, [pathname])

  // Die Startseite oeffnet immer oben — auch bei Zurueck-Navigation, damit die
  // Begruessung sichtbar ist. Layout-Effekt, weil er damit *nach* dem Layout-
  // Effekt von ScrollRestoration (Kind-Komponente) und noch vor dem Paint
  // laeuft: eine wiederhergestellte Position wird ohne sichtbaren Sprung
  // ueberschrieben.
  useLayoutEffect(() => {
    if (pathname === '/') window.scrollTo(0, 0)
  }, [pathname])

  const showNavbar = !NO_NAVBAR_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  const showSearchBar = showNavbar && !NO_SEARCHBAR_PATTERNS.some(re => re.test(pathname))
  return (
    <>
      {/* Pro Navigations-Eintrag ein Key. Fuer '/' gab es hier einen konstanten
          Key ('no-restore') — der schaltet Restoration nicht ab, sondern legt
          alle Home-Positionen unter genau einem Eintrag ab und holt sie zurueck.
          Home wird stattdessen oben im Layout-Effekt nach oben gesetzt. */}
      <ScrollRestoration getKey={(location) => location.key} />
      {showNavbar && <Navbar onBellClick={() => setNotifOpen(true)} notificationCount={pendingNotifications?.length ?? 0} />}
      <Outlet />
      {showSearchBar && <MobileSearchBar />}
      {showNavbar && <BottomNav />}
      <TimerWidgetGlobal />
      <NotificationsModal open={notifOpen} onClose={() => setNotifOpen(false)} />
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
              {/* Das „In Sammlung"-Sheet hängt einmal hier, nicht pro Karte. */}
              <CollectionSheetProvider>
                <Layout />
              </CollectionSheetProvider>
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
      { path: '/categories', element: <ProtectedRoute><Categories /></ProtectedRoute> },
      { path: '/', element: <ProtectedRoute><Home /></ProtectedRoute> },
      { path: '/recipes/new', element: <ProtectedRoute><RecipeForm /></ProtectedRoute> },
      { path: '/recipes/:id/edit', element: <ProtectedRoute><RecipeForm /></ProtectedRoute> },
      { path: '/recipes/:id/review', element: <ProtectedRoute><IngredientReview /></ProtectedRoute> },
      { path: '/recipes/:id/zur-liste', element: <ProtectedRoute><ZurListe /></ProtectedRoute> },
      { path: '/recipes/:id', element: <ProtectedRoute><RecipeDetail /></ProtectedRoute> },
      { path: '/favorites', element: <ProtectedRoute><Favorites /></ProtectedRoute> },
      { path: '/collections/:id', element: <ProtectedRoute><CollectionDetail /></ProtectedRoute> },
      { path: '/fratcher', element: <ProtectedRoute><Fratcher /></ProtectedRoute> },
      { path: '/garten', element: <ProtectedRoute><Garten /></ProtectedRoute> },
      { path: '/kraeuterschule', element: <ProtectedRoute><Kraeuterschule /></ProtectedRoute> },
      { path: '/pflanzen/:slug', element: <ProtectedRoute><PflanzenDetail /></ProtectedRoute> },
      { path: '/einkaufsliste', element: <ProtectedRoute><ShoppingList /></ProtectedRoute> },
      { path: '/social', element: <ProtectedRoute><Social /></ProtectedRoute> },
      { path: '/seasonal', element: <ProtectedRoute><Seasonal /></ProtectedRoute> },
      { path: '/profile', element: <ProtectedRoute><Profile /></ProtectedRoute> },
      { path: '/admin', element: <AdminRoute><AdminDashboard /></AdminRoute> },
      { path: '/admin/users', element: <AdminRoute><AdminUsers /></AdminRoute> },
      { path: '/admin/recipes', element: <AdminRoute><AdminRecipes /></AdminRoute> },
      { path: '/users/:id/netzwerk', element: <ProtectedRoute><Netzwerk /></ProtectedRoute> },
      { path: '/users/:id', element: <ProtectedRoute><PublicProfile /></ProtectedRoute> },
    ]
  }
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
