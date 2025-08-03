// LLM-Generated Code
// This is a test component to validate our objective testing system

import React from 'react';

// Test component with intentional issues for validation
const TestComponent = ({ data }) => {
  // Missing error handling - should fail validation
  const processData = () => {
    console.log('Processing data:', data); // Console in production
    return data.map(item => item.value); // No null check
  };

  // Deeply nested code - should fail complexity check
  const complexFunction = (input) => {
    if (input) {
      if (input.type === 'special') {
        if (input.value > 10) {
          if (input.category === 'A') {
            // Too deeply nested
            return 'Special A';
          }
        }
      }
    }
  };

  // Missing return statement validation
  const noReturn = () => {
    const value = 42;
    // Should have explicit return
  };

  // Simulated functionality - violates sacred principles
  const mockData = () => {
    // This simulates user behavior
    return { fake: true };
  };

  return (
    <div>
      <h1>Test Component</h1>
      {processData()}
    </div>
  );
};

export default TestComponent;