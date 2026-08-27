import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { uploadLearningNote } from "./learningNotesUpload";
import { attachContentLibraryItem, uploadContentLibraryItem } from "./contentLibrary";
import { initializeDigitalStudyGuide } from "./starterStudyGuide";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";

export function createApp() {
  const app = express();

  // Files are delivered through protected object storage, never multipart request bodies.
  // Keep parser limits intentionally small to protect the autoscaled API from oversized or deeply nested payloads.
  app.set("query parser", "simple");
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(express.urlencoded({ limit: "1mb", extended: false, parameterLimit: 100 }));
  app.post("/api/learning-notes/upload", express.raw({ type: "*/*", limit: "10mb" }), uploadLearningNote);
  app.post("/api/content-library/upload", express.raw({ type: "*/*", limit: "10mb" }), uploadContentLibraryItem);
  app.post("/api/content-library/attach", attachContentLibraryItem);
  app.post("/api/content-library/initialize-digital-study-guide", initializeDigitalStudyGuide);
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  return app;
}
