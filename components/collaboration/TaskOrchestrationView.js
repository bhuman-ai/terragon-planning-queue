import { useState, useEffect, useRef } from 'react';

/**
 * TaskOrchestrationView - Workflow management with Task.md
 *
 * Features:
 * - Visual workflow designer with Task.md
 * - AI-powered task decomposition
 * - Real-time collaboration with agents
 * - Dependency management and scheduling
 * - Progress tracking and metrics
 */
export default function TaskOrchestrationView({
  sessionId,
  agentAuth,
  onTaskUpdate,
  initialTaskData = null,
  readonly = false
}) {
  const [taskDocument, setTaskDocument] = useState('');
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [selectedStep, setSelectedStep] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [collaboratorAgents, setCollaboratorAgents] = useState([]);
  const [dependencies, setDependencies] = useState(new Map());
  const [executionStatus, setExecutionStatus] = useState({});
  const [timeEstimates, setTimeEstimates] = useState({});
  const [chatMessages, setChatMessages] = useState([;
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Welcome to the Task Orchestration workspace! I can help you break down complex tasks, create workflows, and coordinate with other AI agents. What would you like to accomplish?',
      timestamp: new Date().toISOString(),
      type: 'orchestration'
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [showDependencyView, setShowDependencyView] = useState(false);
  const [viewMode, setViewMode] = useState('visual'); // 'visual', 'document', 'timeline'

  const canvasRef = useRef(null);
  const chatEndRef = useRef(null);

  // Load initial task data
  useEffect(() => {
    if (initialTaskData) {
      loadTaskData(initialTaskData);
    }
  }, [initialTaskData]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Render workflow canvas
  useEffect(() => {
    if (viewMode === 'visual' && canvasRef.current) {
      drawWorkflowCanvas();
    }
  }, [workflowSteps, selectedStep, viewMode, dependencies, executionStatus]);

  const loadTaskData = async (taskData) => {
    try {
      setTaskDocument(taskData.document || '');
      setWorkflowSteps(taskData.steps || []);
      setDependencies(new Map(taskData.dependencies || []));
      setExecutionStatus(taskData.status || {});
      setTimeEstimates(taskData.estimates || {});
      setCollaboratorAgents(taskData.agents || []);
    } catch (error) {
      console.error('Failed to load task data:', error);
    }
  };

  const decomposeTask = async (description) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/collaboration/orchestration/decompose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          taskDescription: description,
          context: taskDocument,
          requirements: {
            maxSteps: 20,
            targetDuration: '< 10 minutes per step',
            includeValidation: true,
            generateDependencies: true
          }
        })
      });

      if (response.ok) {
        const data = await response.json();

        // Update workflow steps
        setWorkflowSteps(data.steps || []);
        setDependencies(new Map(data.dependencies || []));
        setTimeEstimates(data.timeEstimates || {});
        setCollaboratorAgents(data.recommendedAgents || []);

        // Update task document
        const updatedDocument = generateTaskDocument(data.steps, data.dependencies);
        setTaskDocument(updatedDocument);

        addSystemMessage(`Decomposed task into ${data.steps?.length || 0} steps with ${data.dependencies?.length || 0} dependencies`);

        onTaskUpdate?.({
          steps: data.steps,
          dependencies: data.dependencies,
          document: updatedDocument
        });
      }
    } catch (error) {
      console.error('Task decomposition failed:', error);
      addSystemMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const generateTaskDocument = (steps, deps) => {
    const doc = `# Task Orchestration Document\n\n`;
    doc += `**Session ID:** ${sessionId}\n`;
    doc += `**Generated:** ${new Date().toISOString()}\n`;
    doc += `**Total Steps:** ${steps.length}\n\n`;

    doc += `## Workflow Overview\n\n`;
    steps.forEach((step, index) => {
      doc += `### Step ${index + 1}: ${step.title}\n`;
      doc += `**Duration:** ${step.estimatedDuration || 'TBD'}\n`;
      doc += `**Agent:** ${step.assignedAgent || 'Unassigned'}\n`;
      doc += `**Status:** ${executionStatus[step.id] || 'Pending'}\n\n`;
      doc += `${step.description}\n\n`;

      if (step.dependencies && step.dependencies.length > 0) {
        doc += `**Dependencies:** ${step.dependencies.join(', ')}\n\n`;
      }

      if (step.deliverables && step.deliverables.length > 0) {
        doc += `**Deliverables:**\n`;
        step.deliverables.forEach(deliverable => {
          doc += `- ${deliverable}\n`;
        });
        doc += `\n`;
      }
    });

    return doc;
  };

  const drawWorkflowCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Clear canvas
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (workflowSteps.length === 0) {
      // Draw empty state
      ctx.fillStyle = '#666';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No workflow steps defined', rect.width / 2, rect.height / 2);
      return;
    }

    // Calculate layout
    const stepWidth = 160;
    const stepHeight = 80;
    const columnWidth = 200;
    const rowHeight = 120;
    const columns = Math.ceil(Math.sqrt(workflowSteps.length));
    const rows = Math.ceil(workflowSteps.length / columns);

    // Draw workflow steps
    workflowSteps.forEach((step, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = 50 + col * columnWidth;
      const y = 50 + row * rowHeight;

      // Draw step box
      const isSelected = selectedStep?.id === step.id;
      const status = executionStatus[step.id] || 'pending';

      ctx.fillStyle = isSelected ? '#003366' :
                     status === 'completed' ? '#004d00' :
                     status === 'in_progress' ? '#664400' :
                     status === 'failed' ? '#660000' : '#1a1a1a';
      ctx.fillRect(x, y, stepWidth, stepHeight);

      ctx.strokeStyle = isSelected ? '#66bbff' :
                       status === 'completed' ? '#00aa44' :
                       status === 'in_progress' ? '#ffaa66' :
                       status === 'failed' ? '#aa4444' : '#333';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(x, y, stepWidth, stepHeight);

      // Draw step title
      ctx.fillStyle = '#fff';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'left';
      const maxTitleWidth = stepWidth - 10;
      const title = step.title.length > 20 ? step.title.substr(0, 17) + '...' : step.title;
      ctx.fillText(title, x + 5, y + 15);

      // Draw step number
      ctx.fillStyle = '#888';
      ctx.font = '10px system-ui';
      ctx.fillText(`#${index + 1}`, x + 5, y + 30);

      // Draw agent assignment
      if (step.assignedAgent) {
        ctx.fillStyle = '#66bbff';
        ctx.font = '10px system-ui';
        const agent = step.assignedAgent.length > 15 ? step.assignedAgent.substr(0, 12) + '...' : step.assignedAgent;
        ctx.fillText(`Agent: ${agent}`, x + 5, y + 45);
      }

      // Draw status indicator
      ctx.fillStyle = status === 'completed' ? '#00ff88' :
                     status === 'in_progress' ? '#ffaa66' :
                     status === 'failed' ? '#ff6666' : '#888';
      ctx.beginPath();
      ctx.arc(x + stepWidth - 15, y + 15, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Store step position for click detection
      step._canvasPosition = { x, y, width: stepWidth, height: stepHeight };
    });

    // Draw dependency arrows
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    dependencies.forEach((deps, stepId) => {
      const toStep = workflowSteps.find(s => s.id === stepId);
      if (!toStep?._canvasPosition) return;

      deps.forEach(depId => {
        const fromStep = workflowSteps.find(s => s.id === depId);
        if (!fromStep?._canvasPosition) return;

        const fromX = fromStep._canvasPosition.x + stepWidth;
        const fromY = fromStep._canvasPosition.y + stepHeight / 2;
        const toX = toStep._canvasPosition.x;
        const toY = toStep._canvasPosition.y + stepHeight / 2;

        // Draw arrow
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX - 10, toY);
        ctx.stroke();

        // Draw arrowhead
        ctx.beginPath();
        ctx.moveTo(toX - 10, toY);
        ctx.lineTo(toX - 15, toY - 5);
        ctx.lineTo(toX - 15, toY + 5);
        ctx.closePath();
        ctx.fill();
      });
    });
  };

  const handleCanvasClick = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find clicked step
    const clickedStep = workflowSteps.find(step => {
      const pos = step._canvasPosition;
      return pos && x >= pos.x && x <= pos.x + pos.width &&;
             y >= pos.y && y <= pos.y + pos.height;
    });

    if (clickedStep) {
      setSelectedStep(clickedStep);
      addSystemMessage(`Selected step: ${clickedStep.title}`);
    }
  };

  const assignAgent = async (stepId, agentType) => {
    try {
      const response = await fetch('/api/collaboration/orchestration/assign-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          stepId,
          agentType,
          context: taskDocument
        })
      });

      if (response.ok) {
        const data = await response.json();

        // Update step with assigned agent
        setWorkflowSteps(prev => prev.map(step =>
          step.id === stepId
            ? { ...step, assignedAgent: agentType, agentConfig: data.config }
            : step
        ));

        addSystemMessage(`Assigned ${agentType} to step: ${workflowSteps.find(s => s.id === stepId)?.title}`);
      }
    } catch (error) {
      console.error('Agent assignment failed:', error);
      addSystemMessage(`Error assigning agent: ${error.message}`);
    }
  };

  const executeStep = async (stepId) => {
    const step = workflowSteps.find(s => s.id === stepId);
    if (!step) return;

    // Check dependencies
    const stepDeps = dependencies.get(stepId) || [];
    const uncompletedDeps = stepDeps.filter(depId =>
      executionStatus[depId] !== 'completed');

    if (uncompletedDeps.length > 0) {
      addSystemMessage(`Cannot execute step: incomplete dependencies`);
      return;
    }

    setExecutionStatus(prev => ({ ...prev, [stepId]: 'in_progress' }));
    addSystemMessage(`Starting execution of: ${step.title}`);

    try {
      const response = await fetch('/api/collaboration/orchestration/execute-step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          step,
          context: taskDocument,
          dependencies: stepDeps
        })
      });

      if (response.ok) {
        const data = await response.json();
        setExecutionStatus(prev => ({
          ...prev,
          [stepId]: data.success ? 'completed' : 'failed'
        }));

        addSystemMessage(
          data.success
            ? `✅ Completed: ${step.title}`
            : `❌ Failed: ${step.title} - ${data.error}`
        );

        onTaskUpdate?.({ stepId, status: data.success ? 'completed' : 'failed' });
      }
    } catch (error) {
      console.error('Step execution failed:', error);
      setExecutionStatus(prev => ({ ...prev, [stepId]: 'failed' }));
      addSystemMessage(`❌ Execution failed: ${error.message}`);
    }
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: currentMessage.trim(),
      timestamp: new Date().toISOString(),
      type: 'orchestration'
    };

    setChatMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/collaboration/orchestration/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          message: userMessage.content,
          context: {
            taskDocument,
            workflowSteps,
            dependencies: Array.from(dependencies.entries()),
            executionStatus,
            selectedStep
          },
          chatHistory: chatMessages.slice(-10)
        })
      });

      if (response.ok) {
        const data = await response.json();

        const assistantMessage = {
          id: Date.now().toString() + '-ai',
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString(),
          type: 'orchestration',
          actions: data.actions
        };

        setChatMessages(prev => [...prev, assistantMessage]);

        // Handle suggested actions
        if (data.actions) {
          data.actions.forEach(action => handleAssistantAction(action));
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, {
        id: Date.now().toString() + '-error',
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
        type: 'error'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssistantAction = async (action) => {
    switch (action.type) {
      case 'decompose_task':
        await decomposeTask(action.description);
        break;
      case 'assign_agent':
        await assignAgent(action.stepId, action.agentType);
        break;
      case 'execute_step':
        await executeStep(action.stepId);
        break;
      case 'update_dependencies':
        setDependencies(new Map(action.dependencies));
        break;
      default:
        console.log('Unknown action:', action);
    }
  };

  const addSystemMessage = (content) => {
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'system',
      content,
      timestamp: new Date().toISOString(),
      type: 'system'
    }]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getProgressStats = () => {
    const total = workflowSteps.length;
    const completed = Object.values(executionStatus).filter(s => s === 'completed').length;
    const inProgress = Object.values(executionStatus).filter(s => s === 'in_progress').length;
    const failed = Object.values(executionStatus).filter(s => s === 'failed').length;

    return { total, completed, inProgress, failed };
  };

  const stats = getProgressStats();

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      backgroundColor: '#0a0a0a',
      color: '#e0e0e0',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Left Panel - Workflow Visualization */}
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
              <h1 style={{ color: '#ffaa66', margin: 0, fontSize: '24px' }}>
                ⚡ Task Orchestration
              </h1>
              <p style={{ color: '#888', margin: '5px 0 0 0', fontSize: '14px' }}>
                Task.md • Workflow Management & AI Coordination
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: '#0f0f0f',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              >
                <option value='visual'>🎨 Visual</option>
                <option value='document'>📝 Document</option>
                <option value='timeline'>📅 Timeline</option>
              </select>

              <button
                onClick={() => setShowDependencyView(!showDependencyView)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: showDependencyView ? '#ffaa66' : '#333',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                🔗 Dependencies
              </button>
            </div>
          </div>

          {/* Progress Stats */}
          <div style={{
            display: 'flex',
            gap: '20px',
            fontSize: '12px',
            color: '#666'
          }}>
            <span style={{ color: '#fff' }}>Total: {stats.total}</span>
            <span style={{ color: '#00ff88' }}>Completed: {stats.completed}</span>
            <span style={{ color: '#ffaa66' }}>In Progress: {stats.inProgress}</span>
            <span style={{ color: '#ff6666' }}>Failed: {stats.failed}</span>
            <span>Progress: {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%</span>
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {viewMode === 'visual' && (
            <div style={{ flex: 1, position: 'relative' }}>
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                style={{
                  width: '100%',
                  height: '100%',
                  cursor: 'pointer'
                }}
              />

              {workflowSteps.length === 0 && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  color: '#666'
                }}>
                  <h3>No workflow defined</h3>
                  <p>Describe your task to AI to get started</p>
                </div>
              )}
            </div>
          )}

          {viewMode === 'document' && (
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px'
            }}>
              <pre style={{
                backgroundColor: '#0f0f0f',
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '20px',
                fontSize: '13px',
                fontFamily: 'Monaco, Menlo, monospace',
                color: '#e0e0e0',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6'
              }}>
                {taskDocument || 'No task document generated yet.'}
              </pre>
            </div>
          )}

          {viewMode === 'timeline' && (
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px'
            }}>
              <div style={{ maxWidth: '800px' }}>
                {workflowSteps.map((step, index) => (
                  <div key={step.id} style={{
                    display: 'flex',
                    marginBottom: '20px',
                    alignItems: 'flex-start'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor:
                        executionStatus[step.id] === 'completed' ? '#00aa44' :
                        executionStatus[step.id] === 'in_progress' ? '#ffaa66' :
                        executionStatus[step.id] === 'failed' ? '#aa4444' : '#333',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      marginRight: '15px',
                      flexShrink: 0
                    }}>
                      {index + 1}
                    </div>

                    <div style={{ flex: 1 }}>
                      <h4 style={{ color: '#ffaa66', margin: '0 0 5px 0' }}>
                        {step.title}
                      </h4>
                      <p style={{ color: '#ccc', margin: '0 0 10px 0', fontSize: '14px' }}>
                        {step.description}
                      </p>
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        <span>Duration: {step.estimatedDuration || 'TBD'}</span>
                        {step.assignedAgent && (
                          <span style={{ marginLeft: '15px' }}>
                            Agent: {step.assignedAgent}
                          </span>
                        )}
                      </div>

                      {!readonly && (
                        <div style={{ marginTop: '10px' }}>
                          <button
                            onClick={() => executeStep(step.id)}
                            disabled={
                              executionStatus[step.id] === 'in_progress' ||
                              executionStatus[step.id] === 'completed' ||
                              (dependencies.get(step.id) || []).some(depId =>
                                executionStatus[depId] !== 'completed'
                              )
                            }
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#00aa44',
                              border: 'none',
                              borderRadius: '4px',
                              color: '#fff',
                              cursor: 'pointer',
                              fontSize: '12px',
                              opacity: executionStatus[step.id] === 'completed' ? 0.5 : 1
                            }}
                          >
                            {executionStatus[step.id] === 'completed' ? '✅ Done' :
                             executionStatus[step.id] === 'in_progress' ? '⏳ Running' :
                             '▶️ Execute'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Step Details Panel */}
        {selectedStep && (
          <div style={{
            height: '200px',
            borderTop: '1px solid #333',
            padding: '15px',
            backgroundColor: '#1a1a1a',
            overflow: 'auto'
          }}>
            <h4 style={{ color: '#ffaa66', margin: '0 0 10px 0' }}>
              Step Details: {selectedStep.title}
            </h4>
            <p style={{ fontSize: '14px', marginBottom: '10px' }}>
              {selectedStep.description}
            </p>
            <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: '#888' }}>
              <span>Status: {executionStatus[selectedStep.id] || 'Pending'}</span>
              <span>Duration: {selectedStep.estimatedDuration || 'TBD'}</span>
              <span>Agent: {selectedStep.assignedAgent || 'Unassigned'}</span>
            </div>

            {selectedStep.deliverables && (
              <div style={{ marginTop: '10px' }}>
                <strong style={{ fontSize: '12px', color: '#ccc' }}>Deliverables:</strong>
                <ul style={{ fontSize: '12px', color: '#888', margin: '5px 0' }}>
                  {selectedStep.deliverables.map((deliverable, idx) => (
                    <li key={idx}>{deliverable}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Panel - AI Chat */}
      <div style={{
        width: '400px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1a1a1a'
      }}>
        {/* Chat Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #333'
        }}>
          <h2 style={{ color: '#ffaa66', margin: 0, fontSize: '18px' }}>
            🤖 Orchestration Assistant
          </h2>
          <p style={{ color: '#888', fontSize: '12px', margin: '5px 0 0 0' }}>
            Task decomposition & workflow management
          </p>
        </div>

        {/* Chat Messages */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '15px'
        }}>
          {chatMessages.map((message) => (
            <div key={message.id} style={{
              marginBottom: '15px',
              display: 'flex',
              flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
              gap: '10px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor:
                  message.role === 'user' ? '#0066cc' :
                  message.role === 'system' ? '#666' : '#00aa44',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                flexShrink: 0
              }}>
                {message.role === 'user' ? '👤' :
                 message.role === 'system' ? '⚙️' : '🤖'}
              </div>

              <div style={{ flex: 1, maxWidth: '85%' }}>
                <div style={{
                  backgroundColor:
                    message.role === 'user' ? '#003366' :
                    message.role === 'system' ? '#333' : '#0f0f0f',
                  border: '1px solid #333',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '14px',
                  lineHeight: '1.4'
                }}>
                  {message.content}
                </div>

                <div style={{
                  fontSize: '11px',
                  color: '#666',
                  marginTop: '4px',
                  textAlign: message.role === 'user' ? 'right' : 'left'
                }}>
                  {formatTimestamp(message.timestamp)}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '15px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#00aa44',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px'
              }}>
                🤖
              </div>
              <div style={{
                backgroundColor: '#0f0f0f',
                border: '1px solid #333',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '14px',
                color: '#888'
              }}>
                <span>Processing</span>
                <span style={{ animation: 'pulse 1.5s infinite' }}>...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div style={{
          padding: '15px',
          borderTop: '1px solid #333'
        }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <textarea
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder='Describe a task to decompose, request agent assignments, or ask for guidance...'
              disabled={isLoading}
              style={{
                flex: 1,
                minHeight: '60px',
                maxHeight: '120px',
                padding: '10px',
                backgroundColor: '#0f0f0f',
                border: '1px solid #333',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!currentMessage.trim() || isLoading}
              style={{
                padding: '10px 15px',
                backgroundColor: currentMessage.trim() && !isLoading ? '#00aa44' : '#333',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                cursor: currentMessage.trim() && !isLoading ? 'pointer' : 'not-allowed',
                fontSize: '16px',
                alignSelf: 'flex-end'
              }}
            >
              📤
            </button>
          </div>
          <div style={{
            fontSize: '11px',
            color: '#666',
            marginTop: '5px'
          }}>
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
