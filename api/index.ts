import { createApp } from "../server/app";
import { serveStatic } from "../server/_core/vite";

const app = createApp();
serveStatic(app);

export default app;
