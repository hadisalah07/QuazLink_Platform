import { DatabaseSync, StatementSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export class PosDatabase {
  private static instance: PosDatabase | null = null;
  public db: DatabaseSync;
  private dbPath: string;

  constructor(dbPath: string = ':memory:') {
    this.dbPath = dbPath;
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(this.dbPath);
    this.initSchema();
  }

  public static getInstance(dbPath?: string): PosDatabase {
    if (!PosDatabase.instance) {
      const defaultPath = dbPath || path.join(process.env.USERPROFILE || process.env.HOME || '.', '.quazlink', 'pos_local.db');
      PosDatabase.instance = new PosDatabase(defaultPath);
    }
    return PosDatabase.instance;
  }

  public static createInMemory(): PosDatabase {
    return new PosDatabase(':memory:');
  }

  private initSchema(): void {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      this.db.exec(sql);
    } else {
      // Fallback relative resolution if compiled
      const fallbackPath = path.join(process.cwd(), 'apps', 'pos-client', 'src', 'database', 'schema.sql');
      if (fs.existsSync(fallbackPath)) {
        const sql = fs.readFileSync(fallbackPath, 'utf8');
        this.db.exec(sql);
      }
    }
  }

  public prepare(sql: string): StatementSync {
    return this.db.prepare(sql);
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public queryAll<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  public queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params);
    return (result as T) || null;
  }

  public run(sql: string, params: any[] = []): { changes: number | bigint; lastInsertRowid: number | bigint } {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  private inTransaction = false;

  public transaction<T>(callback: () => T): T {
    if (this.inTransaction) {
      return callback();
    }

    this.inTransaction = true;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = callback();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    } finally {
      this.inTransaction = false;
    }
  }

  public generateId(): string {
    return crypto.randomUUID();
  }

  public close(): void {
    this.db.close();
  }
}
