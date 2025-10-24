// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import Router from './router'; // this is your router.jsx
import './styles/main.scss';

ReactDOM.createRoot(document.getElementById('root')).render(
//  <React.StrictMode>
      <Router />
//  </React.StrictMode>
);