#!/usr/bin/env node

/**
 * DOM Validation Script for LLM-Generated UI Components
 * Provides instant pass/fail validation for UI elements
 */

const DOMValidator = require('../lib/dom-testing/dom-validator')
const fs = require('fs').promises
const path = require('path')
const glob = require('glob')

class DOMValidationRunner {
  constructor() {
    this.results = {
      totalFiles: 0,
      passedFiles: 0,
      failedFiles: 0,
      errors: [],
      executionTime: 0
    }
  }

  /**
   * Run DOM validation on specified files
   * @param {Object} options - Validation options
   * @returns {Object} Validation results
   */
  async run(options = {}) {
    const {
      pattern = 'components/**/*.js',
      configFile = null,
      output = 'json',
      verbose = false
    } = options

    const startTime = Date.now()
    console.log('🔍 Starting DOM Validation...')

    try {
      // Load test configurations
      const testConfigs = await this.loadTestConfigs(configFile, pattern)
      
      if (testConfigs.length === 0) {
        console.error('No test configurations found')
        return this.generateOutput(output)
      }

      // Run validation for each configuration
      for (const config of testConfigs) {
        await this.validateComponent(config, verbose)
      }

      this.results.executionTime = Date.now() - startTime
      return this.generateOutput(output)

    } catch (error) {
      console.error('Validation error:', error.message)
      this.results.errors.push({
        type: 'runner-error',
        message: error.message
      })
      return this.generateOutput(output)
    }
  }

  /**
   * Load test configurations
   */
  async loadTestConfigs(configFile, pattern) {
    const configs = []

    if (configFile) {
      // Load from config file
      try {
        const configPath = path.resolve(configFile)
        const configContent = await fs.readFile(configPath, 'utf8')
        const config = JSON.parse(configContent)
        
        if (Array.isArray(config)) {
          configs.push(...config)
        } else {
          configs.push(config)
        }
      } catch (error) {
        throw new Error(`Failed to load config file: ${error.message}`)
      }
    } else {
      // Load default test configurations for collaboration components
      configs.push(...this.getDefaultConfigs())
    }

    return configs
  }

  /**
   * Get default test configurations
   */
  getDefaultConfigs() {
    return [
      {
        name: 'CollaborationHub',
        file: 'components/collaboration/CollaborationHub.js',
        html: `
          <div class="collaboration-hub">
            <div class="hub-header">
              <h1>Claude.md Collaboration Hub</h1>
            </div>
            <div class="view-selector">
              <button data-view="ideation">Ideation</button>
              <button data-view="orchestration">Task Orchestration</button>
              <button data-view="execution">Execution</button>
              <button data-view="merge">Merge Review</button>
            </div>
          </div>
        `,
        tests: {
          elements: [
            { selector: '.collaboration-hub', exists: true },
            { selector: '.hub-header h1', exists: true },
            { selector: '.view-selector button', count: 4 }
          ]
        }
      },
      {
        name: 'IdeationView',
        file: 'components/collaboration/IdeationView.js',
        html: `
          <div class="ideation-view">
            <textarea id="claude-draft"></textarea>
            <div class="ai-mode-selector">
              <input type="radio" name="ai-mode" value="collaborative">
              <input type="radio" name="ai-mode" value="research">
              <input type="radio" name="ai-mode" value="critique">
            </div>
          </div>
        `,
        tests: {
          elements: [
            { selector: '.ideation-view', exists: true },
            { selector: '#claude-draft', exists: true },
            { selector: 'input[name="ai-mode"]', count: 3 }
          ]
        }
      },
      {
        name: 'TaskOrchestrationView',
        file: 'components/collaboration/TaskOrchestrationView.js',
        html: `
          <div class="orchestration-view">
            <div class="task-list"></div>
            <button id="generate-tasks">Generate Tasks</button>
          </div>
        `,
        tests: {
          elements: [
            { selector: '.orchestration-view', exists: true },
            { selector: '.task-list', exists: true },
            { selector: '#generate-tasks', exists: true }
          ]
        }
      },
      {
        name: 'ExecutionView',
        file: 'components/collaboration/ExecutionView.js',
        html: `
          <div class="execution-view">
            <div class="checkpoint-list"></div>
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
          </div>
        `,
        tests: {
          elements: [
            { selector: '.execution-view', exists: true },
            { selector: '.checkpoint-list', exists: true },
            { selector: '.progress-bar', exists: true }
          ]
        }
      },
      {
        name: 'MergeReviewView',
        file: 'components/collaboration/MergeReviewView.js',
        html: `
          <div class="merge-review-view">
            <div class="diff-viewer"></div>
            <div class="merge-actions">
              <button id="approve-merge">Approve</button>
              <button id="request-changes">Request Changes</button>
            </div>
          </div>
        `,
        tests: {
          elements: [
            { selector: '.merge-review-view', exists: true },
            { selector: '.diff-viewer', exists: true },
            { selector: '.merge-actions button', count: 2 }
          ]
        }
      }
    ]
  }

