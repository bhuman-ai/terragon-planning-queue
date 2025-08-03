#!/usr/bin/env node

/**
 * Real-time LLM Code Linting with <100ms Overhead
 * Optimized for instant feedback during development
 */

const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');

class RealtimeLLMLinter {
  constructor() {
    this.cache = new Map();
    this.workers = [];
    this.maxWorkers = 2;
    this.initWorkers();
  }

  /**
   * Initialize worker threads for parallel processing
   */
  initWorkers() {
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = new Worker(`
        const { parentPort } = require('worker_threads');
        const fs = require('fs');

        // Fast validation rules optimized for <100ms
        const fastRules = {
          // Sacred Principle violations
          noSimulation: (content) => {
            const patterns = [/mock\\s*\\(/gi, /simulate\\s*\\(/gi, /fake\\s*\\(/gi];
            return patterns.some(p => p.test(content));
          },

          // Function length check
          functionLength: (content) => {
            const funcRegex = /function\\s+\\w+\\s*\\([^)]*\\)\\s*\\{([^}]*(?:\\{[^}]*\\}[^}]*)*)\\}/g;
            let match;
            while ((match = funcRegex.exec(content)) !== null) {
              if (match[1].split('\\n').length > 50) return true;
            }
            return false;
          },

          // Empty catch blocks
          emptyCatch: (content) => {
            return /catch\\s*\\([^)]*\\)\\s*\\{\\s*\\}/g.test(content);
          },

          // Magic numbers
          magicNumbers: (content) => {
            const numberRegex = /(?<!\\w)\\d{3,}(?!\\w)/g;
            const exceptions = [200, 404, 500, 1000, 5000, 10000];
            let match;
            while ((match = numberRegex.exec(content)) !== null) {
              const num = parseInt(match[0]);
              if (!exceptions.includes(num)) return true;
            }
            return false;
          },

          // Console in production
          consoleInProd: (content, filename) => {
            if (filename.includes('test')) return false;
            return /console\\.(log|debug|info)\\s*\\(/g.test(content);
          },

          // TODO comments
          todoComments: (content) => {
            return /\\/\\/\\s*(TODO|FIXME|XXX|HACK|BUG)/gi.test(content);
          }
        };

        parentPort.on('message', ({ id, content, filename }) => {
          const startTime = Date.now();
          const errors = [];

          try {
            // Run fast checks
            if (fastRules.noSimulation(content)) {
              errors.push({ rule: 'no-simulation', message: 'Simulation/mock patterns detected' });
            }

            if (fastRules.functionLength(content)) {
              errors.push({ rule: 'function-length', message: 'Function exceeds 50 lines' });
            }

            if (fastRules.emptyCatch(content)) {
              errors.push({ rule: 'empty-catch', message: 'Empty catch block detected' });
            }

            if (fastRules.magicNumbers(content)) {
              errors.push({ rule: 'magic-numbers', message: 'Magic numbers detected' });
            }

            if (fastRules.consoleInProd(content, filename)) {
              errors.push({ rule: 'console-in-prod', message: 'Console statements in production code' });
            }

            if (fastRules.todoComments(content)) {
              errors.push({ rule: 'todo-comments', message: 'TODO/FIXME comments detected' });
            }

            const executionTime = Date.now() - startTime;

            parentPort.postMessage({
              id,
              success: true,
              errors,
              executionTime,
              passed: errors.length === 0
            });

          } catch (error) {
            parentPort.postMessage({
              id,
              success: false,
              error: error.message,
              executionTime: Date.now() - startTime
            });
          }
        });
      `, { eval: true });

      this.workers.push(worker);
    }
  }

  /**
   * Fast lint a single file with caching
   * @param {string} filepath - Path to file
   * @returns {Promise<Object>} Validation result
   */
  async lintFile(filepath) {
    const startTime = Date.now();

    try {
      // Check cache first
      const stats = fs.statSync(filepath);
      const cacheKey = `${filepath}-${stats.mtime.getTime()}`;

      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        cached.cached = true;
        cached.executionTime = Date.now() - startTime;
        return cached;
      }

      // Read file content
      const content = fs.readFileSync(filepath, 'utf8');

      // Use worker for validation
      const result = await this.validateWithWorker(content, filepath);

      // Cache result
      result.filepath = filepath;
      result.executionTime = Date.now() - startTime;
      this.cache.set(cacheKey, result);

      // Limit cache size
      if (this.cache.size > 1000) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      return result;

    } catch (error) {
      return {
        filepath,
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
        passed: false
      };
    }
  }

  /**
   * Validate content using worker thread
   */
  validateWithWorker(content, filename) {
    return new Promise((resolve) => {
      const worker = this.workers[Math.floor(Math.random() * this.workers.length)];
      const id = Math.random().toString(36).substr(2, 9);

      const timeout = setTimeout(() => {
        resolve({
          id,
          success: false,
          error: 'Validation timeout',
          executionTime: 100,
          passed: false
        });
      }, 100); // 100ms timeout for real-time performance

      const handler = (result) => {
        if (result.id === id) {
          clearTimeout(timeout);
          worker.off('message', handler);
          resolve(result);
        }
      };

      worker.on('message', handler);
      worker.postMessage({ id, content, filename });
    });
  }

  /**
   * Lint multiple files in parallel
   * @param {string[]} filepaths - Array of file paths
   * @returns {Promise<Object[]>} Array of validation results
   */
  async lintFiles(filepaths) {
    const startTime = Date.now();

    const results = await Promise.all(
      filepaths.map(filepath => this.lintFile(filepath))
    );

    const totalTime = Date.now() - startTime;
    const passed = results.every(r => r.passed);
    const errors = results.flatMap(r => r.errors || []);

    return {
      passed,
      totalTime,
      fileCount: filepaths.length,
      results,
      summary: {
        totalFiles: filepaths.length,
        passedFiles: results.filter(r => r.passed).length,
        failedFiles: results.filter(r => !r.passed).length,
        totalErrors: errors.length,
        averageTime: Math.round(totalTime / filepaths.length),
        cached: results.filter(r => r.cached).length
      }
    };
  }

  /**
   * Watch directory for changes and lint in real-time
   * @param {string} directory - Directory to watch
   * @param {Object} options - Watch options
   */
  watch(directory, options = {}) {
    const {
      extensions = ['.js', '.jsx'],
      exclude = ['node_modules', '.next', 'coverage'],
      onValidation = null
    } = options;

    console.log(`🔍 Watching ${directory} for real-time LLM validation...`);

    const watcher = fs.watch(directory, { recursive: true }, async (eventType, filename) => {
      if (!filename) return;

      // Check if file should be processed
      const ext = path.extname(filename);
      if (!extensions.includes(ext)) return;

      const fullPath = path.join(directory, filename);

      // Skip excluded directories
      if (exclude.some(pattern => fullPath.includes(pattern))) return;

      // Skip if file doesn't exist (deleted)
      if (!fs.existsSync(fullPath)) return;

      try {
        const result = await this.lintFile(fullPath);

        if (onValidation) {
          onValidation(result);
        } else {
          // Default output
          const status = result.passed ? '✅' : '❌';
          const time = result.executionTime < 100 ? `${result.executionTime}ms` : `${result.executionTime}ms (slow)`;
          const cached = result.cached ? ' (cached)' : '';

          console.log(`${status} ${filename} - ${time}${cached}`);

          if (!result.passed && result.errors) {
            result.errors.forEach(error => {
              console.log(`   └─ ${error.rule}: ${error.message}`);
            });
          }
        }

      } catch (error) {
        console.error(`❌ Error validating ${filename}: ${error.message}`);
      }
    });

    return watcher;
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      workers: this.workers.length,
      memory: process.memoryUsage()
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.workers.forEach(worker => worker.terminate());
    this.cache.clear();
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Real-time LLM Code Linter

Usage: node scripts/realtime-lint.js [options] [files...]

Options:
  --watch <dir>       Watch directory for changes [default: .]
  --output <format>   Output format (compact|detailed|json) [default: compact]
  --extensions <ext>  File extensions to watch [default: .js,.jsx]
  --help              Show this help message

Examples:
  node scripts/realtime-lint.js file1.js file2.js
  node scripts/realtime-lint.js --watch lib --output detailed
  node scripts/realtime-lint.js --watch . --extensions .js,.ts,.jsx,.tsx
    `);
    return;
  }

  const linter = new RealtimeLLMLinter();

  // Handle cleanup on exit
  process.on('SIGINT', () => {
    console.log('\n👋 Cleaning up...');
    linter.cleanup();
    process.exit(0);
  });

  // Parse options
  const watchDirIndex = args.indexOf('--watch');
  const outputIndex = args.indexOf('--output');
  const extensionsIndex = args.indexOf('--extensions');

  if (watchDirIndex !== -1) {
    // Watch mode
    const watchDir = args[watchDirIndex + 1] || '.';
    const outputFormat = outputIndex !== -1 ? args[outputIndex + 1] : 'compact';
    const extensions = extensionsIndex !== -1
      ? args[extensionsIndex + 1].split(',')
      : ['.js', '.jsx'];

    const watcher = linter.watch(watchDir, {
      extensions,
      onValidation: (result) => {
        switch (outputFormat) {
          case 'json':
            console.log(JSON.stringify(result));
            break;
          case 'detailed':
            console.log(`File: ${result.filepath}`);
            console.log(`Status: ${result.passed ? 'PASS' : 'FAIL'}`);
            console.log(`Time: ${result.executionTime}ms`);
            if (result.errors && result.errors.length > 0) {
              console.log('Errors:');
              result.errors.forEach(error => {
                console.log(`  - ${error.rule}: ${error.message}`);
              });
            }
            console.log('---');
            break;
          default: // compact
            const status = result.passed ? '✅' : '❌';
            const time = result.executionTime < 100 ? `${result.executionTime}ms` : `${result.executionTime}ms (slow)`;
            const cached = result.cached ? ' (cached)' : '';
            const filename = path.basename(result.filepath);

            console.log(`${status} ${filename} - ${time}${cached}`);

            if (!result.passed && result.errors) {
              result.errors.forEach(error => {
                console.log(`   └─ ${error.rule}: ${error.message}`);
              });
            }
        }
      }
    });

    // Keep process alive
    setInterval(() => {
      const stats = linter.getStats();
      if (stats.cacheSize > 0) {
        console.log(`📊 Cache: ${stats.cacheSize} files | Memory: ${Math.round(stats.memory.heapUsed / 1024 / 1024)}MB`);
      }
    }, 30000); // Every 30 seconds

  } else {
    // Single file mode
    const files = args.filter(arg => !arg.startsWith('--') &&
      args[args.indexOf(arg) - 1] !== '--output' &&
      args[args.indexOf(arg) - 1] !== '--extensions');

    if (files.length === 0) {
      console.error('No files specified for validation');
      process.exit(1);
    }

    const result = await linter.lintFiles(files);

    console.log(`${result.passed ? '✅ PASS' : '❌ FAIL'} | ${result.summary.passedFiles}/${result.summary.totalFiles} files | ${result.summary.totalErrors} errors | ${result.totalTime}ms`);

    if (!result.passed) {
      result.results.forEach(fileResult => {
        if (!fileResult.passed && fileResult.errors) {
          console.log(`\n${fileResult.filepath}:`);
          fileResult.errors.forEach(error => {
            console.log(`  ${error.rule}: ${error.message}`);
          });
        }
      });
    }

    linter.cleanup();
    process.exit(result.passed ? 0 : 1);
  }
}

// Only run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Real-time linter failed:', error.message);
    process.exit(1);
  });
}

module.exports = RealtimeLLMLinter;
