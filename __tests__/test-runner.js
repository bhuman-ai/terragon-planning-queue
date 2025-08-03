/**
 * Comprehensive Test Runner
 * Orchestrates different test suites and provides reporting
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestRunner {
  constructor() {
    this.results = {
      security: null,
      collaboration: null,
      integration: null,
      e2e: null,
      overall: null
    };
    this.startTime = Date.now();
  }

  /**
   * Run all test suites
   */
  async runAllTests() {
    console.log('🧪 Starting Comprehensive Test Suite for Terragon Claude.md Collaboration System');
    console.log('=' .repeat(80));

    try {
      // Run security tests
      console.log('\n🔐 Running Security Tests...');
      this.results.security = await this.runTestSuite('security', [
        '__tests__/security/agent-auth.test.js',
        '__tests__/security/dual-hash-integrity.test.js',
        '__tests__/security/atomic-checkpoints.test.js'
      ]);

      // Run collaboration API tests
      console.log('\n🤝 Running Collaboration API Tests...');
      this.results.collaboration = await this.runTestSuite('collaboration', [
        '__tests__/collaboration/drafts-api.test.js',
        '__tests__/collaboration/checkpoints-api.test.js',
        '__tests__/collaboration/merge-api.test.js'
      ]);

      // Run integration tests
      console.log('\n🔄 Running Integration Tests...');
      this.results.integration = await this.runTestSuite('integration', [
        '__tests__/integration/collaboration-workflow.test.js',
        '__tests__/integration/sacred-document-integrity.test.js'
      ]);

      // Run E2E tests
      console.log('\n🎭 Running E2E UI Tests...');
      this.results.e2e = await this.runTestSuite('e2e', [
        '__tests__/e2e/collaboration-ui.test.js'
      ]);

      // Generate overall results
      this.generateOverallResults();

      // Generate reports
      await this.generateReports();

      console.log(`\n${'=' .repeat(80)}`);
      console.log('✅ Test Suite Completed');
      this.printSummary();

      return this.results.overall.success;

    } catch (error) {
      console.error('\n❌ Test Suite Failed:', error.message);
      return false;
    }
  }

  /**
   * Run specific test suite
   */
  async runTestSuite(suiteName, testFiles) {
    const startTime = Date.now();
    let success = true;
    let output = '';
    let coverage = null;

    try {
      // Build Jest command
      const testPattern = testFiles.join('|');
      const jestCmd = `npx jest --testPathPattern="(${testPattern})" --coverage --verbose --json`;

      console.log(`  Running: ${testFiles.length} test files`);

      // Execute tests
      output = execSync(jestCmd, {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      // Parse Jest JSON output
      const jsonOutput = this.parseJestOutput(output);
      coverage = this.extractCoverageData(jsonOutput);

      console.log(`  ✅ ${suiteName} tests passed`);

    } catch (error) {
      success = false;
      output = error.stdout || error.message;
      console.log(`  ❌ ${suiteName} tests failed`);

      // Try to parse even failed output for partial results
      try {
        const jsonOutput = this.parseJestOutput(output);
        coverage = this.extractCoverageData(jsonOutput);
      } catch (parseError) {
        console.log(`    Could not parse output: ${parseError.message}`);
      }
    }

    const duration = Date.now() - startTime;

    return {
      suiteName,
      success,
      duration,
      output,
      coverage,
      testFiles: testFiles.length
    };
  }

  /**
   * Parse Jest JSON output
   */
  parseJestOutput(output) {
    // Jest outputs multiple JSON objects, we need the last one
    const lines = output.split('\n').filter(line => line.trim());
    const jsonLine = lines.find(line => line.startsWith('{') && line.includes('"success"'));

    if (!jsonLine) {
      throw new Error('Could not find Jest JSON output');
    }

    return JSON.parse(jsonLine);
  }

  /**
   * Extract coverage data from Jest output
   */
  extractCoverageData(jsonOutput) {
    if (!jsonOutput.coverageMap) {
      return null;
    }

    // Calculate overall coverage
    let totalLines = 0;
    let coveredLines = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalStatements = 0;
    let coveredStatements = 0;

    Object.values(jsonOutput.coverageMap).forEach(fileCoverage => {
      if (fileCoverage.lines) {
        totalLines += Object.keys(fileCoverage.lines).length;
        coveredLines += Object.values(fileCoverage.lines).filter(count => count > 0).length;
      }

      if (fileCoverage.functions) {
        totalFunctions += Object.keys(fileCoverage.functions).length;
        coveredFunctions += Object.values(fileCoverage.functions).filter(count => count > 0).length;
      }

      if (fileCoverage.branches) {
        totalBranches += Object.keys(fileCoverage.branches).length;
        coveredBranches += Object.values(fileCoverage.branches).filter(count => count > 0).length;
      }

      if (fileCoverage.statements) {
        totalStatements += Object.keys(fileCoverage.statements).length;
        coveredStatements += Object.values(fileCoverage.statements).filter(count => count > 0).length;
      }
    });

    return {
      lines: { covered: coveredLines, total: totalLines, percentage: totalLines > 0 ? (coveredLines / totalLines * 100).toFixed(2) : 0 },
      functions: { covered: coveredFunctions, total: totalFunctions, percentage: totalFunctions > 0 ? (coveredFunctions / totalFunctions * 100).toFixed(2) : 0 },
      branches: { covered: coveredBranches, total: totalBranches, percentage: totalBranches > 0 ? (coveredBranches / totalBranches * 100).toFixed(2) : 0 },
      statements: { covered: coveredStatements, total: totalStatements, percentage: totalStatements > 0 ? (coveredStatements / totalStatements * 100).toFixed(2) : 0 }
    };
  }

  /**
   * Generate overall results
   */
  generateOverallResults() {
    const suites = [this.results.security, this.results.collaboration, this.results.integration, this.results.e2e];
    const successfulSuites = suites.filter(suite => suite && suite.success).length;
    const totalSuites = suites.filter(suite => suite).length;
    const totalDuration = Date.now() - this.startTime;

    // Calculate overall coverage
    let overallCoverage = null;
    const coverageData = suites.filter(suite => suite && suite.coverage).map(suite => suite.coverage);

    if (coverageData.length > 0) {
      overallCoverage = this.mergeCoverageData(coverageData);
    }

    this.results.overall = {
      success: successfulSuites === totalSuites && totalSuites > 0,
      totalSuites,
      successfulSuites,
      failedSuites: totalSuites - successfulSuites,
      totalDuration,
      coverage: overallCoverage,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Merge coverage data from multiple suites
   */
  mergeCoverageData(coverageDataArray) {
    const merged = {
      lines: { covered: 0, total: 0, percentage: 0 },
      functions: { covered: 0, total: 0, percentage: 0 },
      branches: { covered: 0, total: 0, percentage: 0 },
      statements: { covered: 0, total: 0, percentage: 0 }
    };

    coverageDataArray.forEach(coverage => {
      Object.keys(merged).forEach(metric => {
        merged[metric].covered += coverage[metric].covered;
        merged[metric].total += coverage[metric].total;
      });
    });

    // Calculate percentages
    Object.keys(merged).forEach(metric => {
      merged[metric].percentage = merged[metric].total > 0
        ? (merged[metric].covered / merged[metric].total * 100).toFixed(2)
        : 0;
    });

    return merged;
  }

  /**
   * Generate test reports
   */
  async generateReports() {
    const reportsDir = path.join(process.cwd(), 'test-reports');

    // Ensure reports directory exists
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Generate JSON report
    const jsonReport = {
      timestamp: new Date().toISOString(),
      results: this.results,
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        totalDuration: this.results.overall.totalDuration
      }
    };

    fs.writeFileSync(
      path.join(reportsDir, 'test-results.json'),
      JSON.stringify(jsonReport, null, 2)
    );

    // Generate HTML report
    const htmlReport = this.generateHTMLReport(jsonReport);
    fs.writeFileSync(
      path.join(reportsDir, 'test-results.html'),
      htmlReport
    );

    // Generate coverage badge data
    if (this.results.overall.coverage) {
      const badgeData = this.generateCoverageBadge(this.results.overall.coverage);
      fs.writeFileSync(
        path.join(reportsDir, 'coverage-badge.json'),
        JSON.stringify(badgeData, null, 2)
      );
    }

    console.log(`\n📊 Reports generated in: ${reportsDir}`);
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(jsonReport) {
    const { results, metadata } = jsonReport;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terragon Test Results</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .suite { margin: 20px 0; border: 1px solid #e1e5e9; border-radius: 6px; overflow: hidden; }
        .suite-header { background: #f6f8fa; padding: 15px; border-bottom: 1px solid #e1e5e9; }
        .suite-content { padding: 15px; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .coverage-bar { width: 100%; height: 20px; background: #e1e5e9; border-radius: 10px; overflow: hidden; }
        .coverage-fill { height: 100%; background: linear-gradient(90deg, #28a745, #20c997); transition: width 0.3s ease; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .badge-success { background: #28a745; color: white; }
        .badge-danger { background: #dc3545; color: white; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .summary-number { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Terragon Claude.md Collaboration System</h1>
            <h2>Test Results Report</h2>
            <p>Generated: ${new Date(jsonReport.timestamp).toLocaleString()}</p>
        </div>

        <div class="content">
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="summary-number ${results.overall.success ? 'success' : 'failure'}">
                        ${results.overall.success ? '✅' : '❌'}
                    </div>
                    <div>Overall Status</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number">${results.overall.successfulSuites}/${results.overall.totalSuites}</div>
                    <div>Test Suites Passed</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number">${(results.overall.totalDuration / 1000).toFixed(1)}s</div>
                    <div>Total Duration</div>
                </div>
                ${results.overall.coverage ? `
                <div class="summary-card">
                    <div class="summary-number">${results.overall.coverage.lines.percentage}%</div>
                    <div>Line Coverage</div>
                </div>
                ` : ''}
            </div>

            ${results.overall.coverage ? `
            <h3>📊 Coverage Summary</h3>
            <div class="coverage-metrics">
                <div class="metric">
                    <strong>Lines:</strong> ${results.overall.coverage.lines.covered}/${results.overall.coverage.lines.total} (${results.overall.coverage.lines.percentage}%)
                    <div class="coverage-bar">
                        <div class="coverage-fill" style="width: ${results.overall.coverage.lines.percentage}%"></div>
                    </div>
                </div>
                <div class="metric">
                    <strong>Functions:</strong> ${results.overall.coverage.functions.covered}/${results.overall.coverage.functions.total} (${results.overall.coverage.functions.percentage}%)
                    <div class="coverage-bar">
                        <div class="coverage-fill" style="width: ${results.overall.coverage.functions.percentage}%"></div>
                    </div>
                </div>
                <div class="metric">
                    <strong>Branches:</strong> ${results.overall.coverage.branches.covered}/${results.overall.coverage.branches.total} (${results.overall.coverage.branches.percentage}%)
                    <div class="coverage-bar">
                        <div class="coverage-fill" style="width: ${results.overall.coverage.branches.percentage}%"></div>
                    </div>
                </div>
                <div class="metric">
                    <strong>Statements:</strong> ${results.overall.coverage.statements.covered}/${results.overall.coverage.statements.total} (${results.overall.coverage.statements.percentage}%)
                    <div class="coverage-bar">
                        <div class="coverage-fill" style="width: ${results.overall.coverage.statements.percentage}%"></div>
                    </div>
                </div>
            </div>
            ` : ''}

            <h3>🔍 Test Suite Details</h3>
            ${Object.values(results).filter(result => result && result.suiteName).map(result => `
            <div class="suite">
                <div class="suite-header">
                    <h4>
                        ${result.success ? '✅' : '❌'} ${result.suiteName.toUpperCase()} Tests
                        <span class="badge ${result.success ? 'badge-success' : 'badge-danger'}">
                            ${result.success ? 'PASSED' : 'FAILED'}
                        </span>
                    </h4>
                    <div>
                        Duration: ${(result.duration / 1000).toFixed(1)}s |
                        Files: ${result.testFiles}
                        ${result.coverage ? ` | Coverage: ${result.coverage.lines.percentage}%` : ''}
                    </div>
                </div>
                ${result.coverage ? `
                <div class="suite-content">
                    <h5>Coverage Details</h5>
                    <div class="metric">
                        Lines: ${result.coverage.lines.covered}/${result.coverage.lines.total} (${result.coverage.lines.percentage}%)
                    </div>
                    <div class="metric">
                        Functions: ${result.coverage.functions.covered}/${result.coverage.functions.total} (${result.coverage.functions.percentage}%)
                    </div>
                </div>
                ` : ''}
            </div>
            `).join('')}

            <h3>🛠 Environment</h3>
            <div class="suite">
                <div class="suite-content">
                    <div class="metric">Node.js: ${metadata.nodeVersion}</div>
                    <div class="metric">Platform: ${metadata.platform}</div>
                    <div class="metric">Architecture: ${metadata.architecture}</div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate coverage badge data
   */
  generateCoverageBadge(coverage) {
    const percentage = parseFloat(coverage.lines.percentage);
    let color = 'red';

    if (percentage >= 90) color = 'brightgreen';
    else if (percentage >= 80) color = 'green';
    else if (percentage >= 70) color = 'yellow';
    else if (percentage >= 60) color = 'orange';

    return {
      schemaVersion: 1,
      label: 'coverage',
      message: `${percentage}%`,
      color
    };
  }

  /**
   * Print summary to console
   */
  printSummary() {
    const { overall } = this.results;

    console.log('\n📊 TEST SUMMARY');
    console.log('-'.repeat(50));
    console.log(`Overall Status: ${overall.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Test Suites: ${overall.successfulSuites}/${overall.totalSuites} passed`);
    console.log(`Duration: ${(overall.totalDuration / 1000).toFixed(1)}s`);

    if (overall.coverage) {
      console.log('\n📈 COVERAGE');
      console.log('-'.repeat(50));
      console.log(`Lines: ${overall.coverage.lines.percentage}%`);
      console.log(`Functions: ${overall.coverage.functions.percentage}%`);
      console.log(`Branches: ${overall.coverage.branches.percentage}%`);
      console.log(`Statements: ${overall.coverage.statements.percentage}%`);
    }

    console.log('\n🔍 SUITE BREAKDOWN');
    console.log('-'.repeat(50));
    Object.values(this.results).filter(result => result && result.suiteName).forEach(result => {
      console.log(`${result.success ? '✅' : '❌'} ${result.suiteName}: ${(result.duration / 1000).toFixed(1)}s`);
    });
  }
}

// CLI execution
if (require.main === module) {
  const runner = new TestRunner();

  runner.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = TestRunner;
