import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ActiveSessionProvider } from "./contexts/ActiveSessionContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Results from "./pages/Results";
import PasswordReset from "./pages/PasswordReset";
import ResetPassword from "./pages/ResetPassword";
import ShareView from "./pages/ShareView";
import Diary from "./pages/Diary";
import DiaryNew from "./pages/DiaryNew";
import DiaryEntry from "./pages/DiaryEntry";
import DiarySetups from "./pages/DiarySetups";
import Settings from "./pages/Settings";
import Queries from "./pages/Queries";
import MapPage from "./pages/MapPage";
import VenueDetail from "./pages/VenueDetail";
import NotFound from "./pages/NotFound";
import AdminUpload from "./pages/AdminUpload";
import AdminDbStatus from "./pages/AdminDbStatus";
import AdminTestAdvice from "./pages/AdminTestAdvice";
import AdminRecompute from "./pages/AdminRecompute";
import AdminVenueSubmissions from "./pages/AdminVenueSubmissions";
import SocialFeed from "./pages/SocialFeed";
import Leaderboard from "./pages/Leaderboard";
import SessionShareView from "./pages/SessionShareView";
import GroupJoinView from "./pages/GroupJoinView";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./layouts/AppShell";

const Shelled = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppShell>{children}</AppShell>
  </ProtectedRoute>
);
const ShelledNamed = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requireDisplayName>
    <AppShell>{children}</AppShell>
  </ProtectedRoute>
);

const queryClient = new QueryClient();

// Apply persisted motion + theme prefs before first paint
if (typeof document !== "undefined") {
  try {
    const reduceMotion = localStorage.getItem("ic.reduceMotion") === "true";
    document.documentElement.setAttribute("data-motion", reduceMotion ? "reduced" : "");
    const theme = localStorage.getItem("ic.theme");
    if (theme) document.documentElement.setAttribute("data-theme", theme);
  } catch { /* ignore */ }
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ActiveSessionProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/password-reset" element={<PasswordReset />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route 
              path="/dashboard" 
              element={<Shelled><Dashboard /></Shelled>} 
            />
            <Route 
              path="/results" 
              element={<Shelled><Results /></Shelled>} 
            />
            <Route 
              path="/diary" 
              element={<Shelled><Diary /></Shelled>} 
            />
            <Route 
              path="/diary/new" 
              element={<Shelled><DiaryNew /></Shelled>} 
            />
            <Route 
              path="/diary/:id" 
              element={<Shelled><DiaryEntry /></Shelled>} 
            />
            <Route 
              path="/diary/settings/setups" 
              element={<Shelled><DiarySetups /></Shelled>} 
            />
            <Route 
              path="/settings" 
              element={<Shelled><Settings /></Shelled>} 
            />
            <Route 
              path="/queries" 
              element={<Shelled><Queries /></Shelled>} 
            />
            <Route 
              path="/map" 
              element={<Shelled><MapPage /></Shelled>} 
            />
            <Route 
              path="/venue/:venueId" 
              element={<Shelled><VenueDetail /></Shelled>} 
            />
            <Route path="/social" element={<ShelledNamed><SocialFeed /></ShelledNamed>} />
            <Route path="/leaderboard" element={<ShelledNamed><Leaderboard /></ShelledNamed>} />
            <Route path="/leaderboard/:scope" element={<ShelledNamed><Leaderboard /></ShelledNamed>} />
            <Route path="/share/:token" element={<ShareView />} />
            <Route path="/social/session/:shareToken" element={<SessionShareView />} />
            <Route path="/social/join/:inviteCode" element={<GroupJoinView />} />
            <Route path="/admin/upload" element={<Shelled><AdminUpload /></Shelled>} />
            <Route path="/admin/db-status" element={<Shelled><AdminDbStatus /></Shelled>} />
            <Route path="/admin/test-advice" element={<Shelled><AdminTestAdvice /></Shelled>} />
            <Route path="/admin/recompute" element={<Shelled><AdminRecompute /></Shelled>} />
            <Route path="/admin/venue-submissions" element={<Shelled><AdminVenueSubmissions /></Shelled>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ActiveSessionProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
