import './style.css';
import { App } from './app';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const app = new App(canvas);
app.start();

(window as unknown as { app: App }).app = app;
