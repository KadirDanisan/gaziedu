import "dotenv/config";
import express from "express";
import cors from "cors";
import { uploadsDir } from "./config/env.js";
import pool from "./db/pool.js";
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
app.use("/uploads", async (req, res, next) => {
  try {
    const uploadPath = `/uploads${decodeURIComponent(req.path)}`;
    const protectedFile = await pool.query(
      `SELECT 1
       FROM education_modules em
       JOIN educations e ON e.id = em.education_id
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(em.resources, '[]'::jsonb)) resource
       WHERE e.sales_filter = 'kalite-egitim'
         AND (
           resource->>'path' = $1
           OR resource->>'path' LIKE $2
           OR resource->>'url' = $1
           OR resource->>'url' LIKE $2
         )
       LIMIT 1`,
      [uploadPath, `%${uploadPath}`],
    );
    if (protectedFile.rows[0]) return res.status(404).end();
    return next();
  } catch (error) {
    return next(error);
  }
});
app.use("/uploads", express.static(uploadsDir));

registerRoutes(app);

app.use(errorHandler);

export default app;
