import './styles/main.css';
import { ViewportManager } from './viewport/ViewportManager';
import { createAppShell } from './ui/AppShell';
import { DocumentStore } from './document/DocumentStore';
import { HistoryManager } from './edit/HistoryManager';

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) {
  throw new Error('Missing #app root element');
}

new ViewportManager();
const documentStore = new DocumentStore();
const historyManager = new HistoryManager(documentStore);
appRoot.appendChild(createAppShell(documentStore, historyManager));
