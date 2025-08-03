#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix common parsing errors
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix apostrophes in strings - convert 'I don't' to "I don't"
  const apostropheRegex = /'([^']*don't[^']*)'/g;
  if (apostropheRegex.test(content)) {
    content = content.replace(apostropheRegex, '"$1"');
    modified = true;
  }

  // Fix apostrophes in other common contractions
  const contractionsRegex = /'([^']*(won't|can't|couldn't|wouldn't|shouldn't|didn't|isn't|aren't|hasn't|haven't)[^']*)'/g;
  if (contractionsRegex.test(content)) {
    content = content.replace(contractionsRegex, '"$1"');
    modified = true;
  }

  // Fix semicolons before dots
  const semicolonDotRegex = /;\.(\w+)/g;
  if (semicolonDotRegex.test(content)) {
    content = content.replace(semicolonDotRegex, '.$1');
    modified = true;
  }

  // Fix extra semicolons in JSX
  const jsxSemicolonRegex = /<(\w+);/g;
  if (jsxSemicolonRegex.test(content)) {
    content = content.replace(jsxSemicolonRegex, '<$1');
    modified = true;
  }

  // Fix double semicolons
  const doubleSemicolonRegex = /;;/g;
  if (doubleSemicolonRegex.test(content)) {
    content = content.replace(doubleSemicolonRegex, ';');
    modified = true;
  }

  // Fix semicolons at wrong positions in arrays
  const arraySemicolonRegex = /,;/g;
  if (arraySemicolonRegex.test(content)) {
    content = content.replace(arraySemicolonRegex, ',');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed parsing errors in: ${filePath}`);
  }

  return modified;
}

// Process all JS/JSX files
function processDirectory(dir) {
  const items = fs.readdirSync(dir);

  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules' && item !== '.next') {
      processDirectory(fullPath);
    } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.jsx'))) {
      fixFile(fullPath);
    }
  });
}

// Run on specific directories
console.log('Fixing parsing errors in JavaScript files...');
processDirectory(path.join(__dirname, 'pages'));
processDirectory(path.join(__dirname, 'components'));
processDirectory(path.join(__dirname, 'lib'));
console.log('Done!');
