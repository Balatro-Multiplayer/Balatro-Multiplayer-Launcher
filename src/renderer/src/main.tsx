import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@renderer/components/layout'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@renderer/lib/theme-provider'

const queryClient = new QueryClient()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <Layout>
          <Toaster richColors closeButton />
          <App />
        </Layout>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
