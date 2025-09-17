import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Listings() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/dashboard'); }, [navigate]);
  return null;
}