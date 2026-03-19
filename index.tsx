
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('--- App Entry Point Reached ---');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Critical: Could not find root element with id 'root'");
  throw new Error("Could not find root element");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
