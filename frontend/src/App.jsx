import React, { Suspense, lazy } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ScrollToTop } from './components/ScrollToTop'
import ProtectedRoute from './components/ProtectedRoute'
import { InstallPWABanner } from './components/InstallPWA'
import './styles/main.scss'

const MainLayout = lazy(() => import('./layouts/MainLayout'))
const Home = lazy(() => import('./pages/Home'))
const Clans = lazy(() => import('./pages/Clans'))
const ClanDetails = lazy(() => import('./pages/ClanDetails'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Dashboard = lazy(() => import('./pages/Dashboard'))

function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Suspense fallback={<div className="page-loading">Loading...</div>}>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route
              path="clans"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <Clans />
                </ProtectedRoute>
              }
            />
            <Route
              path="clans/:clanTag"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <ClanDetails />
                </ProtectedRoute>
              }
            />
            <Route path="contact" element={<Navigate to="/" replace />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route
            path="dashboard"
            element={
              <ProtectedRoute requireAdmin={true}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          </Route>
        </Routes>
      </Suspense>
      <InstallPWABanner />
    </HashRouter>
  )
}

export default App
