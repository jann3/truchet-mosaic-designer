import './styles/main.css';
import { ViewportManager } from './viewport/ViewportManager';
import { createAppShell } from './ui/AppShell';

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) {
  throw new Error('Missing #app root element');
}

new ViewportManager();
appRoot.appendChild(createAppShell());
