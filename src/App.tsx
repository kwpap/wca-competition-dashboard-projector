import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AuthCallback from './pages/AuthCallback';
import Competitions from './pages/Competitions';
import Control from './pages/Control';
import Login from './pages/Login';
import OpenPublic from './pages/OpenPublic';
import Projector from './pages/Projector';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/competitions" element={<Competitions />} />
        <Route path="/open/:competitionId" element={<OpenPublic />} />
        <Route path="/control/:competitionId" element={<Control />} />
        <Route path="/projector/:competitionId" element={<Projector />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
