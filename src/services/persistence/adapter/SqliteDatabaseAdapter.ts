import { DatabaseSync } from 'node:sqlite';
import { IDatabaseAdapter, ISyncDatabaseAdapter, DatabaseDialect, QueryResult } from './IDatabaseAdapter';

export class SqliteDatabaseAdapter implements IDatabaseAdapter, ISyncDatabaseAdapter {
  public readonly dialect: DatabaseDialect = 'sqlite';
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  public getRawDb(): DatabaseSync {
    return this.db;
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  public queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params);
    return (row as T) || null;
  }

  public execute(sql: string, params: any[] = []): QueryResult {
    const stmt = this.db.prepare(sql);
    const res = stmt.run(...params);
    return {
      changes: Number(res.changes),
      lastInsertRowId: res.lastInsertRowid,
    };
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch (_) {}
      throw err;
    }
  }

  public close(): void {
    this.db.close();
  }
}
