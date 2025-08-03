/**
 * Test suite for LLM output validation system
 * Tests binary validation, schema validation, and performance requirements
 */

const { validateLLMOutput, binaryValidate, validationFeedback } = require('../lib/collaboration/validation.js');
const { validateBySchema, binaryValidateBySchema } = require('../lib/collaboration/llm-schemas.js');
const eslintPlugin = require('../lib/eslint-plugins/eslint-plugin-llm-validation.js');

describe('LLM Output Validation System', () => {
  describe('Binary Validation', () => {
    test('should pass valid JavaScript code', () => {
      const validCode = `
        function calculateSum(a, b) {
          if (typeof a !== 'number' || typeof b !== 'number') {
            throw new Error('Parameters must be numbers');
          }
          return a + b;
        }
      `;
      
      const result = binaryValidate(validCode, 'syntax');
      expect(result.isValid).toBe(true);
      expect(result.performanceMs).toBeLessThan(100);
    });

    test('should fail code with security issues', () => {
      const unsafeCode = `
        function processInput(userInput) {
          eval(userInput); // Security violation
          return userInput;
        }
      `;
      
      const result = binaryValidate(unsafeCode, 'security');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Security vulnerability detected');
    });

    test('should fail code with sacred principle violations', () => {
      const mockCode = `
        function fetchData() {
          // This is just a mock implementation
          return { fake: 'data' };
        }
      `;
      
      const result = binaryValidate(mockCode, 'sacred');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Sacred principle violation');
    });

    test('should complete validation within performance threshold', () => {
      const testCode = 'const x = 1; const y = 2; const z = x + y;';
      
      const result = binaryValidate(testCode, 'quality', { performanceThreshold: 50 });
      expect(result.performanceMs).toBeLessThan(50);
      expect(result.withinThreshold).toBe(true);
    });
  });

  describe('Comprehensive LLM Validation', () => {
    test('should validate JavaScript code comprehensively', () => {
      const code = `
        /**
         * Calculate the area of a rectangle
         * @param {number} width - Width of rectangle
         * @param {number} height - Height of rectangle
         * @returns {number} Area of rectangle
         */
        function calculateArea(width, height) {
          if (typeof width !== 'number' || typeof height !== 'number') {
            throw new Error('Width and height must be numbers');
          }
          if (width < 0 || height < 0) {
            throw new Error('Width and height must be positive');
          }
          return width * height;
        }
        
        module.exports = calculateArea;
      `;
      
      const result = validateLLMOutput(code, 'code', {
        language: 'javascript',
        securityLevel: 'high',
        validationLevel: 'strict',
        enforcesSacredPrinciples: true
      });
      
      expect(result.isValid).toBe(true);
      expect(result.validationScore).toBeGreaterThan(80);
      expect(result.performanceMs).toBeLessThan(100);
      expect(result.securityIssues).toHaveLength(0);
      expect(result.sacredViolations).toHaveLength(0);
    });

    test('should detect multiple validation issues', () => {
      const problematicCode = `
        function badFunction(input) {
          eval(input); // Security issue
          // TODO: implement proper validation
          return mockData; // Sacred violation
        }
      `;
      
      const result = validateLLMOutput(problematicCode, 'code', {
        language: 'javascript',
        securityLevel: 'high',
        enforcesSacredPrinciples: true
      });
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.securityIssues.length).toBeGreaterThan(0);
      expect(result.sacredViolations.length).toBeGreaterThan(0);
      expect(result.validationScore).toBeLessThan(50);
    });
  });

  describe('Schema-based Validation', () => {
    test('should validate React component against schema', () => {
      const reactComponent = `
        import React, { useState } from 'react';
        
        /**
         * Button component with accessibility support
         */
        function Button({ children, onClick, disabled = false, type = 'button' }) {
          const [isPressed, setIsPressed] = useState(false);
          
          return (
            <button
              type={type}
              onClick={onClick}
              disabled={disabled}
              aria-pressed={isPressed}
              onMouseDown={() => setIsPressed(true)}
              onMouseUp={() => setIsPressed(false)}
            >
              {children}
            </button>
          );
        }
        
        export default Button;
      `;
      
      const result = validateBySchema(reactComponent, 'reactComponent');
      expect(result.isValid).toBe(true);
      expect(result.performanceMs).toBeLessThan(100);
    });

    test('should validate API response schema', () => {
      const apiResponse = `
        {
          "data": {
            "id": "user_123",
            "name": "John Doe",
            "email": "john@example.com"
          },
          "error": null,
          "timestamp": "2025-08-03T10:30:00Z"
        }
      `;
      
      const result = validateBySchema(apiResponse, 'apiResponse');
      expect(result.isValid).toBe(true);
      expect(result.securityIssues).toHaveLength(0);
    });

    test('should detect security issues in configuration', () => {
      const configWithSecrets = `
        {
          "database": {
            "host": "localhost",
            "password": "hardcoded_secret_123",
            "api_key": "sk-1234567890abcdef"
          }
        }
      `;
      
      const result = validateBySchema(configWithSecrets, 'configFile');
      expect(result.isValid).toBe(false);
      expect(result.securityIssues.length).toBeGreaterThan(0);
    });

    test('should validate test file structure', () => {
      const testFile = `
        describe('Calculator', () => {
          it('should add two numbers correctly', () => {
            expect(add(2, 3)).toBe(5);
          });
          
          it('should throw error for invalid input', () => {
            expect(() => add('a', 'b')).toThrow();
          });
          
          it('should handle edge cases', () => {
            expect(add(0, 0)).toBe(0);
            expect(add(-1, 1)).toBe(0);
          });
        });
      `;
      
      const result = validateBySchema(testFile, 'testFile');
      expect(result.isValid).toBe(true);
    });
  });

  describe('ESLint Plugin Integration', () => {
    test('should provide binary validation utility', () => {
      const code = `
        function test() {
          eval('alert("test")'); // Security issue
        }
      `;
      
      const result = eslintPlugin.binaryValidate(code, {
        enforcesSacredPrinciples: true,
        securityLevel: 'high'
      });
      
      expect(result.isValid).toBe(false);
      expect(result.hasSecurityIssues).toBe(true);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    test('should validate code against sacred principles', () => {
      const mockCode = `
        function getData() {
          // This is just a mock for now
          return { mock: true };
        }
      `;
      
      const result = eslintPlugin.validateLLMCode(mockCode, {
        enforcesSacredPrinciples: true
      });
      
      expect(result.isValid).toBe(false);
      expect(result.sacredViolations.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Requirements', () => {
    test('should complete all validations under 100ms', async () => {
      const testCases = [
        { content: 'const x = 1;', type: 'code' },
        { content: '{"test": true}', type: 'api-response' },
        { content: '# Test\nSome content', type: 'documentation' },
        { content: '<div>Hello</div>', type: 'ui-component' }
      ];
      
      for (const testCase of testCases) {
        const startTime = Date.now();
        const result = validateLLMOutput(testCase.content, testCase.type);
        const duration = Date.now() - startTime;
        
        expect(duration).toBeLessThan(100);
        expect(result.performanceMs).toBeLessThan(100);
      }
    });

    test('should handle batch validation efficiently', async () => {
      const { batchValidate } = require('../lib/collaboration/llm-schemas.js');
      
      const validations = Array.from({ length: 10 }, (_, i) => ({
        content: `function test${i}() { return ${i}; }`,
        schemaName: 'javascriptCode',
        index: i
      }));
      
      const startTime = Date.now();
      const result = await batchValidate(validations, { concurrency: 3 });
      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeLessThan(500); // 50ms per validation max
      expect(result.summary.total).toBe(10);
      expect(result.summary.avgPerformance).toBeLessThan(100);
    });
  });

  describe('Real-time Feedback System', () => {
    test('should provide cached validation results', async () => {
      const testCode = 'function hello() { return "world"; }';
      
      // First validation
      const result1 = await validationFeedback.validateWithFeedback(testCode, {
        outputType: 'code'
      });
      
      // Second validation (should be cached)
      const result2 = await validationFeedback.validateWithFeedback(testCode, {
        outputType: 'code'
      });
      
      expect(result1.isValid).toBe(result2.isValid);
      expect(result2.fromCache).toBe(true);
      expect(result2.performanceMs).toBeLessThan(result1.performanceMs);
    });

    test('should track performance metrics', () => {
      const stats = validationFeedback.getPerformanceStats();
      
      expect(stats).toHaveProperty('avg');
      expect(stats).toHaveProperty('min');
      expect(stats).toHaveProperty('max');
      expect(stats).toHaveProperty('count');
      expect(stats).toHaveProperty('under100ms');
    });
  });

  describe('Security-focused Validation', () => {
    test('should detect XSS vulnerabilities', () => {
      const xssCode = `
        function displayMessage(msg) {
          document.getElementById('output').innerHTML = msg;
        }
      `;
      
      const result = validateLLMOutput(xssCode, 'code', {
        securityLevel: 'high'
      });
      
      expect(result.securityIssues.length).toBeGreaterThan(0);
      expect(result.securityIssues[0].code).toContain('SECURITY');
    });

    test('should detect SQL injection patterns', () => {
      const sqlCode = `
        function getUser(id) {
          const query = 'SELECT * FROM users WHERE id = ' + id;
          return db.query(query);
        }
      `;
      
      const result = validateLLMOutput(sqlCode, 'code', {
        securityLevel: 'critical'
      });
      
      expect(result.securityIssues.length).toBeGreaterThan(0);
    });

    test('should detect hardcoded secrets', () => {
      const secretCode = `
        const config = {
          apiKey: "sk-1234567890abcdef",
          password: "super_secret_password"
        };
      `;
      
      const result = validateLLMOutput(secretCode, 'code', {
        securityLevel: 'high'
      });
      
      expect(result.securityIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with Collaboration APIs', () => {
    test('should validate collaboration integration data', () => {
      const { validateCollaborationIntegration } = require('../lib/collaboration/validation.js');
      
      const collaborationData = {
        content: `
          function processTask(task) {
            if (!task || typeof task !== 'object') {
              throw new Error('Invalid task object');
            }
            return { status: 'processed', task };
          }
        `,
        outputType: 'code',
        language: 'javascript'
      };
      
      const result = validateCollaborationIntegration(collaborationData, 'process-full-task');
      
      expect(result.isValid).toBe(true);
      expect(result.collaborationReady).toBe(true);
      expect(result.performanceMs).toBeLessThan(100);
    });
  });
});