import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import './styles.css';
import './styles/controles-modernizados.css';
import './styles/organizacion-modulos.css';
import './styles/tablas.css';
import { MarcaProvider } from './marca/MarcaContext';

const router = createBrowserRouter([{ path: '*', element: (
  <MarcaProvider><AuthProvider><App /></AuthProvider></MarcaProvider>
) }]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><RouterProvider router={router} /></React.StrictMode>,
);
