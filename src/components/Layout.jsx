import React from 'react';
import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';

const Layout = () => {
  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-muted/20">
        <div className="container mx-auto p-8 max-w-7xl">
            <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;

