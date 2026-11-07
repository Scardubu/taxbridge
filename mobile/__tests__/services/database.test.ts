import * as SQLite from 'expo-sqlite';
import { getDatabase } from '../../services/database';

describe('mobile SQLite durability configuration', () => {
  test('opens the canonical database and enables durable WAL settings', async () => {
    const database = await getDatabase();
    const openDatabaseAsync = SQLite.openDatabaseAsync as jest.Mock;
    const execAsync = database.execAsync as jest.Mock;

    expect(openDatabaseAsync).toHaveBeenCalledWith('taxbridge_v13.db');
    expect(execAsync).toHaveBeenCalledWith(expect.stringContaining('PRAGMA journal_mode = WAL;'));

    const initializationSql = String(execAsync.mock.calls[0]?.[0] ?? '');
    expect(initializationSql).toContain('PRAGMA busy_timeout = 5000;');
    expect(initializationSql).toContain('PRAGMA foreign_keys = ON;');
    expect(initializationSql).toContain('PRAGMA synchronous = FULL;');
    expect(initializationSql).toContain('PRAGMA wal_autocheckpoint = 1000;');
  });
});
