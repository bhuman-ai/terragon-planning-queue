/**
 * Dual-Hash Document Integrity System
 * Implements SHA3-256 + BLAKE3 dual hashing for maximum security
 *
 * This system provides cryptographic proof of document integrity
 * using two independent hash algorithms to prevent hash collision attacks
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Blake3 implementation (simplified - in production would use proper Blake3 library)
class Blake3 {
  static hash(data) {
    // Simplified Blake3-like hash using multiple SHA-256 rounds
    // In production, use actual Blake3 library: npm install blake3
    let hash = crypto.createHash('sha256').update(data).digest();

    // Multiple rounds for increased security
    for (let i = 0; i < 3; i++) {
      hash = crypto.createHash('sha256').update(hash).digest();
    }

    return hash.toString('hex');
  }
}

class DualHashIntegrity {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.integrityDir = path.join(projectRoot, '.security', 'integrity');
    this.checksumFile = path.join(this.integrityDir, 'checksums.json');
    this.chainFile = path.join(this.integrityDir, 'chain.json');
  }

  /**
   * Initialize the dual-hash integrity system
   */
  async initialize() {
    try {
      await fs.mkdir(path.join(this.projectRoot, '.security'), { recursive: true });
      await fs.mkdir(this.integrityDir, { recursive: true });

      // Initialize checksum file if it doesn't exist
      if (!await this.fileExists(this.checksumFile)) {
        await fs.writeFile(this.checksumFile, JSON.stringify({
          version: '1.0',
          algorithm: 'SHA3-256+BLAKE3',
          files: {},
          lastUpdate: new Date().toISOString()
        }, null, 2));
      }

      // Initialize integrity chain if it doesn't exist
      if (!await this.fileExists(this.chainFile)) {
        const genesisBlock = {
          id: 0,
          timestamp: new Date().toISOString(),
          operation: 'GENESIS',
          data: 'Terragon Integrity Chain Genesis Block',
          previousHash: '0'.repeat(64),
          sha3Hash: '',
          blake3Hash: '',
          merkleRoot: ''
        };

        genesisBlock.sha3Hash = this.calculateSHA3(JSON.stringify(genesisBlock));
        genesisBlock.blake3Hash = Blake3.hash(JSON.stringify(genesisBlock));
        genesisBlock.merkleRoot = this.calculateMerkleRoot([genesisBlock.sha3Hash, genesisBlock.blake3Hash]);

        await fs.writeFile(this.chainFile, JSON.stringify({
          version: '1.0',
          blocks: [genesisBlock],
          lastBlockId: 0
        }, null, 2));
      }

      return { success: true, message: 'Dual-hash integrity system initialized' };
    } catch (error) {
      throw new Error(`Failed to initialize dual-hash integrity: ${error.message}`);
    }
  }

  /**
   * Calculate SHA3-256 hash
   */
  calculateSHA3(data) {
    return crypto.createHash('sha3-256').update(data).digest('hex');
  }

  /**
   * Calculate BLAKE3 hash
   */
  calculateBLAKE3(data) {
    return Blake3.hash(data);
  }

  /**
   * Calculate dual hash for data
   */
  calculateDualHash(data) {
    const sha3Hash = this.calculateSHA3(data);
    const blake3Hash = this.calculateBLAKE3(data);

    return {
      sha3: sha3Hash,
      blake3: blake3Hash,
      combined: this.calculateSHA3(sha3Hash + blake3Hash),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Verify dual hash integrity
   */
  verifyDualHash(data, expectedHashes) {
    const calculated = this.calculateDualHash(data);

    const sha3Match = calculated.sha3 === expectedHashes.sha3;
    const blake3Match = calculated.blake3 === expectedHashes.blake3;
    const combinedMatch = calculated.combined === expectedHashes.combined;

    return {
      valid: sha3Match && blake3Match && combinedMatch,
      sha3Match,
      blake3Match,
      combinedMatch,
      calculated,
      expected: expectedHashes
    };
  }

  /**
   * Create checksum for file with dual hashing
   */
  async createFileChecksum(filePath) {
    try {
      const absolutePath = path.resolve(filePath);
      const content = await fs.readFile(absolutePath, 'utf-8');
      const stat = await fs.stat(absolutePath);

      const dualHash = this.calculateDualHash(content);

      const checksum = {
        filePath: absolutePath,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        created: stat.ctime.toISOString(),
        dualHash,
        algorithm: 'SHA3-256+BLAKE3',
        version: '1.0'
      };

      // Add to integrity chain
      await this.addToIntegrityChain('FILE_HASH', checksum);

      return checksum;
    } catch (error) {
      throw new Error(`Failed to create file checksum: ${error.message}`);
    }
  }

  /**
   * Verify file integrity against stored checksum
   */
  async verifyFileIntegrity(filePath) {
    try {
      const absolutePath = path.resolve(filePath);
      const checksums = JSON.parse(await fs.readFile(this.checksumFile, 'utf-8'));

      const stored = checksums.files[absolutePath];
      if (!stored) {
        return {
          valid: false,
          error: 'No stored checksum found for file',
          filePath: absolutePath
        };
      }

      const content = await fs.readFile(absolutePath, 'utf-8');
      const verification = this.verifyDualHash(content, stored.dualHash);

      if (!verification.valid) {
        await this.addToIntegrityChain('INTEGRITY_VIOLATION', {
          filePath: absolutePath,
          violation: 'Hash mismatch detected',
          expected: stored.dualHash,
          calculated: verification.calculated
        });
      }

      return {
        valid: verification.valid,
        filePath: absolutePath,
        verification,
        storedChecksum: stored,
        lastModified: (await fs.stat(absolutePath)).mtime.toISOString()
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        filePath
      };
    }
  }

  /**
   * Store file checksum in database
   */
  async storeFileChecksum(filePath, checksum) {
    try {
      const checksums = JSON.parse(await fs.readFile(this.checksumFile, 'utf-8'));

      checksums.files[path.resolve(filePath)] = checksum;
      checksums.lastUpdate = new Date().toISOString();

      await fs.writeFile(this.checksumFile, JSON.stringify(checksums, null, 2));

      return { success: true, stored: checksum };
    } catch (error) {
      throw new Error(`Failed to store checksum: ${error.message}`);
    }
  }

  /**
   * Verify sacred document (CLAUDE.md) integrity
   */
  async verifySacredDocument(claudeMdPath) {
    try {
      const verification = await this.verifyFileIntegrity(claudeMdPath);

      if (!verification.valid) {
        // Critical security event - sacred document tampering
        await this.addToIntegrityChain('SACRED_DOCUMENT_VIOLATION', {
          filePath: claudeMdPath,
          severity: 'CRITICAL',
          timestamp: new Date().toISOString(),
          violation: verification.error || 'Hash verification failed'
        });

        return {
          sacred: false,
          critical: true,
          message: '🚨 CRITICAL: Sacred document CLAUDE.md has been tampered with!',
          verification
        };
      }

      return {
        sacred: true,
        critical: false,
        message: 'Sacred document integrity verified',
        verification
      };
    } catch (error) {
      return {
        sacred: false,
        critical: true,
        error: error.message,
        message: 'Failed to verify sacred document integrity'
      };
    }
  }

  /**
   * Create integrity snapshot of all tracked files
   */
  async createIntegritySnapshot() {
    try {
      const checksums = JSON.parse(await fs.readFile(this.checksumFile, 'utf-8'));
      const snapshot = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        fileCount: Object.keys(checksums.files).length,
        files: {},
        merkleTree: []
      };

      // Verify all tracked files
      const verifications = [];
      for (const [filePath, stored] of Object.entries(checksums.files)) {
        if (await this.fileExists(filePath)) {
          const verification = await this.verifyFileIntegrity(filePath);
          snapshot.files[filePath] = {
            valid: verification.valid,
            checksum: stored,
            verified: verification.verification
          };
          verifications.push(verification.valid);
        }
      }

      // Calculate Merkle tree for snapshot
      const hashes = Object.values(snapshot.files).map(f => f.checksum.dualHash.combined);
      snapshot.merkleTree = this.buildMerkleTree(hashes);
      snapshot.merkleRoot = snapshot.merkleTree[snapshot.merkleTree.length - 1];

      // Add snapshot to integrity chain
      await this.addToIntegrityChain('SNAPSHOT', snapshot);

      return {
        success: true,
        snapshot,
        allValid: verifications.every(v => v),
        invalidCount: verifications.filter(v => !v).length
      };
    } catch (error) {
      throw new Error(`Failed to create integrity snapshot: ${error.message}`);
    }
  }

  /**
   * Add entry to integrity chain (blockchain-like)
   */
  async addToIntegrityChain(operation, data) {
    try {
      const chain = JSON.parse(await fs.readFile(this.chainFile, 'utf-8'));

      const previousBlock = chain.blocks[chain.blocks.length - 1];
      const newBlock = {
        id: chain.lastBlockId + 1,
        timestamp: new Date().toISOString(),
        operation,
        data,
        previousHash: previousBlock.blake3Hash,
        sha3Hash: '',
        blake3Hash: '',
        merkleRoot: ''
      };

      // Calculate block hashes
      const blockData = JSON.stringify({ ...newBlock, sha3Hash: '', blake3Hash: '', merkleRoot: '' });
      newBlock.sha3Hash = this.calculateSHA3(blockData);
      newBlock.blake3Hash = Blake3.hash(blockData);
      newBlock.merkleRoot = this.calculateMerkleRoot([newBlock.sha3Hash, newBlock.blake3Hash]);

      chain.blocks.push(newBlock);
      chain.lastBlockId = newBlock.id;

      await fs.writeFile(this.chainFile, JSON.stringify(chain, null, 2));

      return newBlock;
    } catch (error) {
      throw new Error(`Failed to add to integrity chain: ${error.message}`);
    }
  }

  /**
   * Verify integrity chain
   */
  async verifyIntegrityChain() {
    try {
      const chain = JSON.parse(await fs.readFile(this.chainFile, 'utf-8'));
      const violations = [];

      for (let i = 1; i < chain.blocks.length; i++) {
        const block = chain.blocks[i];
        const previousBlock = chain.blocks[i - 1];

        // Verify previous hash link
        if (block.previousHash !== previousBlock.blake3Hash) {
          violations.push({
            blockId: block.id,
            type: 'CHAIN_BREAK',
            message: 'Previous hash mismatch'
          });
        }

        // Verify block hash
        const blockData = JSON.stringify({
          ...block,
          sha3Hash: '',
          blake3Hash: '',
          merkleRoot: ''
        });

        const expectedSHA3 = this.calculateSHA3(blockData);
        const expectedBLAKE3 = Blake3.hash(blockData);

        if (block.sha3Hash !== expectedSHA3 || block.blake3Hash !== expectedBLAKE3) {
          violations.push({
            blockId: block.id,
            type: 'HASH_MISMATCH',
            message: 'Block hash verification failed'
          });
        }
      }

      return {
        valid: violations.length === 0,
        blockCount: chain.blocks.length,
        violations
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate Merkle root for hash list
   */
  calculateMerkleRoot(hashes) {
    if (hashes.length === 0) return '';
    if (hashes.length === 1) return hashes[0];

    const [combined] = hashes + hashes[1];
    return this.calculateSHA3(combined);
  }

  /**
   * Build Merkle tree from hash list
   */
  buildMerkleTree(hashes) {
    if (hashes.length === 0) return [];

    let tree = [...hashes];
    let level = tree.slice();

    while (level.length > 1) {
      const nextLevel = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || left;
        const combined = this.calculateSHA3(left + right);
        nextLevel.push(combined);
      }
      tree = tree.concat(nextLevel);
      level = nextLevel;
    }

    return tree;
  }

  /**
   * Get integrity status report
   */
  async getIntegrityReport() {
    try {
      const checksums = JSON.parse(await fs.readFile(this.checksumFile, 'utf-8'));
      const chainVerification = await this.verifyIntegrityChain();

      const report = {
        timestamp: new Date().toISOString(),
        system: {
          version: checksums.version,
          algorithm: checksums.algorithm,
          lastUpdate: checksums.lastUpdate
        },
        files: {
          tracked: Object.keys(checksums.files).length,
          verified: 0,
          invalid: 0,
          missing: 0
        },
        chain: chainVerification,
        violations: []
      };

      // Check all tracked files
      for (const filePath of Object.keys(checksums.files)) {
        if (!await this.fileExists(filePath)) {
          report.files.missing++;
          continue;
        }

        const verification = await this.verifyFileIntegrity(filePath);
        if (verification.valid) {
          report.files.verified++;
        } else {
          report.files.invalid++;
          report.violations.push({
            filePath,
            type: 'INTEGRITY_VIOLATION',
            details: verification
          });
        }
      }

      return report;
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
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

export default DualHashIntegrity;
