import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getFirebaseConfigFromEnv, initializeFirebase } from '@chrisasstanina/firebase';
import { AuthProvider } from '@chrisasstanina/auth';
import { BootstrapWrapper } from './BootstrapWrapper';
import App from './App';
import './index.css';

initializeFirebase(getFirebaseConfigFromEnv());

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BootstrapWrapper>
          <App />
        </BootstrapWrapper>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
