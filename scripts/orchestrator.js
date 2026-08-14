/**
 * AME Bazaar AI Agent System - Central Orchestrator
 * File: scripts/orchestrator.js
 * 
 * Responsible for:
 * 1. Time-based agent slot evaluation (Asia/Kolkata timezone)
 * 2. 11:00, 14:00, 19:00 IST schedule detection for Social Media Agent & dynamic agent schedules
 * 3. Idempotency locking & unique slot-date constraint enforcement
 * 4. Recovery of missed slots vs. skipping obsolete slots
 * 5. Future slot protection (preventing early execution)
 * 6. Content selection shuffling helper
 * 7. Failure, retry, and container restart recovery handling
 */

const { createDbClient } = require('./db');

const TIMEZONE = process.env.GENERIC_TIMEZONE || 'Asia/Kolkata';
const RECOVERY_WINDOW_HOURS = 4; // Only auto-recover slots missed within last 4 hours

async function getDbClient(overrideClient = null) {
    if (overrideClient) return overrideClient;
    const client = createDbClient();
    if (!client.isMock) {
        await client.connect();
    }
    return client;
}

/**
 * Returns formatted date string (YYYY-MM-DD) and current slot details in Asia/Kolkata
 */
function getCurrentSlotContext(referenceDate = new Date()) {
    const options = { timeZone: TIMEZONE, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    const parts = formatter.formatToParts(referenceDate);
    
    let year, month, day, hour, minute;
    for (const part of parts) {
        if (part.type === 'year') year = part.value;
        if (part.type === 'month') month = part.value;
        if (part.type === 'day') day = part.value;
        if (part.type === 'hour') hour = part.value;
        if (part.type === 'minute') minute = part.value;
    }
    
    const businessDate = `${year}-${month}-${day}`;
    const currentTimeStr = `${hour}:${minute}:00`;
    return { now: referenceDate, businessDate, currentTimeStr, year, month, day, hour, minute };
}

/**
 * Evaluates whether an agent slot should run, acquire idempotency lock, or skip.
 */
async function evaluateAndLockSlot(agentId, scheduledSlotTimeStr, overrideClient = null, referenceDate = new Date()) {
    const client = await getDbClient(overrideClient);
    const shouldCloseClient = !overrideClient && !client.isMock;
    try {
        const { now, businessDate } = getCurrentSlotContext(referenceDate);
        
        // Construct full ISO timestamp for scheduled slot on current business date
        const scheduledTimestampStr = `${businessDate}T${scheduledSlotTimeStr}+05:30`;
        const scheduledTimestamp = new Date(scheduledTimestampStr);

        // RULE: Future slot protection (NEVER run future slots early)
        if (scheduledTimestamp > now) {
            return { action: 'FUTURE_SLOT', allowed: false, message: `Slot ${scheduledSlotTimeStr} is in the future.` };
        }

        // Generate deterministic idempotency key
        const idempotencyKey = `${agentId}_${businessDate}_${scheduledSlotTimeStr}`;

        await client.query('BEGIN');

        // Check if execution or idempotency key already exists
        const existingKeyRes = await client.query(
            'SELECT * FROM idempotency_keys WHERE idempotency_key = $1',
            [idempotencyKey]
        );

        if (existingKeyRes.rows.length > 0) {
            const execRes = await client.query(
                'SELECT status FROM executions WHERE id = $1',
                [existingKeyRes.rows[0].execution_id]
            );
            const status = execRes.rows[0]?.status;
            await client.query('ROLLBACK');

            if (status === 'SUCCESS') {
                return { action: 'DUPLICATE_PREVENTED', allowed: false, status, message: `Slot ${idempotencyKey} already completed.` };
            } else if (status === 'RUNNING') {
                return { action: 'ALREADY_RUNNING', allowed: false, status, message: `Slot ${idempotencyKey} currently RUNNING.` };
            }
        }

        // Check if missed slot is too old (> RECOVERY_WINDOW_HOURS)
        const diffHours = (now - scheduledTimestamp) / (1000 * 60 * 60);
        if (diffHours > RECOVERY_WINDOW_HOURS) {
            const execRes = await client.query(
                `INSERT INTO executions (agent_id, scheduled_slot, business_date, status, error_message)
                 VALUES ($1, $2, $3, 'SKIPPED', 'Exceeded recovery window') RETURNING id`,
                [agentId, scheduledTimestampStr, businessDate]
            );
            const execId = execRes.rows[0].id;

            await client.query(
                `INSERT INTO recovery_events (execution_id, agent_id, event_type, details)
                 VALUES ($1, $2, 'MISSED_SLOT_SKIPPED', $3)`,
                [execId, agentId, JSON.stringify({ diffHours, scheduledSlotTimeStr })]
            );

            await client.query('COMMIT');
            return { action: 'MISSED_SLOT_SKIPPED', allowed: false, diffHours };
        }

        // Acquire lock & create RUNNING execution
        const execRes = await client.query(
            `INSERT INTO executions (agent_id, scheduled_slot, business_date, status, started_at)
             VALUES ($1, $2, $3, 'RUNNING', NOW()) RETURNING id`,
            [agentId, scheduledTimestampStr, businessDate]
        );
        const executionId = execRes.rows[0].id;

        await client.query(
            `INSERT INTO idempotency_keys (execution_id, agent_id, scheduled_slot, business_date, idempotency_key)
             VALUES ($1, $2, $3, $4, $5)`,
            [executionId, agentId, scheduledTimestampStr, businessDate, idempotencyKey]
        );

        await client.query('COMMIT');
        return { action: 'LOCK_ACQUIRED', allowed: true, executionId, idempotencyKey };

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        if (shouldCloseClient) await client.end().catch(() => {});
    }
}

/**
 * Updates execution status upon completion or failure with retry count increment
 */
async function updateExecutionStatus(executionId, status, errorMessage = null, overrideClient = null) {
    const client = await getDbClient(overrideClient);
    const shouldCloseClient = !overrideClient && !client.isMock;
    try {
        if (status === 'FAILED') {
            await client.query(
                `UPDATE executions 
                 SET status = $1, error_message = $2, retry_count = retry_count + 1, completed_at = NOW(), updated_at = NOW()
                 WHERE id = $3`,
                [status, errorMessage, executionId]
            );
        } else {
            await client.query(
                `UPDATE executions 
                 SET status = $1, error_message = $2, completed_at = NOW(), updated_at = NOW()
                 WHERE id = $3`,
                [status, errorMessage, executionId]
            );
        }
    } finally {
        if (shouldCloseClient) await client.end().catch(() => {});
    }
}

/**
 * Shuffled content selection helper: picks deterministically/randomly from available items
 */
function selectShuffledContent(items) {
    if (!items || items.length === 0) return null;
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    return shuffled[0];
}

/**
 * Evaluates all schedules across multiple agents for current business date
 */
async function runCentralSchedulerCheck(overrideClient = null, referenceDate = new Date()) {
    const client = await getDbClient(overrideClient);
    const shouldCloseClient = !overrideClient && !client.isMock;
    try {
        const { now } = getCurrentSlotContext(referenceDate);
        const schedulesRes = await client.query(
            `SELECT s.agent_id, s.slot_time, a.is_active 
             FROM schedules s 
             JOIN agents a ON s.agent_id = a.id 
             WHERE s.is_enabled = TRUE AND a.is_active = TRUE`
        );

        const results = [];
        for (const row of schedulesRes.rows) {
            const res = await evaluateAndLockSlot(row.agent_id, row.slot_time, client, now);
            results.push({ agentId: row.agent_id, slotTime: row.slot_time, ...res });
        }
        return results;
    } finally {
        if (shouldCloseClient) await client.end().catch(() => {});
    }
}

module.exports = {
    getCurrentSlotContext,
    evaluateAndLockSlot,
    updateExecutionStatus,
    selectShuffledContent,
    runCentralSchedulerCheck
};
