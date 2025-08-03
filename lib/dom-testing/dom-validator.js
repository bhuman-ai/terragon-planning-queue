/**
 * DOM Testing Validator for LLM-Generated UI Components
 * Provides objective binary pass/fail validation for UI elements
 */

const { JSDOM } = require('jsdom')

class DOMValidator {
  constructor(options = {}) {
    this.window = null
    this.document = null
    this.jquery = null
    this.options = {
      timeout: 5000,
      verbose: false,
      ...options
    }
  }

  /**
   * Initialize DOM environment
   * @param {string} html - HTML content to test
   * @param {Object} options - JSDOM options
   * @returns {void}
   */
  async initialize(html, options = {}) {
    const dom = new JSDOM(html, {
      url: 'http://localhost',
      runScripts: 'dangerously',
      resources: 'usable',
      ...options
    })

    this.window = dom.window
    this.document = dom.window.document
    
    // Wait for DOM to be ready
    await new Promise(resolve => {
      if (this.document.readyState === 'complete') {
        resolve()
      } else {
        this.window.addEventListener('load', resolve)
      }
    })
  }

  /**
   * Run DOM validation tests
   * @param {Object} testConfig - Test configuration
   * @returns {Object} Validation results
   */
  async validate(testConfig) {
    const results = {
      passed: true,
      tests: [],
      errors: [],
      metrics: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        executionTime: 0
      }
    }

    const startTime = Date.now()

    try {
      // Run element existence tests
      if (testConfig.elements) {
        await this.validateElements(testConfig.elements, results)
      }

      // Run attribute tests
      if (testConfig.attributes) {
        await this.validateAttributes(testConfig.attributes, results)
      }

      // Run interaction tests
      if (testConfig.interactions) {
        await this.validateInteractions(testConfig.interactions, results)
      }

      // Run accessibility tests
      if (testConfig.accessibility) {
        await this.validateAccessibility(testConfig.accessibility, results)
      }

      // Run state tests
      if (testConfig.states) {
        await this.validateStates(testConfig.states, results)
      }

      // Run custom assertions
      if (testConfig.assertions) {
        await this.validateAssertions(testConfig.assertions, results)
      }

      // Calculate final metrics
      results.metrics.executionTime = Date.now() - startTime
      results.passed = results.errors.length === 0

    } catch (error) {
      results.errors.push({
        type: 'validation-error',
        message: error.message,
        stack: error.stack
      })
      results.passed = false
    }

