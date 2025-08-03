/**
 * Unit Tests for Dual-Hash Document Integrity System
 * Tests SHA3-256 + BLAKE3 dual hashing, integrity verification, and blockchain-like chain
 */

import DualHashIntegrity from '../../lib/security/dual-hash-integrity.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Mock the file system
jest.mock('fs/promises');

describe('DualHashIntegrity', () => {
  let integrity;
  const mockProjectRoot = '/test/project';

  beforeEach(() => {
    integrity = new DualHashIntegrity(mockProjectRoot);
  });

  describe('Initialization', () => {
    test('should initialize successfully with new directories', async () => {
      fs.mkdir.mockResolvedValue(undefined);
      fs.writeFile.mockResolvedValue(undefined);

      // Mock files don't exist initially
      fs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await integrity.initialize();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Dual-hash integrity system initialized');

      // Verify directories were created
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(mockProjectRoot, '.security'),
        { recursive: true }
      );
      expect(fs.mkdir).toHaveBeenCalledWith(integrity.integrityDir, { recursive: true });

      // Verify initial files were created
      expect(fs.writeFile).toHaveBeenCalledWith(
        integrity.checksumFile,
        expect.stringContaining('"algorithm":"SHA3-256+BLAKE3"')
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        integrity.chainFile,
        expect.stringContaining('"operation":"GENESIS"')
      );
    });

    test('should handle initialization errors', async () => {
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(integrity.initialize()).rejects.toThrow(
        'Failed to initialize dual-hash integrity: Permission denied'
      );
    });

    test('should skip file creation if they already exist', async () => {
      global.testUtils.mockFileSystem.setupMockFiles({
        [integrity.checksumFile]: '{"version":"1.0"}',
        [integrity.chainFile]: '{"version":"1.0"}'
      });

      const result = await integrity.initialize();

      expect(result.success).toBe(true);

      // Should not overwrite existing files
      expect(fs.writeFile).not.toHaveBeenCalledWith(
        integrity.checksumFile,
        expect.any(String)
      );
    });
  });

  describe('Hash Calculation', () => {
    const testData = 'Hello, Terragon!';

    test('should calculate SHA3-256 hash correctly', () => {
      const hash = integrity.calculateSHA3(testData);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64); // SHA3-256 produces 64 hex characters
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should calculate BLAKE3 hash correctly', () => {
      const hash = integrity.calculateBLAKE3(testData);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64); // Our simplified BLAKE3 produces 64 hex characters
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should produce different hashes for different algorithms', () => {
      const sha3Hash = integrity.calculateSHA3(testData);
      const blake3Hash = integrity.calculateBLAKE3(testData);

      expect(sha3Hash).not.toBe(blake3Hash);
    });

    test('should calculate consistent dual hash', () => {
      const result1 = integrity.calculateDualHash(testData);
      const result2 = integrity.calculateDualHash(testData);

      expect(result1.sha3).toBe(result2.sha3);
      expect(result1.blake3).toBe(result2.blake3);
      expect(result1.combined).toBe(result2.combined);
    });

    test('should include timestamp in dual hash', () => {
      const result = integrity.calculateDualHash(testData);

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });

    test('should calculate combined hash correctly', () => {
      const result = integrity.calculateDualHash(testData);
      const expectedCombined = integrity.calculateSHA3(result.sha3 + result.blake3);

      expect(result.combined).toBe(expectedCombined);
    });

    test('should produce different hashes for different input', () => {
      const result1 = integrity.calculateDualHash('input1');
      const result2 = integrity.calculateDualHash('input2');

      expect(result1.sha3).not.toBe(result2.sha3);
      expect(result1.blake3).not.toBe(result2.blake3);
      expect(result1.combined).not.toBe(result2.combined);
    });
  });

  describe('Hash Verification', () => {
    const testData = 'Test data for verification';

    test('should verify matching dual hash', () => {
      const originalHash = integrity.calculateDualHash(testData);
      const verification = integrity.verifyDualHash(testData, originalHash);

      expect(verification.valid).toBe(true);
      expect(verification.sha3Match).toBe(true);
      expect(verification.blake3Match).toBe(true);
      expect(verification.combinedMatch).toBe(true);
    });

    test('should detect SHA3 hash mismatch', () => {
      const originalHash = integrity.calculateDualHash(testData);
      const corruptedHash = {
        ...originalHash,
        sha3: `corrupted${originalHash.sha3.slice(9)}` // Corrupt first part
      };

      const verification = integrity.verifyDualHash(testData, corruptedHash);

      expect(verification.valid).toBe(false);
      expect(verification.sha3Match).toBe(false);
      expect(verification.blake3Match).toBe(true);
      expect(verification.combinedMatch).toBe(false); // Combined will also fail
    });

    test('should detect BLAKE3 hash mismatch', () => {
      const originalHash = integrity.calculateDualHash(testData);
      const corruptedHash = {
        ...originalHash,
        blake3: `corrupted${originalHash.blake3.slice(9)}`
      };

      const verification = integrity.verifyDualHash(testData, corruptedHash);

      expect(verification.valid).toBe(false);
      expect(verification.sha3Match).toBe(true);
      expect(verification.blake3Match).toBe(false);
      expect(verification.combinedMatch).toBe(false);
    });

    test('should detect combined hash mismatch', () => {
      const originalHash = integrity.calculateDualHash(testData);
      const corruptedHash = {
        ...originalHash,
        combined: `corrupted${originalHash.combined.slice(9)}`
      };

      const verification = integrity.verifyDualHash(testData, corruptedHash);

      expect(verification.valid).toBe(false);
      expect(verification.combinedMatch).toBe(false);
    });

    test('should return calculated and expected hashes in verification', () => {
      const originalHash = integrity.calculateDualHash(testData);
      const verification = integrity.verifyDualHash(testData, originalHash);

      expect(verification.calculated).toBeDefined();
      expect(verification.expected).toBe(originalHash);
      expect(verification.calculated.sha3).toBe(originalHash.sha3);
    });
  });

  describe('File Checksum Operations', () => {
    const testFilePath = '/test/file.txt';
    const testContent = 'File content for checksum testing';

    beforeEach(() => {
      global.testUtils.mockFileSystem.setupMockFiles({
        [testFilePath]: testContent
      });

      // Mock adding to integrity chain
      jest.spyOn(integrity, 'addToIntegrityChain').mockResolvedValue({});
    });

    test('should create file checksum successfully', async () => {
      const checksum = await integrity.createFileChecksum(testFilePath);

      expect(checksum.filePath).toBe(path.resolve(testFilePath));
      expect(checksum.size).toBe(testContent.length);
      expect(checksum.dualHash).toBeDefined();
      expect(checksum.dualHash.sha3).toBeDefined();
      expect(checksum.dualHash.blake3).toBeDefined();
      expect(checksum.dualHash.combined).toBeDefined();
      expect(checksum.algorithm).toBe('SHA3-256+BLAKE3');
      expect(checksum.version).toBe('1.0');

      // Verify it was added to integrity chain
      expect(integrity.addToIntegrityChain).toHaveBeenCalledWith('FILE_HASH', checksum);
    });

    test('should include file statistics in checksum', async () => {
      const checksum = await integrity.createFileChecksum(testFilePath);

      expect(checksum.size).toBe(testContent.length);
      expect(checksum.modified).toBeDefined();
      expect(checksum.created).toBeDefined();
      expect(new Date(checksum.modified)).toBeInstanceOf(Date);
      expect(new Date(checksum.created)).toBeInstanceOf(Date);
    });

    test('should handle file reading errors', async () => {
      fs.readFile.mockRejectedValue(new Error('Permission denied'));

      await expect(integrity.createFileChecksum(testFilePath)).rejects.toThrow(
        'Failed to create file checksum: Permission denied'
      );
    });
  });

  describe('File Integrity Verification', () => {
    const testFilePath = '/test/verify-file.txt';
    const testContent = 'Content to verify integrity';

    beforeEach(() => {
      global.testUtils.mockFileSystem.setupMockFiles({
        [testFilePath]: testContent
      });

      jest.spyOn(integrity, 'addToIntegrityChain').mockResolvedValue({});
    });

    test('should verify file integrity successfully', async () => {
      // First create a checksum
      const originalChecksum = await integrity.createFileChecksum(testFilePath);

      // Mock stored checksums
      const checksums = {
        version: '1.0',
        files: {
          [path.resolve(testFilePath)]: originalChecksum
        }
      };

      global.testUtils.mockFileSystem.setupMockFiles({
        [integrity.checksumFile]: JSON.stringify(checksums),
        [testFilePath]: testContent
      });

      const verification = await integrity.verifyFileIntegrity(testFilePath);

      expect(verification.valid).toBe(true);
      expect(verification.filePath).toBe(path.resolve(testFilePath));
      expect(verification.verification.valid).toBe(true);
      expect(verification.storedChecksum).toEqual(originalChecksum);
    });

    test('should detect file content changes', async () => {
      // Create checksum for original content
      const originalChecksum = await integrity.createFileChecksum(testFilePath);

      const checksums = {
        version: '1.0',
        files: {
          [path.resolve(testFilePath)]: originalChecksum
        }
      };

      // Mock modified file content
      const modifiedContent = 'Modified content that should fail verification';
      global.testUtils.mockFileSystem.setupMockFiles({
        [integrity.checksumFile]: JSON.stringify(checksums),
        [testFilePath]: modifiedContent
      });

      const verification = await integrity.verifyFileIntegrity(testFilePath);

      expect(verification.valid).toBe(false);
      expect(verification.verification.valid).toBe(false);

      // Should log integrity violation
      expect(integrity.addToIntegrityChain).toHaveBeenCalledWith(
        'INTEGRITY_VIOLATION',
        expect.objectContaining({
          filePath: path.resolve(testFilePath),
          violation: 'Hash mismatch detected'
        })
      );
    });

    test('should handle missing stored checksum', async () => {
      global.testUtils.mockFileSystem.setupMockFiles({
        [integrity.checksumFile]: JSON.stringify({ version: '1.0', files: {} }),
        [testFilePath]: testContent
      });

      const verification = await integrity.verifyFileIntegrity(testFilePath);

      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('No stored checksum found for file');
    });

    test('should handle missing file', async () => {
      fs.readFile.mockImplementation((path) => {
        if (path === integrity.checksumFile) {
          return Promise.resolve(JSON.stringify({ version: '1.0', files: {} }));
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const verification = await integrity.verifyFileIntegrity('/nonexistent/file.txt');

      expect(verification.valid).toBe(false);
      expect(verification.error).toBeDefined();
    });
  });

  describe('Sacred Document Verification', () => {
    const claudeMdPath = '/test/CLAUDE.md';
    const sacredContent = `# CLAUDE.md
## Sacred Principles
- NO SIMULATIONS
- NO FALLBACKS
- ALWAYS REAL`;

    beforeEach(() => {
      jest.spyOn(integrity, 'verifyFileIntegrity').mockResolvedValue({
        valid: true,
        verification: { valid: true }
      });
      jest.spyOn(integrity, 'addToIntegrityChain').mockResolvedValue({});
    });

    test('should verify sacred document successfully', async () => {
      const result = await integrity.verifySacredDocument(claudeMdPath);

      expect(result.sacred).toBe(true);
      expect(result.critical).toBe(false);
      expect(result.message).toContain('Sacred document integrity verified');
    });

    test('should detect sacred document tampering', async () => {
      jest.spyOn(integrity, 'verifyFileIntegrity').mockResolvedValue({
        valid: false,
        error: 'Hash verification failed'
      });

      const result = await integrity.verifySacredDocument(claudeMdPath);

      expect(result.sacred).toBe(false);
      expect(result.critical).toBe(true);
      expect(result.message).toContain('🚨 CRITICAL: Sacred document CLAUDE.md has been tampered with!');

      // Should log critical security event
      expect(integrity.addToIntegrityChain).toHaveBeenCalledWith(
        'SACRED_DOCUMENT_VIOLATION',
        expect.objectContaining({
          filePath: claudeMdPath,
          severity: 'CRITICAL'
        })
      );
    });

    test('should handle verification errors', async () => {
      jest.spyOn(integrity, 'verifyFileIntegrity').mockRejectedValue(
        new Error('File access denied')
      );

      const result = await integrity.verifySacredDocument(claudeMdPath);

      expect(result.sacred).toBe(false);
      expect(result.critical).toBe(true);
      expect(result.error).toBe('File access denied');
      expect(result.message).toContain('Failed to verify sacred document integrity');
    });
  });

  describe('Checksum Storage', () => {
    test('should store file checksum successfully', async () => {
      const testChecksum = {
        filePath: '/test/file.txt',
        dualHash: { sha3: 'hash1', blake3: 'hash2' }
      };

      global.testUtils.mockFileSystem.setupMockFiles({
        [integrity.checksumFile]: JSON.stringify({
          version: '1.0',
          files: {},
          lastUpdate: '2022-01-01T00:00:00.000Z'
        })
      });

      fs.writeFile.mockResolvedValue(undefined);

      const result = await integrity.storeFileChecksum('/test/file.txt', testChecksum);

      expect(result.success).toBe(true);
      expect(result.stored).toBe(testChecksum);

      // Verify updated checksums were written
      expect(fs.writeFile).toHaveBeenCalledWith(
        integrity.checksumFile,
        expect.stringContaining('"lastUpdate"')
      );
    });

    test('should handle storage errors', async () => {
      fs.readFile.mockRejectedValue(new Error('Permission denied'));

      await expect(integrity.storeFileChecksum('/test/file.txt', {})).rejects.toThrow(
        'Failed to store checksum: Permission denied'
      );
    });
  });

  describe('Integrity Chain (Blockchain-like)', () => {
    beforeEach(() => {
      global.testUtils.mockFileSystem.setupMockFiles({
        [integrity.chainFile]: JSON.stringify({
          version: '1.0',
          blocks: [{
            id: 0,
            operation: 'GENESIS',
            previousHash: '0'.repeat(64),
            sha3Hash: 'genesis-sha3',
            blake3Hash: 'genesis-blake3'
          }],
          lastBlockId: 0
        })
      });
    });

    test('should add entry to integrity chain', async () => {
      fs.writeFile.mockResolvedValue(undefined);

      const operation = 'TEST_OPERATION';
      const data = { testData: 'test value' };

      const newBlock = await integrity.addToIntegrityChain(operation, data);

      expect(newBlock.id).toBe(1);
      expect(newBlock.operation).toBe(operation);
      expect(newBlock.data).toEqual(data);
      expect(newBlock.previousHash).toBe('genesis-blake3');
      expect(newBlock.sha3Hash).toBeDefined();
      expect(newBlock.blake3Hash).toBeDefined();
      expect(newBlock.merkleRoot).toBeDefined();

      // Verify chain was updated
      expect(fs.writeFile).toHaveBeenCalledWith(
        integrity.chainFile,
        expect.stringContaining('"lastBlockId":1')
      );
    });

    test('should verify integrity chain successfully', async () => {
      const validChain = {
        version: '1.0',
        blocks: [
          {
            id: 0,
            operation: 'GENESIS',
            previousHash: '0'.repeat(64),
            sha3Hash: 'valid-genesis-sha3',
            blake3Hash: 'valid-genesis-blake3'
          },
          {
            id: 1,
            operation: 'TEST',
            previousHash: 'valid-genesis-blake3',
            sha3Hash: 'valid-block1-sha3',
            blake3Hash: 'valid-block1-blake3'
          }
        ]
      };

      global.testUtils.mockFileSystem.setupMockFiles({
        [integrity.chainFile]: JSON.stringify(validChain)
      });

      // Mock hash calculations to match stored values
      jest.spyOn(integrity, 'calculateSHA3').mockImplementation((data) => {
        if (data.includes('"operation":"GENESIS"')) return 'valid-genesis-sha3';
        if (data.includes('"operation":"TEST"')) return 'valid-block1-sha3';
        return 'default-sha3';
      });

      // Mock BLAKE3 calculations
      jest.spyOn(integrity, 'calculateBLAKE3').mockImplementation((data) => {
        if (data.includes('"operation":"GENESIS"')) return 'valid-genesis-blake3';
        if (data.includes('"operation":"TEST"')) return 'valid-block1-blake3';
        return 'default-blake3';
      });

      const verification = await integrity.verifyIntegrityChain();

      expect(verification.valid).toBe(true);
      expect(verification.blockCount).toBe(2);
      expect(verification.violations).toHaveLength(0);
    });

    test('should detect chain breaks', async () => {
      const brokenChain = {
        version: '1.0',
        blocks: [
          {
            id: 0,
            operation: 'GENESIS',
            blake3Hash: 'genesis-blake3'
          },
          {
            id: 1,
            operation: 'TEST',
            previousHash: 'wrong-previous-hash',
            blake3Hash: 'block1-blake3'
          }
        ]
      };

      global.testUtils.mockFileSystem.setupMockFiles({
        [integrity.chainFile]: JSON.stringify(brokenChain)
      });

      const verification = await integrity.verifyIntegrityChain();

      expect(verification.valid).toBe(false);
      expect(verification.violations).toHaveLength(1);
      expect(verification.violations[0].type).toBe('CHAIN_BREAK');
      expect(verification.violations[0].blockId).toBe(1);
    });

    test('should detect hash corruption', async () => {
      const corruptedChain = {
        version: '1.0',
        blocks: [
          {
            id: 0,
            operation: 'GENESIS',
            sha3Hash: 'corrupted-hash',
            blake3Hash: 'also-corrupted'
          }
        ]
      };

      global.testUtils.mockFileSystem.setupMockFiles({
        [integrity.chainFile]: JSON.stringify(corruptedChain)
      });

      // Mock calculations to return different values
      jest.spyOn(integrity, 'calculateSHA3').mockReturnValue('correct-sha3');
      jest.spyOn(integrity, 'calculateBLAKE3').mockReturnValue('correct-blake3');

      const verification = await integrity.verifyIntegrityChain();

      expect(verification.valid).toBe(false);
      expect(verification.violations.some(v => v.type === 'HASH_MISMATCH')).toBe(true);
    });

    test('should handle chain verification errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      const verification = await integrity.verifyIntegrityChain();

      expect(verification.valid).toBe(false);
      expect(verification.error).toBe('File not found');
    });
  });

  describe('Merkle Tree Operations', () => {
    test('should calculate Merkle root for two hashes', () => {
      const hash1 = 'a'.repeat(64);
      const hash2 = 'b'.repeat(64);

      const root = integrity.calculateMerkleRoot([hash1, hash2]);

      expect(root).toBeDefined();
      expect(root).toHaveLength(64);
      expect(root).toBe(integrity.calculateSHA3(hash1 + hash2));
    });

    test('should handle single hash', () => {
      const singleHash = 'a'.repeat(64);

      const root = integrity.calculateMerkleRoot([singleHash]);

      expect(root).toBe(singleHash);
    });

    test('should handle empty hash list', () => {
      const root = integrity.calculateMerkleRoot([]);

      expect(root).toBe('');
    });

    test('should build complete Merkle tree', () => {
      const hashes = ['hash1', 'hash2', 'hash3', 'hash4'];

      const tree = integrity.buildMerkleTree(hashes);

      expect(tree).toContain('hash1');
      expect(tree).toContain('hash2');
      expect(tree).toContain('hash3');
      expect(tree).toContain('hash4');
      expect(tree.length).toBeGreaterThan(hashes.length); // Should include intermediate nodes
    });

    test('should handle odd number of hashes', () => {
      const hashes = ['hash1', 'hash2', 'hash3'];

      const tree = integrity.buildMerkleTree(hashes);

      expect(tree).toBeDefined();
      expect(tree.length).toBeGreaterThan(0);
    });
  });

  describe('Integrity Snapshot', () => {
    beforeEach(() => {
      global.testUtils.mockFileSystem.setupMockFiles({
        [integrity.checksumFile]: JSON.stringify({
          version: '1.0',
          files: {
            '/test/file1.txt': {
              dualHash: { combined: 'hash1' }
            },
            '/test/file2.txt': {
              dualHash: { combined: 'hash2' }
            }
          }
        })
      });

      jest.spyOn(integrity, 'verifyFileIntegrity').mockResolvedValue({
        valid: true,
        verification: { valid: true }
      });

      jest.spyOn(integrity, 'addToIntegrityChain').mockResolvedValue({});
    });

    test('should create integrity snapshot successfully', async () => {
      const snapshot = await integrity.createIntegritySnapshot();

      expect(snapshot.success).toBe(true);
      expect(snapshot.allValid).toBe(true);
      expect(snapshot.invalidCount).toBe(0);
      expect(snapshot.snapshot.fileCount).toBe(2);
      expect(snapshot.snapshot.merkleRoot).toBeDefined();

      // Should add snapshot to chain
      expect(integrity.addToIntegrityChain).toHaveBeenCalledWith(
        'SNAPSHOT',
        snapshot.snapshot
      );
    });

    test('should detect invalid files in snapshot', async () => {
      jest.spyOn(integrity, 'verifyFileIntegrity')
        .mockResolvedValueOnce({ valid: true, verification: { valid: true } })
        .mockResolvedValueOnce({ valid: false, verification: { valid: false } });

      const snapshot = await integrity.createIntegritySnapshot();

      expect(snapshot.success).toBe(true);
      expect(snapshot.allValid).toBe(false);
      expect(snapshot.invalidCount).toBe(1);
    });

    test('should handle snapshot creation errors', async () => {
      fs.readFile.mockRejectedValue(new Error('Permission denied'));

      await expect(integrity.createIntegritySnapshot()).rejects.toThrow(
        'Failed to create integrity snapshot: Permission denied'
      );
    });
  });

  describe('Integrity Report', () => {
    beforeEach(() => {
      global.testUtils.mockFileSystem.setupMockFiles({
        [integrity.checksumFile]: JSON.stringify({
          version: '1.0',
          algorithm: 'SHA3-256+BLAKE3',
          lastUpdate: '2022-01-01T00:00:00.000Z',
          files: {
            '/test/valid-file.txt': { dualHash: { combined: 'hash1' } },
            '/test/invalid-file.txt': { dualHash: { combined: 'hash2' } },
            '/test/missing-file.txt': { dualHash: { combined: 'hash3' } }
          }
        })
      });

      jest.spyOn(integrity, 'verifyIntegrityChain').mockResolvedValue({
        valid: true,
        blockCount: 5,
        violations: []
      });

      jest.spyOn(integrity, 'verifyFileIntegrity')
        .mockImplementation((filePath) => {
          if (filePath.includes('valid-file')) {
            return Promise.resolve({ valid: true });
          }
          return Promise.resolve({ valid: false, error: 'Hash mismatch' });
        });

      jest.spyOn(integrity, 'fileExists')
        .mockImplementation((filePath) => {
          return Promise.resolve(!filePath.includes('missing-file'));
        });
    });

    test('should generate comprehensive integrity report', async () => {
      const report = await integrity.getIntegrityReport();

      expect(report.timestamp).toBeDefined();
      expect(report.system.version).toBe('1.0');
      expect(report.system.algorithm).toBe('SHA3-256+BLAKE3');
      expect(report.files.tracked).toBe(3);
      expect(report.files.verified).toBe(1);
      expect(report.files.invalid).toBe(1);
      expect(report.files.missing).toBe(1);
      expect(report.chain.valid).toBe(true);
      expect(report.violations).toHaveLength(1);
    });

    test('should handle report generation errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      const report = await integrity.getIntegrityReport();

      expect(report.error).toBe('File not found');
      expect(report.timestamp).toBeDefined();
    });
  });

  describe('File Existence Helper', () => {
    test('should detect existing file', async () => {
      fs.access.mockResolvedValue(undefined);

      const exists = await integrity.fileExists('/test/existing-file.txt');

      expect(exists).toBe(true);
    });

    test('should detect non-existing file', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));

      const exists = await integrity.fileExists('/test/nonexistent-file.txt');

      expect(exists).toBe(false);
    });
  });
});
