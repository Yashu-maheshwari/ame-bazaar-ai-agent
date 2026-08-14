/**
 * AME Bazaar AI Agent System - Database Adapter Module
 * File: scripts/db.js
 * 
 * Provides production-safe connection handling for Supabase PostgreSQL
 * with fallback to mock mode for offline testing and local validation.
 */

let pgModule = null;
try {
    pgModule = require('pg');
} catch (err) {
    // pg module not installed or not loaded; mock mode will handle offline testing
}

class MockDbClient {
    constructor() {
        this.isMock = true;
        this.tables = {
            agents: [
                { id: 'social-media', name: 'Social Media Agent', is_active: true },
                { id: 'blogger', name: 'Blogger Agent', is_active: true }
            ],
            schedules: [
                { agent_id: 'social-media', slot_time: '11:00:00', is_enabled: true },
                { agent_id: 'social-media', slot_time: '14:00:00', is_enabled: true },
                { agent_id: 'social-media', slot_time: '19:00:00', is_enabled: true }
            ],
            executions: [],
            idempotency_keys: [],
            recovery_events: []
        };
        this.idCounter = 1;
    }

    async query(sqlText, params = []) {
        const sql = sqlText.trim().replace(/\s+/g, ' ');

        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            return { rowCount: 0, rows: [] };
        }

        if (sql.includes('SELECT 1')) {
            return { rowCount: 1, rows: [{ '?column?': 1 }] };
        }

        if (sql.includes('SELECT id, name, is_active FROM agents') || sql.includes('SELECT * FROM agents')) {
            return { rows: this.tables.agents, rowCount: this.tables.agents.length };
        }

        if (sql.includes('SELECT s.agent_id, s.slot_time')) {
            const rows = this.tables.schedules.map(s => ({
                agent_id: s.agent_id,
                slot_time: s.slot_time,
                is_active: true
            }));
            return { rows, rowCount: rows.length };
        }

        if (sql.includes('SELECT * FROM idempotency_keys WHERE idempotency_key = $1')) {
            const key = params[0];
            const rows = this.tables.idempotency_keys.filter(k => k.idempotency_key === key);
            return { rows, rowCount: rows.length };
        }

        if (sql.includes('SELECT status FROM executions WHERE id = $1')) {
            const id = params[0];
            const rows = this.tables.executions.filter(e => e.id === id);
            return { rows, rowCount: rows.length };
        }

        if (sql.includes('INSERT INTO executions')) {
            const id = `exec-uuid-${this.idCounter++}`;
            const record = {
                id,
                agent_id: params[0],
                scheduled_slot: params[1],
                business_date: params[2],
                status: params[3] || 'RUNNING',
                error_message: params[4] || null,
                retry_count: 0
            };
            this.tables.executions.push(record);
            return { rows: [{ id }], rowCount: 1 };
        }

        if (sql.includes('INSERT INTO idempotency_keys')) {
            const id = `idem-uuid-${this.idCounter++}`;
            const idempotency_key = params[4];

            if (this.tables.idempotency_keys.some(k => k.idempotency_key === idempotency_key)) {
                throw new Error(`duplicate key value violates unique constraint "unique_agent_slot_date"`);
            }

            const record = {
                id,
                execution_id: params[0],
                agent_id: params[1],
                scheduled_slot: params[2],
                business_date: params[3],
                idempotency_key
            };
            this.tables.idempotency_keys.push(record);
            return { rows: [{ id }], rowCount: 1 };
        }

        if (sql.includes('INSERT INTO recovery_events')) {
            const id = `rec-uuid-${this.idCounter++}`;
            this.tables.recovery_events.push({ id, details: params[3] });
            return { rows: [{ id }], rowCount: 1 };
        }

        if (sql.includes('UPDATE executions')) {
            const status = params[0];
            const error_message = params[1];
            const id = params[2];
            const exec = this.tables.executions.find(e => e.id === id);
            if (exec) {
                exec.status = status;
                exec.error_message = error_message;
                if (status === 'FAILED') exec.retry_count += 1;
            }
            return { rowCount: exec ? 1 : 0, rows: [] };
        }

        return { rows: [], rowCount: 0 };
    }

    async end() {
        return;
    }
}

/**
 * Creates and returns a database client.
 * Uses real PostgreSQL if DATABASE_URL is set and pg module is available.
 * Fallbacks cleanly to MockDbClient if MOCK_DB=true or DATABASE_URL is missing.
 */
function createDbClient(connectionString = process.env.DATABASE_URL) {
    if (process.env.MOCK_DB === 'true' || !connectionString || !pgModule) {
        return new MockDbClient();
    }

    const { Client } = pgModule;
    // Configure SSL for Supabase / Cloud Postgres
    const ssl = connectionString.includes('localhost') ? false : { rejectUnauthorized: false };
    return new Client({ connectionString, ssl });
}

/**
 * Validates DB connection safely.
 */
async function validateConnection(clientOverride = null) {
    const client = clientOverride || createDbClient();
    const shouldClose = !clientOverride;
    try {
        if (!clientOverride && !client.isMock) {
            await client.connect();
        }
        const res = await client.query('SELECT 1');
        return { success: res.rowCount === 1, isMock: !!client.isMock };
    } catch (err) {
        return { success: false, error: err.message, isMock: !!client.isMock };
    } finally {
        if (shouldClose && !client.isMock) {
            await client.end().catch(() => {});
        }
    }
}

module.exports = {
    createDbClient,
    validateConnection,
    MockDbClient
};
