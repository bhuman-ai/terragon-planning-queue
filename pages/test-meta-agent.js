import { useState } from 'react';

export default function TestMetaAgent() {
  const [testMessage, setTestMessage] = useState('implement user authentication');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState('process');

  async function testMetaAgent() {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/meta-agent/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action,
          message: testMessage,
          context: {}
        })
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: error.message });
    }

    setLoading(false);
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', background: '#0a0a0a', minHeight: '100vh', color: '#e0e0e0' }}>
      <h1 style={{ color: '#00ff88' }}>🧠 Meta-Agent Test Page</h1>
      <p style={{ marginBottom: '20px' }}>Test the Meta-Agent functionality without affecting Terragon</p>

      <div style={{ marginBottom: '20px', padding: '20px', background: '#1a1a1a', borderRadius: '10px', border: '1px solid #333' }}>
        <h2>Test Configuration</h2>
        
        <div style={{ marginBottom: '15px' }}>
          <label>Action:</label>
          <select 
            value={action} 
            onChange={(e) => setAction(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              marginTop: '5px',
              background: '#2a2a2a',
              border: '1px solid #444',
              color: '#fff',
              borderRadius: '5px'
            }}
          >
            <option value="classify">Classify (determine request type)</option>
            <option value="requirements">Requirements (gather questions)</option>
            <option value="research">Research (search with Perplexity)</option>
            <option value="process">Process (full enhancement)</option>
            <option value="enhance">Enhance (add context)</option>
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Test Message:</label>
          <textarea
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            rows="3"
            style={{ 
              width: '100%', 
              padding: '8px', 
              marginTop: '5px',
              background: '#2a2a2a',
              border: '1px solid #444',
              color: '#fff',
              borderRadius: '5px'
            }}
          />
        </div>

        <button
          onClick={testMetaAgent}
          disabled={loading || !testMessage}
          style={{
            padding: '10px 20px',
            background: loading ? '#666' : '#00ff88',
            color: loading ? '#ccc' : '#000',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {loading ? 'Processing...' : 'Test Meta-Agent'}
        </button>
      </div>

      {result && (
        <div style={{ padding: '20px', background: '#1a1a1a', borderRadius: '10px', border: '1px solid #333' }}>
          <h2>Result</h2>
          
          {result.error ? (
            <div style={{ color: '#ff6666' }}>
              <strong>Error:</strong> {result.error}
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '15px' }}>
                <strong style={{ color: '#00ff88' }}>Success!</strong>
                <span style={{ marginLeft: '10px', color: '#666' }}>Action: {result.action}</span>
              </div>

              {result.result && (
                <div>
                  {/* Classification Result */}
                  {result.result.classification && (
                    <div style={{ marginBottom: '15px', padding: '10px', background: '#2a2a2a', borderRadius: '5px' }}>
                      <h3>Classification</h3>
                      <p>Type: <strong style={{ color: '#00ff88' }}>{result.result.classification.type}</strong></p>
                      <p>Confidence: {result.result.classification.confidence}</p>
                      <p>Reasoning: {result.result.classification.reasoning}</p>
                    </div>
                  )}

                  {/* Requirements Result */}
                  {result.result.questions && (
                    <div style={{ marginBottom: '15px', padding: '10px', background: '#2a2a2a', borderRadius: '5px' }}>
                      <h3>Generated Questions ({result.result.questions.length})</h3>
                      {result.result.questions.map((q, idx) => (
                        <div key={idx} style={{ marginBottom: '10px', padding: '10px', background: '#1a1a1a', borderRadius: '5px' }}>
                          <strong>Q{idx + 1}: {q.question}</strong>
                          {q.options && (
                            <ul style={{ marginTop: '5px', marginLeft: '20px' }}>
                              {q.options.map((opt, i) => (
                                <li key={i}>{opt}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Research Result */}
                  {result.result.content && (
                    <div style={{ marginBottom: '15px', padding: '10px', background: '#2a2a2a', borderRadius: '5px' }}>
                      <h3>Research Result</h3>
                      <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>
                        {result.result.content.substring(0, 500)}...
                      </pre>
                    </div>
                  )}

                  {/* Process/Enhancement Result */}
                  {result.result.processedMessage && (
                    <div style={{ marginBottom: '15px', padding: '10px', background: '#2a2a2a', borderRadius: '5px' }}>
                      <h3>Processed Message</h3>
                      <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>
                        {result.result.processedMessage}
                      </pre>
                      {result.result.metadata && (
                        <div style={{ marginTop: '10px', padding: '10px', background: '#1a1a1a', borderRadius: '5px' }}>
                          <strong>Metadata:</strong>
                          <pre style={{ fontSize: '12px' }}>
                            {JSON.stringify(result.result.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Enhanced Message */}
                  {result.result.enhanced && (
                    <div style={{ marginBottom: '15px', padding: '10px', background: '#2a2a2a', borderRadius: '5px' }}>
                      <h3>Enhanced Message</h3>
                      <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>
                        {result.result.enhanced}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '40px', padding: '20px', background: '#1a1a1a', borderRadius: '10px', border: '1px solid #333' }}>
        <h2>How It Works</h2>
        <ul style={{ lineHeight: '1.8' }}>
          <li><strong>Classify:</strong> Determines if the message is INFO_REQUEST, ACTION_REQUEST, PLANNING_REQUEST, or STATUS_CHECK</li>
          <li><strong>Requirements:</strong> Generates clarifying questions based on the request type and research</li>
          <li><strong>Research:</strong> Uses Perplexity API to search for best practices and current information</li>
          <li><strong>Process:</strong> Full pipeline - classify → context → enhance</li>
          <li><strong>Enhance:</strong> Adds project context (task folders, tech stack, etc.) to the message</li>
        </ul>
      </div>
    </div>
  );
}