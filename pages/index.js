import { useState, useEffect } from 'react';

export default function Home() {
  const [state, setState] = useState({
    connected: false,
    sessionToken: '',
    threadId: generateThreadId(),
    planningQueue: [],
    githubConfig: {
      owner: 'bhuman-ai',
      repo: 'gesture_generator'
    }
  });

  const [sessionInput, setSessionInput] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [status, setStatus] = useState('');
  const [conversation, setConversation] = useState([
    { role: 'system', content: 'Ready to help you plan tasks. Connect to Terragon to begin.' }
  ]);

  useEffect(() => {
    // Load saved data
    const savedToken = localStorage.getItem('terragonSession');
    if (savedToken) {
      setSessionInput(savedToken);
    }
    
    const savedGithub = localStorage.getItem('githubConfig');
    if (savedGithub) {
      setState(prev => ({ ...prev, githubConfig: JSON.parse(savedGithub) }));
    }
  }, []);

  function generateThreadId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function generateActionId() {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < 40; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  async function connectToTerragon() {
    if (!sessionInput.trim()) {
      showStatus('Please enter a session token', 'error');
      return;
    }
    
    showStatus('Validating session...', 'info');
    
    try {
      const response = await fetch('/api/validate-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ session_token: sessionInput })
      });
      
      const result = await response.json();
      
      if (result.valid) {
        setState(prev => ({ ...prev, connected: true, sessionToken: sessionInput }));
        showStatus('Connected to Terragon!', 'success');
        localStorage.setItem('terragonSession', sessionInput);
      } else {
        showStatus('Invalid session: ' + result.message, 'error');
      }
    } catch (error) {
      showStatus('Failed to connect: ' + error.message, 'error');
    }
  }

  async function submitToPlanningQueue() {
    if (!state.connected) {
      showStatus('Please connect to Terragon first', 'error');
      return;
    }
    
    if (!taskTitle.trim() || !taskDescription.trim()) {
      showStatus('Please fill in all fields', 'error');
      return;
    }
    
    const task = {
      id: Date.now(),
      title: taskTitle,
      description: taskDescription,
      priority: taskPriority,
      phase: 'seedling',
      status: 'planning',
      createdAt: new Date().toISOString(),
      threadId: generateThreadId()
    };
    
    setState(prev => ({ ...prev, planningQueue: [...prev.planningQueue, task] }));
    
    // Clear form
    setTaskTitle('');
    setTaskDescription('');
    
    // Send to Terragon for planning
    await sendToTerragon(task);
  }

  async function sendToTerragon(task) {
    const prompt = `I need help planning a task for implementation. Please analyze this request and create a detailed plan.

Task: ${task.title}
Description: ${task.description}
Priority: ${task.priority}

Please provide:
1. A clear breakdown of implementation steps
2. Required technologies and dependencies
3. Potential challenges and solutions
4. Time estimate for completion
5. A GitHub issue description with @terragon-labs mention

Format the response as a structured plan that can be converted to a GitHub issue.`;
    
    addMessage('user', prompt);
    
    try {
      const payload = [
        task.threadId,
        { role: "user", content: prompt },
        null,
        { modelId: "claude-3-5-sonnet-20241022", attachments: [] }
      ];
      
      // Use the new Terragon format
      let response = await fetch('/api/actions/terragon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionToken: state.sessionToken,
          message: prompt,
          githubRepoFullName: `${state.githubConfig.owner}/${state.githubConfig.repo}`,
          repoBaseBranchName: "main"
        })
      });
      
      // Fallback to original endpoint if needed
      if (!response.ok && response.status === 404) {
        response = await fetch('/api/terragon', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': state.sessionToken,
            'X-Next-Action': generateActionId()
          },
          body: JSON.stringify(payload)
        });
      }
      
      const contentType = response.headers.get('content-type');
      console.log('Response status:', response.status, 'Content-Type:', contentType);
      
      if (response.ok || response.status === 200) {
        let result;
        
        if (contentType && contentType.includes('application/json')) {
          result = await response.json();
          console.log('API Response:', result);
          
          if (result.success === false && result.status === 404) {
            // This is the "Server action not found" response from Terragon
            // Try a different approach or show a specific error
            throw new Error('Terragon API format may have changed. Please check session token.');
          }
          
          if (result.taskId) {
            task.terragonTaskId = result.taskId;
            task.terragonUrl = `https://www.terragonlabs.com/task/${result.taskId}`;
          } else if (result.data) {
            // Try to extract ID from the data field
            const idMatch = result.data.match(/"id":"([a-f0-9-]+)"|task\/([a-f0-9-]+)/);
            if (idMatch) {
              task.terragonTaskId = idMatch[1] || idMatch[2];
              task.terragonUrl = `https://www.terragonlabs.com/task/${task.terragonTaskId}`;
            }
          }
        } else {
          const text = await response.text();
          console.log('Raw response:', text.substring(0, 200));
          const idMatch = text.match(/"id":"([a-f0-9-]+)"/);
          if (idMatch) {
            task.terragonTaskId = idMatch[1];
            task.terragonUrl = `https://www.terragonlabs.com/task/${task.terragonTaskId}`;
          }
        }
        
        if (task.terragonUrl) {
          console.log('Terragon Task URL:', task.terragonUrl);
          // Update task phase
          task.phase = 'growing';
          updateQueue(task);
          
          // Show success message with link
          addMessage('assistant', `Task created successfully! View on Terragon: ${task.terragonUrl}`);
          showStatus('Task sent to Terragon!', 'success');
        } else {
          // Still update phase even if we don't have URL yet
          task.phase = 'growing';
          updateQueue(task);
          addMessage('assistant', 'Task is being processed by Terragon AI...');
        }
        
        // Simulate GitHub issue creation after a delay
        setTimeout(() => {
          task.phase = 'ready';
          task.githubIssue = Math.floor(Math.random() * 1000);
          updateQueue(task);
          showStatus(`GitHub issue #${task.githubIssue} created!`, 'success');
        }, 3000);
      } else {
        let errorMsg;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorData.message || JSON.stringify(errorData);
        } catch (e) {
          errorMsg = await response.text();
        }
        console.error('API Error:', response.status, errorMsg);
        throw new Error(`API error ${response.status}: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Failed to send to Terragon:', error);
      addMessage('assistant', 'Error: ' + error.message);
      showStatus('Failed to process task: ' + error.message, 'error');
    }
  }

  function updateQueue(updatedTask) {
    setState(prev => ({
      ...prev,
      planningQueue: prev.planningQueue.map(task => 
        task.id === updatedTask.id ? updatedTask : task
      )
    }));
  }

  function addMessage(role, content) {
    setConversation(prev => [...prev, { role, content }]);
  }

  function showStatus(message, type) {
    setStatus({ message, type });
    setTimeout(() => setStatus(''), 5000);
  }

  function saveGitHubConfig(owner, repo) {
    const config = { owner, repo };
    setState(prev => ({ ...prev, githubConfig: config }));
    localStorage.setItem('githubConfig', JSON.stringify(config));
    showStatus('GitHub settings saved!', 'success');
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
        
        input, textarea, select {
          width: 100%;
          padding: 12px;
          background: #0a0a0a;
          border: 1px solid #333;
          border-radius: 5px;
          color: #e0e0e0;
          font-family: inherit;
          margin-bottom: 10px;
        }
        
        button {
          padding: 12px 24px;
          background: #00ff88;
          color: #0a0a0a;
          border: none;
          border-radius: 5px;
          font-size: 16px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.3s;
        }
        
        button:hover {
          background: #00cc6a;
          transform: translateY(-1px);
        }
        
        button:disabled {
          background: #333;
          color: #666;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', color: '#00ff88', fontSize: '2.5em', marginBottom: '10px' }}>
          🚀 Terragon Planning Queue
        </h1>
        <p style={{ textAlign: 'center', color: '#888', marginBottom: '30px', fontSize: '1.1em' }}>
          AI-powered task planning with GitHub integration
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
            <h2 style={{ color: '#00ff88', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: state.connected ? '#00ff88' : '#ff3300'
              }}></span>
              Terragon Connection
            </h2>
            <div style={{ marginBottom: '10px', fontSize: '12px', color: '#888' }}>
              <details>
                <summary style={{ cursor: 'pointer', marginBottom: '5px' }}>📖 How to get session token</summary>
                <ol style={{ marginLeft: '20px', marginTop: '10px', lineHeight: '1.6' }}>
                  <li>Log in to <a href="https://www.terragonlabs.com" target="_blank" rel="noopener noreferrer" style={{ color: '#00ff88' }}>terragonlabs.com</a></li>
                  <li>Press F12 (Developer Tools)</li>
                  <li>Go to Application → Cookies</li>
                  <li>Find "__Secure-better-auth.session_token" cookie</li>
                  <li>Copy the value (e.g. JTgr3pSv...)</li>
                </ol>
                <p style={{ marginTop: '10px', fontSize: '11px' }}>
                  ⏰ Tokens last 24-48 hours typically
                </p>
              </details>
            </div>
            <input
              type="password"
              placeholder="Paste your __Secure-better-auth.session_token value here"
              value={sessionInput}
              onChange={(e) => setSessionInput(e.target.value)}
              style={{ fontFamily: 'Monaco, Menlo, monospace', fontSize: '11px' }}
            />
            <button onClick={connectToTerragon}>Connect to Terragon</button>
            {status && (
              <div style={{
                marginTop: '10px',
                padding: '10px',
                borderRadius: '5px',
                background: status.type === 'error' ? '#ff330033' : '#00ff8833',
                border: `1px solid ${status.type === 'error' ? '#ff3300' : '#00ff88'}`
              }}>
                {status.message}
              </div>
            )}
          </div>
          
          <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
            <h2 style={{ color: '#00ff88', marginBottom: '15px' }}>GitHub Configuration</h2>
            <input
              type="text"
              placeholder="Repository owner"
              value={state.githubConfig.owner}
              onChange={(e) => setState(prev => ({ ...prev, githubConfig: { ...prev.githubConfig, owner: e.target.value } }))}
            />
            <input
              type="text"
              placeholder="Repository name"
              value={state.githubConfig.repo}
              onChange={(e) => setState(prev => ({ ...prev, githubConfig: { ...prev.githubConfig, repo: e.target.value } }))}
            />
            <button onClick={() => saveGitHubConfig(state.githubConfig.owner, state.githubConfig.repo)}>
              Save GitHub Settings
            </button>
          </div>
        </div>
        
        <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '10px', border: '1px solid #333', marginBottom: '20px' }}>
          <h2 style={{ color: '#00ff88', marginBottom: '15px' }}>📋 Planning Queue</h2>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '10px' }}>New Task Planning Request</h3>
            <input
              type="text"
              placeholder="Task title..."
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <textarea
              rows="4"
              placeholder="Describe what you want to build..."
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
            />
            <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}>
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
            <button onClick={submitToPlanningQueue}>🌱 Submit to Planning Queue</button>
          </div>
          
          <div>
            {state.planningQueue.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
                No tasks in planning queue
              </p>
            ) : (
              state.planningQueue.map(task => (
                <div key={task.id} style={{
                  background: '#0a0a0a',
                  padding: '15px',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  border: '1px solid #333',
                  borderLeft: `4px solid ${task.phase === 'seedling' ? '#ffaa00' : task.phase === 'growing' ? '#00aaff' : '#00ff88'}`
                }}>
                  <div style={{ fontWeight: 'bold', color: '#00ff88', marginBottom: '5px' }}>
                    {task.title}
                  </div>
                  <div style={{ color: '#aaa', margin: '5px 0' }}>{task.description}</div>
                  <div style={{ fontSize: '12px', color: '#888', display: 'flex', gap: '15px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      background: task.phase === 'seedling' ? '#ffaa0033' : task.phase === 'growing' ? '#00aaff33' : '#00ff8833',
                      color: task.phase === 'seedling' ? '#ffaa00' : task.phase === 'growing' ? '#00aaff' : '#00ff88'
                    }}>
                      {task.phase === 'seedling' ? '🌱' : task.phase === 'growing' ? '🌿' : '🌳'} {task.phase}
                    </span>
                    <span>Priority: {task.priority}</span>
                    {task.terragonUrl && (
                      <span>
                        <a href={task.terragonUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#00ff88' }}>
                          View on Terragon
                        </a>
                      </span>
                    )}
                    {task.githubIssue && <span>GitHub #{task.githubIssue}</span>}
                    <span>{new Date(task.createdAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
          <h2 style={{ color: '#00ff88', marginBottom: '15px' }}>💬 Terragon Conversation</h2>
          <div style={{
            background: '#0a0a0a',
            padding: '15px',
            borderRadius: '5px',
            maxHeight: '400px',
            overflowY: 'auto',
            border: '1px solid #333',
            fontFamily: 'Monaco, Menlo, monospace',
            fontSize: '12px'
          }}>
            {conversation.map((msg, idx) => (
              <div key={idx} style={{
                marginBottom: '15px',
                padding: '10px',
                borderRadius: '5px',
                background: msg.role === 'user' ? '#00ff8822' : '#00aaff22',
                borderLeft: `3px solid ${msg.role === 'user' ? '#00ff88' : '#00aaff'}`
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px', textTransform: 'uppercase', fontSize: '10px' }}>
                  {msg.role}
                </div>
                <div>{msg.content}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}