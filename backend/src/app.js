import "dotenv/config";
import express from "express";
import cors from "cors";
import { uploadsDir } from "./config/env.js";
import { registerRoutes } from "./routes/index.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();

app.use(
  cors({
    exposedHeaders: [
      "Content-Disposition",
      "X-Bulk-Success-Count",
      "X-Bulk-Failed-Count",
      "X-Bulk-Skipped-Count",
      "X-Bulk-Summary",
    ],
  }),
);
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

registerRoutes(app);

app.use(errorHandler);

export default app;
