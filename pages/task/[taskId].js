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

    // Load saved messages for this task
    const savedMessages = localStorage.getItem(`task_messages_${taskId}`);
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages);
      } catch (e) {
        console.error('Error loading saved messages:', e);
      }
    }

    // Connect to SSE stream
    // Note: EventSource doesn't support custom headers directly
    // We'll use a query parameter instead
    const eventSource = new EventSource(`/api/stream/${taskId}?token=${encodeURIComponent(sessionToken)}`);

    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log('Connected to task stream');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'messages' && data.messages) {
          // Merge new messages with existing ones, avoiding duplicates
          setMessages(prevMessages => {
            const newMessages = [...prevMessages];
            const existingIds = new Set(prevMessages.map(m => m.id || m.timestamp));

            data.messages.forEach(newMsg => {
              const msgId = newMsg.id || newMsg.timestamp || Date.now() + Math.random();
              if (!existingIds.has(msgId)) {
                newMessages.push({ ...newMsg, id: msgId });
              }
            });

            // Save merged messages to localStorage
            localStorage.setItem(`task_messages_${taskId}`, JSON.stringify(newMessages));
            return newMessages;
          });
        } else if (data.type === 'new_message') {
          // Handle single new message
          const newMsg = { ...data.message, id: data.message.id || Date.now() + Math.random() };
          setMessages(prevMessages => {
            const updatedMessages = [...prevMessages, newMsg];
            localStorage.setItem(`task_messages_${taskId}`, JSON.stringify(updatedMessages));
            return updatedMessages;
          });
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

      // Try to reconnect after a delay
      setTimeout(() => {
        if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
          // Reconnect if not already connected
          const newEventSource = new EventSource(`/api/stream/${taskId}?token=${encodeURIComponent(sessionToken)}`);
          eventSourceRef.current = newEventSource;

          // Re-attach event handlers (recursive call to this useEffect would be cleaner but this works)
          newEventSource.onopen = () => setIsConnected(true);
          newEventSource.onmessage = eventSource.onmessage;
          newEventSource.onerror = eventSource.onerror;
        }
      }, 3000);
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

    const messageText = inputMessage.trim();
    setIsLoading(true);
    setInputMessage('');

    // Immediately add user message to UI
    const userMessage = {
      id: Date.now() + Math.random(),
      type: 'user',
      content: messageText,
      timestamp: new Date().toISOString()
    };

    setMessages(prevMessages => {
      const updatedMessages = [...prevMessages, userMessage];
      localStorage.setItem(`task_messages_${taskId}`, JSON.stringify(updatedMessages));
      return updatedMessages;
    });

    const sessionToken = localStorage.getItem('terragonSession');

    try {
      const response = await fetch(`/api/task/${taskId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionToken,
          message: messageText
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to send message:', error);
        alert(`Failed to send message: ${error}`.error);

        // Remove the user message if sending failed
        setMessages(prevMessages => {
          const filteredMessages = prevMessages.filter(m => m.id !== userMessage.id);
          localStorage.setItem(`task_messages_${taskId}`, JSON.stringify(filteredMessages));
          return filteredMessages;
        });
      }
      // The SSE stream will handle assistant responses
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message');

      // Remove the user message if sending failed
      setMessages(prevMessages => {
        const filteredMessages = prevMessages.filter(m => m.id !== userMessage.id);
        localStorage.setItem(`task_messages_${taskId}`, JSON.stringify(filteredMessages));
        return filteredMessages;
      });
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
            gap: '15px',
            marginLeft: 'auto'
          }}>
            {messages.length > 0 && (
              <button
                onClick={() => {
                  setMessages([]);
                  localStorage.removeItem(`task_messages_${taskId}`);
                }}
                style={{
                  padding: '5px 10px',
                  background: '#ff3300',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '3px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Clear Messages
              </button>
            )}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
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
        </div>

        <div style={{ marginBottom: '10px', textAlign: 'center' }}>
          <a
            href={`https://www.terragonlabs.com/task/${taskId}`}
            target='_blank'
            rel='noopener noreferrer'
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
              type='text'
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder='Type a message...'
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
