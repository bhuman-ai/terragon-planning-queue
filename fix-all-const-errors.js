const fs = require('fs');
const path = require('path');

// Pattern to find const declarations that are later modified
const CONST_PATTERN = /const\s+(\w+)\s*=\s*([^;]+);/g;
const REASSIGN_PATTERNS = [
  (varName) => new RegExp(`${varName}\\s*\\+=`, 'g'),
  (varName) => new RegExp(`${varName}\\s*-=`, 'g'),
  (varName) => new RegExp(`${varName}\\s*\\*=`, 'g'),
  (varName) => new RegExp(`${varName}\\s*\\/=`, 'g'),
  (varName) => new RegExp(`${varName}\\+\\+`, 'g'),
  (varName) => new RegExp(`${varName}--`, 'g'),
  (varName) => new RegExp(`\\+\\+${varName}`, 'g'),
  (varName) => new RegExp(`--${varName}`, 'g'),
];

let totalFixed = 0;

function checkAndFixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let newContent = content;
  
  // Find all const declarations
  const constMatches = [...content.matchAll(CONST_PATTERN)];
  
  for (const match of constMatches) {
    const fullMatch = match[0];
    const varName = match[1];
    const startIndex = match.index;
    
    // Check if this variable is reassigned anywhere in the file
    let isReassigned = false;
    
    for (const patternFn of REASSIGN_PATTERNS) {
      const reassignPattern = patternFn(varName);
      if (reassignPattern.test(content)) {
        isReassigned = true;
        break;
      }
    }
    
    if (isReassigned) {
      // Replace const with let
      const replacement = fullMatch.replace('const', 'let');
      newContent = newContent.replace(fullMatch, replacement);
      modified = true;
      console.log(`  Fixed: const ${varName} -> let ${varName} in ${filePath}`);
      totalFixed++;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, newContent);
    return true;
  }
  
  return false;
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and .next
      if (file === 'node_modules' || file === '.next' || file === '.git') {
        continue;
      }
      processDirectory(fullPath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      try {
        checkAndFixFile(fullPath);
      } catch (error) {
        console.error(`Error processing ${fullPath}:`, error.message);
      }
    }
  }
}

console.log('Scanning for const reassignment errors...\n');

// Process key directories
const directories = [
  'pages',
  'lib',
  'components',
  'hooks',
  'scripts'
];

for (const dir of directories) {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath)) {
    console.log(`Processing ${dir}/...`);
    processDirectory(fullPath);
  }
}

console.log(`\nTotal fixes applied: ${totalFixed}`);
console.log('Done!');