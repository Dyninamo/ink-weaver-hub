import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
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
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/results" 
              element={
                <ProtectedRoute>
                  <Results />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/diary" 
              element={
                <ProtectedRoute>
                  <Diary />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/diary/new" 
              element={
                <ProtectedRoute>
                  <DiaryNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/diary/:id" 
              element={
                <ProtectedRoute>
                  <DiaryEntry />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/diary/settings/setups" 
              element={
                <ProtectedRoute>
                  <DiarySetups />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/queries" 
              element={
                <ProtectedRoute>
                  <Queries />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/map" 
              element={
                <ProtectedRoute>
                  <MapPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/venue/:venueId" 
              element={
                <ProtectedRoute>
                  <VenueDetail />
                </ProtectedRoute>
              } 
            />
            <Route path="/social" element={<ProtectedRoute requireDisplayName><SocialFeed /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute requireDisplayName><Leaderboard /></ProtectedRoute>} />
            <Route path="/leaderboard/:scope" element={<ProtectedRoute requireDisplayName><Leaderboard /></ProtectedRoute>} />
            <Route path="/share/:token" element={<ShareView />} />
            <Route path="/social/session/:shareToken" element={<SessionShareView />} />
            <Route path="/social/join/:inviteCode" element={<GroupJoinView />} />
            <Route path="/admin/upload" element={<ProtectedRoute><AdminUpload /></ProtectedRoute>} />
            <Route path="/admin/db-status" element={<ProtectedRoute><AdminDbStatus /></ProtectedRoute>} />
            <Route path="/admin/test-advice" element={<ProtectedRoute><AdminTestAdvice /></ProtectedRoute>} />
            <Route path="/admin/recompute" element={<ProtectedRoute><AdminRecompute /></ProtectedRoute>} />
            <Route path="/admin/venue-submissions" element={<ProtectedRoute><AdminVenueSubmissions /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
