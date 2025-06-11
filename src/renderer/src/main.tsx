import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@renderer/components/layout'
import { Toaster } from 'sonner'
const queryClient = new QueryClient()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Layout>
        <Toaster richColors closeButton />
        <App />
      </Layout>
    </QueryClientProvider>
  </StrictMode>
)
