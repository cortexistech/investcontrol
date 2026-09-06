"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { ensureDatabase } = require("./migrate");

const projectRoot = path.join(__dirname, "..");
const migrationsDir = path.join(projectRoot, "prisma", "migrations");

// Uses the system-Node native addon; the packaged app resolves the Electron-rebuilt copy.
const standaloneDir = path.join(
  projectRoot,
  "node_modules",
  "@prisma",
  "adapter-better-sqlite3",
);

test("aplica todas as migrations e permanece idempotente", () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "investe-valor-migrate-"),
  );
  const dbPath = path.join(tempDir, "test.db");

  try {
    ensureDatabase(dbPath, migrationsDir, standaloneDir);
    ensureDatabase(dbPath, migrationsDir, standaloneDir);

    const Database = require(
      path.join(standaloneDir, "node_modules", "better-sqlite3"),
    );
    const db = new Database(dbPath);
    try {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => row.name);
      const migrationCount = db
        .prepare('SELECT COUNT(*) AS count FROM "__investe_valor_migrations"')
        .get().count;
      const expectedCount = fs
        .readdirSync(migrationsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory()).length;

      assert.ok(tables.includes("Investment"));
      assert.ok(tables.includes("PortfolioEntry"));
      assert.ok(tables.includes("InvestmentMovement"));
      assert.ok(tables.includes("BankAccount"));
      assert.ok(tables.includes("BankTransaction"));
      assert.ok(tables.includes("ExpenseCategory"));
      assert.equal(migrationCount, expectedCount);
    } finally {
      db.close();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("atualiza um banco legado sem repetir migrations já refletidas no schema", () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "investe-valor-legacy-"),
  );
  const dbPath = path.join(tempDir, "legacy.db");

  try {
    ensureDatabase(dbPath, migrationsDir, standaloneDir);
    const Database = require(
      path.join(standaloneDir, "node_modules", "better-sqlite3"),
    );
    const db = new Database(dbPath);
    db.exec('DROP TABLE "__investe_valor_migrations"');
    db.close();

    ensureDatabase(dbPath, migrationsDir, standaloneDir);

    const upgraded = new Database(dbPath);
    try {
      const migrationCount = upgraded
        .prepare('SELECT COUNT(*) AS count FROM "__investe_valor_migrations"')
        .get().count;
      const cashFlowColumns = upgraded
        .prepare('PRAGMA table_info("PortfolioEntry")')
        .all()
        .map((row) => row.name);
      assert.equal(
        migrationCount,
        fs
          .readdirSync(migrationsDir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory()).length,
      );
      assert.ok(cashFlowColumns.includes("contributions"));
      assert.ok(cashFlowColumns.includes("withdrawals"));
    } finally {
      upgraded.close();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
