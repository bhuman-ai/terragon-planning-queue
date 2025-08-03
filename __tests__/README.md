# Terragon Collaboration System Test Suite

This comprehensive test suite ensures the reliability, security, and sacred document integrity of the Terragon Claude.md collaboration system.

## 🧪 Test Architecture

The test suite follows a layered testing strategy following the test pyramid principle:

```
       🎭 E2E Tests (UI Components)
     🔄 Integration Tests (Workflows) 
   🤝 Unit Tests (APIs & Components)
 🔐 Security Tests (Sacred Protection)
```

## 📁 Test Structure

```
__tests__/
├── security/                    # Security component unit tests
│   ├── agent-auth.test.js      # Agent authentication system
│   ├── dual-hash-integrity.test.js  # Dual-hash integrity system
│   └── atomic-checkpoints.test.js   # Atomic checkpoint system
├── collaboration/               # Collaboration API unit tests
│   ├── drafts-api.test.js      # Draft management APIs
│   ├── checkpoints-api.test.js # Checkpoint management APIs
│   └── merge-api.test.js       # Merge and conflict resolution APIs
├── integration/                 # Integration & workflow tests
│   ├── collaboration-workflow.test.js    # End-to-end workflows
│   └── sacred-document-integrity.test.js # Sacred document protection
├── e2e/                        # End-to-end UI tests
│   └── collaboration-ui.test.js      # Complete UI workflows
├── test-runner.js              # Comprehensive test orchestrator
└── README.md                   # This file
```

## 🔐 Sacred Principles Testing

The test suite enforces the following sacred principles:

### ABSOLUTE RULES - NEVER VIOLATE
1. **NO SIMULATIONS** - Tests use real implementations, never mocks for business logic
2. **NO FALLBACKS** - Tests identify root causes, never create workarounds
3. **NO TEMPLATES** - Test scenarios are dynamically generated, not templated
4. **ALWAYS REAL** - Every test interaction must be genuine

### Sacred Document Protection
- **Content Validation**: Tests verify sacred principles are not violated in CLAUDE.md changes
- **Integrity Monitoring**: Cryptographic verification of sacred document tampering
- **Deployment Protection**: Ensures only sacred deployment targets are allowed

## 🚀 Running Tests

### Quick Start
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:security      # Security components
npm run test:collaboration # Collaboration APIs
npm run test:integration   # Integration workflows
npm run test:e2e          # End-to-end UI tests
npm run test:sacred       # Sacred document integrity

# Comprehensive test suite with reporting
npm run test:comprehensive
```

### Development Testing
```bash
# Watch mode for development
npm run test:watch

# Coverage reporting
npm run test:coverage

# CI mode (no watch, with coverage)
npm run test:ci
```

### Specialized Testing
```bash
# Pre-commit security checks
npm run precommit

# Performance testing
npm run test:performance

# Security audit
npm run audit:security
```

## 📊 Coverage Requirements

The test suite maintains strict coverage requirements:

| Component Type | Lines | Functions | Branches | Statements |
|---------------|-------|-----------|----------|------------|
| Security Components | 90% | 90% | 90% | 90% |
| Collaboration APIs | 85% | 85% | 85% | 85% |
| General Components | 80% | 80% | 80% | 80% |
| Overall Project | 80% | 80% | 80% | 80% |

## 🔍 Test Categories

### 1. Security Tests (`__tests__/security/`)
- **Agent Authentication**: Certificate-based auth, session management
- **Dual-Hash Integrity**: SHA3-256 + BLAKE3 document verification
- **Atomic Checkpoints**: Transaction safety, rollback capabilities

### 2. Collaboration API Tests (`__tests__/collaboration/`)
- **Draft Management**: Creation, updating, version control
- **Checkpoint Operations**: Atomic operations, rollback scenarios
- **Merge & Conflicts**: Conflict detection, resolution workflows

### 3. Integration Tests (`__tests__/integration/`)
- **Complete Workflows**: Multi-agent collaboration scenarios
- **Sacred Document Protection**: End-to-end integrity verification
- **Error Recovery**: Failure handling and system resilience

### 4. E2E Tests (`__tests__/e2e/`)
- **UI Component Integration**: React component interactions
- **User Workflows**: Complete user journey testing
- **Cross-Component Communication**: State management verification

## 🛡️ Security Testing

### Sacred Document Integrity
```javascript
// Example: Testing sacred principle violation detection
test('should reject content violating sacred principles', async () => {
  const violatingContent = 'We can simulate this behavior as a fallback'
  
  await expect(
    createDraft(violatingContent)
  ).rejects.toThrow('Violates NO SIMULATIONS principle')
})
```

### Cryptographic Verification
```javascript
// Example: Testing dual-hash integrity
test('should detect document tampering', async () => {
  const originalContent = 'Original sacred content'
  const checksum = await createChecksum(originalContent)
  
  // Simulate tampering
  const tamperedContent = 'Modified content'
  
  const verification = await verifyIntegrity(tamperedContent, checksum)
  expect(verification.valid).toBe(false)
  expect(verification.critical).toBe(true)
})
```

## 🤝 Collaboration Testing

### Multi-Agent Workflows
```javascript
// Example: Testing agent collaboration
test('should handle multiple agents working on same session', async () => {
  const agent1 = createMockAgent('agent-1')
  const agent2 = createMockAgent('agent-2')
  
  // Agent 1 creates draft
  const draft = await agent1.createDraft(content)
  
  // Agent 2 creates checkpoint
  const checkpoint = await agent2.createCheckpoint(draft.id)
  
  // Verify collaboration tracking
  expect(session.collaborators).toContain(agent1.id)
  expect(session.collaborators).toContain(agent2.id)
})
```

### Conflict Resolution
```javascript
// Example: Testing merge conflict detection
test('should detect sacred section conflicts', async () => {
  const originalContent = '## Sacred Principles\n- NO SIMULATIONS'
  const modifiedContent = '## Sacred Principles\n- SIMULATIONS OK'
  
  const conflicts = await detectConflicts(originalContent, modifiedContent)
  
  expect(conflicts).toHaveLength(1)
  expect(conflicts[0].severity).toBe('critical')
  expect(conflicts[0].category).toBe('sacred')
})
```

## 📈 Performance Testing

### Load Testing
- **Concurrent Operations**: Multiple agents working simultaneously
- **Large Content**: Testing with substantial CLAUDE.md files
- **Rapid Operations**: Sequential API calls and UI interactions

### Benchmarks
- **API Response Times**: < 500ms for CRUD operations
- **UI Interactions**: < 100ms for component updates
- **Cryptographic Operations**: < 1s for integrity checks

## 🔧 Test Configuration

### Jest Configuration (`jest.config.js`)
- **Environment**: Node + JSDOM for UI tests
- **Module Mapping**: Absolute imports support
- **Coverage Thresholds**: Enforced per component type
- **Transform**: Next.js + Babel integration

### Mocking Strategy
```javascript
// Real implementations preferred over mocks
const realSecuritySystem = new SecuritySystem()
await realSecuritySystem.initialize()

