import { useState } from 'react';

export default function TestPage() {
  const [sessionToken, setSessionToken] = useState('');
  const [taskId, setTaskId] = useState('');
  const [message, setMessage] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  function addResult(result) {
    setResults(prev => [...prev, { 
      time: new Date().toLocaleTimeString(), 
      ...result 
    }]);
  }

  async function testCreateTask() {
    setLoading(true);
    try {
      const response = await fetch('/api/actions/terragon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          message: message || 'Create a simple hello world function',
          githubRepoFullName: 'bhuman-ai/gesture_generator',
          repoBaseBranchName: 'main'
        })
      });
      
      const result = await response.json();
      setTaskId(result.taskId || '');
      addResult({ 
        type: 'Create Task', 
        success: result.success, 
        taskId: result.taskId,
        url: result.terragonUrl,
        details: result
      });
    } catch (error) {
      addResult({ type: 'Create Task', error: error.message });
    }
    setLoading(false);
  }

  async function testGetMessages() {
    if (!taskId) {
      alert('Please create a task first or enter a task ID');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/stream/${taskId}?token=${encodeURIComponent(sessionToken)}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let messageData = null;
      const { done, value } = await reader.read();
      
      if (!done) {
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.type === 'messages') {
                messageData = data;
                break;
              }
            } catch (e) {}
          }
        }
      }
      
      reader.cancel();
      
      if (messageData) {
        addResult({ 
          type: 'Get Messages', 
          success: true,
          messageCount: messageData.messages.length,
          messages: messageData.messages
        });
      } else {
        addResult({ type: 'Get Messages', error: 'No messages found' });
      }
    } catch (error) {
      addResult({ type: 'Get Messages', error: error.message });
    }
    setLoading(false);
  }

  async function testSendMessage() {
    if (!taskId) {
      alert('Please create a task first or enter a task ID');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/task/${taskId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          message: message || 'Can you add error handling?'
        })
      });
      
      const result = await response.json();
      addResult({ 
        type: 'Send Message', 
        success: result.success,
        details: result
      });
    } catch (error) {
      addResult({ type: 'Send Message', error: error.message });
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Terragon API Test Page</h1>
      
      <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Configuration</h2>
        <div style={{ marginBottom: '10px' }}>
          <label>Session Token:</label>
          <input
            type="password"
            value={sessionToken}
            onChange={(e) => setSessionToken(e.target.value)}
            placeholder="Paste your __Secure-better-auth.session_token here"
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label>Task ID (auto-filled after create):</label>
          <input
            type="text"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            placeholder="Task ID"
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label>Message:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your message"
            rows="3"
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={testCreateTask} 
          disabled={loading || !sessionToken}
          style={{ padding: '10px 20px', background: '#00ff88', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          1. Create Task
        </button>
        
        <button 
          onClick={testGetMessages} 
          disabled={loading || !sessionToken || !taskId}
          style={{ padding: '10px 20px', background: '#00aaff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          2. Get Messages
        </button>
        
        <button 
          onClick={testSendMessage} 
          disabled={loading || !sessionToken || !taskId}
          style={{ padding: '10px 20px', background: '#ffaa00', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          3. Send Message
        </button>
        
        <button 
          onClick={() => setResults([])}
          style={{ padding: '10px 20px', background: '#ff3366', border: 'none', borderRadius: '5px', cursor: 'pointer', marginLeft: 'auto' }}
        >
          Clear Results
        </button>
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', background: '#f5f5f5' }}>
        <h2>Results</h2>
        {results.length === 0 ? (
          <p>No results yet. Run a test above.</p>
        ) : (
          results.map((result, idx) => (
            <div key={idx} style={{ 
              marginBottom: '15px', 
              padding: '10px', 
              background: result.error ? '#ffe6e6' : '#e6ffe6',
              border: '1px solid ' + (result.error ? '#ff9999' : '#99ff99'),
              borderRadius: '5px'
            }}>
              <strong>{result.time} - {result.type}</strong>
              {result.error && <div style={{ color: 'red' }}>Error: {result.error}</div>}
              {result.success && <div style={{ color: 'green' }}>Success!</div>}
              {result.taskId && <div>Task ID: <code>{result.taskId}</code></div>}
              {result.url && <div>URL: <a href={result.url} target="_blank">{result.url}</a></div>}
              {result.messageCount !== undefined && <div>Messages: {result.messageCount}</div>}
              {result.messages && (
                <details style={{ marginTop: '10px' }}>
                  <summary>View Messages</summary>
                  <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                    {JSON.stringify(result.messages, null, 2)}
                  </pre>
                </details>
              )}
              {result.details && (
                <details style={{ marginTop: '10px' }}>
                  <summary>Full Response</summary>
                  <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}