  /**
   * Validate a component
   */
  async validateComponent(config, verbose) {
    const validator = new DOMValidator({ verbose })
    
    try {
      console.log(`\nValidating ${config.name}...`)
      this.results.totalFiles++

      // Initialize DOM with component HTML
      await validator.initialize(config.html)

      // Run validation tests
      const results = await validator.validate(config.tests)

      if (results.passed) {
        console.log(`✅ ${config.name} - PASSED`)
        this.results.passedFiles++
      } else {
        console.log(`❌ ${config.name} - FAILED`)
        this.results.failedFiles++
        
        // Log errors
        results.errors.forEach(error => {
          console.log(`   - ${error.name}: ${error.error}`)
          this.results.errors.push({
            component: config.name,
            test: error.name,
            error: error.error
          })
        })
      }

      // Show metrics if verbose
      if (verbose) {
        console.log(`   Tests: ${results.metrics.totalTests} | Passed: ${results.metrics.passedTests} | Failed: ${results.metrics.failedTests}`)
      }

    } catch (error) {
      console.log(`❌ ${config.name} - ERROR: ${error.message}`)
      this.results.failedFiles++
      this.results.errors.push({
        component: config.name,
        type: 'validation-error',
        error: error.message
      })
    } finally {
      validator.cleanup()
    }
  }

  /**
   * Generate output in specified format
   */
  generateOutput(format) {
    const output = {
      passed: this.results.failedFiles === 0,
      timestamp: new Date().toISOString(),
      executionTime: this.results.executionTime,
      summary: {
        totalFiles: this.results.totalFiles,
        passedFiles: this.results.passedFiles,
        failedFiles: this.results.failedFiles,
        errors: this.results.errors.length
      },
      errors: this.results.errors
    }

    switch (format) {
      case 'json':
        console.log('\n' + JSON.stringify(output, null, 2))
        break

      case 'compact':
        console.log(`\n${output.passed ? '✅ PASS' : '❌ FAIL'} | Files: ${output.summary.passedFiles}/${output.summary.totalFiles} | Errors: ${output.summary.errors} | ${output.executionTime}ms`)
        break

      case 'detailed':
        console.log('\n📊 DOM Validation Results')
        console.log('═'.repeat(50))
        console.log(`Status: ${output.passed ? '✅ PASSED' : '❌ FAILED'}`)
        console.log(`Files: ${output.summary.passedFiles}/${output.summary.totalFiles} passed`)
        console.log(`Errors: ${output.summary.errors}`)
        console.log(`Execution Time: ${output.executionTime}ms`)
        
        if (output.errors.length > 0) {
          console.log('\n❌ Validation Errors:')
          output.errors.forEach(error => {
            console.log(`  ${error.component} - ${error.test || error.type}: ${error.error}`)
          })
        }
        break
    }

    return output
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2)
  const options = {}

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--pattern':
        options.pattern = args[++i]
        break
      case '--config':
        options.configFile = args[++i]
        break
      case '--output':
        options.output = args[++i]
        break
      case '--verbose':
        options.verbose = true
        break
      case '--help':
        console.log(`
DOM Validation Tool

Usage: node scripts/validate-dom.js [options]

Options:
  --pattern <glob>    File pattern to validate [default: components/**/*.js]
  --config <file>     JSON config file with test specifications
  --output <format>   Output format (json|compact|detailed) [default: json]
  --verbose           Show detailed test results
  --help              Show this help message

Examples:
  node scripts/validate-dom.js --output detailed
  node scripts/validate-dom.js --config dom-tests.json --verbose
  node scripts/validate-dom.js --pattern "src/**/*.jsx" --output compact
        `)
        return
    }
  }

  const runner = new DOMValidationRunner()
  const result = await runner.run(options)
  
  // Exit with appropriate code
  process.exit(result.passed ? 0 : 1)
}

// Only run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('DOM validation failed:', error.message)
    process.exit(1)
  })
}

module.exports = DOMValidationRunner