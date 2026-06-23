import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/AppContext";
import NotFound from "@/pages/not-found";

// Components
import Layout from "@/components/layout/Layout";

// Pages
import Overview from "@/pages/Overview";
import Transfers from "@/pages/Transfers";
import Scan from "@/pages/Scan";
import Matching from "@/pages/Matching";
import Inactive from "@/pages/Inactive";
import Statement from "@/pages/Statement";
import Whatsapp from "@/pages/Whatsapp";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Overview} />
        <Route path="/transfers" component={Transfers} />
        <Route path="/scan" component={Scan} />
        <Route path="/matching" component={Matching} />
        <Route path="/inactive" component={Inactive} />
        <Route path="/statement" component={Statement} />
        <Route path="/whatsapp" component={Whatsapp} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
