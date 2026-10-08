import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

// Universal SQLite Engine Selector:
// 1. Native node:sqlite on Node 22+ (only in pure Node.js environments, never in Electron)
// 2. sql-wasm (WebAssembly SQLite) bundled directly in dist/database/engine
// 3. sql-asm (Pure JavaScript asm.js SQLite) bundled as bulletproof universal fallback
let NativeDatabaseSync: any = null;

if (typeof process !== 'undefined' && process.versions && !process.versions.electron) {
  const major = parseInt((process.versions.node || '0').split('.')[0], 10);
  if (major >= 22) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodeSqlite = require('node:sqlite');
      if (nodeSqlite && nodeSqlite.DatabaseSync) {
        NativeDatabaseSync = nodeSqlite.DatabaseSync;
      }
    } catch {
      // Fall through to embedded engine
    }
  }
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
  private inTransaction = false;

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
      // Synchronous attempt: try loading bundled sql.js or asm.js
      try {
        const engineDir = path.join(__dirname, 'engine');
        const asmPath = path.join(engineDir, 'sql-asm.js');
        if (fs.existsSync(asmPath)) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const initAsm = require(asmPath);
          // sql-asm export is synchronous if not awaited in some builds, or returns a promise
          throw new Error('SQLite engine not initialized. Please call await PosDatabase.initializeEngine() at startup.');
        }
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const initSqlJs = require('sql.js');
        throw new Error('SQLite engine not initialized. Please call await PosDatabase.initializeEngine() at startup.');
      } catch (err: any) {
        throw new Error(`Fatal: SQLite engine unavailable (${err.message}).`);
      }
    }

    this.initSchema();
  }

  public static async initializeEngine(): Promise<void> {
    if (NativeDatabaseSync) return;
    if (PosDatabase.sqlJsModule) return;

    // Search paths for engine files
    const possibleEngineDirs = [
      path.join(__dirname, 'engine'),
      path.join(__dirname, '..', 'database', 'engine'),
      path.join(process.cwd(), 'dist', 'database', 'engine'),
      path.join(process.cwd(), 'src', 'database', 'engine'),
      path.join(process.cwd(), 'apps', 'pos-client', 'src', 'database', 'engine'),
      path.join(process.cwd(), 'apps', 'pos-client', 'dist', 'database', 'engine'),
    ];

    let foundEngineDir: string | null = null;
    for (const d of possibleEngineDirs) {
      if (fs.existsSync(d) && (fs.existsSync(path.join(d, 'sql-wasm.js')) || fs.existsSync(path.join(d, 'sql-asm.js')))) {
        foundEngineDir = d;
        break;
      }
    }

    // Strategy 1: Load bundled WebAssembly SQLite (sql-wasm.js + sql-wasm.wasm)
    if (foundEngineDir) {
      const wasmJsPath = path.join(foundEngineDir, 'sql-wasm.js');
      const wasmBinaryPath = path.join(foundEngineDir, 'sql-wasm.wasm');

      if (fs.existsSync(wasmJsPath)) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const initWasm = require(wasmJsPath);
          PosDatabase.sqlJsModule = await initWasm({
            locateFile: (file: string) => {
              if (file === 'sql-wasm.wasm') return wasmBinaryPath;
              return path.join(foundEngineDir!, file);
            },
          });
          console.log('✅ [SQLite] Loaded bundled WebAssembly SQLite engine');
          return;
        } catch (err: any) {
          console.warn('⚠️ [SQLite] WebAssembly engine init failed, falling back to ASM.js:', err.message);
        }
      }

      // Strategy 2: Load bundled pure-JavaScript SQLite (sql-asm.js)
      const asmJsPath = path.join(foundEngineDir, 'sql-asm.js');
      if (fs.existsSync(asmJsPath)) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const initAsm = require(asmJsPath);
          PosDatabase.sqlJsModule = await initAsm();
          console.log('✅ [SQLite] Loaded bundled pure-JS SQLite engine (sql-asm.js)');
          return;
        } catch (err: any) {
          console.warn('⚠️ [SQLite] Bundled ASM.js engine init failed:', err.message);
        }
      }
    }

    // Strategy 3: Standard npm module fallback
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const initSqlJs = require('sql.js');
      PosDatabase.sqlJsModule = await initSqlJs();
      console.log('✅ [SQLite] Loaded npm sql.js engine');
      return;
    } catch (err: any) {
      console.error('❌ [SQLite] All SQLite engines unavailable:', err.message);
      throw new Error(`Fatal: SQLite engine unavailable (${err.message})`);
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

  public static resetInstance(): void {
    if (PosDatabase.instance) {
      try {
        PosDatabase.instance.db.close();
      } catch {
        // Ignore close errors
      }
      PosDatabase.instance = null;
    }
  }

  private initSchema(): void {
    const possibleSchemaPaths = [
      path.join(__dirname, 'schema.sql'),
      path.join(__dirname, '..', 'database', 'schema.sql'),
      path.join(process.cwd(), 'src', 'database', 'schema.sql'),
      path.join(process.cwd(), 'dist', 'database', 'schema.sql'),
      path.join(process.cwd(), 'apps', 'pos-client', 'src', 'database', 'schema.sql'),
      path.join(process.cwd(), 'apps', 'pos-client', 'dist', 'database', 'schema.sql'),
    ];

    let schemaSql: string | null = null;
    for (const p of possibleSchemaPaths) {
      if (fs.existsSync(p)) {
        schemaSql = fs.readFileSync(p, 'utf-8');
        break;
      }
    }

    if (schemaSql) {
      this.db.exec(schemaSql);
    }
    this.runMigrations();
  }

  private runMigrations(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          applied_at TEXT NOT NULL
        );
      `);
    } catch {
      // Schema may already exist
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
