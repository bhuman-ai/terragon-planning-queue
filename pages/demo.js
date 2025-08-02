import { useState, useEffect } from 'react';

export default function Demo() {
  const [step, setStep] = useState(0);
  const [taskId, setTaskId] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState({});

  async function runDemo() {
    setStep(1);
    setLoading(true);
    
    // Step 1: Create Task
    const createPayload = {
      sessionToken: 'demo-token',
      message: 'Create a simple hello world function in JavaScript',
      githubRepoFullName: 'bhuman-ai/gesture_generator',
      repoBaseBranchName: 'main'
    };
    
    setCode({ step1Request: createPayload });
    
    // Simulate API call
    await new Promise(r => setTimeout(r, 1000));
    
    const createResponse = {
      success: true,
      status: 200,
      taskId: '7de350d4-322b-4fbf-bd84-43b784f35c10',
      terragonUrl: 'https://www.terragonlabs.com/task/7de350d4-322b-4fbf-bd84-43b784f35c10',
      responseFormat: 'streaming',
      linesCount: 3
    };
    
    setTaskId(createResponse.taskId);
    setCode(prev => ({ ...prev, step1Response: createResponse }));
    setStep(2);
    
    // Step 2: Get Messages
    await new Promise(r => setTimeout(r, 1500));
    
    const streamResponse = {
      type: 'messages',
      taskId: createResponse.taskId,
      messages: [
        {
          type: 'user',
          content: 'Create a simple hello world function in JavaScript',
          timestamp: '2025-08-02T14:35:36.486Z'
        },
        {
          type: 'assistant',
          content: `Here's a simple hello world function in JavaScript:\n\n\`\`\`javascript\nfunction helloWorld() {\n  console.log("Hello, World!");\n}\n\n// Call the function\nhelloWorld();\n\`\`\``,
          timestamp: '2025-08-02T14:35:38.123Z'
        }
      ]
    };
    
    setMessages(streamResponse.messages);
    setCode(prev => ({ ...prev, step2Response: streamResponse }));
    setStep(3);
    
    // Step 3: Send Follow-up
    await new Promise(r => setTimeout(r, 1000));
    
    const followUpPayload = {
      sessionToken: 'demo-token',
      message: 'Can you make it print the current date as well?'
    };
    
    setCode(prev => ({ ...prev, step3Request: followUpPayload }));
    
    await new Promise(r => setTimeout(r, 1000));
    
    const followUpResponse = {
      success: true,
      status: 200,
      taskId: createResponse.taskId,
      message: 'Message sent successfully'
    };
    
    setCode(prev => ({ ...prev, step3Response: followUpResponse }));
    setStep(4);
    
    // Step 4: Get Updated Messages
    await new Promise(r => setTimeout(r, 1500));
    
    const updatedMessages = [
      ...streamResponse.messages,
      {
        type: 'user',
        content: 'Can you make it print the current date as well?',
        timestamp: '2025-08-02T14:36:45.123Z'
      },
      {
        type: 'assistant',
        content: `Sure! Here's the updated function that also prints the current date:\n\n\`\`\`javascript\nfunction helloWorld() {\n  console.log("Hello, World!");\n  console.log("Current date:", new Date().toLocaleString());\n}\n\n// Call the function\nhelloWorld();\n\`\`\``,
        timestamp: '2025-08-02T14:36:47.456Z'
      }
    ];
    
    setMessages(updatedMessages);
    setCode(prev => ({ ...prev, step4Response: { messages: updatedMessages } }));
    setStep(5);
    setLoading(false);
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>🚀 Terragon API Flow Live Demo</h1>
      <p>This demonstrates how the full Terragon integration works</p>
      
      <button 
        onClick={runDemo} 
        disabled={loading}
        style={{
          padding: '15px 30px',
          fontSize: '18px',
          background: loading ? '#666' : '#00ff88',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '20px'
        }}
      >
        {loading ? 'Running Demo...' : 'Start Live Demo'}
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left: Flow Steps */}
        <div>
          <h2>Flow Progress</h2>
          
          <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px' }}>
            {[
              { num: 1, title: 'Create Task', desc: 'Send initial message to Terragon' },
              { num: 2, title: 'Get Messages', desc: 'Stream AI response via SSE' },
              { num: 3, title: 'Send Follow-up', desc: 'Continue conversation' },
              { num: 4, title: 'Get Updated Messages', desc: 'Receive follow-up response' },
              { num: 5, title: 'Complete', desc: 'Full conversation flow working!' }
            ].map(s => (
              <div key={s.num} style={{
                padding: '15px',
                marginBottom: '10px',
                background: step >= s.num ? '#e6ffe6' : 'white',
                border: '2px solid ' + (step === s.num ? '#00ff88' : '#ddd'),
                borderRadius: '8px',
                opacity: step >= s.num ? 1 : 0.5
              }}>
                <strong>Step {s.num}: {s.title}</strong>
                <div style={{ color: '#666', fontSize: '14px' }}>{s.desc}</div>
              </div>
            ))}
          </div>

          {/* Messages Display */}
          {messages.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3>Conversation</h3>
              <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
                {messages.map((msg, idx) => (
                  <div key={idx} style={{
                    marginBottom: '10px',
                    padding: '10px',
                    background: msg.type === 'user' ? '#e6f3ff' : '#f0f0f0',
                    borderRadius: '5px',
                    borderLeft: `3px solid ${msg.type === 'user' ? '#0066cc' : '#666'}`
                  }}>
                    <strong>{msg.type === 'user' ? 'User' : 'Assistant'}:</strong>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{msg.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: API Details */}
        <div>
          <h2>API Request/Response</h2>
          
          <div style={{ background: '#1e1e1e', color: '#fff', padding: '20px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px', overflow: 'auto', maxHeight: '600px' }}>
            {step >= 1 && code.step1Request && (
              <>
                <div style={{ color: '#00ff88', marginBottom: '5px' }}>// Step 1: Create Task</div>
                <div style={{ color: '#ff9' }}>POST /api/actions/terragon</div>
                <pre style={{ color: '#8cf' }}>{JSON.stringify(code.step1Request, null, 2)}</pre>
              </>
            )}
            
            {step >= 2 && code.step1Response && (
              <>
                <div style={{ color: '#00ff88', marginTop: '20px' }}>// Response:</div>
                <pre style={{ color: '#8f8' }}>{JSON.stringify(code.step1Response, null, 2)}</pre>
              </>
            )}
            
            {step >= 2 && (
              <>
                <div style={{ color: '#00ff88', marginTop: '20px' }}>// Step 2: Stream Messages</div>
                <div style={{ color: '#ff9' }}>GET /api/stream/{taskId}?token=...</div>
              </>
            )}
            
            {step >= 3 && code.step2Response && (
              <>
                <div style={{ color: '#00ff88', marginTop: '10px' }}>// SSE Response:</div>
                <pre style={{ color: '#8f8' }}>data: {JSON.stringify(code.step2Response, null, 2)}</pre>
              </>
            )}
            
            {step >= 3 && code.step3Request && (
              <>
                <div style={{ color: '#00ff88', marginTop: '20px' }}>// Step 3: Send Follow-up</div>
                <div style={{ color: '#ff9' }}>POST /api/task/{taskId}/message</div>
                <pre style={{ color: '#8cf' }}>{JSON.stringify(code.step3Request, null, 2)}</pre>
              </>
            )}
            
            {step >= 4 && code.step3Response && (
              <>
                <div style={{ color: '#00ff88', marginTop: '10px' }}>// Response:</div>
                <pre style={{ color: '#8f8' }}>{JSON.stringify(code.step3Response, null, 2)}</pre>
              </>
            )}
            
            {step >= 5 && (
              <div style={{ color: '#0f0', marginTop: '20px', fontSize: '16px' }}>
                ✅ Full flow completed successfully!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}