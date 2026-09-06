-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CORRENTE',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "initialBalance" TEXT NOT NULL,
    "creditLimit" TEXT,
    "closingDay" INTEGER,
    "dueDay" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BankAccount" ("closingDay", "createdAt", "creditLimit", "currency", "dueDay", "id", "initialBalance", "institution", "name", "type", "updatedAt") SELECT "closingDay", "createdAt", "creditLimit", "currency", "dueDay", "id", "initialBalance", "institution", "name", "type", "updatedAt" FROM "BankAccount";
DROP TABLE "BankAccount";
ALTER TABLE "new_BankAccount" RENAME TO "BankAccount";
CREATE TABLE "new_BankTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "type" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "tags" TEXT,
    "isIncoming" BOOLEAN NOT NULL DEFAULT false,
    "transferGroupId" TEXT,
    "counterpartAccountId" TEXT,
    "installmentGroupId" TEXT,
    "installmentIndex" INTEGER,
    "installmentCount" INTEGER,
    "recurrenceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BankTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BankAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BankTransaction_counterpartAccountId_fkey" FOREIGN KEY ("counterpartAccountId") REFERENCES "BankAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BankTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BankTransaction_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "Recurrence" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BankTransaction" ("accountId", "amount", "categoryId", "counterpartAccountId", "createdAt", "date", "description", "id", "installmentCount", "installmentGroupId", "installmentIndex", "isIncoming", "notes", "recurrenceId", "tags", "transferGroupId", "type", "updatedAt") SELECT "accountId", "amount", "categoryId", "counterpartAccountId", "createdAt", "date", "description", "id", "installmentCount", "installmentGroupId", "installmentIndex", "isIncoming", "notes", "recurrenceId", "tags", "transferGroupId", "type", "updatedAt" FROM "BankTransaction";
DROP TABLE "BankTransaction";
ALTER TABLE "new_BankTransaction" RENAME TO "BankTransaction";
CREATE INDEX "BankTransaction_accountId_date_idx" ON "BankTransaction"("accountId", "date");
CREATE INDEX "BankTransaction_date_idx" ON "BankTransaction"("date");
CREATE INDEX "BankTransaction_transferGroupId_idx" ON "BankTransaction"("transferGroupId");
CREATE INDEX "BankTransaction_installmentGroupId_idx" ON "BankTransaction"("installmentGroupId");
CREATE TABLE "new_Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Budget" ("amount", "categoryId", "createdAt", "id", "month", "updatedAt", "year") SELECT "amount", "categoryId", "createdAt", "id", "month", "updatedAt", "year" FROM "Budget";
DROP TABLE "Budget";
ALTER TABLE "new_Budget" RENAME TO "Budget";
CREATE UNIQUE INDEX "Budget_categoryId_year_month_key" ON "Budget"("categoryId", "year", "month");
CREATE TABLE "new_ExpenseCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SAIDA',
    "color" TEXT NOT NULL DEFAULT '#0f766e',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    CONSTRAINT "ExpenseCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ExpenseCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ExpenseCategory" ("color", "id", "kind", "name", "parentId", "sortOrder", "system") SELECT "color", "id", "kind", "name", "parentId", "sortOrder", "system" FROM "ExpenseCategory";
DROP TABLE "ExpenseCategory";
ALTER TABLE "new_ExpenseCategory" RENAME TO "ExpenseCategory";
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");
CREATE TABLE "new_Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OBJETIVO',
    "targetAmount" TEXT NOT NULL,
    "currentAmount" TEXT NOT NULL,
    "deadline" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Goal" ("createdAt", "currentAmount", "deadline", "id", "kind", "name", "targetAmount", "updatedAt") SELECT "createdAt", "currentAmount", "deadline", "id", "kind", "name", "targetAmount", "updatedAt" FROM "Goal";
DROP TABLE "Goal";
ALTER TABLE "new_Goal" RENAME TO "Goal";
CREATE TABLE "new_Recurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "type" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recurrence_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BankAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recurrence_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Recurrence" ("accountId", "active", "amount", "categoryId", "createdAt", "dayOfMonth", "description", "endDate", "id", "startDate", "tags", "type", "updatedAt") SELECT "accountId", "active", "amount", "categoryId", "createdAt", "dayOfMonth", "description", "endDate", "id", "startDate", "tags", "type", "updatedAt" FROM "Recurrence";
DROP TABLE "Recurrence";
ALTER TABLE "new_Recurrence" RENAME TO "Recurrence";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
