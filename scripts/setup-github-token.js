#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupGitHubToken() {
  console.log('🔐 GitHub Token Setup for Calibration Scanner\n');
  console.log('This tool will help you set up a GitHub Personal Access Token.\n');
  
  console.log('To create a token:');
  console.log('1. Go to: https://github.com/settings/tokens');
  console.log('2. Click "Generate new token (classic)"');
  console.log('3. Give it a name like "Terragon Calibration Scanner"');
  console.log('4. Select scopes:');
  console.log('   - public_repo (for public repositories)');
  console.log('   - repo (for private repositories - optional)');
  console.log('5. Click "Generate token" and copy it\n');
  
  const token = await question('Enter your GitHub token (or press Enter to skip): ');
  
  if (!token) {
    console.log('\nSkipping token setup. You can add it later to .env.local');
    rl.close();
    return;
  }
  
  // Validate token format
  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    console.log('\n⚠️  Warning: Token doesn\'t look like a GitHub token (should start with ghp_ or github_pat_)');
    const proceed = await question('Continue anyway? (y/n): ');
    if (proceed.toLowerCase() !== 'y') {
      rl.close();
      return;
    }
  }
  
  // Read current .env.local
  const envPath = path.join(process.cwd(), '.env.local');
  let envContent = '';
  
  try {
    envContent = await fs.readFile(envPath, 'utf8');
  } catch (error) {
    console.log('Creating new .env.local file...');
  }
  
  // Update or add GITHUB_TOKEN
  const lines = envContent.split('\n');
  let tokenUpdated = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('GITHUB_TOKEN=')) {
      lines[i] = `GITHUB_TOKEN="${token}"`;
      tokenUpdated = true;
      break;
    }
  }
  
  if (!tokenUpdated) {
    // Add token at the end
    if (envContent && !envContent.endsWith('\n')) {
      envContent += '\n';
    }
    envContent += `GITHUB_TOKEN="${token}"\n`;
  } else {
    envContent = lines.join('\n');
  }
  
  // Write back to file
  await fs.writeFile(envPath, envContent, 'utf8');
  
  console.log('\n✅ GitHub token has been saved to .env.local');
  console.log('\nTesting token...');
  
  // Test the token
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (response.ok) {
      const user = await response.json();
      console.log(`✅ Token is valid! Authenticated as: ${user.login}`);
      console.log(`   Name: ${user.name || 'N/A'}`);
      console.log(`   Public repos: ${user.public_repos}`);
      
      // Check rate limit
      const rateLimit = response.headers.get('x-ratelimit-limit');
      const remaining = response.headers.get('x-ratelimit-remaining');
      console.log(`   API Rate limit: ${remaining}/${rateLimit}`);
    } else {
      console.log(`❌ Token validation failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log(`❌ Failed to validate token: ${error.message}`);
  }
  
  rl.close();
}

setupGitHubToken().catch(error => {
  console.error('Setup failed:', error);
  rl.close();
  process.exit(1);
});