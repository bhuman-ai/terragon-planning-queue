/**
 * Unit Tests for Atomic Checkpoints System
 * Tests atomic operations, checkpoints, transactions, and rollback capabilities
 */

import AtomicCheckpoints, { createCheckpoint } from '../../lib/security/atomic-checkpoints.js'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

// Mock the file system
jest.mock('fs/promises')

describe('AtomicCheckpoints', () => {
  let checkpoints
  const mockProjectRoot = '/test/project'
  
  beforeEach(() => {
    checkpoints = new AtomicCheckpoints(mockProjectRoot)
    
    // Mock process properties
    process.pid = 12345
    process.version = 'v18.0.0'
    process.uptime = jest.fn().mockReturnValue(3600)
    process.memoryUsage = jest.fn().mockReturnValue({
      rss: 100000000,
      heapTotal: 50000000,
      heapUsed: 30000000,
      external: 5000000
    })
  })

  describe('Initialization', () => {
    test('should initialize successfully with new directories', async () => {
      fs.mkdir.mockResolvedValue(undefined)
      fs.writeFile.mockResolvedValue(undefined)
      fs.access.mockRejectedValue(new Error('ENOENT'))

      const result = await checkpoints.initialize()

      expect(result.success).toBe(true)
      expect(result.message).toBe('Atomic checkpoint system initialized')
      
      // Verify directories were created
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(mockProjectRoot, '.security'),
        { recursive: true }
      )
      expect(fs.mkdir).toHaveBeenCalledWith(checkpoints.checkpointsDir, { recursive: true })
      expect(fs.mkdir).toHaveBeenCalledWith(checkpoints.lockDir, { recursive: true })
      expect(fs.mkdir).toHaveBeenCalledWith(checkpoints.transactionDir, { recursive: true })
      
      // Verify checkpoint log was created
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(checkpoints.checkpointsDir, 'checkpoint-log.json'),
        expect.stringContaining('"checkpoints":[]')
      )
    })

    test('should handle initialization errors', async () => {
      fs.mkdir.mockRejectedValue(new Error('Permission denied'))

      await expect(checkpoints.initialize()).rejects.toThrow(
        'Failed to initialize atomic checkpoints: Permission denied'
      )
    })

    test('should skip log creation if it already exists', async () => {
      const logPath = path.join(checkpoints.checkpointsDir, 'checkpoint-log.json')
      global.testUtils.mockFileSystem.setupMockFiles({
        [logPath]: '{"version":"1.0"}'
      })

      const result = await checkpoints.initialize()

      expect(result.success).toBe(true)
      
      // Should not overwrite existing log
      expect(fs.writeFile).not.toHaveBeenCalledWith(
        logPath,
        expect.any(String)
      )
    })
  })

  describe('Checkpoint Creation', () => {
    const testFilePaths = ['/test/file1.txt', '/test/file2.txt']
    const testContent1 = 'Content of file 1'
    const testContent2 = 'Content of file 2'

    beforeEach(() => {
      global.testUtils.mockFileSystem.setupMockFiles({
        [testFilePaths[0]]: testContent1,
        [testFilePaths[1]]: testContent2
      })
      
      jest.spyOn(checkpoints, 'updateCheckpointLog').mockResolvedValue(undefined)
      fs.writeFile.mockResolvedValue(undefined)
    })

    test('should create checkpoint with file backups', async () => {
      const description = 'Test checkpoint creation'

      const result = await checkpoints.createCheckpoint(description, testFilePaths)

      expect(result.success).toBe(true)
      expect(result.checkpointId).toMatch(/^test-uuid-\d+$/)
      expect(result.timestamp).toBeDefined()
      expect(result.filesBackedUp).toBe(2)

      // Verify checkpoint file was written
      const checkpointCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes('checkpoint-') && call[0].endsWith('.json')
      )
      expect(checkpointCall).toBeDefined()
      
      const checkpoint = JSON.parse(checkpointCall[1])
      expect(checkpoint.description).toBe(description)
      expect(checkpoint.state).toBe('CREATED')
      expect(checkpoint.filePaths).toHaveLength(2)
      expect(checkpoint.backups[path.resolve(testFilePaths[0])].content).toBe(testContent1)
      expect(checkpoint.backups[path.resolve(testFilePaths[1])].content).toBe(testContent2)
    })

    test('should include file metadata in backups', async () => {
      const result = await checkpoints.createCheckpoint('Test metadata', [testFilePaths[0]])

      const checkpointCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes('checkpoint-')
      )
      const checkpoint = JSON.parse(checkpointCall[1])
      
      const backup = checkpoint.backups[path.resolve(testFilePaths[0])]
      expect(backup.metadata).toBeDefined()
      expect(backup.metadata.size).toBe(testContent1.length)
      expect(backup.metadata.modified).toBeDefined()
      expect(backup.metadata.permissions).toBeDefined()
    })

    test('should handle non-existent files gracefully', async () => {
      const nonExistentFile = '/test/nonexistent.txt'
      fs.access.mockImplementation((filePath) => {
        if (filePath === nonExistentFile) {
          return Promise.reject(new Error('ENOENT'))
        }
        return Promise.resolve()
      })

      const result = await checkpoints.createCheckpoint(
        'Test with missing file',
        [testFilePaths[0], nonExistentFile]
      )

      expect(result.success).toBe(true)
      expect(result.filesBackedUp).toBe(1) // Only existing file backed up
    })

    test('should include process metadata', async () => {
      await checkpoints.createCheckpoint('Test metadata', [testFilePaths[0]])

      const checkpointCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes('checkpoint-')
      )
      const checkpoint = JSON.parse(checkpointCall[1])
      
      expect(checkpoint.metadata.creator).toBe('atomic-system')
      expect(checkpoint.metadata.process).toBe(12345)
      expect(checkpoint.metadata.node).toBe('v18.0.0')
    })

    test('should update checkpoint log', async () => {
      await checkpoints.createCheckpoint('Test log update', [testFilePaths[0]])

      expect(checkpoints.updateCheckpointLog).toHaveBeenCalledWith(
        'CREATE',
        expect.objectContaining({
          description: 'Test log update',
          state: 'CREATED'
        })
      )
    })

    test('should handle checkpoint creation errors', async () => {
      fs.readFile.mockRejectedValue(new Error('Permission denied'))

      await expect(
        checkpoints.createCheckpoint('Failed checkpoint', [testFilePaths[0]])
      ).rejects.toThrow('Failed to create checkpoint: Permission denied')
    })
  })

  describe('File Locking', () => {
    const testFilePath = '/test/lock-test.txt'

    beforeEach(() => {
      fs.writeFile.mockResolvedValue(undefined)
      fs.readFile.mockResolvedValue('{}')
    })

    test('should acquire single file lock successfully', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT')) // No existing lock

      const lockId = 'test-lock-123'
      const expiresAt = new Date(Date.now() + 30000).toISOString()

      await checkpoints.acquireFileLock(testFilePath, lockId, expiresAt)

      // Verify lock file was created
      const lockFile = path.join(checkpoints.lockDir, `file-${checkpoints.hashPath(testFilePath)}.lock`)
      expect(fs.writeFile).toHaveBeenCalledWith(
        lockFile,
        expect.stringContaining(lockId)
      )
    })

    test('should reject locking already locked file', async () => {
      const existingLock = {
        lockId: 'existing-lock',
        expiresAt: new Date(Date.now() + 30000).toISOString() // Not expired
      }

      global.testUtils.mockFileSystem.setupMockFiles({
        [`${checkpoints.lockDir}/file-${checkpoints.hashPath(testFilePath)}.lock`]: JSON.stringify(existingLock)
      })

      await expect(
        checkpoints.acquireFileLock(testFilePath, 'new-lock', new Date().toISOString())
      ).rejects.toThrow(`File ${testFilePath} is already locked by existing-lock`)
    })

    test('should acquire lock on expired lock', async () => {
      const expiredLock = {
        lockId: 'expired-lock',
        expiresAt: new Date(Date.now() - 30000).toISOString() // Expired
      }

      global.testUtils.mockFileSystem.setupMockFiles({
        [`${checkpoints.lockDir}/file-${checkpoints.hashPath(testFilePath)}.lock`]: JSON.stringify(expiredLock)
      })

      fs.unlink.mockResolvedValue(undefined)

      const lockId = 'new-lock'
      const expiresAt = new Date(Date.now() + 30000).toISOString()

      await checkpoints.acquireFileLock(testFilePath, lockId, expiresAt)

      // Should remove expired lock
      expect(fs.unlink).toHaveBeenCalled()
      
      // Should create new lock
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.lock'),
        expect.stringContaining(lockId)
      )
    })

    test('should acquire multiple file locks in sorted order', async () => {
      const filePaths = ['/test/c.txt', '/test/a.txt', '/test/b.txt']
      fs.access.mockRejectedValue(new Error('ENOENT')) // No existing locks

      const lockId = await checkpoints.acquireLocks(filePaths, 30000)

      expect(lockId).toMatch(/^test-uuid-\d+$/)
      
      // Should create lock info file
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(checkpoints.lockDir, `lock-${lockId}.json`),
        expect.stringContaining('ACTIVE')
      )
    })

    test('should release file locks successfully', async () => {
      const lockId = 'test-lock-release'
      const locks = {
        id: lockId,
        files: {
          '/test/file1.txt': { locked: true },
          '/test/file2.txt': { locked: true }
        },
        state: 'ACTIVE'
      }

      global.testUtils.mockFileSystem.setupMockFiles({
        [`${checkpoints.lockDir}/lock-${lockId}.json`]: JSON.stringify(locks)
      })

      jest.spyOn(checkpoints, 'releaseFileLock').mockResolvedValue(undefined)
      fs.writeFile.mockResolvedValue(undefined)

      const result = await checkpoints.releaseLocks(lockId)

      expect(result.success).toBe(true)
      expect(result.lockId).toBe(lockId)
      expect(checkpoints.releaseFileLock).toHaveBeenCalledTimes(2)
      
      // Should update lock state
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(checkpoints.lockDir, `lock-${lockId}.json`),
        expect.stringContaining('"state":"RELEASED"')
      )
    })

    test('should handle lock release errors gracefully', async () => {
      const lockId = 'test-lock-error'
      const locks = {
        id: lockId,
        files: { '/test/file1.txt': { locked: true } },
        state: 'ACTIVE'
      }

      global.testUtils.mockFileSystem.setupMockFiles({
        [`${checkpoints.lockDir}/lock-${lockId}.json`]: JSON.stringify(locks)
      })

      jest.spyOn(checkpoints, 'releaseFileLock').mockRejectedValue(new Error('Lock removal failed'))
      fs.writeFile.mockResolvedValue(undefined)

      // Should not throw despite individual lock release failure
      const result = await checkpoints.releaseLocks(lockId)
      expect(result.success).toBe(true)
    })
  })

  describe('Transaction Management', () => {
    const testCheckpointId = 'test-checkpoint-123'
    const testFilePaths = ['/test/file1.txt', '/test/file2.txt']

    beforeEach(() => {
      jest.spyOn(checkpoints, 'updateTransactionLog').mockResolvedValue(undefined)
      fs.writeFile.mockResolvedValue(undefined)
    })

    test('should start transaction successfully', async () => {
      const description = 'Test transaction'

      const transactionId = await checkpoints.startTransaction(
        description,
        testCheckpointId,
        testFilePaths
      )

      expect(transactionId).toMatch(/^test-uuid-\d+$/)
      
      // Verify transaction file was written
      const transactionCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes('transaction-') && call[0].endsWith('.json')
      )
      expect(transactionCall).toBeDefined()
      
      const transaction = JSON.parse(transactionCall[1])
      expect(transaction.description).toBe(description)
      expect(transaction.checkpointId).toBe(testCheckpointId)
      expect(transaction.state).toBe('ACTIVE')
      expect(transaction.filePaths).toEqual(testFilePaths.map(p => path.resolve(p)))
      expect(transaction.operations).toEqual([])
    })

    test('should log operations in transaction', async () => {
      const transactionId = 'test-transaction-123'
      const transaction = {
        id: transactionId,
        operations: []
      }

      global.testUtils.mockFileSystem.setupMockFiles({
        [`${checkpoints.transactionDir}/transaction-${transactionId}.json`]: JSON.stringify(transaction)
      })

      const operationId = await checkpoints.logOperation(
        transactionId,
        'WRITE',
        '/test/file.txt',
        'old content',
        'new content'
      )

      expect(operationId).toMatch(/^test-uuid-\d+$/)
      
      // Verify transaction was updated
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(checkpoints.transactionDir, `transaction-${transactionId}.json`),
        expect.stringContaining('"operation":"WRITE"')
      )
    })

    test('should truncate large content in operation logs', async () => {
      const transactionId = 'test-transaction-truncate'
      const transaction = { id: transactionId, operations: [] }

      global.testUtils.mockFileSystem.setupMockFiles({
        [`${checkpoints.transactionDir}/transaction-${transactionId}.json`]: JSON.stringify(transaction)
      })

      const largeContent = 'x'.repeat(2000) // 2000 characters
      
      await checkpoints.logOperation(
        transactionId,
        'WRITE',
        '/test/file.txt',
        largeContent,
        largeContent
      )

      const transactionCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes(`transaction-${transactionId}.json`)
      )
      const updatedTransaction = JSON.parse(transactionCall[1])
      const operation = updatedTransaction.operations[0]
      
      // Content should be truncated to 1000 characters
      expect(operation.oldContent).toHaveLength(1000)
      expect(operation.newContent).toHaveLength(1000)
      expect(operation.contentLength.old).toBe(2000)
      expect(operation.contentLength.new).toBe(2000)
    })

    test('should commit transaction successfully', async () => {
      const transactionId = 'test-transaction-commit'
      const transaction = {
        id: transactionId,
        state: 'ACTIVE'
      }

      global.testUtils.mockFileSystem.setupMockFiles({
        [`${checkpoints.transactionDir}/transaction-${transactionId}.json`]: JSON.stringify(transaction)
      })

      const result = await checkpoints.commitTransaction(transactionId)

      expect(result.success).toBe(true)
      expect(result.transactionId).toBe(transactionId)
      
      // Should update transaction state and call log
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(checkpoints.transactionDir, `transaction-${transactionId}.json`),
        expect.stringContaining('"state":"COMMITTED"')
      )
      expect(checkpoints.updateTransactionLog).toHaveBeenCalledWith(
        'COMMIT',
        expect.objectContaining({ id: transactionId })
      )
    })

    test('should rollback transaction with checkpoint', async () => {
      const transactionId = 'test-transaction-rollback'
      const checkpointId = 'test-checkpoint-rollback'
      const transaction = {
        id: transactionId,
        checkpointId,
        state: 'ACTIVE'
      }

      global.testUtils.mockFileSystem.setupMockFiles({
        [`${checkpoints.transactionDir}/transaction-${transactionId}.json`]: JSON.stringify(transaction)
      })

      jest.spyOn(checkpoints, 'rollbackToCheckpoint').mockResolvedValue({ success: true })

      const result = await checkpoints.rollbackTransaction(transactionId)

      expect(result.success).toBe(true)
      expect(result.transactionId).toBe(transactionId)
      expect(checkpoints.rollbackToCheckpoint).toHaveBeenCalledWith(checkpointId)
      
      // Should update transaction state
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(checkpoints.transactionDir, `transaction-${transactionId}.json`),
        expect.stringContaining('"state":"ROLLED_BACK"')
      )
    })
  })

  describe('Checkpoint Rollback', () => {
    const checkpointId = 'test-checkpoint-rollback'
    const testFile1 = '/test/rollback1.txt'
    const testFile2 = '/test/rollback2.txt'
    const originalContent1 = 'Original content 1'
    const originalContent2 = 'Original content 2'

    beforeEach(() => {
      const checkpoint = {
        id: checkpointId,
        state: 'CREATED',
        backups: {
          [testFile1]: {
            content: originalContent1,
            metadata: {
              permissions: 0o644,
              modified: '2022-01-01T00:00:00.000Z'
            }
          },
          [testFile2]: {
            content: originalContent2,
            metadata: {
              permissions: 0o644,
              modified: '2022-01-01T00:00:00.000Z'
            }
          }
        }
      }

      global.testUtils.mockFileSystem.setupMockFiles({
        [`${checkpoints.checkpointsDir}/checkpoint-${checkpointId}.json`]: JSON.stringify(checkpoint)
      })

      jest.spyOn(checkpoints, 'updateCheckpointLog').mockResolvedValue(undefined)
      fs.writeFile.mockResolvedValue(undefined)
      fs.chmod.mockResolvedValue(undefined)
      fs.utimes.mockResolvedValue(undefined)
    })

    test('should restore files from checkpoint', async () => {
      const result = await checkpoints.rollbackToCheckpoint(checkpointId)

      expect(result.success).toBe(true)
      expect(result.checkpointId).toBe(checkpointId)
      expect(result.filesRestored).toBe(2)

      // Should restore file contents
      expect(fs.writeFile).toHaveBeenCalledWith(testFile1, originalContent1)
      expect(fs.writeFile).toHaveBeenCalledWith(testFile2, originalContent2)

      // Should restore file metadata
      expect(fs.chmod).toHaveBeenCalledWith(testFile1, 0o644)
      expect(fs.chmod).toHaveBeenCalledWith(testFile2, 0o644)
      expect(fs.utimes).toHaveBeenCalledTimes(2)
    })

    test('should update checkpoint state after rollback', async () => {
      await checkpoints.rollbackToCheckpoint(checkpointId)

      // Should update checkpoint state
      const checkpointUpdateCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes(`checkpoint-${checkpointId}.json`)
      )
      expect(checkpointUpdateCall).toBeDefined()
      
      const updatedCheckpoint = JSON.parse(checkpointUpdateCall[1])
      expect(updatedCheckpoint.state).toBe('ROLLED_BACK')
      expect(updatedCheckpoint.rolledBackAt).toBeDefined()

      // Should update checkpoint log
      expect(checkpoints.updateCheckpointLog).toHaveBeenCalledWith(
        'ROLLBACK',
        expect.objectContaining({ id: checkpointId })
      )
    })

    test('should handle metadata restoration errors gracefully', async () => {
      fs.chmod.mockRejectedValue(new Error('Chmod failed'))
      fs.utimes.mockRejectedValue(new Error('Utimes failed'))

      // Should not throw despite metadata errors
      const result = await checkpoints.rollbackToCheckpoint(checkpointId)
      expect(result.success).toBe(true)
    })

    test('should mark checkpoint as successful', async () => {
      const result = await checkpoints.markCheckpointSuccessful(checkpointId)

      expect(result.success).toBe(true)
      expect(result.checkpointId).toBe(checkpointId)

      // Should update checkpoint state
      const checkpointUpdateCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes(`checkpoint-${checkpointId}.json`)
      )
      const updatedCheckpoint = JSON.parse(checkpointUpdateCall[1])
      expect(updatedCheckpoint.state).toBe('SUCCESSFUL')
      expect(updatedCheckpoint.completedAt).toBeDefined()
    })
  })

  describe('Atomic Operation Execution', () => {
    const testFilePaths = ['/test/atomic1.txt', '/test/atomic2.txt']
    let mockOperation

    beforeEach(() => {
      mockOperation = jest.fn().mockResolvedValue({ success: true, data: 'operation result' })
      
      // Mock all the atomic operation steps
      jest.spyOn(checkpoints, 'acquireLocks').mockResolvedValue('test-lock-id')
      jest.spyOn(checkpoints, 'createCheckpoint').mockResolvedValue({ 
        checkpointId: 'test-checkpoint-id' 
      })
      jest.spyOn(checkpoints, 'startTransaction').mockResolvedValue('test-transaction-id')
      jest.spyOn(checkpoints, 'commitTransaction').mockResolvedValue({ success: true })
      jest.spyOn(checkpoints, 'markCheckpointSuccessful').mockResolvedValue({ success: true })
      jest.spyOn(checkpoints, 'releaseLocks').mockResolvedValue({ success: true })
    })

    test('should execute atomic operation successfully', async () => {
      const result = await checkpoints.executeAtomic(mockOperation, {
        description: 'Test atomic operation',
        filePaths: testFilePaths
      })

      expect(result.success).toBe(true)
      expect(result.result).toEqual({ success: true, data: 'operation result' })
      expect(result.checkpointId).toBe('test-checkpoint-id')
      expect(result.transactionId).toBe('test-transaction-id')
      expect(result.attempt).toBe(1)

      // Verify all steps were called in order
      expect(checkpoints.acquireLocks).toHaveBeenCalledWith(testFilePaths, checkpoints.lockTimeout)
      expect(checkpoints.createCheckpoint).toHaveBeenCalled()
      expect(checkpoints.startTransaction).toHaveBeenCalled()
      expect(mockOperation).toHaveBeenCalled()
      expect(checkpoints.commitTransaction).toHaveBeenCalled()
      expect(checkpoints.markCheckpointSuccessful).toHaveBeenCalled()
      expect(checkpoints.releaseLocks).toHaveBeenCalled()
    })

    test('should retry on failure with exponential backoff', async () => {
      mockOperation
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce({ success: true, data: 'third attempt success' })

      // Mock rollback functions
      jest.spyOn(checkpoints, 'rollbackTransaction').mockResolvedValue({ success: true })
      jest.spyOn(checkpoints, 'rollbackToCheckpoint').mockResolvedValue({ success: true })
      jest.spyOn(checkpoints, 'sleep').mockResolvedValue(undefined)

      const result = await checkpoints.executeAtomic(mockOperation, {
        description: 'Test retry',
        filePaths: testFilePaths,
        retries: 3
      })

      expect(result.success).toBe(true)
      expect(result.attempt).toBe(3)
      expect(mockOperation).toHaveBeenCalledTimes(3)
      
      // Should have performed rollbacks on failures
      expect(checkpoints.rollbackTransaction).toHaveBeenCalledTimes(2)
      expect(checkpoints.rollbackToCheckpoint).toHaveBeenCalledTimes(2)
      
      // Should have used exponential backoff
      expect(checkpoints.sleep).toHaveBeenCalledWith(2000) // 2^1 * 1000
      expect(checkpoints.sleep).toHaveBeenCalledWith(4000) // 2^2 * 1000
    })

    test('should fail after exhausting retries', async () => {
      const error = new Error('Persistent failure')
      mockOperation.mockRejectedValue(error)

      jest.spyOn(checkpoints, 'rollbackTransaction').mockResolvedValue({ success: true })
      jest.spyOn(checkpoints, 'rollbackToCheckpoint').mockResolvedValue({ success: true })
      jest.spyOn(checkpoints, 'sleep').mockResolvedValue(undefined)

      await expect(
        checkpoints.executeAtomic(mockOperation, {
          description: 'Test failure',
          filePaths: testFilePaths,
          retries: 2
        })
      ).rejects.toThrow('Atomic operation failed after 2 attempts: Persistent failure')

      expect(mockOperation).toHaveBeenCalledTimes(2)
    })

    test('should handle rollback errors gracefully', async () => {
      mockOperation.mockRejectedValue(new Error('Operation failed'))
      jest.spyOn(checkpoints, 'rollbackTransaction').mockRejectedValue(new Error('Rollback failed'))
      jest.spyOn(checkpoints, 'rollbackToCheckpoint').mockRejectedValue(new Error('Checkpoint rollback failed'))

      // Should not throw rollback errors
      await expect(
        checkpoints.executeAtomic(mockOperation, {
          description: 'Test rollback errors',
          filePaths: testFilePaths,
          retries: 1
        })
      ).rejects.toThrow('Atomic operation failed after 1 attempts: Operation failed')
    })
  })

  describe('System Status and Monitoring', () => {
    beforeEach(() => {
      const mockLog = {
        version: '1.0',
        checkpoints: [
          { action: 'CREATE', checkpointId: 'cp1' },
          { action: 'SUCCESS', checkpointId: 'cp1' }
        ],
        transactions: [
          { action: 'START', transactionId: 'tx1' },
          { action: 'COMMIT', transactionId: 'tx1' }
        ],
        lastCheckpointId: 1,
        lastTransactionId: 1
      }

      global.testUtils.mockFileSystem.setupMockFiles({
        [`${checkpoints.checkpointsDir}/checkpoint-log.json`]: JSON.stringify(mockLog)
      })

      jest.spyOn(checkpoints, 'getActiveLocks').mockResolvedValue([
        { id: 'lock1', state: 'ACTIVE' }
      ])
      jest.spyOn(checkpoints, 'getActiveTransactions').mockResolvedValue([
        { id: 'tx1', state: 'ACTIVE' }
      ])
    })

    test('should return comprehensive system status', async () => {
      const status = await checkpoints.getStatus()

      expect(status.timestamp).toBeDefined()
      expect(status.checkpoints.total).toBe(2)
      expect(status.checkpoints.lastId).toBe(1)
      expect(status.transactions.total).toBe(2)
      expect(status.transactions.lastId).toBe(1)
      expect(status.transactions.active).toBe(1)
      expect(status.locks.active).toBe(1)
      expect(status.system.pid).toBe(12345)
      expect(status.system.uptime).toBe(3600)
      expect(status.system.memory).toBeDefined()
    })

    test('should handle status errors gracefully', async () => {
      fs.readFile.mockRejectedValue(new Error('Log file not found'))

      const status = await checkpoints.getStatus()

      expect(status.error).toBe('Log file not found')
      expect(status.timestamp).toBeDefined()
    })

    test('should identify active locks', async () => {
      const activeLock = {
        id: 'active-lock',
        state: 'ACTIVE',
        expiresAt: new Date(Date.now() + 30000).toISOString()
      }
      const expiredLock = {
        id: 'expired-lock',
        state: 'ACTIVE',
        expiresAt: new Date(Date.now() - 30000).toISOString()
      }
      const releasedLock = {
        id: 'released-lock',
        state: 'RELEASED',
        expiresAt: new Date(Date.now() + 30000).toISOString()
      }

      fs.readdir.mockResolvedValue(['lock-1.json', 'lock-2.json', 'lock-3.json', 'other-file.txt'])
      
      global.testUtils.mockFileSystem.setupMockFiles({
        [`${checkpoints.lockDir}/lock-1.json`]: JSON.stringify(activeLock),
        [`${checkpoints.lockDir}/lock-2.json`]: JSON.stringify(expiredLock),
        [`${checkpoints.lockDir}/lock-3.json`]: JSON.stringify(releasedLock)
      })

      // Reset the mock to call the actual implementation
      checkpoints.getActiveLocks.mockRestore()
      
      const activeLocks = await checkpoints.getActiveLocks()

      expect(activeLocks).toHaveLength(1)
      expect(activeLocks[0].id).toBe('active-lock')
    })

    test('should identify active transactions', async () => {
      const activeTransaction = { id: 'tx1', state: 'ACTIVE' }
      const committedTransaction = { id: 'tx2', state: 'COMMITTED' }

      fs.readdir.mockResolvedValue(['transaction-1.json', 'transaction-2.json'])
      
      global.testUtils.mockFileSystem.setupMockFiles({
        [`${checkpoints.transactionDir}/transaction-1.json`]: JSON.stringify(activeTransaction),
        [`${checkpoints.transactionDir}/transaction-2.json`]: JSON.stringify(committedTransaction)
      })

      // Reset the mock to call the actual implementation
      checkpoints.getActiveTransactions.mockRestore()
      
      const activeTransactions = await checkpoints.getActiveTransactions()

      expect(activeTransactions).toHaveLength(1)
      expect(activeTransactions[0].id).toBe('tx1')
    })
  })

  describe('Cleanup Operations', () => {
    beforeEach(() => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days old
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day old

      fs.readdir.mockImplementation((dir) => {
        if (dir === checkpoints.checkpointsDir) {
          return Promise.resolve(['checkpoint-old.json', 'checkpoint-recent.json', 'checkpoint-log.json'])
        }
        if (dir === checkpoints.transactionDir) {
          return Promise.resolve(['transaction-old.json', 'transaction-recent.json'])
        }
        if (dir === checkpoints.lockDir) {
          return Promise.resolve(['expired.lock', 'active.lock'])
        }
        return Promise.resolve([])
      })

      global.testUtils.mockFileSystem.setupMockFiles({
        [`${checkpoints.checkpointsDir}/checkpoint-old.json`]: JSON.stringify({
          timestamp: oldDate.toISOString(),
          state: 'SUCCESSFUL'
        }),
        [`${checkpoints.checkpointsDir}/checkpoint-recent.json`]: JSON.stringify({
          timestamp: recentDate.toISOString(),
          state: 'SUCCESSFUL'
        }),
        [`${checkpoints.transactionDir}/transaction-old.json`]: JSON.stringify({
          timestamp: oldDate.toISOString(),
          state: 'COMMITTED'
        }),
        [`${checkpoints.transactionDir}/transaction-recent.json`]: JSON.stringify({
          timestamp: recentDate.toISOString(),
          state: 'COMMITTED'
        }),
        [`${checkpoints.lockDir}/expired.lock`]: JSON.stringify({
          expiresAt: new Date(Date.now() - 3600000).toISOString()
        }),
        [`${checkpoints.lockDir}/active.lock`]: JSON.stringify({
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        })
      })

      fs.unlink.mockResolvedValue(undefined)
    })

    test('should clean up old checkpoints and transactions', async () => {
      const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
      
      const result = await checkpoints.cleanup(maxAge)

      expect(result.success).toBe(true)
      expect(result.cleanedCheckpoints).toBe(1)
      expect(result.cleanedTransactions).toBe(1)
      expect(result.maxAge).toBe(maxAge)

      // Should remove old files
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(checkpoints.checkpointsDir, 'checkpoint-old.json')
      )
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(checkpoints.transactionDir, 'transaction-old.json')
      )
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(checkpoints.lockDir, 'expired.lock')
      )

      // Should not remove recent files or active locks
      expect(fs.unlink).not.toHaveBeenCalledWith(
        path.join(checkpoints.checkpointsDir, 'checkpoint-recent.json')
      )
      expect(fs.unlink).not.toHaveBeenCalledWith(
        path.join(checkpoints.lockDir, 'active.lock')
      )
    })

    test('should not clean active checkpoints or transactions', async () => {
      // Set up active items
      global.testUtils.mockFileSystem.setupMockFiles({
        [`${checkpoints.checkpointsDir}/checkpoint-active.json`]: JSON.stringify({
          timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          state: 'ACTIVE' // Active state
        }),
        [`${checkpoints.transactionDir}/transaction-active.json`]: JSON.stringify({
          timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          state: 'ACTIVE' // Active state
        })
      })

      fs.readdir.mockImplementation((dir) => {
        if (dir === checkpoints.checkpointsDir) {
          return Promise.resolve(['checkpoint-active.json'])
        }
        if (dir === checkpoints.transactionDir) {
          return Promise.resolve(['transaction-active.json'])
        }
        return Promise.resolve([])
      })

      const result = await checkpoints.cleanup(7 * 24 * 60 * 60 * 1000)

      expect(result.cleanedCheckpoints).toBe(0)
      expect(result.cleanedTransactions).toBe(0)
    })

    test('should handle cleanup errors', async () => {
      fs.readdir.mockRejectedValue(new Error('Directory access denied'))

      await expect(checkpoints.cleanup()).rejects.toThrow('Cleanup failed: Directory access denied')
    })
  })

  describe('Utility Functions', () => {
    test('should hash file paths consistently', () => {
      const filePath1 = '/test/file.txt'
      const filePath2 = '/test/file.txt'
      const filePath3 = '/test/other.txt'

      const hash1 = checkpoints.hashPath(filePath1)
      const hash2 = checkpoints.hashPath(filePath2)
      const hash3 = checkpoints.hashPath(filePath3)

      expect(hash1).toBe(hash2) // Same path should produce same hash
      expect(hash1).not.toBe(hash3) // Different paths should produce different hashes
      expect(hash1).toHaveLength(16) // Should be truncated to 16 characters
      expect(hash1).toMatch(/^[a-f0-9]{16}$/) // Should be hex
    })

    test('should provide sleep utility', async () => {
      const start = Date.now()
      await checkpoints.sleep(100)
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(100)
      expect(elapsed).toBeLessThan(150) // Some tolerance for test timing
    })

    test('should check file existence', async () => {
      fs.access.mockResolvedValue(undefined)
      const exists = await checkpoints.fileExists('/test/existing-file.txt')
      expect(exists).toBe(true)

      fs.access.mockRejectedValue(new Error('ENOENT'))
      const notExists = await checkpoints.fileExists('/test/nonexistent-file.txt')
      expect(notExists).toBe(false)
    })
  })

  describe('Log Management', () => {
    const mockLog = {
      version: '1.0',
      checkpoints: [],
      transactions: [],
      lastCheckpointId: 0,
      lastTransactionId: 0
    }

    beforeEach(() => {
      global.testUtils.mockFileSystem.setupMockFiles({
        [`${checkpoints.checkpointsDir}/checkpoint-log.json`]: JSON.stringify(mockLog)
      })
      fs.writeFile.mockResolvedValue(undefined)
    })

    test('should update checkpoint log correctly', async () => {
      const checkpoint = {
        id: 'test-checkpoint',
        description: 'Test checkpoint',
        state: 'CREATED'
      }

      await checkpoints.updateCheckpointLog('CREATE', checkpoint)

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(checkpoints.checkpointsDir, 'checkpoint-log.json'),
        expect.stringContaining('"action":"CREATE"')
      )

      const logCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes('checkpoint-log.json')
      )
      const updatedLog = JSON.parse(logCall[1])
      
      expect(updatedLog.checkpoints).toHaveLength(1)
      expect(updatedLog.checkpoints[0].action).toBe('CREATE')
      expect(updatedLog.checkpoints[0].checkpointId).toBe('test-checkpoint')
      expect(updatedLog.lastCheckpointId).toBe(1)
    })

    test('should update transaction log correctly', async () => {
      const transaction = {
        id: 'test-transaction',
        description: 'Test transaction',
        state: 'ACTIVE'
      }

      await checkpoints.updateTransactionLog('START', transaction)

      const logCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes('checkpoint-log.json')
      )
      const updatedLog = JSON.parse(logCall[1])
      
      expect(updatedLog.transactions).toHaveLength(1)
      expect(updatedLog.transactions[0].action).toBe('START')
      expect(updatedLog.transactions[0].transactionId).toBe('test-transaction')
      expect(updatedLog.lastTransactionId).toBe(1)
    })

    test('should handle log update errors gracefully', async () => {
      fs.readFile.mockRejectedValue(new Error('Log file corrupted'))

      // Should not throw
      await checkpoints.updateCheckpointLog('CREATE', { id: 'test', state: 'CREATED' })
    })
  })
})

describe('createCheckpoint Utility Function', () => {
  test('should create simple checkpoint', async () => {
    const data = { test: 'data' }
    const checkpoint = await createCheckpoint(data)

    expect(checkpoint.id).toMatch(/^checkpoint_\d+_[a-z0-9]{6}$/)
    expect(checkpoint.timestamp).toBeDefined()
    expect(checkpoint.data).toEqual(data)
    expect(checkpoint.status).toBe('created')
  })

  test('should include current timestamp', async () => {
    const checkpoint = await createCheckpoint({})
    const timestamp = new Date(checkpoint.timestamp)
    const now = new Date()

    expect(Math.abs(now - timestamp)).toBeLessThan(1000) // Within 1 second
  })
})