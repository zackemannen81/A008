"use strict";
const Database = require("better-sqlite3");
const databasePath = process.argv[2];
if (!databasePath) {
  process.stderr.write("A008 platform database path is required.\n");
  process.exit(2);
}
try {
  const db = new Database(databasePath, { readonly: true, fileMustExist: true });
  const count = db.prepare("SELECT count(*) AS n FROM A008_platform_runs WHERE status IN (?, ?, ?)").get(
    "running", "queued", "cancel_requested",
  ).n;
  db.close();
  process.stdout.write(String(count) + "\n");
} catch (error) {
  process.stderr.write("Cannot inspect active A008 runs: " + String(error) + "\n");
  process.exit(1);
}
