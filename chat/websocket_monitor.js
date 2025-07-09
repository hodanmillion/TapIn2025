#!/usr/bin/env node

/**
 * WebSocket Monitor for Tap-In Chat Service
 * 
 * This script connects to the WebSocket endpoint and monitors messages
 * to help debug frontend-backend communication issues.
 * 
 * Usage:
 *   node websocket_monitor.js [options]
 * 
 * Options:
 *   --host <host>     WebSocket server host (default: localhost)
 *   --port <port>     WebSocket server port (default: 3001)
 *   --location <id>   Location ID for the room (default: test-location)
 *   --scenario <name> Test scenario to run (default: join-chat)
 *   --verbose         Enable verbose logging
 */

const WebSocket = require('ws');
const readline = require('readline');

// Configuration
const config = {
    host: process.argv.includes('--host') ? process.argv[process.argv.indexOf('--host') + 1] : 'localhost',
    port: process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : '3001',
    locationId: process.argv.includes('--location') ? process.argv[process.argv.indexOf('--location') + 1] : 'test-location',
    scenario: process.argv.includes('--scenario') ? process.argv[process.argv.indexOf('--scenario') + 1] : 'join-chat',
    verbose: process.argv.includes('--verbose')
};

// Test user data
const testUser = {
    user_id: 'test-user-123',
    username: 'TestUser',
    token: 'test-jwt-token-123',
    latitude: 37.7749,  // San Francisco coordinates
    longitude: -122.4194,
    search_radius: 5000
};

// Message logging
const messageLog = [];

function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type}] ${message}`;
    console.log(logEntry);
    messageLog.push(logEntry);
}

function logMessage(direction, message) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        direction,
        message: typeof message === 'string' ? message : JSON.stringify(message, null, 2)
    };
    
    console.log(`\n${direction === 'SENT' ? '📤' : '📥'} ${direction} [${timestamp}]:`);
    console.log(typeof message === 'string' ? message : JSON.stringify(message, null, 2));
    console.log('─'.repeat(60));
    
    messageLog.push(logEntry);
}

function createWebSocketUrl() {
    const protocol = config.host === 'localhost' ? 'ws' : 'wss';
    return `${protocol}://${config.host}:${config.port}/ws/${config.locationId}`;
}

// Test scenarios
const scenarios = {
    'join-chat': async (ws) => {
        log('Testing JoinLocalChat scenario');
        
        const joinMessage = {
            type: 'JoinLocalChat',
            user_id: testUser.user_id,
            username: testUser.username,
            token: testUser.token,
            latitude: testUser.latitude,
            longitude: testUser.longitude,
            search_radius: testUser.search_radius
        };
        
        ws.send(JSON.stringify(joinMessage));
        logMessage('SENT', joinMessage);
        
        // Wait for response, then send a test message
        setTimeout(() => {
            const testMessage = {
                type: 'Message',
                data: {
                    content: 'Hello from WebSocket monitor!'
                }
            };
            ws.send(JSON.stringify(testMessage));
            logMessage('SENT', testMessage);
        }, 2000);
    },
    
    'legacy-join': async (ws) => {
        log('Testing legacy Join scenario');
        
        const joinMessage = {
            type: 'Join',
            user_id: testUser.user_id,
            username: testUser.username,
            token: testUser.token
        };
        
        ws.send(JSON.stringify(joinMessage));
        logMessage('SENT', joinMessage);
    },
    
    'auth-only': async (ws) => {
        log('Testing Auth-only scenario');
        
        const authMessage = {
            type: 'Auth',
            user_id: testUser.user_id,
            username: testUser.username,
            token: testUser.token
        };
        
        ws.send(JSON.stringify(authMessage));
        logMessage('SENT', authMessage);
    },
    
    'location-update': async (ws) => {
        log('Testing LocationUpdate scenario');
        
        // First join a chat
        const joinMessage = {
            type: 'JoinLocalChat',
            user_id: testUser.user_id,
            username: testUser.username,
            token: testUser.token,
            latitude: testUser.latitude,
            longitude: testUser.longitude,
            search_radius: testUser.search_radius
        };
        
        ws.send(JSON.stringify(joinMessage));
        logMessage('SENT', joinMessage);
        
        // Then update location
        setTimeout(() => {
            const locationUpdate = {
                type: 'LocationUpdate',
                user_id: testUser.user_id,
                latitude: testUser.latitude + 0.001,  // Move slightly
                longitude: testUser.longitude + 0.001
            };
            ws.send(JSON.stringify(locationUpdate));
            logMessage('SENT', locationUpdate);
        }, 2000);
    },
    
    'interactive': async (ws) => {
        log('Starting interactive mode');
        log('Type WebSocket messages as JSON and press Enter to send');
        log('Type "quit" to exit');
        
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.prompt();
        
        rl.on('line', (input) => {
            if (input.trim().toLowerCase() === 'quit') {
                rl.close();
                ws.close();
                return;
            }
            
            try {
                const message = JSON.parse(input);
                ws.send(JSON.stringify(message));
                logMessage('SENT', message);
            } catch (e) {
                log(`Error parsing JSON: ${e.message}`, 'ERROR');
            }
            
            rl.prompt();
        });
        
        rl.on('close', () => {
            log('Interactive mode ended');
        });
    }
};

