// Jest setup file for testing configuration
import '@testing-library/jest-dom'

// Mock environment variables for testing
process.env.NODE_ENV = 'test'
process.env.CLAUDE_API_KEY = 'test-claude-key'
process.env.PERPLEXITY_API_KEY = 'test-perplexity-key'
process.env.DISCORD_BOT_TOKEN = 'test-discord-token'
process.env.DISCORD_CHANNEL_ID = 'test-channel-id'
process.env.CRON_SECRET = 'test-cron-secret'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock Vercel KV for testing
jest.mock('@vercel/kv', () => ({
  kv: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    keys: jest.fn(),
    ping: jest.fn(),
    hget: jest.fn(),
    hset: jest.fn(),
    hdel: jest.fn(),
    hgetall: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    incr: jest.fn(),
    lpush: jest.fn(),
    rpush: jest.fn(),
    lpop: jest.fn(),
    rpop: jest.fn(),
    lrange: jest.fn(),
    sadd: jest.fn(),
    srem: jest.fn(),
    smembers: jest.fn(),
    sismember: jest.fn()
  }
}))

// Mock crypto for deterministic testing
const crypto = require('crypto')
const originalRandomUUID = crypto.randomUUID

// Create a deterministic UUID generator for testing
let uuidCounter = 0
crypto.randomUUID = jest.fn(() => {
  return `test-uuid-${++uuidCounter}`
})

// Mock Date.now for deterministic timestamps
const originalDateNow = Date.now
Date.now = jest.fn(() => 1640995200000) // Fixed timestamp: 2022-01-01 00:00:00 UTC

// Mock file system operations for security components
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  access: jest.fn(),
  mkdir: jest.fn(),
  stat: jest.fn(),
  unlink: jest.fn(),
  readdir: jest.fn()
}))

// Global test utilities
global.testUtils = {
  createMockAgent: (agentId = 'test-agent', agentType = 'meta-agent') => ({
    agentId,
    agentType,
    permissions: ['claude-md:read', 'claude-md:propose-changes'],
    sessionToken: `test-session-${agentId}`,
    authenticated: true
  }),
  
  createMockClaudeContent: () => `# Test CLAUDE.md
## Sacred Principles
- NO SIMULATIONS
- NO FALLBACKS
- ALWAYS REAL
`,
  
  createMockDraft: (id = 'test-draft-1') => ({
    id,
    sessionId: 'test-session-1',
    agentId: 'test-agent',
    content: global.testUtils.createMockClaudeContent(),
    metadata: {
      title: 'Test Draft',
      description: 'Test draft for unit testing',
      lastModified: new Date().toISOString(),
      version: 1
    },
    checksum: 'test-checksum-' + id
  }),
  
  createMockCheckpoint: (id = 'test-checkpoint-1') => ({
    id,
    sessionId: 'test-session-1',
    agentId: 'test-agent',
    operation: 'CREATE_DRAFT',
    timestamp: new Date().toISOString(),
    data: {
      draftId: 'test-draft-1',
      content: global.testUtils.createMockClaudeContent()
    },
    rollbackData: null
  }),
  
  mockVercelKV: {
    // Helper to setup KV mocks for specific tests
    setupMockData: (data) => {
      const { kv } = require('@vercel/kv')
      kv.get.mockImplementation((key) => Promise.resolve(data[key] || null))
      kv.set.mockResolvedValue('OK')
      kv.exists.mockImplementation((key) => Promise.resolve(!!data[key]))
      kv.keys.mockImplementation((pattern) => {
        const keys = Object.keys(data).filter(key => 
          pattern === '*' || key.includes(pattern.replace('*', ''))
        )
        return Promise.resolve(keys)
      })
    },
    
    reset: () => {
      const { kv } = require('@vercel/kv')
      Object.keys(kv).forEach(method => {
        if (jest.isMockFunction(kv[method])) {
          kv[method].mockReset()
        }
      })
    }
  },
  
  mockFileSystem: {
    // Helper to setup filesystem mocks
    setupMockFiles: (files) => {
      const fs = require('fs/promises')
      fs.readFile.mockImplementation((path) => {
        const content = files[path]
        if (content === undefined) {
          return Promise.reject(new Error(`ENOENT: no such file or directory, open '${path}'`))
        }
        return Promise.resolve(content)
      })
      fs.access.mockImplementation((path) => {
        if (files[path] === undefined) {
          return Promise.reject(new Error(`ENOENT: no such file or directory, access '${path}'`))
        }
        return Promise.resolve()
      })
      fs.stat.mockImplementation((path) => {
        if (files[path] === undefined) {
          return Promise.reject(new Error(`ENOENT: no such file or directory, stat '${path}'`))
        }
        return Promise.resolve({
          size: files[path].length,
          mtime: new Date('2022-01-01T00:00:00.000Z'),
          ctime: new Date('2022-01-01T00:00:00.000Z')
        })
      })
    },
    
    reset: () => {
      const fs = require('fs/promises')
      Object.keys(fs).forEach(method => {
        if (jest.isMockFunction(fs[method])) {
          fs[method].mockReset()
        }
      })
    }
  }
}

// Reset all mocks before each test
beforeEach(() => {
  // Reset UUID counter
  uuidCounter = 0
  
  // Reset mocks
  global.testUtils.mockVercelKV.reset()
  global.testUtils.mockFileSystem.reset()
  
  // Clear all mocks
  jest.clearAllMocks()
})

// Cleanup after all tests
afterAll(() => {
  // Restore original functions
  crypto.randomUUID = originalRandomUUID
  Date.now = originalDateNow
})

// Configure console to reduce noise in tests unless there's an error
const originalError = console.error
const originalWarn = console.warn

console.error = (...args) => {
  // Only show errors that aren't test-related
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Warning:')) {
    return
  }
  originalError.call(console, ...args)
}

console.warn = (...args) => {
  // Only show warnings that aren't test-related
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Warning:')) {
    return
  }
  originalWarn.call(console, ...args)
}