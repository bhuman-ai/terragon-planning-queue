import { useState, useEffect } from 'react';

export default function TaskCreationProgress({ show, taskId, onClose }) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [message, setMessage] = useState('Initializing...');
  const [isComplete, setIsComplete] = useState(false);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!show || !taskId) return;

    const eventSource = new EventSource(`/api/meta-agent/status/${taskId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      setLogs(prev => [...prev, {
        timestamp: new Date().toLocaleTimeString(),
        message: data.message,
        type: data.type
      }]);

      if (data.type === 'progress') {
        setProgress(data.progress);
        setCurrentStep(data.step);
        setMessage(data.message);
      } else if (data.type === 'complete') {
        setProgress(100);
        setMessage(data.message);
        setIsComplete(true);
        setTimeout(() => {
          eventSource.close();
        }, 2000);
      } else if (data.type === 'done') {
        eventSource.close();
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      setMessage('Connection lost - task may still be processing');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [show, taskId]);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '10px',
        padding: '30px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ color: '#00ff88', margin: 0 }}>
            🚀 Creating Task Structure
          </h2>
          {isComplete && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#999',
                fontSize: '24px',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div style={{
          background: '#333',
          height: '8px',
          borderRadius: '4px',
          marginBottom: '20px',
          overflow: 'hidden'
        }}>
          <div style={{
            background: isComplete ? '#00ff88' : '#00aaff',
            height: '100%',
            width: `${progress}%`,
            borderRadius: '4px',
            transition: 'width 0.5s ease, background 0.3s ease',
            boxShadow: isComplete ? '0 0 10px #00ff88' : '0 0 10px #00aaff'
          }} />
        </div>

        {/* Current Status */}
        <div style={{
          textAlign: 'center',
          marginBottom: '20px',
          padding: '15px',
          background: '#2a2a2a',
          borderRadius: '5px',
          border: '1px solid #444'
        }}>
          <div style={{
            fontSize: '18px',
            color: isComplete ? '#00ff88' : '#fff',
            marginBottom: '5px',
            fontWeight: 'bold'
          }}>
            {message}
          </div>
          <div style={{ fontSize: '14px', color: '#888' }}>
            {progress}% Complete
          </div>
        </div>

        {/* Activity Log */}
        <div style={{
          flex: 1,
          background: '#0a0a0a',
          padding: '15px',
          borderRadius: '5px',
          border: '1px solid #333',
          overflow: 'auto',
          fontFamily: 'Monaco, Menlo, monospace',
          fontSize: '12px'
        }}>
          <div style={{ color: '#666', marginBottom: '10px', fontSize: '11px' }}>
            ACTIVITY LOG
          </div>
          {logs.map((log, idx) => (
            <div key={idx} style={{
              marginBottom: '5px',
              color: log.type === 'complete' ? '#00ff88' :
                log.type === 'error' ? '#ff3300' : '#aaa'
            }}>
              <span style={{ color: '#666', marginRight: '10px' }}>
                [{log.timestamp}]
              </span>
              {log.message}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        {isComplete && (
          <div style={{
            marginTop: '20px',
            display: 'flex',
            gap: '10px',
            justifyContent: 'center'
          }}>
            <button
              onClick={() => {
                // Open task folder
                window.open(`/tasks/task-${taskId}`, '_blank');
              }}
              style={{
                background: '#00ff88',
                color: '#000',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              📁 Open Task Folder
            </button>
            <button
              onClick={onClose}
              style={{
                background: '#333',
                color: '#fff',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
