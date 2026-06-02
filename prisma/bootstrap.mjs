import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const prismaDir = join(projectRoot, "prisma");
const databasePath = join(prismaDir, "dev.db");
const migrationsDir = join(prismaDir, "migrations");
const sqliteBinary = "/usr/bin/sqlite3";

async function getMigrationFiles() {
  const entries = await readdir(migrationsDir, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(migrationsDir, entry.name, "migration.sql"))
    .sort();
}

function runCommand(command, args, input) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    input,
    stdio: ["pipe", "inherit", "inherit"],
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  const migrationFiles = await getMigrationFiles();

  if (migrationFiles.length === 0) {
    throw new Error("Inga migrationer hittades i prisma/migrations.");
  }

  await rm(databasePath, {
    force: true,
  });

  for (const migrationFile of migrationFiles) {
    const sql = await readFile(migrationFile, "utf8");
    runCommand(sqliteBinary, [databasePath], sql);
  }

  runCommand("npx", ["prisma", "generate"]);
  runCommand(process.execPath, [join(prismaDir, "seed.mjs")]);
}

await main();