// Connection monitoring
function monitorConnection() {
    const wsUrl = createWebSocketUrl();
    log(`Connecting to WebSocket: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
        log('WebSocket connection opened');
        
        // Run the selected scenario
        if (scenarios[config.scenario]) {
            scenarios[config.scenario](ws);
        } else {
            log(`Unknown scenario: ${config.scenario}`, 'ERROR');
            log(`Available scenarios: ${Object.keys(scenarios).join(', ')}`);
            ws.close();
        }
    });
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            logMessage('RECEIVED', message);
        } catch (e) {
            logMessage('RECEIVED', data.toString());
        }
    });
    
    ws.on('error', (error) => {
        log(`WebSocket error: ${error.message}`, 'ERROR');
    });
    
    ws.on('close', (code, reason) => {
        log(`WebSocket closed with code ${code}: ${reason}`);
        
        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('CONNECTION SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total messages logged: ${messageLog.length}`);
        console.log(`Scenario: ${config.scenario}`);
        console.log(`WebSocket URL: ${wsUrl}`);
        console.log(`Test User: ${testUser.username} (${testUser.user_id})`);
        console.log('='.repeat(60));
        
        // Option to save log to file
        if (messageLog.length > 0) {
            const fs = require('fs');
            const logFile = `websocket_log_${Date.now()}.json`;
            fs.writeFileSync(logFile, JSON.stringify(messageLog, null, 2));
            console.log(`Log saved to: ${logFile}`);
        }
    });
    
    // Handle process termination
    process.on('SIGINT', () => {
        log('Received SIGINT, closing connection...');
        ws.close();
    });
}

// Main function
function main() {
    console.log('WebSocket Monitor for Tap-In Chat Service');
    console.log('=========================================');
    console.log(`Host: ${config.host}`);
    console.log(`Port: ${config.port}`);
    console.log(`Location ID: ${config.locationId}`);
    console.log(`Scenario: ${config.scenario}`);
    console.log(`Verbose: ${config.verbose}`);
    console.log('');
    
    if (config.scenario === 'help' || process.argv.includes('--help')) {
        console.log('Available scenarios:');
        Object.keys(scenarios).forEach(scenario => {
            console.log(`  ${scenario}`);
        });
        console.log('');
        console.log('Examples:');
        console.log('  node websocket_monitor.js --scenario join-chat');
        console.log('  node websocket_monitor.js --scenario interactive --verbose');
        console.log('  node websocket_monitor.js --host example.com --port 8080');
        return;
    }
    
    monitorConnection();
}

// Check if WebSocket module is available
try {
    require('ws');
} catch (e) {
    console.error('WebSocket module not found. Please install it with:');
    console.error('npm install ws');
    process.exit(1);
}

// Run the monitor
main();