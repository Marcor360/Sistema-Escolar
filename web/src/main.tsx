import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import './styles.css';
import { MarcaProvider } from './marca/MarcaContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <MarcaProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MarcaProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
