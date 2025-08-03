#!/usr/bin/env node

/**
 * Enhanced Test Runner with LLM Code Validation
 * Integrates objective binary testing with existing test infrastructure
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const LLMCodeValidator = require('./validate-llm-code');

class EnhancedTestRunner {
  constructor() {
    this.results = {
      unitTests: null,
      integrationTests: null,
      e2eTests: null,
      llmValidation: null,
      overall: null
    };
    this.startTime = Date.now();
    this.llmValidator = new LLMCodeValidator();
  }

  /**
   * Run comprehensive test suite with LLM validation
   */
  async runAll(options = {}) {
    const {
      skipUnit = false,
      skipIntegration = false,
      skipE2E = false,
      skipLLM = false,
      strictLLM = false,
      output = 'detailed'
    } = options;

    console.log('🧪 Enhanced Test Suite with LLM Validation');
    console.log('═'.repeat(60));

    try {
      // Phase 1: LLM Code Validation (fastest, fail early)
      if (!skipLLM) {
        console.log('\n🤖 Phase 1: LLM Code Validation (Objective Binary Testing)');
        this.results.llmValidation = await this.runLLMValidation(strictLLM);

        if (!this.results.llmValidation.passed) {
          console.log('❌ LLM validation failed - stopping early to fix code quality issues');
          this.generateFinalResults(output);
          return false;
        }
        console.log('✅ LLM validation passed - proceeding with test suites');
      }

      // Phase 2: Unit Tests
      if (!skipUnit) {
        console.log('\n🔬 Phase 2: Unit Tests');
        this.results.unitTests = await this.runUnitTests();
      }

      // Phase 3: Integration Tests
      if (!skipIntegration) {
        console.log('\n🔄 Phase 3: Integration Tests');
        this.results.integrationTests = await this.runIntegrationTests();
      }

      // Phase 4: E2E Tests
      if (!skipE2E) {
        console.log('\n🎭 Phase 4: End-to-End Tests');
        this.results.e2eTests = await this.runE2ETests();
      }

      // Generate final results
      this.generateFinalResults(output);

      const { success } = this.results.overall;
      console.log(`\n${success ? '🎉 ALL TESTS PASSED' : '❌ TESTS FAILED'}`);

      return success;

    } catch (error) {
      console.error(`\n💥 Test runner failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Run LLM code validation
   */
  async runLLMValidation(strict = false) {
    const startTime = Date.now();

    try {
      console.log('  Validating LLM-generated code with objective rules...');

      const result = await this.llmValidator.validate({
        target: 'all',
        strict,
        output: 'json'
      });

      const duration = Date.now() - startTime;

      console.log(`  ${result.passed ? '✅' : '❌'} LLM validation ${result.passed ? 'passed' : 'failed'} (${duration}ms)`);

      if (!result.passed) {
        console.log(`    Errors: ${result.summary.errors}`);
        console.log(`    Warnings: ${result.summary.warnings}`);

        // Show first few errors for immediate feedback
        if (result.results.errors.length > 0) {
          console.log('    Top issues:');
          result.results.errors.slice(0, 3).forEach(error => {
            const filename = path.basename(error.file || 'unknown');
            console.log(`      ${filename}:${error.line} - ${error.message}`);
          });
        }
      }

      return {
        passed: result.passed,
        duration,
        details: result,
        phase: 'llm-validation'
      };

    } catch (error) {
      return {
        passed: false,
        duration: Date.now() - startTime,
        error: error.message,
        phase: 'llm-validation'
      };
    }
  }

  /**
   * Run unit tests
   */
  async runUnitTests() {
    return this.runJestSuite('unit', [
      '__tests__/security/**/*.test.js',
      '__tests__/collaboration/**/*.test.js'
    ]);
  }

  /**
   * Run integration tests
   */
  async runIntegrationTests() {
    return this.runJestSuite('integration', [
      '__tests__/integration/**/*.test.js'
    ]);
  }

  /**
   * Run E2E tests
   */
  async runE2ETests() {
    return this.runJestSuite('e2e', [
      '__tests__/e2e/**/*.test.js'
    ]);
  }

  /**
   * Run Jest test suite
   */
  async runJestSuite(suiteName, testPatterns) {
    const startTime = Date.now();

    try {
      const pattern = testPatterns.join('|');
      const cmd = `npx jest --testPathPattern="(${pattern})" --coverage --json`;

      console.log(`  Running ${testPatterns.length} test pattern(s)...`);

      let output = execSync(cmd, {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10
      });

      const result = JSON.parse(output);
      const duration = Date.now() - startTime;

      console.log(`  ✅ ${suiteName} tests passed (${duration}ms)`);

      return {
        passed: result.success,
        duration,
        coverage: this.extractCoverage(result),
        testResults: result.testResults,
        phase: suiteName
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`  ❌ ${suiteName} tests failed (${duration}ms)`);

      return {
        passed: false,
        duration,
        error: error.message,
        phase: suiteName
      };
    }
  }

  /**
   * Extract coverage data from Jest results
   */
  extractCoverage(jestResult) {
    if (!jestResult.coverageMap) return null;

    // Simple coverage calculation
    let totalLines = 0;
    let coveredLines = 0;

    Object.values(jestResult.coverageMap).forEach(fileCoverage => {
      if (fileCoverage.lines) {
        totalLines += Object.keys(fileCoverage.lines).length;
        coveredLines += Object.values(fileCoverage.lines).filter(count => count > 0).length;
      }
    });

    return {
      lines: {
        total: totalLines,
        covered: coveredLines,
        percentage: totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0
      }
    };
  }

  /**
   * Generate final results
   */
  generateFinalResults(output) {
    const phases = ['llmValidation', 'unitTests', 'integrationTests', 'e2eTests'];
    const completedPhases = phases.filter(phase => this.results[phase] !== null);
    const passedPhases = completedPhases.filter(phase => this.results[phase]?.passed);

    const totalDuration = Date.now() - this.startTime;

    this.results.overall = {
      success: completedPhases.length > 0 && passedPhases.length === completedPhases.length,
      totalPhases: completedPhases.length,
      passedPhases: passedPhases.length,
      failedPhases: completedPhases.length - passedPhases.length,
      totalDuration,
      timestamp: new Date().toISOString()
    };

    this.outputResults(output);
  }

  /**
   * Output results in specified format
   */
  outputResults(format) {
    switch (format) {
      case 'json':
        console.log(JSON.stringify(this.results, null, 2));
        break;

      case 'compact':
        const { overall } = this.results;
        console.log(`${overall.success ? '✅ PASS' : '❌ FAIL'} | ${overall.passedPhases}/${overall.totalPhases} phases | ${overall.totalDuration}ms`);
        break;

      case 'detailed':
      default:
        this.outputDetailedResults();
        break;
    }
  }

  /**
   * Output detailed results
   */
  outputDetailedResults() {
    const { overall } = this.results;

    console.log('\n📊 ENHANCED TEST RESULTS');
    console.log('═'.repeat(60));
    console.log(`Overall Status: ${overall.success ? '✅ SUCCESS' : '❌ FAILURE'}`);
    console.log(`Phases Completed: ${overall.passedPhases}/${overall.totalPhases}`);
    console.log(`Total Duration: ${overall.totalDuration}ms`);
    console.log(`Timestamp: ${overall.timestamp}`);

    // Phase breakdown
    console.log('\n🔍 PHASE BREAKDOWN');
    console.log('-'.repeat(40));

    const phases = [
      { key: 'llmValidation', name: '🤖 LLM Validation', critical: true },
      { key: 'unitTests', name: '🔬 Unit Tests', critical: true },
      { key: 'integrationTests', name: '🔄 Integration Tests', critical: true },
      { key: 'e2eTests', name: '🎭 E2E Tests', critical: false }
    ];

    phases.forEach(phase => {
      const result = this.results[phase.key];
      if (result === null) {
        console.log(`${phase.name}: ⏭️  Skipped`);
        return;
      }

      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const duration = `${result.duration}ms`;
      const critical = phase.critical && !result.passed ? ' (CRITICAL)' : '';

      console.log(`${phase.name}: ${status} - ${duration}${critical}`);

      // Additional details for each phase
      if (result.coverage) {
        console.log(`  └─ Coverage: ${result.coverage.lines.percentage}%`);
      }

      if (!result.passed && result.error) {
        console.log(`  └─ Error: ${result.error}`);
      }

      if (phase.key === 'llmValidation' && result.details) {
        console.log(`  └─ Files: ${result.details.summary.validatedFiles}/${result.details.summary.totalFiles}`);
        console.log(`  └─ Issues: ${result.details.summary.errors} errors, ${result.details.summary.warnings} warnings`);
      }
    });

    // Performance analysis
    if (overall.totalDuration > 0) {
      console.log('\n⚡ PERFORMANCE ANALYSIS');
      console.log('-'.repeat(40));

      phases.forEach(phase => {
        const result = this.results[phase.key];
        if (result && result.duration) {
          const percentage = Math.round((result.duration / overall.totalDuration) * 100);
          console.log(`${phase.name.replace(/🤖|🔬|🔄|🎭/, '').trim()}: ${result.duration}ms (${percentage}%)`);
        }
      });
    }
  }

  /**
   * Run quick validation (LLM only)
   */
  async runQuick() {
    console.log('🚀 Quick LLM Validation');
    console.log('-'.repeat(30));

    const result = await this.runLLMValidation(false);

    if (result.passed) {
      console.log('✅ Quick validation passed - code quality looks good!');
    } else {
      console.log('❌ Quick validation failed - fix issues before running full tests');
    }

    return result.passed;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--skip-unit':
        options.skipUnit = true;
        break;
      case '--skip-integration':
        options.skipIntegration = true;
        break;
      case '--skip-e2e':
        options.skipE2E = true;
        break;
      case '--skip-llm':
        options.skipLLM = true;
        break;
      case '--strict-llm':
        options.strictLLM = true;
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--quick':
        options.quick = true;
        break;
      case '--help':
        console.log(`
Enhanced Test Runner with LLM Validation

Usage: node scripts/test-runner-enhanced.js [options]

Options:
  --skip-unit         Skip unit tests
  --skip-integration  Skip integration tests
  --skip-e2e          Skip E2E tests
  --skip-llm          Skip LLM code validation
  --strict-llm        Treat LLM warnings as errors
  --output <format>   Output format (detailed|compact|json) [default: detailed]
  --quick             Run only quick LLM validation
  --help              Show this help message

Examples:
  node scripts/test-runner-enhanced.js
  node scripts/test-runner-enhanced.js --skip-e2e --strict-llm
  node scripts/test-runner-enhanced.js --quick
  node scripts/test-runner-enhanced.js --output compact
        `);
        return;
    }
  }

  const runner = new EnhancedTestRunner();

  try {
    const success = options.quick
      ? await runner.runQuick()
      : await runner.runAll(options);

    process.exit(success ? 0 : 1);

  } catch (error) {
    console.error('Enhanced test runner failed:', error.message);
    process.exit(1);
  }
}

// Only run if called directly
if (require.main === module) {
  main();
}

module.exports = EnhancedTestRunner;
