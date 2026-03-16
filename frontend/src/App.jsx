import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LogExplorer from './pages/LogExplorer.jsx';
import Incidents from './pages/Incidents.jsx';
import RootCauseViewer from './pages/RootCauseViewer.jsx';
import FixSuggestions from './pages/FixSuggestions.jsx';
import LLMRouter from './pages/LLMRouter.jsx';
import PRGenerator from './pages/PRGenerator.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/logs" element={<LogExplorer />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/root-cause" element={<RootCauseViewer />} />
          <Route path="/fix" element={<FixSuggestions />} />
          <Route path="/llm" element={<LLMRouter />} />
          <Route path="/pr" element={<PRGenerator />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
