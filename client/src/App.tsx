import { Switch, Route } from "wouter";
// Removed Auth0 provider - using session-based authentication
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/hooks/useAuth";
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
import Auth0Login from "@/pages/Auth0Login";
import Auth0Logout from "@/pages/Auth0Logout";
import Layout from "@/components/Layout";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

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
        <Route path="/" component={Landing} />
      ) : (
        <Layout>
          <Route path="/" component={Home} />
          <Route path="/calendar" component={Calendar} />
          <Route path="/gallery" component={Gallery} />
          <Route path="/forum" component={Forum} />
          <Route path="/amenities" component={Amenities} />
          <Route path="/directory" component={Directory} />
          <Route path="/admin" component={Admin} />
          <Route path="/attendance" component={Attendance} />
        </Layout>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