    return results
  }

  /**
   * Validate element existence
   */
  async validateElements(elementTests, results) {
    for (const test of elementTests) {
      const testResult = {
        name: test.name || `Element: ${test.selector}`,
        type: 'element-existence',
        passed: false,
        error: null
      }

      try {
        const element = this.document.querySelector(test.selector)
        
        if (test.exists === false) {
          testResult.passed = element === null
          if (!testResult.passed) {
            testResult.error = `Element "${test.selector}" should not exist but was found`
          }
        } else {
          testResult.passed = element !== null
          if (!testResult.passed) {
            testResult.error = `Element "${test.selector}" not found`
          }
        }

        // Check count if specified
        if (testResult.passed && test.count !== undefined) {
          const elements = this.document.querySelectorAll(test.selector)
          testResult.passed = elements.length === test.count
          if (!testResult.passed) {
            testResult.error = `Expected ${test.count} elements, found ${elements.length}`
          }
        }

        // Check text content if specified
        if (testResult.passed && test.text !== undefined && element) {
          const actualText = element.textContent.trim()
          if (test.text instanceof RegExp) {
            testResult.passed = test.text.test(actualText)
          } else {
            testResult.passed = actualText === test.text
          }
          if (!testResult.passed) {
            testResult.error = `Expected text "${test.text}", found "${actualText}"`
          }
        }

      } catch (error) {
        testResult.error = error.message
      }

      results.tests.push(testResult)
      results.metrics.totalTests++
      
      if (testResult.passed) {
        results.metrics.passedTests++
      } else {
        results.metrics.failedTests++
        results.errors.push(testResult)
      }
    }
  }

  /**
   * Validate element attributes
   */
  async validateAttributes(attributeTests, results) {
    for (const test of attributeTests) {
      const testResult = {
        name: test.name || `Attribute: ${test.selector} [${test.attribute}]`,
        type: 'attribute',
        passed: false,
        error: null
      }

      try {
        const element = this.document.querySelector(test.selector)
        
        if (!element) {
          testResult.error = `Element "${test.selector}" not found`
        } else {
          const actualValue = element.getAttribute(test.attribute)
          
          if (test.value === null) {
            testResult.passed = actualValue === null
            if (!testResult.passed) {
              testResult.error = `Attribute "${test.attribute}" should not exist`
            }
          } else if (test.value instanceof RegExp) {
            testResult.passed = test.value.test(actualValue || '')
            if (!testResult.passed) {
              testResult.error = `Attribute "${test.attribute}" value "${actualValue}" does not match pattern`
            }
          } else {
            testResult.passed = actualValue === test.value
            if (!testResult.passed) {
              testResult.error = `Expected attribute "${test.attribute}" to be "${test.value}", found "${actualValue}"`
            }
          }
        }

      } catch (error) {
        testResult.error = error.message
      }

      results.tests.push(testResult)
      results.metrics.totalTests++
      
      if (testResult.passed) {
        results.metrics.passedTests++
      } else {
        results.metrics.failedTests++
        results.errors.push(testResult)
      }
    }
  }

  /**
   * Validate interactions (clicks, inputs, etc.)
   */
  async validateInteractions(interactionTests, results) {
    for (const test of interactionTests) {
      const testResult = {
        name: test.name || `Interaction: ${test.action} on ${test.selector}`,
        type: 'interaction',
        passed: false,
        error: null
      }

      try {
        const element = this.document.querySelector(test.selector)
        
        if (!element) {
          testResult.error = `Element "${test.selector}" not found`
        } else {
          // Perform the interaction
          switch (test.action) {
            case 'click':
              element.click()
              break
            
            case 'focus':
              element.focus()
              break
            
            case 'blur':
              element.blur()
              break
            
            case 'input':
              if ('value' in element) {
                element.value = test.value || ''
                element.dispatchEvent(new this.window.Event('input', { bubbles: true }))
              } else {
                testResult.error = 'Element does not support input'
              }
              break
            
            case 'change':
              if ('value' in element) {
                element.value = test.value || ''
                element.dispatchEvent(new this.window.Event('change', { bubbles: true }))
              } else {
                testResult.error = 'Element does not support change events'
              }
              break
            
            default:
              testResult.error = `Unknown action: ${test.action}`
          }

          // Wait for any async effects
          if (test.wait) {
            await new Promise(resolve => setTimeout(resolve, test.wait))
          }

          // Validate the expected outcome
          if (!testResult.error && test.expect) {
            const validationResult = await this.validateExpectation(test.expect)
            testResult.passed = validationResult.passed
            testResult.error = validationResult.error
          } else if (!testResult.error) {
            testResult.passed = true
          }
        }

      } catch (error) {
        testResult.error = error.message
      }

      results.tests.push(testResult)
      results.metrics.totalTests++
      
      if (testResult.passed) {
        results.metrics.passedTests++
      } else {
        results.metrics.failedTests++
        results.errors.push(testResult)
      }
    }
  }

  /**
   * Validate accessibility requirements
   */
  async validateAccessibility(accessibilityTests, results) {
    for (const test of accessibilityTests) {
      const testResult = {
        name: test.name || `Accessibility: ${test.rule}`,
        type: 'accessibility',
        passed: false,
        error: null
      }

      try {
        switch (test.rule) {
          case 'alt-text':
            const images = this.document.querySelectorAll('img')
            const missingAlt = Array.from(images).filter(img => !img.hasAttribute('alt'))
            testResult.passed = missingAlt.length === 0
            if (!testResult.passed) {
              testResult.error = `${missingAlt.length} images missing alt text`
            }
            break
          
          case 'labels':
            const inputs = this.document.querySelectorAll('input, select, textarea')
            const unlabeled = Array.from(inputs).filter(input => {
              const id = input.id
              if (!id) return true
              const label = this.document.querySelector(`label[for="${id}"]`)
              return !label
            })
            testResult.passed = unlabeled.length === 0
            if (!testResult.passed) {
              testResult.error = `${unlabeled.length} form elements missing labels`
            }
            break
          
          case 'heading-order':
            const headings = this.document.querySelectorAll('h1, h2, h3, h4, h5, h6')
            let lastLevel = 0
            let validOrder = true
            
            headings.forEach(heading => {
              const level = parseInt(heading.tagName[1])
              if (level > lastLevel + 1) {
                validOrder = false
              }
              lastLevel = level
            })
            
            testResult.passed = validOrder
            if (!testResult.passed) {
              testResult.error = 'Invalid heading hierarchy'
            }
            break
          
          case 'aria-roles':
            if (test.selector) {
              const element = this.document.querySelector(test.selector)
              if (!element) {
                testResult.error = `Element "${test.selector}" not found`
              } else {
                const role = element.getAttribute('role')
                testResult.passed = role === test.expectedRole
                if (!testResult.passed) {
                  testResult.error = `Expected role "${test.expectedRole}", found "${role}"`
                }
              }
            }
            break
          
          default:
            testResult.error = `Unknown accessibility rule: ${test.rule}`
        }

      } catch (error) {
        testResult.error = error.message
      }

      results.tests.push(testResult)
      results.metrics.totalTests++
      
      if (testResult.passed) {
        results.metrics.passedTests++
      } else {
        results.metrics.failedTests++
        results.errors.push(testResult)
      }
    }
  }

  /**
   * Validate component states
   */
  async validateStates(stateTests, results) {
    for (const test of stateTests) {
      const testResult = {
        name: test.name || `State: ${test.selector}`,
        type: 'state',
        passed: false,
        error: null
      }

      try {
        const element = this.document.querySelector(test.selector)
        
        if (!element) {
          testResult.error = `Element "${test.selector}" not found`
        } else {
          // Check various state properties
          if (test.visible !== undefined) {
            const isVisible = element.offsetParent !== null && 
                            element.style.display !== 'none' &&
                            element.style.visibility !== 'hidden'
            testResult.passed = isVisible === test.visible
            if (!testResult.passed) {
              testResult.error = `Expected element to be ${test.visible ? 'visible' : 'hidden'}`
            }
          }
          
          if (testResult.passed && test.enabled !== undefined) {
            const isEnabled = !element.disabled
            testResult.passed = isEnabled === test.enabled
            if (!testResult.passed) {
              testResult.error = `Expected element to be ${test.enabled ? 'enabled' : 'disabled'}`
            }
          }
          
          if (testResult.passed && test.checked !== undefined) {
            testResult.passed = element.checked === test.checked
            if (!testResult.passed) {
              testResult.error = `Expected element to be ${test.checked ? 'checked' : 'unchecked'}`
            }
          }
          
          if (testResult.passed && test.selected !== undefined) {
            testResult.passed = element.selected === test.selected
            if (!testResult.passed) {
              testResult.error = `Expected element to be ${test.selected ? 'selected' : 'unselected'}`
            }
          }
          
          if (testResult.passed && test.className) {
            const hasClass = element.classList.contains(test.className)
            testResult.passed = hasClass === (test.hasClass !== false)
            if (!testResult.passed) {
              testResult.error = `Expected element to ${test.hasClass === false ? 'not ' : ''}have class "${test.className}"`
            }
          }
        }

      } catch (error) {
        testResult.error = error.message
      }

      results.tests.push(testResult)
      results.metrics.totalTests++
      
      if (testResult.passed) {
        results.metrics.passedTests++
      } else {
        results.metrics.failedTests++
        results.errors.push(testResult)
      }
    }
  }

  /**
   * Validate custom assertions
   */
  async validateAssertions(assertions, results) {
    for (const assertion of assertions) {
      const testResult = {
        name: assertion.name || 'Custom Assertion',
        type: 'assertion',
        passed: false,
        error: null
      }

      try {
        // Execute the assertion function in the DOM context
        const assertionFn = new this.window.Function('document', 'window', assertion.code)
        const result = await assertionFn(this.document, this.window)
        
        testResult.passed = result === true
        if (!testResult.passed) {
          testResult.error = assertion.errorMessage || `Assertion returned: ${result}`
        }

      } catch (error) {
        testResult.error = error.message
      }

      results.tests.push(testResult)
      results.metrics.totalTests++
      
      if (testResult.passed) {
        results.metrics.passedTests++
      } else {
        results.metrics.failedTests++
        results.errors.push(testResult)
      }
    }
  }

  /**
   * Validate expectation after interaction
   */
  async validateExpectation(expect) {
    const result = { passed: false, error: null }

    try {
      if (expect.selector) {
        const element = this.document.querySelector(expect.selector)
        
        if (!element && expect.exists !== false) {
          result.error = `Expected element "${expect.selector}" not found`
          return result
        }
        
        if (element && expect.exists === false) {
          result.error = `Element "${expect.selector}" should not exist`
          return result
        }
        
        if (element && expect.text !== undefined) {
          const actualText = element.textContent.trim()
          if (expect.text instanceof RegExp) {
            result.passed = expect.text.test(actualText)
          } else {
            result.passed = actualText === expect.text
          }
          if (!result.passed) {
            result.error = `Expected text "${expect.text}", found "${actualText}"`
          }
          return result
        }
        
        if (element && expect.attribute) {
          const actualValue = element.getAttribute(expect.attribute)
          result.passed = actualValue === expect.value
          if (!result.passed) {
            result.error = `Expected attribute "${expect.attribute}" to be "${expect.value}", found "${actualValue}"`
          }
          return result
        }
      }

      if (expect.custom) {
        const customFn = new this.window.Function('document', 'window', expect.custom)
        result.passed = await customFn(this.document, this.window) === true
        if (!result.passed) {
          result.error = expect.errorMessage || 'Custom expectation failed'
        }
        return result
      }

      result.passed = true

    } catch (error) {
      result.error = error.message
    }

    return result
  }

  /**
   * Cleanup DOM environment
   */
  cleanup() {
    if (this.window) {
      this.window.close()
      this.window = null
      this.document = null
    }
  }
}

module.exports = DOMValidator