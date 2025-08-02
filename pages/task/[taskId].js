import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

export default function TaskDetail() {
  const router = useRouter();
  const { taskId } = router.query;
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const eventSourceRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!taskId) return;

    const sessionToken = localStorage.getItem('terragonSession');
    if (!sessionToken) {
      router.push('/');
      return;
    }

    // Connect to SSE stream
    const eventSource = new EventSource(`/api/stream/${taskId}`, {
      headers: {
        'X-Session-Token': sessionToken
      }
    });

    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log('Connected to task stream');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'messages' && data.messages) {
          setMessages(data.messages);
        } else if (data.type === 'heartbeat') {
          // Keep alive
        } else if (data.type === 'error') {
          console.error('Stream error:', data.error);
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      setIsConnected(false);
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [taskId, router]);

  useEffect(() => {
    // Scroll to bottom when messages update
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!inputMessage.trim() || isLoading) return;

    setIsLoading(true);
    const sessionToken = localStorage.getItem('terragonSession');

    try {
      const response = await fetch(`/api/task/${taskId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionToken,
          message: inputMessage
        })
      });

      if (response.ok) {
        setInputMessage('');
        // The SSE stream will automatically update with new messages
      } else {
        const error = await response.json();
        console.error('Failed to send message:', error);
        alert('Failed to send message: ' + error.error);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e0e0e0', padding: '20px' }}>
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
      `}</style>

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
          <button 
            onClick={() => router.push('/')}
            style={{
              padding: '8px 16px',
              background: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            ← Back
          </button>
          <h1 style={{ color: '#00ff88' }}>Task Conversation</h1>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: 'auto'
          }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: isConnected ? '#00ff88' : '#ff3300'
            }}></span>
            <span style={{ fontSize: '14px' }}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div style={{ marginBottom: '10px', textAlign: 'center' }}>
          <a 
            href={`https://www.terragonlabs.com/task/${taskId}`} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#00ff88', fontSize: '14px' }}
          >
            View on Terragon →
          </a>
        </div>

        <div style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '10px',
          height: '60vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px'
          }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
                Waiting for messages...
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} style={{
                  marginBottom: '15px',
                  padding: '12px',
                  background: msg.type === 'user' ? '#00ff8822' : '#00aaff22',
                  borderLeft: `3px solid ${msg.type === 'user' ? '#00ff88' : '#00aaff'}`,
                  borderRadius: '5px'
                }}>
                  <div style={{ 
                    fontWeight: 'bold', 
                    marginBottom: '5px',
                    color: msg.type === 'user' ? '#00ff88' : '#00aaff',
                    textTransform: 'uppercase',
                    fontSize: '12px'
                  }}>
                    {msg.type || 'system'}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content || msg.text || msg.message || JSON.stringify(msg)}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={{
            borderTop: '1px solid #333',
            padding: '15px',
            display: 'flex',
            gap: '10px'
          }}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '10px',
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '5px',
                color: '#e0e0e0',
                fontSize: '16px'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim()}
              style={{
                padding: '10px 20px',
                background: isLoading ? '#666' : '#00ff88',
                color: '#0a0a0a',
                border: 'none',
                borderRadius: '5px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}