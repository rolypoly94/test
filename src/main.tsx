import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

const url = new URL(window.location.href);
const params = new URLSearchParams(url.search || url.hash.substring(1));
const code = params.get('code');
const state = params.get('state');
const error = params.get('error');

if (code || error) {
  const responseData = code 
    ? { type: 'GOOGLE_OAUTH_CODE', code, state }
    : { type: 'GOOGLE_OAUTH_ERROR', error };

  if (window.opener) {
    window.opener.postMessage(responseData, '*');
  }
  
  localStorage.setItem('GOOGLE_OAUTH_RESPONSE', JSON.stringify({ ...responseData, timestamp: Date.now() }));
  
  document.body.innerHTML = '<div style="padding: 20px; font-family: sans-serif; text-align: center;">Authentication complete. Processing...</div>';
  setTimeout(() => window.close(), 1500);
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
