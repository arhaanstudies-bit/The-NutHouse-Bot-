import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import NotFound from "@/pages/not-found";

import DashboardPage from "@/pages/dashboard";
import PendingUsersPage from "@/pages/pending-users";
import ApprovedUsersPage from "@/pages/approved-users";
import MediaPage from "@/pages/media";
import BroadcastsPage from "@/pages/broadcasts";
import SettingsPage from "@/pages/settings";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/pending-users" component={PendingUsersPage} />
      <Route path="/approved-users" component={ApprovedUsersPage} />
      <Route path="/media" component={MediaPage} />
      <Route path="/broadcasts" component={BroadcastsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Layout>
            <Router />
          </Layout>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
