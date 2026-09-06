"use strict";
// Applies the SQL migrations in order and tracks each applied migration in the app database so
// packaged app updates can evolve existing databases.

const fs = require("node:fs");
const path = require("node:path");

// better-sqlite3 is a native addon and must match the Electron (not system Node) ABI it's
// running under. scripts/copy-standalone-assets.mjs copies the actual (already Electron-rebuilt)
// package here explicitly after the build, and scripts/electron-after-pack.cjs moves it into
// this standard location once electron-builder is done packaging (see the comments in both for
// why it can't just live here from the start) — Next's own file tracer proved unreliable for
// this specific native module, so this fixed path is the one guaranteed-correct source.
function loadDatabase(standaloneDir) {
  return require(path.join(standaloneDir, "node_modules", "better-sqlite3"));
}

function ensureDatabase(dbPath, migrationsDir, standaloneDir) {
  const Database = loadDatabase(standaloneDir);
  const db = new Database(dbPath);
  try {
    const migrationFolders = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    db.exec(`
      CREATE TABLE IF NOT EXISTS "__investe_valor_migrations" (
        "name" TEXT NOT NULL PRIMARY KEY,
        "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    baselineLegacyMigrations(db, migrationFolders);

    const applied = new Set(
      db
        .prepare('SELECT "name" FROM "__investe_valor_migrations"')
        .all()
        .map((row) => row.name),
    );

    for (const folder of migrationFolders) {
      if (applied.has(folder)) continue;
      const sqlPath = path.join(migrationsDir, folder, "migration.sql");
      if (!fs.existsSync(sqlPath)) continue;
      const applyMigration = db.transaction(() => {
        db.exec(fs.readFileSync(sqlPath, "utf8"));
        db.prepare(
          'INSERT INTO "__investe_valor_migrations" ("name") VALUES (?)',
        ).run(folder);
      });
      applyMigration();
    }
  } finally {
    db.close();
  }
}

function baselineLegacyMigrations(db, migrationFolders) {
  const hasUserTables = db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__investe_valor_migrations' LIMIT 1",
    )
    .get();
  if (!hasUserTables) return;

  const appliedCount = db
    .prepare('SELECT COUNT(*) AS count FROM "__investe_valor_migrations"')
    .get().count;
  if (appliedCount > 0) return;

  const hasTable = (table) =>
    Boolean(
      db
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        )
        .get(table),
    );
  const columns = (table) =>
    new Set(
      db
        .prepare(`PRAGMA table_info("${table}")`)
        .all()
        .map((row) => row.name),
    );
  const investmentColumns = columns("Investment");
  const settingsColumns = columns("Settings");
  const portfolioColumns = columns("PortfolioEntry");

  for (const folder of migrationFolders) {
    const applied =
      (folder.endsWith("_init") &&
        hasTable("Investment") &&
        hasTable("Settings")) ||
      (folder.endsWith("_remove_withdrawal") && !hasTable("Withdrawal")) ||
      (folder.endsWith("_encrypt_sensitive_fields") &&
        hasTextColumn(db, "Investment", "name")) ||
      (folder.endsWith("_add_portfolio_entries") &&
        hasTable("PortfolioEntry")) ||
      (folder.endsWith("_add_investment_movements") &&
        hasTable("InvestmentMovement")) ||
      (folder.endsWith("_add_investment_currencies") &&
        investmentColumns.has("currency") &&
        settingsColumns.has("usdToBrl") &&
        settingsColumns.has("eurToBrl")) ||
      (folder.endsWith("_add_portfolio_currency") &&
        portfolioColumns.has("currency")) ||
      (folder.endsWith("_track_portfolio_cash_flows") &&
        portfolioColumns.has("contributions") &&
        portfolioColumns.has("withdrawals")) ||
      (folder.endsWith("_add_authentication") &&
        hasTable("User") &&
        hasTable("AuthSession") &&
        hasTable("PasswordResetToken")) ||
      (folder.endsWith("_add_bank_accounts") &&
        hasTable("BankAccount") &&
        hasTable("BankTransaction") &&
        hasTable("ExpenseCategory")) ||
      (folder.endsWith("_add_finance_planning") &&
        hasTable("Recurrence") &&
        hasTable("Budget") &&
        hasTable("Goal"));

    if (applied) {
      db.prepare(
        'INSERT OR IGNORE INTO "__investe_valor_migrations" ("name") VALUES (?)',
      ).run(folder);
    }
  }
}

function hasTextColumn(db, table, column) {
  return db
    .prepare(`PRAGMA table_info("${table}")`)
    .all()
    .some((row) => row.name === column && row.type.toUpperCase() === "TEXT");
}

module.exports = { ensureDatabase };
