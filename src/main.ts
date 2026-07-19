import './styles/main.css';
import { ViewportManager } from './viewport/ViewportManager';
import { createAppShell } from './ui/AppShell';
import { DocumentStore } from './document/DocumentStore';

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) {
  throw new Error('Missing #app root element');
}

new ViewportManager();
const documentStore = new DocumentStore();
appRoot.appendChild(createAppShell(documentStore));
