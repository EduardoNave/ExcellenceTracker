import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { CoordinatorRoute } from '@/components/auth/coordinator-route'
import { AdminRoute } from '@/components/auth/admin-route'
import LoginPage from '@/pages/login'
import DashboardPage from '@/pages/dashboard'
import TeamPage from '@/pages/team'
import ChecklistsPage from '@/pages/checklists'
import ChecklistEditorPage from '@/pages/checklist-editor'
import ServicesPage from '@/pages/services'
import ServiceDetailPage from '@/pages/service-detail'
import EvaluationPage from '@/pages/evaluation'
import ReportsPage from '@/pages/reports'
import ProfilePage from '@/pages/profile'
import InvitePage from '@/pages/invite'
import CoordinatorInvitePage from '@/pages/coordinator-invite'
import AdminPage from '@/pages/admin'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/invite/:token',
    element: <InvitePage />,
  },
  {
    path: '/coordinator-invite/:token',
    element: <CoordinatorInvitePage />,
  },
  {
    path: '/',
    element: <ProtectedLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'admin',
        element: (
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        ),
      },
      {
        path: 'team',
        element: (
          <CoordinatorRoute>
            <TeamPage />
          </CoordinatorRoute>
        ),
      },
      {
        path: 'checklists',
        element: (
          <CoordinatorRoute>
            <ChecklistsPage />
          </CoordinatorRoute>
        ),
      },
      {
        path: 'checklists/:id',
        element: (
          <CoordinatorRoute>
            <ChecklistEditorPage />
          </CoordinatorRoute>
        ),
      },
      {
        path: 'services',
        element: <ServicesPage />,
      },
      {
        path: 'services/:id',
        element: <ServiceDetailPage />,
      },
      {
        path: 'services/:id/evaluate/:userId',
        element: (
          <CoordinatorRoute>
            <EvaluationPage />
          </CoordinatorRoute>
        ),
      },
      {
        path: 'reports',
        element: <ReportsPage />,
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      },
    ],
  },
])
