/**
 * AME Bazaar AI Agent System - Central Orchestrator & DB Adapter Test Suite
 * File: tests/orchestrator.test.js
 * 
 * Validates Phase 1, Phase 2, and Phase 3 requirements offline using pure in-memory state & mock DB adapter.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { createDbClient, validateConnection, MockDbClient } = require('../scripts/db');
const {
    getCurrentSlotContext,
    evaluateAndLockSlot,
    updateExecutionStatus,
    selectShuffledContent,
    runCentralSchedulerCheck
} = require('../scripts/orchestrator');
const { handleWebhookRequest } = require('../scripts/webhook');

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testName) {
    if (condition) {
        passed++;
        results.push(`PASS: ${testName}`);
        console.log(`✓ PASS: ${testName}`);
    } else {
        failed++;
        results.push(`FAIL: ${testName}`);
        console.error(`✗ FAIL: ${testName}`);
    }
}

async function runTestSuite() {
    console.log("==================================================");
    console.log("STARTING CENTRAL ORCHESTRATOR & DB ADAPTER TEST SUITE");
    console.log("==================================================\n");

    const mockDb = new MockDbClient();

    // 1. PostgreSQL DDL syntax & structure validation
    const ddlPath = path.join(__dirname, '../database/migrations/001_initial_schema.sql');
    const ddlContent = fs.readFileSync(ddlPath, 'utf8');
    const hasRequiredTables = [
        'CREATE TABLE IF NOT EXISTS agents',
        'CREATE TABLE IF NOT EXISTS schedules',
        'CREATE TABLE IF NOT EXISTS executions',
        'CREATE TABLE IF NOT EXISTS idempotency_keys',
        'CREATE TABLE IF NOT EXISTS content_items',
        'CREATE TABLE IF NOT EXISTS platform_publish_results',
        'CREATE TABLE IF NOT EXISTS recovery_events'
    ].every(tableSql => ddlContent.includes(tableSql));
    const hasUniqueConstraint = ddlContent.includes('CONSTRAINT unique_agent_slot_date UNIQUE');
    assert(hasRequiredTables && hasUniqueConstraint, "Test 1: PostgreSQL DDL syntax & schema structure");

    // 2. DB Connection Configuration & Mock Adapter Validation
    const connStatus = await validateConnection(mockDb);
    assert(connStatus.success === true && connStatus.isMock === true, "Test 2: DB connection configuration validation (Mock Mode)");

    // 3. Agents Table Access
    const agentsRes = await mockDb.query('SELECT * FROM agents');
    assert(agentsRes.rowCount >= 2 && agentsRes.rows.some(a => a.id === 'social-media'), "Test 3: Agents table access and active status query");

    // 4. Schedules Table Access
    const schedulesRes = await mockDb.query('SELECT s.agent_id, s.slot_time FROM schedules s');
    assert(schedulesRes.rowCount >= 3 && schedulesRes.rows.some(s => s.slot_time === '11:00:00'), "Test 4: Schedules table access (11:00 / 14:00 / 19:00 IST)");

    // 5. Basic Orchestrator Lock Acquisition
    const refDate = new Date('2026-08-14T11:05:00+05:30'); // 11:05 AM IST
    const evalRes = await evaluateAndLockSlot('social-media', '11:00:00', mockDb, refDate);
    assert(evalRes.allowed === true && evalRes.action === 'LOCK_ACQUIRED', "Test 5: Basic Orchestrator lock acquisition");

    // 6. Asia/Kolkata Time Handling
    const ctx = getCurrentSlotContext(refDate);
    assert(ctx.businessDate === '2026-08-14' && ctx.hour === '11' && ctx.minute === '05', "Test 6: Asia/Kolkata timezone context evaluation");

    // 7. 11:00 / 14:00 / 19:00 Slot Detection
    const schedCheck = await runCentralSchedulerCheck(mockDb, refDate);
    const slot11 = schedCheck.find(s => s.slotTime === '11:00:00');
    const slot14 = schedCheck.find(s => s.slotTime === '14:00:00');
    assert(slot11 && slot14 && slot14.action === 'FUTURE_SLOT', "Test 7: 11:00 / 14:00 / 19:00 slot schedule detection");

    // 8. Shuffled Content Selection Compatibility
    const mockContentPool = ['image1.jpg', 'image2.jpg', 'image3.jpg'];
    const selected = selectShuffledContent(mockContentPool);
    assert(mockContentPool.includes(selected) && selectShuffledContent([]) === null, "Test 8: Content selection & shuffling helper");

    // 9. Missed-Slot Recovery
    const lateRefDate = new Date('2026-08-14T18:00:00+05:30'); // 6:00 PM (7 hours after 11:00 slot)
    const missedObsoleteRes = await evaluateAndLockSlot('blogger', '11:00:00', mockDb, lateRefDate);
    assert(missedObsoleteRes.action === 'MISSED_SLOT_SKIPPED', "Test 9: Missed-slot recovery window enforcement (> 4h skipped)");

    // 10. Future-Slot Protection
    const earlyRefDate = new Date('2026-08-14T10:00:00+05:30'); // 10:00 AM (before 11:00 slot)
    const futureRes = await evaluateAndLockSlot('social-media', '11:00:00', mockDb, earlyRefDate);
    assert(futureRes.action === 'FUTURE_SLOT' && futureRes.allowed === false, "Test 10: Future-slot protection (never execute early)");

    // 11. Duplicate / Idempotency Protection
    await updateExecutionStatus(evalRes.executionId, 'SUCCESS', null, mockDb);
    const duplicateRes = await evaluateAndLockSlot('social-media', '11:00:00', mockDb, refDate);
    assert(duplicateRes.action === 'DUPLICATE_PREVENTED' && duplicateRes.allowed === false, "Test 11: Idempotency lock & duplicate execution rejection");

    // 12. Multiple-Agent Scheduling
    const multiAgentRes = await evaluateAndLockSlot('blogger', '11:00:00', mockDb, refDate);
    assert(multiAgentRes.allowed === true && multiAgentRes.idempotencyKey.includes('blogger_'), "Test 12: Multi-agent independent schedule lock");

    // 13. Process Restart / Recovery Scenarios
    const crashExecRes = await evaluateAndLockSlot('social-media', '14:00:00', mockDb, new Date('2026-08-14T14:01:00+05:30'));
    const rebootRes = await evaluateAndLockSlot('social-media', '14:00:00', mockDb, new Date('2026-08-14T14:05:00+05:30'));
    assert(rebootRes.action === 'ALREADY_RUNNING' && rebootRes.allowed === false, "Test 13: Process crash/restart recovery handling");

    // 14. Failure / Retry Behavior
    await updateExecutionStatus(crashExecRes.executionId, 'FAILED', 'API timeout error', mockDb);
    const failedRecord = mockDb.tables.executions.find(e => e.id === crashExecRes.executionId);
    assert(failedRecord.status === 'FAILED' && failedRecord.retry_count === 1 && failedRecord.error_message === 'API timeout error', "Test 14: Failure tracking & retry count increment");

    // 15. Graceful DB Connection Failure Handling
    class FailingDbClient {
        async query() { throw new Error("Connection failed: ECONNREFUSED"); }
    }
    const gracefulStatus = await validateConnection(new FailingDbClient());
    assert(gracefulStatus.success === false && gracefulStatus.error.includes("ECONNREFUSED"), "Test 15: Graceful DB connection failure handling");

    // 16. Cloud Webhook Entrypoint Endpoint Processing
    const mockReq = { url: '/health', headers: {}, method: 'GET' };
    let responseData = '';
    const mockRes = {
        setHeader: () => {},
        writeHead: () => {},
        end: (data) => { responseData = data; }
    };
    await handleWebhookRequest(mockReq, mockRes);
    const parsedRes = JSON.parse(responseData);
    assert(parsedRes.status === 'OK' && parsedRes.dbConnected === true, "Test 16: Cloud Webhook Entrypoint /health endpoint processing");

    console.log("\n==================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    return { passed, failed, results };
}

if (require.main === module) {
    runTestSuite().then(({ failed }) => {
        process.exit(failed > 0 ? 1 : 0);
    });
}

module.exports = { runTestSuite };
