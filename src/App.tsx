/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, lazy, Suspense } from "react";
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
import Login from "./pages/Login";

// Each page is its own chunk, so the login screen loads without the whole studio.
const pageLoaders = {
  Dashboard: () => import("./pages/Dashboard"),
  CreateProject: () => import("./pages/CreateProject"),
  ProjectOverview: () => import("./pages/ProjectOverview"),
  StoryBible: () => import("./pages/StoryBible"),
  Characters: () => import("./pages/Characters"),
  Locations: () => import("./pages/Locations"),
  Plot: () => import("./pages/Plot"),
  WritingStudio: () => import("./pages/WritingStudio"),
  Settings: () => import("./pages/Settings"),
  GlobalSearchPage: () => import("./pages/GlobalSearchPage"),
  ConsistencyCheckerPage: () => import("./pages/ConsistencyCheckerPage"),
  AdminDashboard: () => import("./pages/AdminDashboard"),
};
const Dashboard = lazy(pageLoaders.Dashboard);
const CreateProject = lazy(pageLoaders.CreateProject);
const ProjectOverview = lazy(pageLoaders.ProjectOverview);
const StoryBible = lazy(pageLoaders.StoryBible);
const Characters = lazy(pageLoaders.Characters);
const Locations = lazy(pageLoaders.Locations);
const Plot = lazy(pageLoaders.Plot);
const WritingStudio = lazy(pageLoaders.WritingStudio);
const Settings = lazy(pageLoaders.Settings);
const GlobalSearchPage = lazy(pageLoaders.GlobalSearchPage);
const ConsistencyCheckerPage = lazy(pageLoaders.ConsistencyCheckerPage);
const AdminDashboard = lazy(pageLoaders.AdminDashboard);

// Once signed in, fetch the other pages in the background so moving around stays instant
let pagesPrefetched = false;
function prefetchPages() {
  if (pagesPrefetched) return;
  pagesPrefetched = true;
  const run = () => Object.values(pageLoaders).forEach((load) => load().catch(() => {}));
  const idle = (window as any).requestIdleCallback as ((cb: () => void) => void) | undefined;
  if (idle) idle(run);
  else setTimeout(run, 1500);
}
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
        storage.switchUser(currentUser.uid, currentUser.email, currentUser.displayName);
        // Ban check and cloud sync run side by side
        const work = Promise.all([
          adminService.trackUserActivity(currentUser).then((res) => setIsBanned(res.isBanned)).catch(() => {}),
          storage.syncFromCloud(currentUser.uid).catch(() => {}),
        ]);
        // Books already on this device: open straight away and refresh in the background.
        // First sign-in here: wait for the library, but never longer than 1.5s — the
        // Dashboard shows a loading state and fills in when the data arrives.
        if (storage.getProjects().length === 0) {
          await Promise.race([work, new Promise((resolve) => setTimeout(resolve, 1500))]);
        }
      }
      setLoading(false);
      if (currentUser && !currentUser.isAnonymous) prefetchPages();
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
    <Suspense fallback={<WaveLoader />}>
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
    </Suspense>
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
