import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import CueApp from './CueApp.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CueApp />
  </StrictMode>,
);
