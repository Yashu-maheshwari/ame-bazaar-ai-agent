/**
 * AME Bazaar AI Agent System - Cloud Orchestrator Webhook Entrypoint
 * File: scripts/webhook.js
 * 
 * Provides a minimal, zero-dependency HTTP webhook entrypoint to receive trigger
 * webhooks (from GitHub Actions / external cron / cloud triggers), run central
 * idempotency checks on Supabase PostgreSQL, and dispatch agent executions.
 */

const http = require('http');
const { validateConnection, createDbClient } = require('./db');
const { evaluateAndLockSlot, runCentralSchedulerCheck, updateExecutionStatus } = require('./orchestrator');

const PORT = process.env.PORT || 3000;

async function handleWebhookRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    res.setHeader('Content-Type', 'application/json');

    // Health check endpoint
    if (url.pathname === '/health') {
        const dbStatus = await validateConnection();
        res.writeHead(200);
        return res.end(JSON.stringify({
            status: 'OK',
            timestamp: new Date().toISOString(),
            dbConnected: dbStatus.success,
            isMockDb: dbStatus.isMock
        }));
    }

    // Orchestrator webhook trigger endpoint
    if (url.pathname === '/webhook/trigger' && req.method === 'POST') {
        let bodyText = '';
        req.on('data', chunk => { bodyText += chunk; });
        req.on('end', async () => {
            try {
                let payload = {};
                if (bodyText) {
                    try { payload = JSON.parse(bodyText); } catch (e) {}
                }

                const { agentId = 'social-media', slotTime } = payload;
                const dbClient = createDbClient();

                let result;
                if (slotTime) {
                    result = await evaluateAndLockSlot(agentId, slotTime, dbClient);
                } else {
                    result = await runCentralSchedulerCheck(dbClient);
                }

                res.writeHead(200);
                return res.end(JSON.stringify({
                    status: 'PROCESSED',
                    result,
                    timestamp: new Date().toISOString()
                }));
            } catch (err) {
                res.writeHead(500);
                return res.end(JSON.stringify({
                    status: 'ERROR',
                    error: err.message
                }));
            }
        });
        return;
    }

    // Fallback for unhandled routes
    res.writeHead(404);
    return res.end(JSON.stringify({ error: 'Endpoint not found' }));
}

function startServer(port = PORT) {
    const server = http.createServer(handleWebhookRequest);
    return new Promise((resolve) => {
        server.listen(port, () => {
            console.log(`[ORCHESTRATOR WEBHOOK] Listening on port ${port}`);
            resolve(server);
        });
    });
}

if (require.main === module) {
    startServer();
}

module.exports = {
    handleWebhookRequest,
    startServer
};
