import { useState, useEffect } from 'react';
import IdeationView from './IdeationView';
import TaskOrchestrationView from './TaskOrchestrationView';
import ExecutionView from './ExecutionView';
import MergeReviewView from './MergeReviewView';

/**
 * CollaborationHub - Unified orchestration for all 4 specialized views
 *
 * Features:
 * - Seamless view switching with state preservation
 * - Cross-view data sharing and synchronization
 * - Session management and security enforcement
 * - Workflow progression tracking
 * - Real-time collaboration coordination
 */
export default function CollaborationHub({
  userSettings = {},
  githubConfig = {},
  onSessionUpdate,
  initialMode = 'ideation'
}) {
  const [currentView, setCurrentView] = useState(initialMode);
  const [sessionId, setSessionId] = useState(null);
  const [agentAuth, setAgentAuth] = useState(null);
  const [sessionData, setSessionData] = useState({
    ideation: {
      draftContent: '',
      versionHistory: [],
      chatHistory: []
    },
    orchestration: {
      taskDocument: '',
      workflowSteps: [],
      dependencies: new Map(),
      executionStatus: {}
    },
    execution: {
      checkpointDocument: '',
      logs: [],
      activeAgents: [],
      metrics: {}
    },
    merge: {
      originalContent: '',
      modifiedContent: '',
      mergedContent: '',
      conflicts: [],
      validationStatus: {}
    }
  });
  const [workflowProgress, setWorkflowProgress] = useState({
    ideation: 'current', // 'current', 'completed', 'available', 'locked'
    orchestration: 'available',
    execution: 'locked',
    merge: 'locked'
  });
  const [isInitializing, setIsInitializing] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Initialize collaboration session
  useEffect(() => {
    initializeSession();
  }, []);

  // Update workflow progress based on session data
  useEffect(() => {
    updateWorkflowProgress();
  }, [sessionData]);

  const initializeSession = async () => {
    try {
      const response = await fetch('/api/collaboration/session/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userSettings,
          githubConfig,
          initialMode: currentView
        })
      });

      if (response.ok) {
        const data = await response.json();

        setSessionId(data.sessionId);
        setAgentAuth(data.agentAuth);
        setSessionData(prev => ({ ...prev, ...data.sessionData }));
        setWorkflowProgress(data.workflowProgress || workflowProgress);
        setConnectionStatus('connected');

        addNotification('Collaboration session initialized', 'success');
        onSessionUpdate?.(data);
      } else {
        throw new Error(`Session initialization failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to initialize session:', error);
      setConnectionStatus('error');
      addNotification(`Initialization failed: ${error.message}`, 'error');
    } finally {
      setIsInitializing(false);
    }
  };

  const updateWorkflowProgress = () => {
    const newProgress = { ...workflowProgress };

    // Ideation phase completion check
    if (sessionData.ideation.draftContent.length > 100) {
      newProgress.ideation = 'completed';
      if (newProgress.orchestration === 'locked') {
        newProgress.orchestration = 'available';
      }
    }

    // Orchestration phase completion check
    if (sessionData.orchestration.workflowSteps.length > 0) {
      newProgress.orchestration = 'completed';
      if (newProgress.execution === 'locked') {
        newProgress.execution = 'available';
      }
    }

    // Execution phase completion check
    const executionComplete = Object.values(sessionData.orchestration.executionStatus);
      .filter(status => status === 'completed').length > 0;

    if (executionComplete) {
      newProgress.execution = 'completed';
      if (newProgress.merge === 'locked') {
        newProgress.merge = 'available';
      }
    }

    setWorkflowProgress(newProgress);
  };

  const switchView = async (newView) => {
    if (workflowProgress[newView] === 'locked') {
      addNotification(`${newView} phase is locked. Complete previous phases first.`, 'warning');
      return;
    }

    try {
      // Save current view state
      await saveViewState(currentView);

      // Switch to new view
      setCurrentView(newView);

      // Load new view state
      await loadViewState(newView);

      addNotification(`Switched to ${newView} view`, 'info');
    } catch (error) {
      console.error('Failed to switch view:', error);
      addNotification(`View switch failed: ${error.message}`, 'error');
    }
  };

  const saveViewState = async (view) => {
    try {
      const response = await fetch('/api/collaboration/session/save-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          view,
          data: sessionData[view]
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save ${view} state`);
      }
    } catch (error) {
      console.error('Save state error:', error);
    }
  };

  const loadViewState = async (view) => {
    try {
      const response = await fetch('/api/collaboration/session/load-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          view
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSessionData(prev => ({
          ...prev,
          [view]: { ...prev[view], ...data }
        }));
      }
    } catch (error) {
      console.error('Load state error:', error);
    }
  };

  const handleIdeationUpdate = (data) => {
    setSessionData(prev => ({
      ...prev,
      ideation: {
        ...prev.ideation,
        draftContent: data.content || prev.ideation.draftContent,
        versionHistory: data.versionHistory || prev.ideation.versionHistory
      }
    }));

    // Auto-progress to orchestration if draft is substantial
    if (data.content && data.content.length > 500 && workflowProgress.orchestration === 'locked') {
      setWorkflowProgress(prev => ({ ...prev, orchestration: 'available' }));
      addNotification('Orchestration phase unlocked!', 'success');
    }
  };

  const handleOrchestrationUpdate = (data) => {
    setSessionData(prev => ({
      ...prev,
      orchestration: {
        ...prev.orchestration,
        workflowSteps: data.steps || prev.orchestration.workflowSteps,
        dependencies: data.dependencies || prev.orchestration.dependencies,
        taskDocument: data.document || prev.orchestration.taskDocument
      }
    }));

    // Auto-progress to execution if workflow is defined
    if (data.steps && data.steps.length > 0 && workflowProgress.execution === 'locked') {
      setWorkflowProgress(prev => ({ ...prev, execution: 'available' }));
      addNotification('Execution phase unlocked!', 'success');
    }
  };

  const handleExecutionUpdate = (data) => {
    setSessionData(prev => ({
      ...prev,
      execution: {
        ...prev.execution,
        logs: data.logs || prev.execution.logs,
        activeAgents: data.activeAgents || prev.execution.activeAgents,
        checkpointDocument: data.checkpointDocument || prev.execution.checkpointDocument
      }
    }));

    // Auto-progress to merge if execution started
    if (data.logs && data.logs.length > 0 && workflowProgress.merge === 'locked') {
      setWorkflowProgress(prev => ({ ...prev, merge: 'available' }));
      addNotification('Merge review phase unlocked!', 'success');
    }
  };

  const handleMergeComplete = (data) => {
    setSessionData(prev => ({
      ...prev,
      merge: {
        ...prev.merge,
        mergedContent: data.mergedContent,
        validationStatus: data.validation
      }
    }));

    addNotification('Merge completed successfully!', 'success');
  };

  const addNotification = (message, type = 'info') => {
    const notification = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: new Date().toISOString()
    };

    setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep last 10
  };

  const getViewIcon = (view) => {
    switch (view) {
      case 'ideation': return '💡';
      case 'orchestration': return '⚡';
      case 'execution': return '📊';
      case 'merge': return '🔀';
      default: return '📄';
    }
  };

  const getViewTitle = (view) => {
    switch (view) {
      case 'ideation': return 'Ideation';
      case 'orchestration': return 'Orchestration';
      case 'execution': return 'Execution';
      case 'merge': return 'Merge Review';
      default: return 'Unknown';
    }
  };

  const getProgressColor = (status) => {
    switch (status) {
      case 'current': return '#00ff88';
      case 'completed': return '#66bbff';
      case 'available': return '#ffaa66';
      case 'locked': return '#666';
      default: return '#666';
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#00ff88';
      case 'connecting': return '#ffaa66';
      case 'error': return '#ff6666';
      default: return '#666';
    }
  };

  if (isInitializing) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
        color: '#e0e0e0',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid #333',
          borderTop: '4px solid #00ff88',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <h2 style={{ color: '#00ff88', margin: 0 }}>
          Initializing Collaboration Hub
        </h2>
        <p style={{ color: '#888', textAlign: 'center', maxWidth: '400px' }}>
          Setting up secure session, validating agent authentication, and preparing workspace...
        </p>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0a0a0a',
      color: '#e0e0e0',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header Navigation */}
      <div style={{
        padding: '15px 30px',
        borderBottom: '1px solid #333',
        backgroundColor: '#1a1a1a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        {/* Logo and Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h1 style={{ color: '#00ff88', margin: 0, fontSize: '24px' }}>
            🤝 Collaboration Hub
          </h1>
          <div style={{
            padding: '4px 8px',
            backgroundColor: getConnectionStatusColor(),
            borderRadius: '12px',
            fontSize: '12px',
            color: '#fff',
            opacity: 0.8
          }}>
            ● {connectionStatus}
          </div>
        </div>

        {/* View Navigation */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {['ideation', 'orchestration', 'execution', 'merge'].map(view => (
            <button
              key={view}
              onClick={() => switchView(view)}
              disabled={workflowProgress[view] === 'locked'}
              style={{
                padding: '10px 15px',
                backgroundColor: currentView === view ? '#003366' :
                                workflowProgress[view] === 'locked' ? '#1a1a1a' : '#333',
                border: `2px solid ${getProgressColor(
                  currentView === view ? 'current' : workflowProgress[view]
                )}`,
                borderRadius: '8px',
                color: workflowProgress[view] === 'locked' ? '#666' : '#fff',
                cursor: workflowProgress[view] === 'locked' ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: workflowProgress[view] === 'locked' ? 0.5 : 1,
                transition: 'all 0.3s ease'
              }}
            >
              <span style={{ fontSize: '16px' }}>{getViewIcon(view)}</span>
              {getViewTitle(view)}
              {workflowProgress[view] === 'completed' && (
                <span style={{ color: '#00ff88', fontSize: '12px' }}>✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Status and Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Notifications */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              style={{
                padding: '8px',
                backgroundColor: notifications.length > 0 ? '#aa4400' : '#333',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                position: 'relative'
              }}
            >
              🔔
              {notifications.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  backgroundColor: '#ff6666',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {notifications.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                width: '300px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                zIndex: 1000,
                maxHeight: '400px',
                overflow: 'auto'
              }}>
                <div style={{
                  padding: '15px',
                  borderBottom: '1px solid #333',
                  fontWeight: 'bold',
                  color: '#ccc'
                }}>
                  Notifications
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: '15px', color: '#666', textAlign: 'center' }}>
                    No notifications
                  </div>
                ) : (
                  notifications.map(notification => (
                    <div key={notification.id} style={{
                      padding: '12px 15px',
                      borderBottom: '1px solid #333',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'flex-start'
                    }}>
                      <span style={{
                        color: notification.type === 'error' ? '#ff6666' :
                              notification.type === 'success' ? '#00ff88' :
                              notification.type === 'warning' ? '#ffaa66' : '#66bbff',
                        fontSize: '16px',
                        flexShrink: 0
                      }}>
                        {notification.type === 'error' ? '❌' :
                         notification.type === 'success' ? '✅' :
                         notification.type === 'warning' ? '⚠️' : 'ℹ️'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', marginBottom: '5px' }}>
                          {notification.message}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666' }}>
                          {new Date(notification.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Session Info */}
          <div style={{ fontSize: '12px', color: '#666' }}>
            Session: {sessionId?.substr(0, 8)}...
          </div>
        </div>
      </div>

      {/* Workflow Progress Indicator */}
      <div style={{
        padding: '10px 30px',
        backgroundColor: '#0f0f0f',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'center',
        gap: '20px'
      }}>
        {['ideation', 'orchestration', 'execution', 'merge'].map((phase, index) => (
          <div key={phase} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: getProgressColor(workflowProgress[phase]),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              color: '#000'
            }}>
              {workflowProgress[phase] === 'completed' ? '✓' : index + 1}
            </div>
            <span style={{
              color: getProgressColor(workflowProgress[phase]),
              fontSize: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              {phase}
            </span>
            {index < 3 && (
              <div style={{
                width: '40px',
                height: '2px',
                backgroundColor: workflowProgress[['orchestration', 'execution', 'merge'][index]] !== 'locked' ? '#333' : '#666',
                margin: '0 10px'
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {currentView === 'ideation' && (
          <IdeationView
            sessionId={sessionId}
            agentAuth={agentAuth}
            onDocumentChange={handleIdeationUpdate}
            initialDraft={sessionData.ideation.draftContent}
            readonly={workflowProgress.ideation === 'locked'}
          />
        )}

        {currentView === 'orchestration' && (
          <TaskOrchestrationView
            sessionId={sessionId}
            agentAuth={agentAuth}
            onTaskUpdate={handleOrchestrationUpdate}
            initialTaskData={sessionData.orchestration}
            readonly={workflowProgress.orchestration === 'locked'}
          />
        )}

        {currentView === 'execution' && (
          <ExecutionView
            sessionId={sessionId}
            agentAuth={agentAuth}
            onExecutionUpdate={handleExecutionUpdate}
            taskId={sessionData.orchestration.taskId}
            readonly={workflowProgress.execution === 'locked'}
          />
        )}

        {currentView === 'merge' && (
          <MergeReviewView
            sessionId={sessionId}
            agentAuth={agentAuth}
            onMergeComplete={handleMergeComplete}
            sourceDocument={sessionData.ideation.draftContent}
            targetDocument={sessionData.execution.checkpointDocument}
            mergeContext={sessionData}
            readonly={workflowProgress.merge === 'locked'}
          />
        )}
      </div>

      {/* Click outside to close notifications */}
      {showNotifications && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={() => setShowNotifications(false)}
        />
      )}
    </div>
  );
}
