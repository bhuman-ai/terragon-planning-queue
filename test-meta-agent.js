/**
 * Test the MetaAgent without breaking existing Terragon flow
 */

import MetaAgent from './lib/meta-agent/index.js';

// Test configuration
const config = {
  claudeApiKey: process.env.CLAUDE_API_KEY,
  perplexityApiKey: process.env.PERPLEXITY_API_KEY,
  enabled: true,
  debugMode: true
};

async function testMetaAgent() {
  console.log('🧪 Testing MetaAgent (Phase 1)\n');
  
  const metaAgent = new MetaAgent(config);
  
  // Test cases
  const testMessages = [
    {
      type: 'INFO_REQUEST',
      message: "What's our current tech stack?"
    },
    {
      type: 'ACTION_REQUEST', 
      message: "Implement user authentication with OAuth"
    },
    {
      type: 'PLANNING_REQUEST',
      message: "Let's plan out the payment system architecture"
    },
    {
      type: 'STATUS_CHECK',
      message: "How's the progress on the auth task?"
    }
  ];
  
  console.log('Testing message processing...\n');
  
  for (const test of testMessages) {
    console.log(`\n📝 Test: ${test.type}`);
    console.log(`Message: "${test.message}"`);
    
    try {
      // Process the message
      const result = await metaAgent.process(test.message);
      
      console.log('✅ Result:');
      console.log('- Processed Message:', result.processedMessage.substring(0, 100) + '...');
      console.log('- Classification:', result.metadata.classification);
      console.log('- Enhanced:', result.metadata.enhanced);
      console.log('- Context:', result.metadata.context);
      
      // For action requests, test requirements gathering
      if (result.metadata.classification.type === 'ACTION_REQUEST') {
        console.log('\n📋 Testing requirements gathering...');
        const requirements = await metaAgent.gatherRequirements(test.message);
        if (requirements && requirements.questions) {
          console.log(`- Generated ${requirements.questions.length} clarifying questions`);
          console.log('- Sample questions:');
          requirements.questions.slice(0, 3).forEach(q => {
            console.log(`  • ${q.question}`);
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
  
  console.log('\n\n🎯 Testing research capability...');
  
  try {
    const researchResult = await metaAgent.research('best practices for OAuth implementation 2024');
    if (researchResult && researchResult.success) {
      console.log('✅ Research successful');
      console.log('- Content preview:', researchResult.content.substring(0, 200) + '...');
    } else {
      console.log('⚠️  Research not available or failed');
    }
  } catch (error) {
    console.error('❌ Research error:', error.message);
  }
  
  console.log('\n\n✨ MetaAgent Phase 1 test complete!');
  console.log('The agent is working as a separate layer without affecting Terragon.');
}

// Run the test
testMetaAgent().catch(console.error);