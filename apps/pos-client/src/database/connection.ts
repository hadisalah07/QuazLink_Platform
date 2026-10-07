import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

// Universal SQLite Engine Selector:
// 1. Native node:sqlite on Node 22+ (instant, synchronous)
// 2. sql.js (WebAssembly SQLite) for Electron, Windows 7, and Node < 22 (100% zero-native, cross-platform)
let NativeDatabaseSync: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeSqlite = require('node:sqlite');
  if (nodeSqlite && nodeSqlite.DatabaseSync) {
    NativeDatabaseSync = nodeSqlite.DatabaseSync;
  }
} catch {
  // Not available in this runtime
}

class SqlJsAdapter {
  private db: any;
  private dbPath: string;

  constructor(SQL: any, dbPath: string) {
    this.dbPath = dbPath;
    if (dbPath !== ':memory:' && fs.existsSync(dbPath)) {
      const buf = fs.readFileSync(dbPath);
      this.db = new SQL.Database(buf);
    } else {
      this.db = new SQL.Database();
    }
  }

  public prepare(sql: string) {
    const db = this.db;
    const dbPath = this.dbPath;
    return {
      all(...params: any[]) {
        const stmt = db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        const rows: any[] = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      },
      get(...params: any[]) {
        const stmt = db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        let row = null;
        if (stmt.step()) {
          row = stmt.getAsObject();
        }
        stmt.free();
        return row;
      },
      run(...params: any[]) {
        const stmt = db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        stmt.step();
        stmt.free();
        const changes = db.getRowsModified();
        if (dbPath !== ':memory:') {
          const data = db.export();
          fs.writeFileSync(dbPath, Buffer.from(data));
        }
        return { changes, lastInsertRowid: 0 };
      },
    };
  }

  public exec(sql: string) {
    this.db.exec(sql);
    if (this.dbPath !== ':memory:') {
      const data = this.db.export();
      fs.writeFileSync(this.dbPath, Buffer.from(data));
    }
  }

  public close() {
    if (this.dbPath !== ':memory:') {
      const data = this.db.export();
      fs.writeFileSync(this.dbPath, Buffer.from(data));
    }
    this.db.close();
  }
}

export class PosDatabase {
  private static instance: PosDatabase | null = null;
  private static sqlJsModule: any = null;
  public db: any;
  private dbPath: string;

  constructor(dbPath: string = ':memory:') {
    this.dbPath = dbPath;
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    if (NativeDatabaseSync) {
      this.db = new NativeDatabaseSync(this.dbPath);
    } else if (PosDatabase.sqlJsModule) {
      this.db = new SqlJsAdapter(PosDatabase.sqlJsModule, this.dbPath);
    } else {
      // Synchronous attempt to load sql.js if possible
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const initSqlJs = require('sql.js');
        // If not initialized, throw descriptive error
        throw new Error('SQLite engine not initialized. Please call await PosDatabase.initializeEngine() at startup.');
      } catch (err: any) {
        throw new Error(`Fatal: SQLite engine unavailable (${err.message}).`);
      }
    }

    this.initSchema();
  }

  public static async initializeEngine(): Promise<void> {
    if (NativeDatabaseSync) return;
    if (!PosDatabase.sqlJsModule) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const initSqlJs = require('sql.js');
      PosDatabase.sqlJsModule = await initSqlJs();
    }
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

  public prepare(sql: string): any {
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
