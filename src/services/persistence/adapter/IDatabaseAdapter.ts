export type DatabaseDialect = 'sqlite' | 'postgres';

export interface QueryResult {
  changes: number;
  lastInsertRowId?: number | bigint;
}

export interface IDatabaseAdapter {
  readonly dialect: DatabaseDialect;

  /**
   * Executes a parameterized query returning multiple rows.
   */
  query<T = any>(sql: string, params?: any[]): Promise<T[]> | T[];

  /**
   * Executes a parameterized query returning a single row or null.
   */
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> | T | null;

  /**
   * Executes an INSERT, UPDATE, or DELETE query and returns rows affected.
   */
  execute(sql: string, params?: any[]): Promise<QueryResult> | QueryResult;

  /**
   * Runs raw DDL or multi-statement SQL.
   */
  exec(sql: string): Promise<void> | void;

  /**
   * Executes a callback within a managed database transaction with appropriate
   * engine-specific isolation (BEGIN IMMEDIATE for SQLite, BEGIN for PostgreSQL).
   */
  transaction<T>(fn: () => T | Promise<T>): Promise<T> | T;

  /**
   * Closes database connection or connection pool.
   */
  close(): Promise<void> | void;
}

export interface ISyncDatabaseAdapter {
  readonly dialect: DatabaseDialect;
  query<T = any>(sql: string, params?: any[]): T[];
  queryOne<T = any>(sql: string, params?: any[]): T | null;
  execute(sql: string, params?: any[]): QueryResult;
  exec(sql: string): void;
  transaction<T>(fn: () => T): T;
  close(): void;
}
