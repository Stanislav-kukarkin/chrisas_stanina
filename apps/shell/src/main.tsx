import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getFirebaseConfigFromEnv, initializeFirebase } from '@chrisasstanina/firebase';
import { AuthProvider } from '@chrisasstanina/auth';
import { BootstrapProvider } from '@/components/layout/BootstrapProvider';
import App from './App';
import './index.css';

initializeFirebase(getFirebaseConfigFromEnv());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BootstrapProvider>
          <BrowserRouter basename={routerBasename || undefined}>
            <App />
          </BrowserRouter>
        </BootstrapProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
