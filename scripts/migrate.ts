import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../lib/utils/logger';

async function main() {
  const databaseUrl = process.env.DATABASE_URL || 'file:./config/db.sqlite';
  const client = createClient({
    url: databaseUrl,
  });

  const db = drizzle(client);

  const migrationsFolder = path.join(__dirname, '../lib/db/migrations');
  const migrationFiles = fs.readdirSync(migrationsFolder).filter(file => file.endsWith('.sql'));

  for (const file of migrationFiles) {
    logger.info(`Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsFolder, file), 'utf-8');
    const statements = sql.split('--> statement-breakpoint');
    for (const statement of statements) {
      if (statement.trim() && !statement.trim().startsWith('--')) {
        await db.run(statement);
      }
    }
  }

  logger.info('Migrations applied successfully!');
}

main().catch(err => {
  logger.error('Migration failed', { error: err instanceof Error ? err.message : err });
  process.exit(1);
});
