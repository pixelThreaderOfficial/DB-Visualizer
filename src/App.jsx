import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import {
  Dashboard,
  AllDatabases,
  ImportDb,
  TableView,
  Analytics
} from './pages/dashboards';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="all-databases" element={<AllDatabases />} />
          <Route path="import" element={<ImportDb />} />
          <Route path="table-view" element={<TableView />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
