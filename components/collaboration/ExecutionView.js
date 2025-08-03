import { useState, useEffect, useRef } from 'react';

/**
 * ExecutionView - Real-time monitoring with Checkpoint.md
 * 
 * Features:
 * - Live execution monitoring and logs
 * - Checkpoint.md document tracking
 * - Agent performance metrics
 * - Error detection and recovery
 * - Resource usage monitoring
 */
export default function ExecutionView({
  sessionId,
  agentAuth,
  onExecutionUpdate,
  taskId = null,
  readonly = false
}) {
  const [checkpointDocument, setCheckpointDocument] = useState('');
  const [executionLogs, setExecutionLogs] = useState([]);
  const [activeAgents, setActiveAgents] = useState([]);
  const [systemMetrics, setSystemMetrics] = useState({});
  const [errorLogs, setErrorLogs] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filterLevel, setFilterLevel] = useState('all'); // 'all', 'info', 'warn', 'error'
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [executionProgress, setExecutionProgress] = useState({});
  const [checkpointHistory, setCheckpointHistory] = useState([]);
  const [realTimeData, setRealTimeData] = useState({
    messagesPerSecond: 0,
    activeConnections: 0,
    memoryUsage: 0,
    cpuUsage: 0
  });
  
  const logsEndRef = useRef(null);
  const wsRef = useRef(null);
  const metricsIntervalRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [executionLogs, autoScroll]);

  // Initialize monitoring
  useEffect(() => {
    if (sessionId) {
      initializeMonitoring();
      return () => {
        cleanup();
      };
    }
  }, [sessionId]);

  const initializeMonitoring = async () => {
    try {
      // Load initial checkpoint data
      await loadCheckpointData();
      
      // Start WebSocket connection for real-time updates
      startWebSocketConnection();
      
      // Start metrics collection
      startMetricsCollection();
      
      setIsMonitoring(true);
      addSystemLog('Monitoring initialized', 'info');
      
    } catch (error) {
      console.error('Failed to initialize monitoring:', error);
      addSystemLog(`Initialization failed: ${error.message}`, 'error');
    }
  };

  const loadCheckpointData = async () => {
    try {
      const response = await fetch('/api/collaboration/execution/checkpoint', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          taskId,
          action: 'load'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCheckpointDocument(data.document || '');
        setExecutionProgress(data.progress || {});
        setCheckpointHistory(data.history || []);
        setActiveAgents(data.activeAgents || []);
      }
    } catch (error) {
      console.error('Failed to load checkpoint data:', error);
    }
  };

  const startWebSocketConnection = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/collaboration/execution/stream?sessionId=${sessionId}&auth=${agentAuth}`;
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      addSystemLog('Real-time connection established', 'info');
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleRealtimeUpdate(data);
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };

    wsRef.current.onclose = () => {
      addSystemLog('Real-time connection closed', 'warn');
      // Attempt reconnection after 5 seconds
      setTimeout(() => {
        if (isMonitoring) {
          startWebSocketConnection();
        }
      }, 5000);
    };

    wsRef.current.onerror = (error) => {
      addSystemLog('WebSocket error occurred', 'error');
    };
  };

  const startMetricsCollection = () => {
    metricsIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/collaboration/execution/metrics', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Agent-Auth': agentAuth
          },
          body: JSON.stringify({ sessionId })
        });

        if (response.ok) {
          const metrics = await response.json();
          setSystemMetrics(metrics);
          setRealTimeData(prev => ({
            ...prev,
            memoryUsage: metrics.memory?.usage || 0,
            cpuUsage: metrics.cpu?.usage || 0,
            activeConnections: metrics.connections?.active || 0
          }));
        }
      } catch (error) {
        console.error('Failed to collect metrics:', error);
      }
    }, 2000); // Update every 2 seconds
  };

  const handleRealtimeUpdate = (data) => {
    switch (data.type) {
      case 'log':
        addExecutionLog(data.log);
        break;
      case 'agent_status':
        updateAgentStatus(data.agent);
        break;
      case 'checkpoint':
        updateCheckpoint(data.checkpoint);
        break;
      case 'progress':
        setExecutionProgress(prev => ({ ...prev, ...data.progress }));
        break;
      case 'error':
        addErrorLog(data.error);
        break;
      case 'metrics':
        setRealTimeData(prev => ({ ...prev, ...data.metrics }));
        break;
      default:
        console.log('Unknown realtime update:', data);
    }
  };

  const addExecutionLog = (log) => {
    const logEntry = {
      id: Date.now().toString() + Math.random(),
      timestamp: new Date().toISOString(),
      level: log.level || 'info',
      source: log.source || 'system',
      message: log.message,
      context: log.context,
      agentId: log.agentId
    };

    setExecutionLogs(prev => [...prev, logEntry].slice(-1000)); // Keep last 1000 logs
    
    if (log.level === 'error') {
      addErrorLog(log);
    }

    onExecutionUpdate?.({ type: 'log', data: logEntry });
  };

  const addErrorLog = (error) => {
    const errorEntry = {
      id: Date.now().toString() + Math.random(),
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      agentId: error.agentId,
      context: error.context,
      resolved: false
    };

    setErrorLogs(prev => [...prev, errorEntry].slice(-100)); // Keep last 100 errors
  };

  const addSystemLog = (message, level = 'info') => {
    addExecutionLog({
      message,
      level,
      source: 'monitoring_system'
    });
  };

  const updateAgentStatus = (agentUpdate) => {
    setActiveAgents(prev => {
      const updated = prev.map(agent => 
        agent.id === agentUpdate.id 
          ? { ...agent, ...agentUpdate }
          : agent
      );
      
      // Add new agent if not exists
      if (!updated.find(a => a.id === agentUpdate.id)) {
        updated.push(agentUpdate);
      }
      
      return updated;
    });
  };

  const updateCheckpoint = async (checkpoint) => {
    try {
      // Update checkpoint document
      const response = await fetch('/api/collaboration/execution/checkpoint', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          taskId,
          action: 'update',
          checkpoint
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCheckpointDocument(data.document);
        setCheckpointHistory(prev => [checkpoint, ...prev.slice(0, 49)]);
        addSystemLog(`Checkpoint created: ${checkpoint.description || 'Auto-save'}`, 'info');
      }
    } catch (error) {
      console.error('Failed to update checkpoint:', error);
      addSystemLog(`Checkpoint update failed: ${error.message}`, 'error');
    }
  };

  const pauseExecution = async () => {
    try {
      const response = await fetch('/api/collaboration/execution/control', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          action: 'pause'
        })
      });

      if (response.ok) {
        addSystemLog('Execution paused by user', 'info');
      }
    } catch (error) {
      addSystemLog(`Failed to pause execution: ${error.message}`, 'error');
    }
  };

  const resumeExecution = async () => {
    try {
      const response = await fetch('/api/collaboration/execution/control', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          action: 'resume'
        })
      });

      if (response.ok) {
        addSystemLog('Execution resumed by user', 'info');
      }
    } catch (error) {
      addSystemLog(`Failed to resume execution: ${error.message}`, 'error');
    }
  };

  const createManualCheckpoint = async (description) => {
    try {
      const checkpoint = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        description,
        type: 'manual',
        progress: executionProgress,
        activeAgents: activeAgents.map(a => ({ id: a.id, status: a.status }))
      };

      await updateCheckpoint(checkpoint);
    } catch (error) {
      addSystemLog(`Failed to create checkpoint: ${error.message}`, 'error');
    }
  };

  const cleanup = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
      metricsIntervalRef.current = null;
    }
    
    setIsMonitoring(false);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getLogLevelColor = (level) => {
    switch (level) {
      case 'error': return '#ff6666';
      case 'warn': return '#ffaa66';
      case 'info': return '#66bbff';
      case 'debug': return '#888';
      default: return '#ccc';
    }
  };

  const getAgentStatusColor = (status) => {
    switch (status) {
      case 'active': return '#00ff88';
      case 'idle': return '#ffaa66';
      case 'error': return '#ff6666';
      case 'paused': return '#888';
      default: return '#666';
    }
  };

  const filteredLogs = executionLogs.filter(log => {
    if (filterLevel === 'all') return true;
    return log.level === filterLevel;
  });

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      backgroundColor: '#0a0a0a',
      color: '#e0e0e0',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Left Panel - Execution Logs */}
      <div style={{
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #333'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #333',
          backgroundColor: '#1a1a1a'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <div>
              <h1 style={{ color: '#00ff88', margin: 0, fontSize: '24px' }}>
                📊 Execution Monitor
              </h1>
              <p style={{ color: '#888', margin: '5px 0 0 0', fontSize: '14px' }}>
                Checkpoint.md • Real-time Agent Monitoring
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{
                padding: '4px 8px',
                backgroundColor: isMonitoring ? '#004d00' : '#660000',
                borderRadius: '12px',
                fontSize: '12px',
                color: '#fff'
              }}>
                {isMonitoring ? '🟢 Live' : '🔴 Offline'}
              </div>

              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: '#0f0f0f',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              >
                <option value="all">All Logs</option>
                <option value="info">Info</option>
                <option value="warn">Warnings</option>
                <option value="error">Errors</option>
              </select>

              <button
                onClick={() => setAutoScroll(!autoScroll)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: autoScroll ? '#00aa44' : '#333',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {autoScroll ? '📌 Auto-scroll' : '📌 Manual'}
              </button>

              <button
                onClick={() => createManualCheckpoint(prompt('Checkpoint description:'))}
                disabled={readonly}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#0066cc',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                💾 Checkpoint
              </button>
            </div>
          </div>

          {/* Real-time Metrics */}
          <div style={{ 
            display: 'flex', 
            gap: '20px', 
            fontSize: '12px', 
            color: '#666'
          }}>
            <span>Logs: {filteredLogs.length}</span>
            <span>Errors: {errorLogs.filter(e => !e.resolved).length}</span>
            <span>Agents: {activeAgents.length}</span>
            <span>Memory: {realTimeData.memoryUsage}%</span>
            <span>CPU: {realTimeData.cpuUsage}%</span>
            <span style={{ color: isMonitoring ? '#00ff88' : '#ff6666' }}>
              ● {realTimeData.messagesPerSecond}/s
            </span>
          </div>
        </div>

        {/* Execution Logs */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: '#0f0f0f',
          fontFamily: 'Monaco, Menlo, monospace',
          fontSize: '13px'
        }}>
          {filteredLogs.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              color: '#666'
            }}>
              No logs available
            </div>
          ) : (
            filteredLogs.map(log => (
              <div key={log.id} style={{
                padding: '8px 15px',
                borderBottom: '1px solid #1a1a1a',
                display: 'flex',
                gap: '15px',
                alignItems: 'flex-start',
                backgroundColor: log.level === 'error' ? '#1a0000' : 
                                log.level === 'warn' ? '#1a1200' : 'transparent'
              }}>
                <span style={{ 
                  color: '#666', 
                  fontSize: '11px',
                  minWidth: '60px',
                  flexShrink: 0
                }}>
                  {formatTimestamp(log.timestamp)}
                </span>
                
                <span style={{
                  color: getLogLevelColor(log.level),
                  fontSize: '11px',
                  minWidth: '50px',
                  flexShrink: 0,
                  textTransform: 'uppercase'
                }}>
                  {log.level}
                </span>
                
                {log.agentId && (
                  <span style={{
                    color: '#888',
                    fontSize: '11px',
                    minWidth: '80px',
                    flexShrink: 0
                  }}>
                    {log.agentId.substr(0, 10)}...
                  </span>
                )}
                
                <span style={{
                  color: '#e0e0e0',
                  flex: 1,
                  wordBreak: 'break-word'
                }}>
                  {log.message}
                </span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Control Panel */}
        {!readonly && (
          <div style={{
            padding: '15px',
            borderTop: '1px solid #333',
            backgroundColor: '#1a1a1a',
            display: 'flex',
            gap: '10px',
            justifyContent: 'center'
          }}>
            <button
              onClick={pauseExecution}
              style={{
                padding: '10px 20px',
                backgroundColor: '#aa4400',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ⏸️ Pause
            </button>
            
            <button
              onClick={resumeExecution}
              style={{
                padding: '10px 20px',
                backgroundColor: '#00aa44',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ▶️ Resume
            </button>
          </div>
        )}
      </div>

      {/* Right Panel - Agents & Checkpoints */}
      <div style={{
        width: '400px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1a1a1a'
      }}>
        {/* Agents Panel */}
        <div style={{
          flex: '1',
          borderBottom: '1px solid #333'
        }}>
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #333'
          }}>
            <h2 style={{ color: '#00ff88', margin: 0, fontSize: '18px' }}>
              🤖 Active Agents
            </h2>
            <p style={{ color: '#888', fontSize: '12px', margin: '5px 0 0 0' }}>
              Real-time agent status and performance
            </p>
          </div>

          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '15px'
          }}>
            {activeAgents.length === 0 ? (
              <div style={{ color: '#666', textAlign: 'center', marginTop: '20px' }}>
                No active agents
              </div>
            ) : (
              activeAgents.map(agent => (
                <div key={agent.id} style={{
                  padding: '12px',
                  backgroundColor: '#0f0f0f',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  cursor: 'pointer'
                }} onClick={() => setSelectedAgent(agent)}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <h4 style={{ 
                      color: '#66bbff', 
                      margin: 0, 
                      fontSize: '14px',
                      maxWidth: '200px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {agent.name || agent.id}
                    </h4>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: getAgentStatusColor(agent.status)
                    }} />
                  </div>
                  
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    <div>Status: {agent.status}</div>
                    <div>Type: {agent.type || 'Unknown'}</div>
                    {agent.currentTask && (
                      <div>Task: {agent.currentTask}</div>
                    )}
                    {agent.performance && (
                      <div style={{ marginTop: '5px' }}>
                        <div>Success Rate: {Math.round(agent.performance.successRate || 0)}%</div>
                        <div>Avg Duration: {formatDuration(agent.performance.avgDuration || 0)}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Checkpoints Panel */}
        <div style={{
          flex: '1'
        }}>
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #333'
          }}>
            <h2 style={{ color: '#ffaa66', margin: 0, fontSize: '18px' }}>
              📚 Checkpoints
            </h2>
            <p style={{ color: '#888', fontSize: '12px', margin: '5px 0 0 0' }}>
              Execution state snapshots
            </p>
          </div>

          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '15px'
          }}>
            {checkpointHistory.length === 0 ? (
              <div style={{ color: '#666', textAlign: 'center', marginTop: '20px' }}>
                No checkpoints yet
              </div>
            ) : (
              checkpointHistory.map((checkpoint, index) => (
                <div key={checkpoint.id} style={{
                  padding: '10px',
                  backgroundColor: '#0f0f0f',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '5px'
                  }}>
                    <span style={{ 
                      color: '#ffaa66', 
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      #{checkpointHistory.length - index}
                    </span>
                    <span style={{ fontSize: '11px', color: '#666' }}>
                      {checkpoint.type === 'manual' ? '👤' : '🤖'}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '5px' }}>
                    {checkpoint.description || 'Auto-checkpoint'}
                  </div>
                  
                  <div style={{ fontSize: '11px', color: '#888' }}>
                    {formatTimestamp(checkpoint.timestamp)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}