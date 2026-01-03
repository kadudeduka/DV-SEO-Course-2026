#!/usr/bin/env node

/**
 * Generate app.config.local.js from .env file
 * 
 * This script reads the .env file and generates config/app.config.local.js
 * for local development.
 * 
 * Usage:
 *   node scripts/generate-config.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const envPath = path.join(__dirname, '..', 'config', '.env');
const configPath = path.join(__dirname, '..', 'config', 'app.config.local.js');

// Read .env file
function parseEnvFile(filePath) {
    const env = {};
    
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Error: .env file not found at ${filePath}`);
        process.exit(1);
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
        // Skip empty lines and comments
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        
        // Parse KEY=VALUE
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            
            env[key] = value;
        }
    }
    
    return env;
}

// Generate config file
function generateConfig(env) {
    const config = `/**
 * LMS Backend Configuration (Local Development)
 * 
 * This file is auto-generated from config/.env
 * DO NOT EDIT MANUALLY - it will be overwritten.
 * 
 * To update configuration, edit config/.env and run:
 *   node scripts/generate-config.js
 * 
 * This file is gitignored and will not be committed.
 */

window.LMS_CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: '${env.SUPABASE_URL || ''}',
    SUPABASE_ANON_KEY: '${env.SUPABASE_ANON_KEY || ''}',
    SUPABASE_SERVICE_KEY: '${env.SUPABASE_SERVICE_KEY || ''}',
    
    // OpenAI Configuration
    OPENAI_API_KEY: '${env.OPENAI_API_KEY || ''}',
    
    // Admin Credentials
    ADMIN_USERNAME: '${env.ADMIN_USERNAME || ''}',
    ADMIN_PASSWORD: '${env.ADMIN_PASSWORD || ''}',
    ADMIN_EMAIL: '${env.ADMIN_EMAIL || ''}'
};
`;

    return config;
}

// Main execution
try {
    console.log('📝 Reading .env file...');
    const env = parseEnvFile(envPath);
    
    console.log('🔧 Generating config/app.config.local.js...');
    const configContent = generateConfig(env);
    
    fs.writeFileSync(configPath, configContent, 'utf-8');
    
    console.log('✅ Successfully generated config/app.config.local.js');
    console.log('   Configuration loaded from config/.env');
    
} catch (error) {
    console.error('❌ Error generating config file:', error.message);
    process.exit(1);
}

