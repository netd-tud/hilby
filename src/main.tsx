import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './App.css'

import '@mantine/core/styles.css';
import App from './App.tsx'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider>
      <QueryClientProvider client={queryClient}>

        <App />
      </QueryClientProvider>
    </MantineProvider>
    
  </StrictMode>,
)
