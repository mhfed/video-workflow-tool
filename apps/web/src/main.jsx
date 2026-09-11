import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/be-vietnam-pro/800.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import App from '@/App';
import '@/index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TooltipProvider delayDuration={120}>
      <App />
    </TooltipProvider>
  </StrictMode>
);
