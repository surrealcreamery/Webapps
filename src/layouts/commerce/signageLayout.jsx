import React from 'react';
import { Outlet } from 'react-router-dom';

const SignageLayout = () => {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#111', color: '#fff' }}>
      <Outlet />
    </div>
  );
};

export default SignageLayout;
