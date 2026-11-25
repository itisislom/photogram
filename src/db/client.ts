import { neon } from '@neondatabase/serverless';

export function toPostgresSql(rawSql: string): string {
  let s = rawSql.trim();
  const hadIgnore = /INSERT\s+OR\s+IGNORE\s+INTO/i.test(s);
  if (hadIgnore) {
    s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
    if (!/ON\s+CONFLICT/i.test(s)) {
      s += ' ON CONFLICT DO NOTHING';
    }
  }

  if (/INSERT\s+INTO\s+(users|posts|comments|username_changes|conversations|messages|notifications)\b/i.test(s) && !/RETURNING/i.test(s)) {
    s += ' RETURNING id';
  }

  s = s.replace(/datetime\('now'\)/gi, 'NOW()');
  s = s.replace(/julianday\('now'\)/gi, 'julianday(NOW())');

  let index = 1;
  let inString = false;
  let result = '';
  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    if (char === "'") {
      if (inString && s[i + 1] === "'") {
        result += "''";
        i++;
        continue;
      }
      inString = !inString;
      result += char;
    } else if (!inString && char === '?') {
      if (i + 1 < s.length && /\d/.test(s[i + 1])) {
        let numStr = '';
        let j = i + 1;
        while (j < s.length && /\d/.test(s[j])) {
          numStr += s[j];
          j++;
        }
        result += '$' + numStr;
        i = j - 1;
      } else {
        result += '$' + index++;
      }
    } else {
      result += char;
    }
  }
  return result;
}

export interface PostgresPreparedStatement {
  sql: string;
  params: any[];
  bind(...params: any[]): PostgresPreparedStatement;
  first<T = any>(colName?: string): Promise<T | null>;
  all<T = any>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number; last_row_id?: number } }>;
}

export interface PostgresDb {
  query<T = any>(rawSql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(rawSql: string, params?: any[]): Promise<T | null>;
  execute(rawSql: string, params?: any[]): Promise<any[]>;
  batch(queries: Array<{ sql: string; params?: any[] } | PostgresPreparedStatement>): Promise<any[]>;
  prepare(rawSql: string): PostgresPreparedStatement;
}

function normalizeRow(row: any): any {
  if (!row || typeof row !== 'object') return row;
  for (const k of Object.keys(row)) {
    const v = row[k];
    if (v instanceof Date) {
      row[k] = v.toISOString().replace('T', ' ').substring(0, 19);
    }
  }
  return row;
}

export function createPostgresClient(databaseUrl: string): PostgresDb {
  const cleanUrl = databaseUrl.replace(/^[\uFEFF\s]+|[\uFEFF\s]+$/g, '').trim();
  const sql = neon(cleanUrl);

  const query = async <T = any>(rawSql: string, params: any[] = []): Promise<T[]> => {
    const pgSql = toPostgresSql(rawSql);
    const rows = await sql.query(pgSql, params);
    if (Array.isArray(rows)) {
      for (let i = 0; i < rows.length; i++) {
        normalizeRow(rows[i]);
      }
    }
    return rows as T[];
  };

  const queryOne = async <T = any>(rawSql: string, params: any[] = []): Promise<T | null> => {
    const rows = await query<T>(rawSql, params);
    return rows.length > 0 ? rows[0] : null;
  };

  const execute = async (rawSql: string, params: any[] = []): Promise<any[]> => {
    const pgSql = toPostgresSql(rawSql);
    return (await sql.query(pgSql, params)) as any[];
  };

  const batch = async (
    queries: Array<{ sql: string; params?: any[] } | PostgresPreparedStatement>
  ): Promise<any[]> => {
    if (!queries.length) return [];
    const results: any[] = [];
    const chunkSize = 50;
    for (let i = 0; i < queries.length; i += chunkSize) {
      const chunk = queries.slice(i, i + chunkSize);
      if (typeof sql.transaction === 'function') {
        const txQueries = chunk.map(q => sql.query(toPostgresSql(q.sql), q.params || []));
        const txRes = await sql.transaction(txQueries);
        results.push(...txRes);
      } else {
        for (const q of chunk) {
          results.push(await query(q.sql, q.params || []));
        }
      }
    }
    return results;
  };

  const prepare = (rawSql: string, boundParams: any[] = []): PostgresPreparedStatement => {
    const createExecutor = (params: any[]): PostgresPreparedStatement => ({
      sql: rawSql,
      params,
      bind(...newParams: any[]) {
        return createExecutor(newParams);
      },
      async first<T = any>(colName?: string): Promise<T | null> {
        const row = await queryOne<any>(rawSql, params);
        if (!row) return null;
        if (colName && typeof row === 'object' && colName in row) {
          return row[colName] as T;
        }
        return row as T;
      },
      async all<T = any>(): Promise<{ results: T[] }> {
        const results = await query<T>(rawSql, params);
        return { results };
      },
      async run(): Promise<{ meta: { changes: number; last_row_id?: number } }> {
        const rows = await execute(rawSql, params);
        const lastId = rows && rows[0] && rows[0].id ? Number(rows[0].id) : undefined;
        return {
          meta: {
            changes: rows ? rows.length : 0,
            last_row_id: lastId
          }
        };
      }
    });

    return createExecutor(boundParams);
  };

  return {
    query,
    queryOne,
    execute,
    batch,
    prepare
  };
}
