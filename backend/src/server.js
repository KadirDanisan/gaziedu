import app from "./app.js";
import { port } from "./config/env.js";
import { migrations } from "./db/migrations/index.js";
import { publishDueEducationCalendarItems } from "./services/education/calendar.js";

process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("unhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("uncaughtException:", err);
  process.exit(1);
});

const startServer = async () => {
  for (const run of migrations) {
    try {
      await run();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Migration ${run.name} skipped:`, error.message);
    }
  }

  app.listen(port, () => {
    // eslint-disable-next-line no-console
  });
  await publishDueEducationCalendarItems();
  setInterval(publishDueEducationCalendarItems, 60 * 1000);
};

startServer();
