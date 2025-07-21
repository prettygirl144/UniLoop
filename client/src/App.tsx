import { Switch, Route } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
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
import Dining from "@/pages/Dining";
import Directory from "@/pages/Directory";
import Admin from "@/pages/Admin";
import Attendance from "@/pages/Attendance";
import Gallery from "@/pages/Gallery";
import Auth0Login from "@/pages/Auth0Login";
import Auth0Logout from "@/pages/Auth0Logout";
import Layout from "@/components/Layout";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const auth0 = useAuth0();
  
  // Check if Auth0 is configured
  const isAuth0Configured = !!(import.meta.env.VITE_AUTH0_DOMAIN && 
                               import.meta.env.VITE_AUTH0_CLIENT_ID && 
                               import.meta.env.VITE_AUTH0_AUDIENCE);

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
        isAuth0Configured ? 
          <Route path="/" component={Auth0Login} /> : 
          <Route path="/" component={Landing} />
      ) : (
        <Layout>
          <Route path="/" component={Home} />
          <Route path="/calendar" component={Calendar} />
          <Route path="/gallery" component={Gallery} />
          <Route path="/forum" component={Forum} />
          <Route path="/dining" component={Dining} />
          <Route path="/directory" component={Directory} />
          <Route path="/admin" component={Admin} />
          <Route path="/attendance" component={Attendance} />
        </Layout>
      )}
      {isAuth0Configured && <Route path="/logout" component={Auth0Logout} />}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
