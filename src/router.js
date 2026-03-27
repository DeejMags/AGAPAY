import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import Marketplace from './pages/Marketplace';
import ProductDetail from './pages/ProductDetail';
import Profile from './pages/Profile';
import Messages from './pages/Messages';
import Login from './pages/Login';
import Signup from './pages/Signup';
import NotFound from './pages/NotFound';
import UploadProduct from './pages/UploadProduct';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import AdminDashboard from './admin/AdminDashboard';
import SellerDashboard from './pages/SellerDashboard';
import Listings from './pages/Listings';
import UserSettings from './pages/UserSettings';
import Reviews from './seller/Reviews';
import Community from './seller/Community';
import { Outlet } from 'react-router-dom';

function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 w-full px-3 sm:px-4">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'marketplace', element: <Marketplace /> },
      { path: 'product/:id', element: <ProductDetail /> },
      { path: 'profile', element: <ProtectedRoute><Profile /></ProtectedRoute> },
      { path: 'profile/:id', element: <Profile /> },
      { path: 'messages', element: <ProtectedRoute><Messages /></ProtectedRoute> },
      { path: 'upload', element: <ProtectedRoute><UploadProduct /></ProtectedRoute> },
      { path: 'login', element: <Login /> },
      { path: 'signup', element: <Signup /> },
      { path: 'admin', element: <AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute> },
      { path: 'listings', element: <ProtectedRoute><Listings /></ProtectedRoute> },
      { path: 'dashboard', element: <ProtectedRoute><SellerDashboard /></ProtectedRoute> },
      { path: 'settings', element: <ProtectedRoute><UserSettings /></ProtectedRoute> },
      { path: 'reviews', element: <ProtectedRoute><Reviews /></ProtectedRoute> },
      { path: 'community', element: <ProtectedRoute><Community /></ProtectedRoute> },
      { path: '*', element: <NotFound /> }
    ]
  }
]);
