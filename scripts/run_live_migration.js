/**
 * AME Bazaar AI Agent System - Live Supabase Migration & Verification Script
 * File: scripts/run_live_migration.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from local .env
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of envLines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            const key = trimmed.substring(0, idx).trim();
            const val = trimmed.substring(idx + 1).trim();
            if (!process.env[key]) {
                process.env[key] = val;
            }
        }
    }
}

const { Client } = require('pg');

async function runLiveMigration() {
    console.log("==================================================");
    console.log("STARTING LIVE SUPABASE DATABASE MIGRATION & TEST");
    console.log("==================================================\n");

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is missing in environment.");
    }

    const ssl = connectionString.includes('localhost') ? false : { rejectUnauthorized: false };
    const client = new Client({ connectionString, ssl });

    try {
        console.log("Connecting to Supabase PostgreSQL...");
        await client.connect();
        console.log("✓ Connected to Supabase PostgreSQL successfully.\n");

        // Step 1: Read & Execute DDL Migration Script
        const ddlPath = path.join(__dirname, '../database/migrations/001_initial_schema.sql');
        const ddlSql = fs.readFileSync(ddlPath, 'utf8');

        console.log("Executing database/migrations/001_initial_schema.sql...");
        await client.query(ddlSql);
        console.log("✓ DDL Migration executed successfully.\n");

        // Step 2: Verify Tables
        const expectedTables = ['agents', 'schedules', 'executions', 'idempotency_keys', 'content_items', 'platform_publish_results', 'recovery_events'];
        const tableRes = await client.query(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
        );
        const existingTables = tableRes.rows.map(r => r.table_name);
        
        for (const tbl of expectedTables) {
            if (existingTables.includes(tbl)) {
                console.log(`✓ Table '${tbl}' verified.`);
            } else {
                throw new Error(`Table '${tbl}' is missing in database!`);
            }
        }

        // Step 3: Verify Core Agents & Schedules
        const agentsRes = await client.query(`SELECT id, name, is_active FROM agents WHERE id = 'social-media'`);
        if (agentsRes.rows.length === 0) {
            throw new Error("Social Media Agent missing from agents table!");
        }
        console.log(`\n✓ Social Media Agent verified in 'agents' table.`);

        const schedulesRes = await client.query(`SELECT slot_time FROM schedules WHERE agent_id = 'social-media' ORDER BY slot_time`);
        const slotTimes = schedulesRes.rows.map(r => r.slot_time);
        console.log(`✓ Social Media Agent schedules verified: ${slotTimes.join(', ')}`);

        // Step 4: Run Live Idempotency & Lock Verification Test
        console.log("\nRunning live DB lock & idempotency test...");
        const testAgentId = 'social-media';
        const testSlot = '11:00:00';
        const testDate = '2026-08-14';
        const idempotencyKey = `live_test_${testAgentId}_${testDate}_${testSlot}_${Date.now()}`;

        await client.query('BEGIN');
        const execRes = await client.query(
            `INSERT INTO executions (agent_id, scheduled_slot, business_date, status, started_at)
             VALUES ($1, $2, $3, 'RUNNING', NOW()) RETURNING id`,
            [testAgentId, `${testDate}T${testSlot}+05:30`, testDate]
        );
        const execId = execRes.rows[0].id;

        await client.query(
            `INSERT INTO idempotency_keys (execution_id, agent_id, scheduled_slot, business_date, idempotency_key)
             VALUES ($1, $2, $3, $4, $5)`,
            [execId, testAgentId, `${testDate}T${testSlot}+05:30`, testDate, idempotencyKey]
        );
        await client.query('COMMIT');
        console.log(`✓ Live lock acquired. Execution ID: ${execId}`);

        // Verify Duplicate Rejection
        try {
            await client.query(
                `INSERT INTO idempotency_keys (execution_id, agent_id, scheduled_slot, business_date, idempotency_key)
                 VALUES ($1, $2, $3, $4, $5)`,
                [execId, testAgentId, `${testDate}T${testSlot}+05:30`, testDate, idempotencyKey]
            );
            throw new Error("Duplicate key insertion succeeded unexpectedly!");
        } catch (err) {
            if (err.message.includes('unique constraint') || err.code === '23505') {
                console.log(`✓ Live idempotency unique constraint correctly rejected duplicate key.`);
            } else {
                throw err;
            }
        }

        // Clean up test execution record
        await client.query(`DELETE FROM executions WHERE id = $1`, [execId]);
        console.log("✓ Live test cleanup complete.");

        console.log("\n==================================================");
        console.log("LIVE SUPABASE MIGRATION & LOCK TEST: ALL PASSED");
        console.log("==================================================");

    } catch (err) {
        console.error(`\n✗ LIVE DB MIGRATION ERROR: ${err.message}`);
        process.exit(1);
    } finally {
        await client.end().catch(() => {});
    }
}

runLiveMigration();
