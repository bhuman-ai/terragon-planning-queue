import { useState, useEffect } from 'react';

export default function TaskMonitorDashboard({ show, onClose }) {
  const [activeTasks, setActiveTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchActiveTasks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/task/active/list');
      const data = await response.json();
      
      if (data.success) {
        setActiveTasks(data.tasks);
        setLastUpdated(data.lastUpdated);
      }
    } catch (error) {
      console.error('Error fetching active tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResumeTask = async (taskId, userInput) => {
    try {
      const response = await fetch('/api/task/active/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          userInput,
          resumeContext: { source: 'dashboard' }
        })
      });

      if (response.ok) {
        fetchActiveTasks(); // Refresh list
      }
    } catch (error) {
      console.error('Error resuming task:', error);
    }
  };

  useEffect(() => {
    if (show) {
      fetchActiveTasks();
      const interval = setInterval(fetchActiveTasks, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [show]);

  if (!show) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'executing': return '#00aaff';
      case 'paused': return '#ff9500';
      case 'completed': return '#00ff88';
      case 'failed': return '#ff4444';
      default: return '#888';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'executing': return '⚙️';
      case 'paused': return '⏸️';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '❓';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '10px',
        width: '90vw',
        maxWidth: '800px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        color: '#e0e0e0'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ 
              color: '#00aaff', 
              margin: 0,
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              🤖 Autonomous Task Monitor
            </h2>
            <div style={{ 
              fontSize: '14px', 
              color: '#888',
              marginTop: '5px' 
            }}>
              {activeTasks.length} active tasks • Updates every 5 minutes
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={fetchActiveTasks}
              disabled={loading}
              style={{
                padding: '6px 12px',
                backgroundColor: '#333',
                border: '1px solid #555',
                borderRadius: '5px',
                color: '#ccc',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '12px'
              }}
            >
              {loading ? '⟳' : '🔄'} Refresh
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#666',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '5px'
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Task List */}
        <div style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto'
        }}>
          {loading && activeTasks.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
              Loading tasks...
            </div>
          ) : activeTasks.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>🏖️</div>
              <div>No active autonomous tasks</div>
              <div style={{ fontSize: '14px', marginTop: '5px' }}>
                Tasks will appear here when they start executing autonomously
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {activeTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onResume={handleResumeTask}
                  getStatusColor={getStatusColor}
                  getStatusIcon={getStatusIcon}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {lastUpdated && (
          <div style={{
            padding: '15px 20px',
            borderTop: '1px solid #333',
            fontSize: '12px',
            color: '#666',
            textAlign: 'center'
          }}>
            Last updated: {new Date(lastUpdated).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, onResume, getStatusColor, getStatusIcon }) {
  const [showResumeInput, setShowResumeInput] = useState(false);
  const [resumeInput, setResumeInput] = useState('');

  const handleResume = () => {
    if (resumeInput.trim()) {
      onResume(task.id, resumeInput.trim());
      setShowResumeInput(false);
      setResumeInput('');
    }
  };

  return (
    <div style={{
      backgroundColor: '#0f0f0f',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '15px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '10px'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '5px'
          }}>
            <span style={{ fontSize: '16px' }}>{getStatusIcon(task.status)}</span>
            <h4 style={{ 
              margin: 0, 
              color: '#fff',
              fontSize: '16px'
            }}>
              {task.title}
            </h4>
            <span style={{
              fontSize: '12px',
              padding: '2px 6px',
              backgroundColor: getStatusColor(task.status) + '22',
              color: getStatusColor(task.status),
              borderRadius: '10px',
              textTransform: 'uppercase',
              fontWeight: 'bold'
            }}>
              {task.status}
            </span>
          </div>
          
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
            Started: {new Date(task.createdAt).toLocaleString()} • Step {task.currentStep}
          </div>

          {task.pauseReason && (
            <div style={{
              backgroundColor: '#ff950022',
              border: '1px solid #ff9500',
              borderRadius: '5px',
              padding: '8px',
              marginBottom: '10px'
            }}>
              <div style={{ fontSize: '12px', color: '#ff9500', fontWeight: 'bold' }}>
                ⏸️ PAUSED - NEEDS INPUT:
              </div>
              <div style={{ fontSize: '14px', color: '#fff', marginTop: '3px' }}>
                {task.pauseReason}
              </div>
            </div>
          )}
        </div>
      </div>

      {task.status === 'paused' && (
        <div style={{ marginTop: '10px' }}>
          {!showResumeInput ? (
            <button
              onClick={() => setShowResumeInput(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#00ff88',
                color: '#000',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              ▶️ Provide Input & Resume
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <textarea
                value={resumeInput}
                onChange={(e) => setResumeInput(e.target.value)}
                placeholder="Enter your response to resume the task..."
                style={{
                  width: '100%',
                  minHeight: '60px',
                  padding: '10px',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #555',
                  borderRadius: '5px',
                  color: '#fff',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleResume}
                  disabled={!resumeInput.trim()}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: resumeInput.trim() ? '#00ff88' : '#333',
                    color: resumeInput.trim() ? '#000' : '#666',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: resumeInput.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  ▶️ Resume Task
                </button>
                <button
                  onClick={() => {
                    setShowResumeInput(false);
                    setResumeInput('');
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    color: '#888',
                    border: '1px solid #555',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}