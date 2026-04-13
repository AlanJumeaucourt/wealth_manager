import { config } from "./config.js";
import { app } from "./app";
import { runMigrations } from "./db/migrate.js";
import { ensureDemoData } from "./demo/seedDemoData.js";
import { markDemoSeeded } from "./demo/demoSeedStatus.js";

await runMigrations();
if (config.demoMode) {
  try {
    await ensureDemoData({ monthsBack: config.demoSimulationYears * 12 });
    markDemoSeeded(true);
  } catch {
    markDemoSeeded(false);
    throw new Error("Demo data seeding failed");
  }
} else {
  markDemoSeeded(false);
}

app.listen(config.port);

console.log(`Server running at http://localhost:${app.server?.port}`);
