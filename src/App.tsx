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
import NotFound from "./pages/NotFound";
import AdminUpload from "./pages/AdminUpload";
import AdminDbStatus from "./pages/AdminDbStatus";
import AdminTestAdvice from "./pages/AdminTestAdvice";
import ProtectedRoute from "./components/ProtectedRoute";

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
            <Route path="/share/:token" element={<ShareView />} />
            <Route path="/admin/upload" element={<AdminUpload />} />
            <Route path="/admin/db-status" element={<AdminDbStatus />} />
            <Route path="/admin/test-advice" element={<AdminTestAdvice />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
