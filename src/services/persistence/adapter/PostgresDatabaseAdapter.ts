import { Pool, PoolConfig, PoolClient } from 'pg';
import { IDatabaseAdapter, DatabaseDialect, QueryResult } from './IDatabaseAdapter';

export class PostgresDatabaseAdapter implements IDatabaseAdapter {
  public readonly dialect: DatabaseDialect = 'postgres';
  private pool: Pool;

  constructor(configOrPool: PoolConfig | Pool) {
    if (configOrPool instanceof Pool) {
      this.pool = configOrPool;
    } else {
      this.pool = new Pool(configOrPool);
    }
  }

  private convertPlaceholders(sql: string): string {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const pgSql = this.convertPlaceholders(sql);
    const res = await this.pool.query(pgSql, params);
    return res.rows as T[];
  }

  public async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  public async execute(sql: string, params: any[] = []): Promise<QueryResult> {
    const pgSql = this.convertPlaceholders(sql);
    const res = await this.pool.query(pgSql, params);
    return {
      changes: res.rowCount || 0,
    };
  }

  public async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  public async transaction<T>(fn: (client?: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
      throw err;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
