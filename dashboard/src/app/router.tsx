import { createBrowserRouter } from 'react-router-dom';
import AppLayout from './AppLayout';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import SessionsPage from '../pages/SessionsPage';
import SessionPage from '../pages/SessionPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { path: 'login', element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { index: true, element: <SessionsPage /> },
          { path: 'session/:id', element: <SessionPage /> },
        ]
      }
    ]
  }
]);
