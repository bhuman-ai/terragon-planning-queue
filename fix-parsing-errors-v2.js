#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all parsing errors from ESLint
console.log('Getting parsing errors from ESLint...');
const eslintOutput = execSync('npm run lint 2>&1 || true', { encoding: 'utf8' });

// Parse errors by file
const errorsByFile = new Map();
const lines = eslintOutput.split('\n');

let currentFile = null;
for (const line of lines) {
  // Match file paths
  if (line.startsWith('/') && line.includes('.js')) {
    currentFile = line.trim();
    if (!errorsByFile.has(currentFile)) {
      errorsByFile.set(currentFile, []);
    }
  }
  // Match error lines
  else if (currentFile && line.includes('Error:')) {
    const match = line.match(/^\s*(\d+):(\d+)\s+Error:\s+(.+)$/);
    if (match) {
      errorsByFile.get(currentFile).push({
        line: parseInt(match[1]),
        column: parseInt(match[2]),
        message: match[3]
      });
    }
  }
}

console.log(`Found ${errorsByFile.size} files with parsing errors`);

// Fix each file
for (const [filePath, errors] of errorsByFile) {
  console.log(`\nFixing ${filePath}...`);

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Sort errors by line number in reverse order (to fix from bottom to top)
    errors.sort((a, b) => b.line - a.line);

    for (const error of errors) {
      const lineIndex = error.line - 1;
      if (lineIndex >= 0 && lineIndex < lines.length) {
        let line = lines[lineIndex];

        // Fix specific parsing errors
        if (error.message.includes('Unexpected token') && error.message.includes('expected ","')) {
          // Missing comma
          console.log(`  Line ${error.line}: Adding missing comma`);
          // Try to add comma at the error column
          if (error.column > 0 && error.column <= line.length) {
            line = `${line.slice(0, error.column - 1)},${line.slice(error.column - 1)}`;
          }
        }
        else if (error.message.includes('Missing semicolon')) {
          console.log(`  Line ${error.line}: Adding missing semicolon`);
          line = `${line.trimEnd()};`;
        }
        else if (error.message.includes('Unterminated string')) {
          console.log(`  Line ${error.line}: Fixing unterminated string`);
          // Count quotes
          const singleQuotes = (line.match(/'/g) || []).length;
          const doubleQuotes = (line.match(/"/g) || []).length;
          if (singleQuotes % 2 !== 0) {
            line = `${line}'`;
          } else if (doubleQuotes % 2 !== 0) {
            line = `${line}"`;
          }
        }

        lines[lineIndex] = line;
      }
    }

    // Write back
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`  Fixed ${errors.length} errors`);

  } catch (err) {
    console.error(`  Error processing file: ${err.message}`);
  }
}

console.log('\nDone!');
