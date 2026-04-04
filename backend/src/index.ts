import { config } from "./config.js";
import { app } from "./app";
import { runMigrations } from "./db/migrate.js";

await runMigrations();

app.listen(config.port);

console.log(`Server running at http://localhost:${app.server?.port}`);
