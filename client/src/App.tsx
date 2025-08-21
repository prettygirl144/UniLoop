import { Switch, Route } from "wouter";
// Removed Auth0 provider - using session-based authentication
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { useAuthContext } from "@/context/AuthContext";
import { CacheStatusIndicator } from "@/components/CacheRefreshButton";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import Calendar from "@/pages/Calendar";
import Forum from "@/pages/Forum";
import Amenities from "@/pages/Amenities";
import Directory from "@/pages/Directory";
import Admin from "@/pages/Admin";
import Attendance from "@/pages/Attendance";
import Gallery from "@/pages/Gallery";
import Triathlon from "@/pages/Triathlon";
import Auth0Login from "@/pages/Auth0Login";
import Auth0Logout from "@/pages/Auth0Logout";
import Layout from "@/components/Layout";

function Router() {
  const { isAuthenticated, isLoading } = useAuthContext();
  

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          {/* All unauthenticated routes redirect to landing */}
          <Route path="/" component={Landing} />
          <Route path="*" component={Landing} />
        </>
      ) : (
        <Layout>
          {/* All routes inside a single Layout - this is the fix */}
          <Route path="/" component={Home} />
          <Route path="/calendar" component={Calendar} />
          <Route path="/events" component={Calendar} />
          <Route path="/gallery" component={Gallery} />
          <Route path="/gallery/:id" component={Gallery} />
          <Route path="/forum" component={Forum} />
          <Route path="/forum/posts" component={Forum} />
          <Route path="/forum/announcements" component={Forum} />
          <Route path="/forum/:topicId" component={Forum} />
          <Route path="/amenities" component={Amenities} />
          <Route path="/amenities/menu" component={Amenities} />
          <Route path="/amenities/services" component={Amenities} />
          <Route path="/amenities/records" component={Amenities} />
          <Route path="/amenities/weekly" component={Amenities} />
          <Route path="/triathlon" component={Triathlon} />
          <Route path="/triathlon/leaderboard" component={Triathlon} />
          <Route path="/directory" component={Directory} />
          <Route path="/attendance" component={Attendance} />
          <Route path="/attendance/:eventId" component={Attendance} />
          <Route path="/hostel/leave" component={Amenities} />
          <Route path="/hostel/leave/records" component={Amenities} />
          <Route path="/community" component={Forum} />
          
          {/* Admin routes */}
          <Route path="/admin" component={Admin} />
          <Route path="/admin/users" component={Admin} />
          <Route path="/admin/students" component={Admin} />
          <Route path="/admin/logs" component={Admin} />
          <Route path="/admin/amenities" component={Admin} />
          <Route path="/admin/amenities/records" component={Admin} />
          <Route path="/admin/forum" component={Admin} />
          <Route path="/admin/triathlon" component={Admin} />
          <Route path="/admin/events" component={Admin} />
          <Route path="/admin/announcements" component={Admin} />
          <Route path="/admin/leave" component={Admin} />
          
          {/* Auth routes */}
          <Route path="/auth/login" component={Auth0Login} />
          <Route path="/auth/logout" component={Auth0Logout} />
          
          {/* Single catch-all route as the very last route */}
          <Route path="*" component={NotFound} />
        </Layout>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
          <CacheStatusIndicator />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