// Mocks only for external dependencies
jest.mock('@vercel/kv', () => ({
  kv: {
    get: jest.fn(),
    set: jest.fn()
  }
}))
```

## 🚨 Continuous Integration

### GitHub Actions Workflow
1. **Security Tests**: Critical path - must pass first
2. **Collaboration Tests**: API functionality verification  
3. **Integration Tests**: End-to-end workflow validation
4. **Sacred Document Check**: CLAUDE.md integrity verification
5. **Performance Tests**: Load and benchmark testing
6. **Deployment Readiness**: Build verification

### Pre-commit Hooks
- **Sacred Document Protection**: Prevents sacred principle violations
- **Security Tests**: Runs security suite before commit
- **Code Quality**: ESLint, formatting, audit checks
- **Test Quality**: Ensures proper test structure

## 📊 Reporting

### Test Reports
```bash
# Reports generated in test-reports/
test-reports/
├── test-results.json    # Machine-readable results
├── test-results.html    # Human-readable dashboard
└── coverage-badge.json  # Coverage badge data
```

### Coverage Reports
- **HTML Dashboard**: Interactive coverage exploration
- **JSON Data**: CI/CD integration
- **Badge Generation**: README coverage badges

## 🚀 Best Practices

### Writing Tests
1. **Descriptive Names**: Tests should read like specifications
2. **Arrange-Act-Assert**: Clear test structure
3. **Real Scenarios**: Test actual user workflows
4. **Error Cases**: Test failure modes extensively

### Sacred Principle Compliance
1. **No Mocks for Business Logic**: Use real implementations
2. **Test Root Causes**: Don't just test symptoms
3. **Dynamic Test Data**: Generate scenarios, don't template
4. **Genuine Interactions**: Real API calls in integration tests

### Security Testing
1. **Threat Modeling**: Test actual attack vectors
2. **Boundary Testing**: Verify input validation
3. **State Verification**: Ensure secure state transitions
4. **Audit Trail**: Verify all security events are logged

## 🔍 Debugging Tests

### Common Issues
```bash
# Test timeouts
npm test -- --testTimeout=30000

# Memory issues
npm test -- --maxWorkers=2

# Debugging specific test
npm test -- --testNamePattern="specific test name" --verbose
```

### Test Isolation
- **Clean State**: Each test starts with fresh state
- **Mock Reset**: All mocks cleared between tests
- **Resource Cleanup**: Proper teardown in afterEach

## 📚 Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

## 🤝 Contributing

When adding new tests:

1. **Follow Sacred Principles**: No simulations, fallbacks, or templates
2. **Maintain Coverage**: Ensure new code has adequate test coverage
3. **Security First**: Include security considerations in all tests
4. **Document Intent**: Clear test descriptions and comments
5. **Performance Aware**: Consider test execution time

### Sacred Document Changes
If modifying CLAUDE.md:
1. Ensure tests pass before committing
2. Run sacred document integrity checks
3. Verify no sacred principles are violated
4. Update related tests if needed

---

**Remember**: These tests guard the sacred principles of the Terragon system. They are not just tests - they are the guardians of quality, security, and integrity.

🔐 **NO SIMULATIONS** - 🚫 **NO FALLBACKS** - ⚡ **ALWAYS REAL**