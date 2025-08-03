#!/usr/bin/env node

/**
 * Objective Binary Validation CLI for LLM-Generated Code
 * Provides instant pass/fail results with <100ms overhead
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

class LLMCodeValidator {
  constructor() {
    this.startTime = Date.now()
    this.results = {
      passed: true,
      errors: [],
      warnings: [],
      metrics: {
        totalFiles: 0,
        validatedFiles: 0,
        ruleViolations: 0,
        executionTime: 0
      }
    }
  }

  /**
   * Run objective binary validation
   * @param {Object} options - Validation options
   * @returns {Object} Binary validation results
   */
  async validate(options = {}) {
    const {
      files = [],
      target = 'all',
      strict = false,
      output = 'json'
    } = options

    console.log('🔍 Starting LLM Code Objective Validation...')
    
    try {
      // Get files to validate
      const filesToValidate = this.getFilesToValidate(files, target)
      this.results.metrics.totalFiles = filesToValidate.length
      
      if (filesToValidate.length === 0) {
        this.results.errors.push('No files found for validation')
        this.results.passed = false
        return this.generateOutput(output)
      }

      // Run ESLint validation
      await this.runESLintValidation(filesToValidate, strict)
      
      // Run custom LLM checks
      await this.runCustomLLMChecks(filesToValidate)
      
      // Calculate final result
      this.results.passed = this.results.errors.length === 0
      this.results.metrics.executionTime = Date.now() - this.startTime
      
      return this.generateOutput(output)
      
    } catch (error) {
      this.results.errors.push(`Validation failed: ${error.message}`)
      this.results.passed = false
      this.results.metrics.executionTime = Date.now() - this.startTime
      
      return this.generateOutput(output)
    }
  }

  /**
   * Get files to validate based on target
   */
  getFilesToValidate(files, target) {
    if (files.length > 0) {
      return files.filter(file => fs.existsSync(file))
    }

    const patterns = {
      all: ['lib/**/*.js', 'pages/**/*.js', 'components/**/*.js'],
      llm: ['lib/meta-agent/**/*.js', 'lib/collaboration/**/*.js'],
      security: ['lib/security/**/*.js'],
      api: ['pages/api/**/*.js'],
      tests: ['__tests__/**/*.js']
    }

    const targetPatterns = patterns[target] || patterns.all
    const foundFiles = []

    targetPatterns.forEach(pattern => {
      try {
        const globResults = execSync(`find . -path "${pattern}" -type f 2>/dev/null`, { 
          encoding: 'utf8' 
        }).split('\n').filter(Boolean)
        foundFiles.push(...globResults)
      } catch (error) {
        // Ignore glob errors - continue with other patterns
      }
    })

    return [...new Set(foundFiles)] // Remove duplicates
  }

  /**
   * Run ESLint validation with LLM rules
   */
  async runESLintValidation(files, strict) {
    const eslintArgs = [
      '--format', 'json',
      '--no-eslintrc',
      '--config', '.eslintrc.js'
    ]

    if (strict) {
      eslintArgs.push('--max-warnings', '0')
    }

    eslintArgs.push(...files)

    try {
      const eslintOutput = execSync(`npx eslint ${eslintArgs.join(' ')}`, {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 5 // 5MB buffer
      })

      // If no output, all files passed
      if (!eslintOutput.trim()) {
        this.results.metrics.validatedFiles = files.length
        return
      }

    } catch (error) {
      // ESLint returns non-zero exit code for errors
      if (error.stdout) {
        try {
          const eslintResults = JSON.parse(error.stdout)
          this.processESLintResults(eslintResults)
        } catch (parseError) {
          this.results.errors.push(`Failed to parse ESLint output: ${parseError.message}`)
        }
      } else {
        this.results.errors.push(`ESLint execution failed: ${error.message}`)
      }
    }
  }

  /**
   * Process ESLint results
   */
  processESLintResults(eslintResults) {
    eslintResults.forEach(fileResult => {
      this.results.metrics.validatedFiles++
      
      fileResult.messages.forEach(message => {
        const violation = {
          file: fileResult.filePath,
          rule: message.ruleId,
          message: message.message,
          line: message.line,
          column: message.column,
          severity: message.severity
        }

        if (message.severity === 2) { // Error
          this.results.errors.push(violation)
          this.results.metrics.ruleViolations++
        } else if (message.severity === 1) { // Warning
          this.results.warnings.push(violation)
        }
      })
    })
  }

  /**
   * Run custom LLM validation checks
   */
  async runCustomLLMChecks(files) {
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8')
        
        // Check 1: No simulation/mock patterns
        if (this.checkForSimulationPatterns(content, file)) continue
        
        // Check 2: Function complexity
        if (this.checkFunctionComplexity(content, file)) continue
        
        // Check 3: Error handling patterns
        if (this.checkErrorHandling(content, file)) continue
        
        // Check 4: Sacred principles compliance
        if (this.checkSacredPrinciples(content, file)) continue
        
      } catch (error) {
        this.results.errors.push({
          file,
          rule: 'file-access',
          message: `Cannot read file: ${error.message}`,
          line: 0,
          column: 0,
          severity: 2
        })
      }
    }
  }

  /**
   * Check for simulation/mock patterns (Sacred Principle #1)
   */
  checkForSimulationPatterns(content, file) {
    const forbiddenPatterns = [
      /mock\s*\(/gi,
      /simulate\s*\(/gi,
      /fake\s*\(/gi,
      /stub\s*\(/gi,
      /\.mock\./gi,
      /\.fake\./gi,
      /\.simulate\./gi
    ]

    // Allow mocks only in test files
    if (file.includes('test') || file.includes('spec') || file.includes('__tests__')) {
      return false
    }

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        this.results.errors.push({
          file,
          rule: 'no-simulation',
          message: 'Sacred Principle Violation: No simulations, mocks, or fake functionality allowed',
          line: this.findLineNumber(content, pattern),
          column: 0,
          severity: 2
        })
        return true
      }
    }

    return false
  }

  /**
   * Check function complexity
   */
  checkFunctionComplexity(content, file) {
    // Simple regex to find functions with excessive line count
    const functionRegex = /function\s+\w+\s*\([^)]*\)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g
    const arrowFunctionRegex = /(?:const|let|var)\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g
    
    let match
    let hasComplexityViolation = false

    // Check regular functions
    while ((match = functionRegex.exec(content)) !== null) {
      const functionBody = match[1]
      const lineCount = functionBody.split('\n').length
      
      if (lineCount > 50) {
        this.results.errors.push({
          file,
          rule: 'max-function-length',
          message: `Function exceeds 50 lines (${lineCount} lines)`,
          line: this.findLineNumber(content, match[0]),
          column: 0,
          severity: 2
        })
        hasComplexityViolation = true
      }
    }

    // Check arrow functions
    while ((match = arrowFunctionRegex.exec(content)) !== null) {
      const functionBody = match[1]
      const lineCount = functionBody.split('\n').length
      
      if (lineCount > 50) {
        this.results.errors.push({
          file,
          rule: 'max-function-length',
          message: `Arrow function exceeds 50 lines (${lineCount} lines)`,
          line: this.findLineNumber(content, match[0]),
          column: 0,
          severity: 2
        })
        hasComplexityViolation = true
      }
    }

    return hasComplexityViolation
  }

  /**
   * Check error handling patterns
   */
  checkErrorHandling(content, file) {
    // Check for empty catch blocks
    const emptyCatchRegex = /catch\s*\([^)]*\)\s*\{\s*\}/g
    let hasErrorHandlingViolation = false

    if (emptyCatchRegex.test(content)) {
      this.results.errors.push({
        file,
        rule: 'no-empty-catch',
        message: 'Empty catch block detected - must handle errors properly',
        line: this.findLineNumber(content, emptyCatchRegex),
        column: 0,
        severity: 2
      })
      hasErrorHandlingViolation = true
    }

    return hasErrorHandlingViolation
  }

  /**
   * Check sacred principles compliance
   */
  checkSacredPrinciples(content, file) {
    let hasViolation = false

    // Check for fallback patterns (Sacred Principle #2)
    const fallbackPatterns = [
      /fallback\s*=/gi,
      /default\s*=.*fallback/gi,
      /\.fallback\(/gi
    ]

    for (const pattern of fallbackPatterns) {
      if (pattern.test(content)) {
        this.results.errors.push({
          file,
          rule: 'no-fallbacks',
          message: 'Sacred Principle Violation: No fallbacks allowed - fix the root problem',
          line: this.findLineNumber(content, pattern),
          column: 0,
          severity: 2
        })
        hasViolation = true
      }
    }

    return hasViolation
  }

  /**
   * Find line number for a pattern match
   */
  findLineNumber(content, pattern) {
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test ? pattern.test(lines[i]) : lines[i].includes(pattern)) {
        return i + 1
      }
    }
    return 1
  }

  /**
   * Generate output in specified format
   */
  generateOutput(format) {
    const output = {
      passed: this.results.passed,
      timestamp: new Date().toISOString(),
      executionTime: this.results.metrics.executionTime,
      summary: {
        totalFiles: this.results.metrics.totalFiles,
        validatedFiles: this.results.metrics.validatedFiles,
        errors: this.results.errors.length,
        warnings: this.results.warnings.length,
        ruleViolations: this.results.metrics.ruleViolations
      },
      results: {
        errors: this.results.errors,
        warnings: this.results.warnings
      }
    }

    switch (format) {
      case 'json':
        console.log(JSON.stringify(output, null, 2))
        break
      
      case 'compact':
        console.log(`${output.passed ? '✅ PASS' : '❌ FAIL'} | ${output.summary.errors} errors | ${output.summary.warnings} warnings | ${output.executionTime}ms`)
        break
      
      case 'detailed':
        console.log('📊 LLM Code Validation Results')
        console.log('═'.repeat(50))
        console.log(`Status: ${output.passed ? '✅ PASSED' : '❌ FAILED'}`)
        console.log(`Files: ${output.summary.validatedFiles}/${output.summary.totalFiles}`)
        console.log(`Errors: ${output.summary.errors}`)
        console.log(`Warnings: ${output.summary.warnings}`)
        console.log(`Execution Time: ${output.executionTime}ms`)
        
        if (output.results.errors.length > 0) {
          console.log('\n❌ Errors:')
          output.results.errors.forEach(error => {
            console.log(`  ${error.file}:${error.line} - ${error.message} (${error.rule})`)
          })
        }
        
        if (output.results.warnings.length > 0) {
          console.log('\n⚠️  Warnings:')
          output.results.warnings.forEach(warning => {
            console.log(`  ${warning.file}:${warning.line} - ${warning.message} (${warning.rule})`)
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
      case '--target':
        options.target = args[++i]
        break
      case '--files':
        options.files = args[++i].split(',')
        break
      case '--strict':
        options.strict = true
        break
      case '--output':
        options.output = args[++i]
        break
      case '--help':
        console.log(`
LLM Code Objective Validator

Usage: node scripts/validate-llm-code.js [options]

Options:
  --target <type>     Target files (all|llm|security|api|tests) [default: all]
  --files <list>      Comma-separated list of specific files
  --strict            Treat warnings as errors
  --output <format>   Output format (json|compact|detailed) [default: json]
  --help              Show this help message

Examples:
  node scripts/validate-llm-code.js --target llm --output detailed
  node scripts/validate-llm-code.js --files lib/meta-agent/index.js --strict
  node scripts/validate-llm-code.js --target security --output compact
        `)
        return
    }
  }

  const validator = new LLMCodeValidator()
  const result = await validator.validate(options)
  
  // Exit with appropriate code
  process.exit(result.passed ? 0 : 1)
}

// Only run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Validator failed:', error.message)
    process.exit(1)
  })
}

module.exports = LLMCodeValidator