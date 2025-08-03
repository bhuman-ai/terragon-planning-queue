/**
 * Atomic Checkpoint System
 * Implements atomic operations and checkpoints to prevent race conditions
 * 
 * This system ensures that sacred document modifications are atomic
 * and provides rollback capabilities for failed operations
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

class AtomicCheckpoints {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.checkpointsDir = path.join(projectRoot, '.security', 'checkpoints');
    this.lockDir = path.join(projectRoot, '.security', 'locks');
    this.transactionDir = path.join(projectRoot, '.security', 'transactions');
    this.lockTimeout = 30000; // 30 seconds
    this.maxRetries = 3;
  }

  /**
   * Initialize the atomic checkpoint system
   */
  async initialize() {
    try {
      await fs.mkdir(path.join(this.projectRoot, '.security'), { recursive: true });
      await fs.mkdir(this.checkpointsDir, { recursive: true });
      await fs.mkdir(this.lockDir, { recursive: true });
      await fs.mkdir(this.transactionDir, { recursive: true });

      // Initialize checkpoint log
      const logPath = path.join(this.checkpointsDir, 'checkpoint-log.json');
      if (!await this.fileExists(logPath)) {
        await fs.writeFile(logPath, JSON.stringify({
          version: '1.0',
          checkpoints: [],
          transactions: [],
          lastCheckpointId: 0,
          lastTransactionId: 0
        }, null, 2));
      }

      return { success: true, message: 'Atomic checkpoint system initialized' };
    } catch (error) {
      throw new Error(`Failed to initialize atomic checkpoints: ${error.message}`);
    }
  }

  /**
   * Create checkpoint before atomic operation
   */
  async createCheckpoint(description, filePaths = []) {
    try {
      const checkpointId = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      
      const checkpoint = {
        id: checkpointId,
        description,
        timestamp,
        filePaths: [],
        backups: {},
        state: 'CREATED',
        metadata: {
          creator: 'atomic-system',
          process: process.pid,
          node: process.version
        }
      };

      // Create backups of all specified files
      for (const filePath of filePaths) {
        if (await this.fileExists(filePath)) {
          const absolutePath = path.resolve(filePath);
          const content = await fs.readFile(absolutePath, 'utf-8');
          const stat = await fs.stat(absolutePath);
          
          const backup = {
            content,
            metadata: {
              size: stat.size,
              modified: stat.mtime.toISOString(),
              permissions: stat.mode
            }
          };

          checkpoint.filePaths.push(absolutePath);
          checkpoint.backups[absolutePath] = backup;
        }
      }

      // Store checkpoint
      const checkpointPath = path.join(this.checkpointsDir, `checkpoint-${checkpointId}.json`);
      await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));

      // Update checkpoint log
      await this.updateCheckpointLog('CREATE', checkpoint);

      return {
        success: true,
        checkpointId,
        timestamp,
        filesBackedUp: checkpoint.filePaths.length
      };
    } catch (error) {
      throw new Error(`Failed to create checkpoint: ${error.message}`);
    }
  }

  /**
   * Execute atomic operation with checkpoint protection
   */
  async executeAtomic(operation, options = {}) {
    const {
      description = 'Atomic operation',
      filePaths = [],
      timeout = this.lockTimeout,
      retries = this.maxRetries
    } = options;

    let attempt = 0;
    let lastError = null;

    while (attempt < retries) {
      attempt++;
      
      let lockId = null;
      let checkpointId = null;
      let transactionId = null;

      try {
        // 1. Acquire locks for all files
        lockId = await this.acquireLocks(filePaths, timeout);
        
        // 2. Create checkpoint
        const checkpoint = await this.createCheckpoint(description, filePaths);
        checkpointId = checkpoint.checkpointId;

        // 3. Start transaction
        transactionId = await this.startTransaction(description, checkpointId, filePaths);

        // 4. Execute operation
        const result = await operation();

        // 5. Commit transaction
        await this.commitTransaction(transactionId);

        // 6. Mark checkpoint as successful
        await this.markCheckpointSuccessful(checkpointId);

        // 7. Release locks
        await this.releaseLocks(lockId);

        return {
          success: true,
          result,
          checkpointId,
          transactionId,
          attempt
        };

      } catch (error) {
        lastError = error;
        
        // Rollback on failure
        try {
          if (transactionId) {
            await this.rollbackTransaction(transactionId);
          }
          
          if (checkpointId) {
            await this.rollbackToCheckpoint(checkpointId);
          }
          
          if (lockId) {
            await this.releaseLocks(lockId);
          }
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
        }

        // If this was the last attempt, throw the error
        if (attempt >= retries) {
          break;
        }

        // Wait before retry (exponential backoff)
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }

    throw new Error(`Atomic operation failed after ${retries} attempts: ${lastError.message}`);
  }

  /**
   * Acquire locks for multiple files
   */
  async acquireLocks(filePaths, timeout = this.lockTimeout) {
    const lockId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const expiresAt = new Date(Date.now() + timeout).toISOString();
    
    const locks = {
      id: lockId,
      timestamp,
      expiresAt,
      files: {},
      state: 'ACTIVE'
    };

    // Sort file paths to prevent deadlocks
    const sortedPaths = filePaths.map(p => path.resolve(p)).sort();

    try {
      for (const filePath of sortedPaths) {
        await this.acquireFileLock(filePath, lockId, expiresAt);
        locks.files[filePath] = {
          locked: true,
          timestamp
        };
      }

      // Store lock information
      const lockPath = path.join(this.lockDir, `lock-${lockId}.json`);
      await fs.writeFile(lockPath, JSON.stringify(locks, null, 2));

      return lockId;
    } catch (error) {
      // Release any locks we did acquire
      for (const filePath of Object.keys(locks.files)) {
        try {
          await this.releaseFileLock(filePath);
        } catch (releaseError) {
          console.error(`Failed to release lock for ${filePath}:`, releaseError);
        }
      }
      
      throw new Error(`Failed to acquire locks: ${error.message}`);
    }
  }

  /**
   * Acquire lock for single file
   */
  async acquireFileLock(filePath, lockId, expiresAt) {
    const lockFile = path.join(this.lockDir, `file-${this.hashPath(filePath)}.lock`);
    
    // Check if file is already locked
    if (await this.fileExists(lockFile)) {
      const existingLock = JSON.parse(await fs.readFile(lockFile, 'utf-8'));
      
      // Check if lock has expired
      if (new Date() < new Date(existingLock.expiresAt)) {
        throw new Error(`File ${filePath} is already locked by ${existingLock.lockId}`);
      }
      
      // Remove expired lock
      await fs.unlink(lockFile);
    }

    // Create new lock
    const lock = {
      lockId,
      filePath: path.resolve(filePath),
      timestamp: new Date().toISOString(),
      expiresAt,
      process: process.pid
    };

    await fs.writeFile(lockFile, JSON.stringify(lock, null, 2));
  }

  /**
   * Release locks
   */
  async releaseLocks(lockId) {
    try {
      const lockPath = path.join(this.lockDir, `lock-${lockId}.json`);
      const locks = JSON.parse(await fs.readFile(lockPath, 'utf-8'));
      
      // Release all file locks
      for (const filePath of Object.keys(locks.files)) {
        try {
          await this.releaseFileLock(filePath);
        } catch (error) {
          console.error(`Failed to release lock for ${filePath}:`, error);
        }
      }

      // Mark lock as released
      locks.state = 'RELEASED';
      locks.releasedAt = new Date().toISOString();
      await fs.writeFile(lockPath, JSON.stringify(locks, null, 2));

      return { success: true, lockId };
    } catch (error) {
      throw new Error(`Failed to release locks: ${error.message}`);
    }
  }

  /**
   * Release single file lock
   */
  async releaseFileLock(filePath) {
    const lockFile = path.join(this.lockDir, `file-${this.hashPath(filePath)}.lock`);
    
    if (await this.fileExists(lockFile)) {
      await fs.unlink(lockFile);
    }
  }

  /**
   * Start transaction
   */
  async startTransaction(description, checkpointId, filePaths) {
    const transactionId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    const transaction = {
      id: transactionId,
      description,
      checkpointId,
      timestamp,
      filePaths: filePaths.map(p => path.resolve(p)),
      state: 'ACTIVE',
      operations: [],
      metadata: {
        process: process.pid,
        node: process.version
      }
    };

    const transactionPath = path.join(this.transactionDir, `transaction-${transactionId}.json`);
    await fs.writeFile(transactionPath, JSON.stringify(transaction, null, 2));

    // Update transaction log
    await this.updateTransactionLog('START', transaction);

    return transactionId;
  }

  /**
   * Log operation in transaction
   */
  async logOperation(transactionId, operation, filePath, oldContent, newContent) {
    try {
      const transactionPath = path.join(this.transactionDir, `transaction-${transactionId}.json`);
      const transaction = JSON.parse(await fs.readFile(transactionPath, 'utf-8'));
      
      const operationLog = {
        id: crypto.randomUUID(),
        operation,
        filePath: path.resolve(filePath),
        timestamp: new Date().toISOString(),
        oldContent: oldContent ? oldContent.substring(0, 1000) : null, // Truncate for storage
        newContent: newContent ? newContent.substring(0, 1000) : null,
        contentLength: {
          old: oldContent ? oldContent.length : 0,
          new: newContent ? newContent.length : 0
        }
      };

      transaction.operations.push(operationLog);
      await fs.writeFile(transactionPath, JSON.stringify(transaction, null, 2));

      return operationLog.id;
    } catch (error) {
      console.error('Failed to log operation:', error);
    }
  }

  /**
   * Commit transaction
   */
  async commitTransaction(transactionId) {
    try {
      const transactionPath = path.join(this.transactionDir, `transaction-${transactionId}.json`);
      const transaction = JSON.parse(await fs.readFile(transactionPath, 'utf-8'));
      
      transaction.state = 'COMMITTED';
      transaction.committedAt = new Date().toISOString();
      
      await fs.writeFile(transactionPath, JSON.stringify(transaction, null, 2));
      await this.updateTransactionLog('COMMIT', transaction);

      return { success: true, transactionId };
    } catch (error) {
      throw new Error(`Failed to commit transaction: ${error.message}`);
    }
  }

  /**
   * Rollback transaction
   */
  async rollbackTransaction(transactionId) {
    try {
      const transactionPath = path.join(this.transactionDir, `transaction-${transactionId}.json`);
      const transaction = JSON.parse(await fs.readFile(transactionPath, 'utf-8'));
      
      // Rollback to checkpoint
      if (transaction.checkpointId) {
        await this.rollbackToCheckpoint(transaction.checkpointId);
      }

      transaction.state = 'ROLLED_BACK';
      transaction.rolledBackAt = new Date().toISOString();
      
      await fs.writeFile(transactionPath, JSON.stringify(transaction, null, 2));
      await this.updateTransactionLog('ROLLBACK', transaction);

      return { success: true, transactionId };
    } catch (error) {
      throw new Error(`Failed to rollback transaction: ${error.message}`);
    }
  }

  /**
   * Rollback to checkpoint
   */
  async rollbackToCheckpoint(checkpointId) {
    try {
      const checkpointPath = path.join(this.checkpointsDir, `checkpoint-${checkpointId}.json`);
      const checkpoint = JSON.parse(await fs.readFile(checkpointPath, 'utf-8'));
      
      // Restore all backed up files
      for (const [filePath, backup] of Object.entries(checkpoint.backups)) {
        await fs.writeFile(filePath, backup.content);
        
        // Restore file metadata if possible
        try {
          await fs.chmod(filePath, backup.metadata.permissions);
          await fs.utimes(filePath, new Date(), new Date(backup.metadata.modified));
        } catch (metaError) {
          console.warn(`Could not restore metadata for ${filePath}:`, metaError);
        }
      }

      // Mark checkpoint as used for rollback
      checkpoint.state = 'ROLLED_BACK';
      checkpoint.rolledBackAt = new Date().toISOString();
      await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));

      await this.updateCheckpointLog('ROLLBACK', checkpoint);

      return {
        success: true,
        checkpointId,
        filesRestored: Object.keys(checkpoint.backups).length
      };
    } catch (error) {
      throw new Error(`Failed to rollback to checkpoint: ${error.message}`);
    }
  }

  /**
   * Mark checkpoint as successful
   */
  async markCheckpointSuccessful(checkpointId) {
    try {
      const checkpointPath = path.join(this.checkpointsDir, `checkpoint-${checkpointId}.json`);
      const checkpoint = JSON.parse(await fs.readFile(checkpointPath, 'utf-8'));
      
      checkpoint.state = 'SUCCESSFUL';
      checkpoint.completedAt = new Date().toISOString();
      
      await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
      await this.updateCheckpointLog('SUCCESS', checkpoint);

      return { success: true, checkpointId };
    } catch (error) {
      throw new Error(`Failed to mark checkpoint successful: ${error.message}`);
    }
  }

  /**
   * Update checkpoint log
   */
  async updateCheckpointLog(action, checkpoint) {
    try {
      const logPath = path.join(this.checkpointsDir, 'checkpoint-log.json');
      const log = JSON.parse(await fs.readFile(logPath, 'utf-8'));
      
      log.checkpoints.push({
        action,
        checkpointId: checkpoint.id,
        timestamp: new Date().toISOString(),
        description: checkpoint.description,
        state: checkpoint.state
      });

      if (action === 'CREATE') {
        log.lastCheckpointId++;
      }

      await fs.writeFile(logPath, JSON.stringify(log, null, 2));
    } catch (error) {
      console.error('Failed to update checkpoint log:', error);
    }
  }

  /**
   * Update transaction log
   */
  async updateTransactionLog(action, transaction) {
    try {
      const logPath = path.join(this.checkpointsDir, 'checkpoint-log.json');
      const log = JSON.parse(await fs.readFile(logPath, 'utf-8'));
      
      log.transactions.push({
        action,
        transactionId: transaction.id,
        timestamp: new Date().toISOString(),
        description: transaction.description,
        state: transaction.state
      });

      if (action === 'START') {
        log.lastTransactionId++;
      }

      await fs.writeFile(logPath, JSON.stringify(log, null, 2));
    } catch (error) {
      console.error('Failed to update transaction log:', error);
    }
  }

  /**
   * Clean up old checkpoints and transactions
   */
  async cleanup(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days
    try {
      const cutoff = new Date(Date.now() - maxAge);
      let cleanedCheckpoints = 0;
      let cleanedTransactions = 0;

      // Clean checkpoints
      const checkpointFiles = await fs.readdir(this.checkpointsDir);
      for (const file of checkpointFiles) {
        if (file.startsWith('checkpoint-') && file.endsWith('.json')) {
          const filePath = path.join(this.checkpointsDir, file);
          const checkpoint = JSON.parse(await fs.readFile(filePath, 'utf-8'));
          
          if (new Date(checkpoint.timestamp) < cutoff && checkpoint.state !== 'ACTIVE') {
            await fs.unlink(filePath);
            cleanedCheckpoints++;
          }
        }
      }

      // Clean transactions
      const transactionFiles = await fs.readdir(this.transactionDir);
      for (const file of transactionFiles) {
        if (file.startsWith('transaction-') && file.endsWith('.json')) {
          const filePath = path.join(this.transactionDir, file);
          const transaction = JSON.parse(await fs.readFile(filePath, 'utf-8'));
          
          if (new Date(transaction.timestamp) < cutoff && transaction.state !== 'ACTIVE') {
            await fs.unlink(filePath);
            cleanedTransactions++;
          }
        }
      }

      // Clean expired locks
      const lockFiles = await fs.readdir(this.lockDir);
      for (const file of lockFiles) {
        if (file.endsWith('.lock')) {
          const filePath = path.join(this.lockDir, file);
          const lock = JSON.parse(await fs.readFile(filePath, 'utf-8'));
          
          if (new Date() > new Date(lock.expiresAt)) {
            await fs.unlink(filePath);
          }
        }
      }

      return {
        success: true,
        cleanedCheckpoints,
        cleanedTransactions,
        maxAge
      };
    } catch (error) {
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Get system status
   */
  async getStatus() {
    try {
      const logPath = path.join(this.checkpointsDir, 'checkpoint-log.json');
      const log = JSON.parse(await fs.readFile(logPath, 'utf-8'));
      
      const activeLocks = await this.getActiveLocks();
      const activeTransactions = await this.getActiveTransactions();

      return {
        timestamp: new Date().toISOString(),
        checkpoints: {
          total: log.checkpoints.length,
          lastId: log.lastCheckpointId
        },
        transactions: {
          total: log.transactions.length,
          lastId: log.lastTransactionId,
          active: activeTransactions.length
        },
        locks: {
          active: activeLocks.length
        },
        system: {
          pid: process.pid,
          uptime: process.uptime(),
          memory: process.memoryUsage()
        }
      };
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get active locks
   */
  async getActiveLocks() {
    try {
      const lockFiles = await fs.readdir(this.lockDir);
      const activeLocks = [];

      for (const file of lockFiles) {
        if (file.startsWith('lock-') && file.endsWith('.json')) {
          const filePath = path.join(this.lockDir, file);
          const lock = JSON.parse(await fs.readFile(filePath, 'utf-8'));
          
          if (lock.state === 'ACTIVE' && new Date() < new Date(lock.expiresAt)) {
            activeLocks.push(lock);
          }
        }
      }

      return activeLocks;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get active transactions
   */
  async getActiveTransactions() {
    try {
      const transactionFiles = await fs.readdir(this.transactionDir);
      const activeTransactions = [];

      for (const file of transactionFiles) {
        if (file.startsWith('transaction-') && file.endsWith('.json')) {
          const filePath = path.join(this.transactionDir, file);
          const transaction = JSON.parse(await fs.readFile(filePath, 'utf-8'));
          
          if (transaction.state === 'ACTIVE') {
            activeTransactions.push(transaction);
          }
        }
      }

      return activeTransactions;
    } catch (error) {
      return [];
    }
  }

  /**
   * Hash file path for lock file naming
   */
  hashPath(filePath) {
    return crypto.createHash('sha256').update(path.resolve(filePath)).digest('hex').substring(0, 16);
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper to check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export default AtomicCheckpoints;

// Export simplified functions for collaboration system
export const createCheckpoint = async (data) => {
  return {
    id: `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    data,
    status: 'created'
  };
};