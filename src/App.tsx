/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { AppLayout, ProjectLayout } from "./components/layout/layouts";
import { storage } from "./lib/storage";
import { auth } from "./lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { ShieldAlert } from "lucide-react";
import WaveLoader from "./components/brand/WaveLoader";
import Dashboard from "./pages/Dashboard";
import CreateProject from "./pages/CreateProject";
import ProjectOverview from "./pages/ProjectOverview";
import StoryBible from "./pages/StoryBible";
import Characters from "./pages/Characters";
import Locations from "./pages/Locations";
import Plot from "./pages/Plot";
import WritingStudio from "./pages/WritingStudio";
import Settings from "./pages/Settings";
import GlobalSearchPage from "./pages/GlobalSearchPage";
import ConsistencyCheckerPage from "./pages/ConsistencyCheckerPage";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import { adminService } from "./lib/adminService";

function ProtectedRoute() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState<boolean>(true);
  const [isBanned, setIsBanned] = useState<boolean>(false);
  const location = useLocation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && !currentUser.isAnonymous) {
        try {
          storage.switchUser(currentUser.uid, currentUser.email, currentUser.displayName);
          const res = await adminService.trackUserActivity(currentUser);
          setIsBanned(res.isBanned);
          await storage.syncFromCloud(currentUser.uid);
        } catch {
          // ignore tracking error
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return <WaveLoader label="Opening your library…" />;
  }

  // If user is not authenticated, redirect directly to Login
  if (!user || user.isAnonymous) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user has been banned by admin, lock them out of the studio
  if (isBanned) {
    return (
      <div className="min-h-screen w-full bg-[#FAF8F5] flex flex-col items-center justify-center p-4 text-center select-none">
        <div className="max-w-md w-full p-8 bg-white border border-rose-200 rounded-2xl shadow-xl space-y-4">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-serif font-bold text-stone-900">
            Account Suspended
          </h2>
          <p className="text-xs text-stone-600 leading-relaxed font-serif">
            Your account access to Ocean Novel Studio has been suspended by an administrator. If you believe this is an error or need assistance, please contact customer support.
          </p>
          <div className="pt-2">
            <button
              onClick={() => auth.signOut()}
              className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <Routes location={location}>
      {/* Public Authentication Gate */}
      <Route path="/login" element={<Login />} />
      <Route path="/auth" element={<Login />} />

      {/* Root Route: Redirects to /dashboard (which passes through ProtectedRoute) */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Protected Archive & Studio Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create" element={<CreateProject />} />
          <Route path="/settings" element={<Settings />} />

          <Route element={<ProjectLayout />}>
            <Route path="/project/:id" element={<ProjectOverview />} />
            <Route path="/project/:id/characters" element={<Characters />} />
            <Route path="/project/:id/bible" element={<StoryBible />} />
            <Route path="/project/:id/locations" element={<Locations />} />
            <Route path="/project/:id/plot" element={<Plot />} />
            <Route path="/project/:id/workspace" element={<Navigate to="studio" replace />} />
            <Route path="/project/:id/workspace/bible" element={<StoryBible />} />
            <Route path="/project/:id/workspace/locations" element={<Locations />} />
            <Route path="/project/:id/workspace/plot" element={<Plot />} />
            <Route path="/project/:id/workspace/studio" element={<WritingStudio />} />
            <Route path="/project/:id/studio" element={<WritingStudio />} />
            <Route path="/project/:id/workspace/search" element={<GlobalSearchPage />} />
            <Route path="/project/:id/search" element={<GlobalSearchPage />} />
            <Route path="/project/:id/workspace/consistency" element={<ConsistencyCheckerPage />} />
            <Route path="/project/:id/consistency" element={<ConsistencyCheckerPage />} />
            <Route path="/project/:id/workspace/settings" element={<Settings />} />
            <Route path="/project/:id/settings" element={<Settings />} />
            <Route path="/project/:id/profile" element={<Settings />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  useEffect(() => {
    storage.initAutoSync();
  }, []);

  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
