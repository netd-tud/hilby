import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './App.css'

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import App from './App.tsx'
import { MantineProvider } from '@mantine/core'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider>
        <App />
    </MantineProvider>
  </StrictMode>,
)
