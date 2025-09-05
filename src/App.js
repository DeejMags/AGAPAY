import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import Marketplace from './pages/Marketplace'
import ProductDetail from './pages/ProductDetail'
import Profile from './pages/Profile'
import Messages from './pages/Messages'
import Login from './pages/Login'
import Signup from './pages/Signup'
import NotFound from './pages/NotFound'
import UploadProduct from './pages/UploadProduct'
import ProtectedRoute from './components/ProtectedRoute'

function App(){
  return (
    <BrowserRouter>
      <Navbar />
      <div className="pt-20">
        <Routes>
          <Route path="/" element={<Landing/>} />
          <Route path="/marketplace" element={<Marketplace/>} />
          <Route path="/product/:id" element={<ProductDetail/>} />
          <Route path="/profile" element={<ProtectedRoute><Profile/></ProtectedRoute>} />
          <Route path="/profile/:id" element={<Profile/>} />
          <Route path="/messages" element={<ProtectedRoute><Messages/></ProtectedRoute>} />
          <Route path="/upload" element={<ProtectedRoute><UploadProduct/></ProtectedRoute>} />
          <Route path="/login" element={<Login/>} />
          <Route path="/signup" element={<Signup/>} />
          <Route path="*" element={<NotFound/>} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App;
