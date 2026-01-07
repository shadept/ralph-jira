#!/usr/bin/env node

/**
 * Verification script for Ralph JIRA setup
 * Checks that all required files and directories exist
 */

const fs = require('fs');
const path = require('path');

const checks = [
  {
    name: 'plans/ directory',
    path: 'plans',
    type: 'directory',
  },
  {
    name: 'plans/runs/ directory',
    path: 'plans/runs',
    type: 'directory',
  },
  {
    name: 'plans/prd.json',
    path: 'plans/prd.json',
    type: 'file',
  },
  {
    name: 'plans/settings.json',
    path: 'plans/settings.json',
    type: 'file',
  },
  {
    name: 'progress.txt',
    path: 'progress.txt',
    type: 'file',
  },
  {
    name: 'node_modules/',
    path: 'node_modules',
    type: 'directory',
  },
];

console.log('🔍 Verifying Ralph JIRA setup...\n');

let allPassed = true;

for (const check of checks) {
  const fullPath = path.join(process.cwd(), check.path);
  let exists = false;

  try {
    const stat = fs.statSync(fullPath);
    if (check.type === 'directory') {
      exists = stat.isDirectory();
    } else {
      exists = stat.isFile();
    }
  } catch (err) {
    exists = false;
  }

  const status = exists ? '✅' : '❌';
  console.log(`${status} ${check.name}`);

  if (!exists) {
    allPassed = false;
  }
}

// Check if .env.local exists and has OPENAI_API_KEY
console.log('\n🔑 Environment variables:');
let envExists = false;
let hasApiKey = false;

try {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    envExists = true;
    const envContent = fs.readFileSync(envPath, 'utf-8');
    hasApiKey = envContent.includes('OPENAI_API_KEY') && !envContent.includes('your-key-here');
  }
} catch (err) {
  // Ignore
}

console.log(`${envExists ? '✅' : '⚠️ '} .env.local ${envExists ? 'exists' : 'missing (optional for dev)'}`);
console.log(`${hasApiKey ? '✅' : '⚠️ '} OPENAI_API_KEY ${hasApiKey ? 'configured' : 'not set (required for AI features)'}`);

// Check prd.json structure
console.log('\n📋 Board structure:');
try {
  const prdPath = path.join(process.cwd(), 'plans/prd.json');
  const prdContent = fs.readFileSync(prdPath, 'utf-8');
  const prd = JSON.parse(prdContent);

  console.log(`✅ Board ID: ${prd.id}`);
  console.log(`✅ Board Name: ${prd.name}`);
  console.log(`✅ Tasks: ${prd.tasks?.length || 0}`);
  console.log(`✅ Columns: ${prd.columns?.length || 0}`);
} catch (err) {
  console.log(`❌ Failed to parse prd.json: ${err.message}`);
  allPassed = false;
}

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('✅ All checks passed!');
  console.log('\nYou can now run:');
  console.log('  npm run dev       - Start the webapp');
  console.log('  npm run pm:run    - Run the AI executor');
} else {
  console.log('❌ Some checks failed. Please run:');
  console.log('  npm install       - If node_modules is missing');
  console.log('  bash scripts/setup.sh - To create missing files');
}

if (!hasApiKey) {
  console.log('\n⚠️  Remember to add your OPENAI_API_KEY to .env.local');
}

console.log('');
