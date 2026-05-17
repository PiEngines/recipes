import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Recipes from './pages/Recipes.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Recipes />} />
    </Routes>
  )
}
