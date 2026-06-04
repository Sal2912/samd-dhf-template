import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Documents from "@/pages/Documents";
import DocumentDetail from "@/pages/DocumentDetail";
import Stories from "@/pages/Stories";
import StoryDetail from "@/pages/StoryDetail";
import AuditTrail from "@/pages/AuditTrail";
import NotFound from "@/pages/not-found";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/documents" component={Documents} />
            <Route path="/documents/:id" component={DocumentDetail} />
            <Route path="/stories" component={Stories} />
            <Route path="/stories/:storyId" component={StoryDetail} />
            <Route path="/audit" component={AuditTrail} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
