import { useState, useEffect } from 'react';
import RequirementsModal from '../components/RequirementsModal';
import PreResearchModal from '../components/PreResearchModal';
import PostResearchModal from '../components/PostResearchModal';
import ProposalReviewModal from '../components/ProposalReviewModal';
import TaskCreationProgress from '../components/TaskCreationProgress';
import TaskMonitorDashboard from '../components/TaskMonitorDashboard';
import CalibrationWizard from '../components/CalibrationWizard';
import UserSettingsModal from '../components/UserSettingsModal';
import ClaudeAutoUpdaterPanel from '../components/ClaudeAutoUpdaterPanel';
import WorkflowHierarchy from '../components/WorkflowHierarchy';

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
  const [enrichContext, setEnrichContext] = useState(true);
  const [useMetaAgent, setUseMetaAgent] = useState(true);
  const [showRequirements, setShowRequirements] = useState(false);
  const [pendingRequirements, setPendingRequirements] = useState(null);
  const [showPreResearch, setShowPreResearch] = useState(false);
  const [showPostResearch, setShowPostResearch] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [preResearchAnswers, setPreResearchAnswers] = useState(null);
  const [postResearchRequirements, setPostResearchRequirements] = useState(null);
  const [showProposal, setShowProposal] = useState(false);
  const [currentProposal, setCurrentProposal] = useState(null);
  const [showTaskProgress, setShowTaskProgress] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [showTaskMonitor, setShowTaskMonitor] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [hasClaudeMd, setHasClaudeMd] = useState(null);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [userSettings, setUserSettings] = useState(null);
  const [currentView, setCurrentView] = useState('queue'); // 'queue' or 'workflow'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conversation, setConversation] = useState([
    { role: 'system', content: 'Ready to help you plan tasks. Connect to Terragon to begin.' }
  ]);

  // Load saved data on mount
  useEffect(() => {
    // Load user settings
    const savedUserSettings = localStorage.getItem('meta-agent-user-settings');
    if (savedUserSettings) {
      setUserSettings(JSON.parse(savedUserSettings));
    }

    // Load project data
    const savedProjectData = localStorage.getItem('projectData');
    if (savedProjectData) {
      try {
        setProjectData(JSON.parse(savedProjectData));
      } catch (e) {
        console.error('Failed to load project data:', e);
      }
    }

    // Load saved data
    const savedToken = localStorage.getItem('terragonSession');
    if (savedToken) {
      setSessionInput(savedToken);
      setState(prev => ({ ...prev, sessionToken: savedToken }));
      // Auto-connect if we have a saved token
      setTimeout(() => connectToTerragon(savedToken), 100);
    }

    const savedGithub = localStorage.getItem('githubConfig');
    if (savedGithub) {
      setState(prev => ({ ...prev, githubConfig: JSON.parse(savedGithub) }));
    }

    // Load saved tasks
    const savedTasks = localStorage.getItem('planningQueue');
    if (savedTasks) {
      try {
        const tasks = JSON.parse(savedTasks);
        setState(prev => ({ ...prev, planningQueue: tasks }));
      } catch (error) {
        console.error('Error loading saved tasks:', error);
      }
    }

    // Load other saved state
    const savedState = localStorage.getItem('appState');
    if (savedState) {
      try {
        const appState = JSON.parse(savedState);
        setEnrichContext(appState.enrichContext !== undefined ? appState.enrichContext : true);
        setUseMetaAgent(appState.useMetaAgent !== undefined ? appState.useMetaAgent : true);
      } catch (error) {
        console.error('Error loading saved app state:', error);
      }
    }
  }, []);

  // Check for CLAUDE.md on mount and when GitHub config changes
  useEffect(() => {
    checkForClaudeMd();
  }, [state.githubConfig]);

  const checkForClaudeMd = async () => {
    try {
      const response = await fetch('/api/calibration/check-claude-md');
      const data = await response.json();

      setHasClaudeMd(data.exists);

      // If no CLAUDE.md exists and user saves GitHub config, show calibration
      if (!data.exists && state.githubConfig.owner && state.githubConfig.repo) {
        setShowCalibration(true);
      }
    } catch (error) {
      console.error('Failed to check for CLAUDE.md:', error);
      setHasClaudeMd(false);
    }
  };

  // Save app state when toggles change
  useEffect(() => {
    const appState = {
      enrichContext,
      useMetaAgent
    };
    localStorage.setItem('appState', JSON.stringify(appState));
  }, [enrichContext, useMetaAgent]);

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

  async function connectToTerragon(tokenToUse) {
    // Use provided token or the one from input
    const token = tokenToUse || sessionInput;

    if (!token.trim()) {
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
        body: JSON.stringify({ session_token: token })
      });

      const result = await response.json();

      if (result.valid) {
        // Save token first
        localStorage.setItem('terragonSession', token);
        setState(prev => ({ ...prev, connected: true, sessionToken: token }));
        showStatus('Connected to Terragon!', 'success');
        // Update the input field if we used a saved token
        if (tokenToUse) {
          setSessionInput(token);
        }
      } else {
        showStatus(`Invalid session: ${result.message}`, 'error');
        // Clear saved token if it's invalid
        localStorage.removeItem('terragonSession');
      }
    } catch (error) {
      showStatus(`Failed to connect: ${error.message}`, 'error');
    }
  }

  async function submitToPlanningQueue() {
    // Prevent double submission
    if (isSubmitting) {
      return;
    }

    // Allow Meta-Agent to work without Terragon connection
    if (!state.connected && !useMetaAgent) {
      showStatus('Please connect to Terragon first', 'error');
      return;
    }

    if (!taskTitle.trim() || !taskDescription.trim()) {
      showStatus('Please fill in all fields', 'error');
      return;
    }

    setIsSubmitting(true);

    // Warn if Meta-Agent is disabled
    if (!useMetaAgent) {
      const confirmed = window.confirm(
        '⚠️ Meta-Agent is disabled!\n\n' +
        'Without Meta-Agent, your task will be sent directly to Terragon without:\n' +
        '• Intelligent requirements gathering\n' +
        '• Research and best practices analysis\n' +
        '• Detailed task decomposition\n' +
        '• Proposal review\n\n' +
        'Are you sure you want to continue without planning?'
      );
      if (!confirmed) {
        setIsSubmitting(false);
        return;
      }
    }

    // Check if we need to run calibration first (no CLAUDE.md)
    if (useMetaAgent && hasClaudeMd === false) {
      alert('⚠️ No CLAUDE.md found! Please run repository calibration first to create your sacred source of truth.');
      setShowCalibration(true);
      setIsSubmitting(false);
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

    setState(prev => {
      const newQueue = [...prev.planningQueue, task];
      // Save to localStorage
      localStorage.setItem('planningQueue', JSON.stringify(newQueue));
      return { ...prev, planningQueue: newQueue };
    });

    // Clear form
    setTaskTitle('');
    setTaskDescription('');

    try {
      // Send to Terragon for planning
      await sendToTerragon(task);
    } catch (error) {
      console.error('Error submitting task:', error);
      showStatus('Failed to submit task', 'error');
    } finally {
      setIsSubmitting(false);
    }
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
5. A structured task description ready for Terragon API

Format the response as a structured implementation plan with clear subtasks and deliverables.`;

    // If MetaAgent is enabled, start with pre-research questions
    if (useMetaAgent) {
      showStatus('Meta-Agent starting two-phase analysis...', 'info');

      // Store the task and show pre-research modal
      setCurrentTask(task);
      setShowPreResearch(true);

      // Don't send to Terragon yet - wait for two-phase question flow
      return;
    }

    addMessage('user', prompt);

    try {
      const payload = [
        task.threadId,
        { role: 'user', content: prompt },
        null,
        { modelId: 'claude-3-5-sonnet-20241022', attachments: [] }
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
          repoBaseBranchName: 'main',
          enrichContext: enrichContext
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
            // This is the 'Server action not found' response from Terragon
            // Try a different approach or show a specific error
            throw new Error('Terragon API format may have changed. Please check session token.');
          }

          if (result.taskId) {
            task.terragonTaskId = result.taskId;
            task.terragonUrl = result.terragonUrl || `https://www.terragonlabs.com/task/${result.taskId}`;
          }
        } else {
          const text = await response.text();
          console.log('Raw response:', text.substring(0, 200));
          const idMatch = text.match(/'id':'([a-f0-9-]+)'/);
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

        // Update task status after processing
        setTimeout(() => {
          task.phase = 'ready';
          task.terragonTaskId = task.terragonTaskId || `terragon-${task.id}`;
          updateQueue(task);
          showStatus(`Task ready for implementation!`, 'success');
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
      addMessage('assistant', `Error: ${error.message}`);
      showStatus(`Failed to process task: ${error.message}`, 'error');
    }
  }

  function updateQueue(updatedTask) {
    setState(prev => {
      const newQueue = prev.planningQueue.map(task =>
        task.id === updatedTask.id ? updatedTask : task);

      // Save to localStorage
      localStorage.setItem('planningQueue', JSON.stringify(newQueue));

      return {
        ...prev,
        planningQueue: newQueue
      };
    });
  }

  function addMessage(role, content) {
    setConversation(prev => [...prev, { role, content }]);
  }

  function showStatus(message, type) {
    setStatus({ message, type });
    setTimeout(() => setStatus(''), 5000);
  }

  // Handle pre-research answers and start research + post-research questions
  async function handlePreResearchSubmit(answers) {
    if (!currentTask) return;

    showStatus('Phase 1 complete. Starting research and codebase analysis...', 'info');
    setPreResearchAnswers(answers);
    setShowPreResearch(false);

    try {
      // Generate post-research questions with full context
      const postResearchResponse = await fetch('/api/meta-agent/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'post-research-requirements',
          message: `${currentTask.title}: ${currentTask.description}`,
          preResearchAnswers: answers,
          context: {
            priority: currentTask.priority,
            githubRepo: `${state.githubConfig.owner}/${state.githubConfig.repo}`
          }
        })
      });

      if (postResearchResponse.ok) {
        const postResult = await postResearchResponse.json();

        if (postResult.result && postResult.result.questions && postResult.result.questions.length > 0) {
          // Store post-research requirements
          setPostResearchRequirements(postResult.result);
          setShowPostResearch(true);

          showStatus('Research complete! Phase 2 questions ready.', 'success');
          addMessage('assistant', `Research completed with ${postResult.result.questions.length} informed questions based on findings.`);
        } else {
          throw new Error('No post-research questions generated');
        }
      } else {
        throw new Error(`Post-research API error: ${postResearchResponse.status}`);
      }

    } catch (error) {
      console.error('Error in post-research phase:', error);
      showStatus(`Research phase error: ${error.message}`, 'error');

      // Fall back to direct proposal creation
      await createProposalFromPreResearch(answers);
    }
  }

  // Handle post-research answers and create proposal
  async function handlePostResearchSubmit(answers) {
    if (!currentTask || !preResearchAnswers || !postResearchRequirements) return;

    showStatus('Phase 2 complete. Creating comprehensive proposal...', 'info');
    setShowPostResearch(false);

    try {
      // Create comprehensive proposal with both sets of answers
      const proposalResponse = await fetch('/api/meta-agent/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          message: `${currentTask.title}: ${currentTask.description}`,
          context: {
            priority: currentTask.priority,
            githubRepo: `${state.githubConfig.owner}/${state.githubConfig.repo}`,
            preResearchAnswers: preResearchAnswers,
            postResearchAnswers: answers
          },
          requirements: {
            questions: postResearchRequirements.questions.map((q, idx) => ({
              ...q,
              answer: answers[q.id] || 'No answer provided'
            })),
            preResearchAnswers: preResearchAnswers,
            research: postResearchRequirements.research
          }
        })
      });

      if (!proposalResponse.ok) {
        throw new Error(`Failed to create proposal: ${proposalResponse.status}`);
      }

      const proposalResult = await proposalResponse.json();

      if (proposalResult.success && proposalResult.proposal) {
        // Store the proposal with task context
        const proposalWithTask = {
          ...proposalResult.proposal,
          originalTask: currentTask
        };

        setCurrentProposal(proposalWithTask);
        setShowProposal(true);

        // Clear temporary state
        setCurrentTask(null);
        setPreResearchAnswers(null);
        setPostResearchRequirements(null);

        showStatus('✅ Comprehensive proposal ready for review!', 'success');
        addMessage('assistant', `Two-phase analysis complete! Meta-Agent created detailed proposal with ${proposalResult.proposal.decomposition?.microTasks?.length || 0} micro-tasks based on research and codebase analysis.`);

      } else {
        throw new Error(proposalResult.error || 'Failed to create proposal');
      }

    } catch (error) {
      console.error('Error creating comprehensive proposal:', error);
      showStatus(`Proposal error: ${error.message}`, 'error');

      // Fall back to basic proposal
      await createProposalFromPreResearch(preResearchAnswers);
    }
  }

  // Fallback: Create proposal from just pre-research answers
  async function createProposalFromPreResearch(preAnswers) {
    try {
      showStatus('Creating basic proposal from initial answers...', 'info');

      const proposalResponse = await fetch('/api/meta-agent/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          message: `${currentTask.title}: ${currentTask.description}`,
          context: {
            priority: currentTask.priority,
            githubRepo: `${state.githubConfig.owner}/${state.githubConfig.repo}`,
            preResearchAnswers: preAnswers
          }
        })
      });

      if (proposalResponse.ok) {
        const result = await proposalResponse.json();
        if (result.success) {
          setCurrentProposal({
            ...result.proposal,
            originalTask: currentTask
          });
          setShowProposal(true);
          setCurrentTask(null);
          setPreResearchAnswers(null);
        }
      }
    } catch (error) {
      console.error('Fallback proposal creation failed:', error);
      showStatus('Unable to create proposal. Please try again.', 'error');
    }
  }

  // DEPRECATED: Handle requirements submission from MetaAgent - OLD SINGLE-PHASE WORKFLOW
  async function handleRequirementsSubmit(answers) {
    if (!pendingRequirements) return;

    const { original, task, questions, research } = pendingRequirements;

    showStatus('Meta-Agent is creating comprehensive proposal...', 'info');

    try {
      // Create comprehensive proposal with all analysis
      const proposalResponse = await fetch('/api/meta-agent/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          message: `${task.title}: ${task.description}`,
          context: {
            priority: task.priority,
            githubRepo: `${state.githubConfig.owner}/${state.githubConfig.repo}`,
            answers: answers
          },
          requirements: {
            questions: questions.map((q, idx) => ({
              ...q,
              answer: answers[q.id] || answers[idx] || 'No answer provided'
            }))
          }
        })
      });

      if (!proposalResponse.ok) {
        throw new Error(`Failed to create proposal: ${proposalResponse.status}`);
      }

      const proposalResult = await proposalResponse.json();

      if (proposalResult.success && proposalResult.proposal) {
        // Store the current task context for later execution
        const proposalWithTask = {
          ...proposalResult.proposal,
          originalTask: task
        };

        // Close requirements modal and show proposal review modal
        setShowRequirements(false);
        setPendingRequirements(null);
        setCurrentProposal(proposalWithTask);
        setShowProposal(true);

        showStatus('✅ Proposal ready for review!', 'success');
        addMessage('assistant', `Meta-Agent created comprehensive proposal with ${proposalResult.proposal.decomposition?.microTasks?.length || 0} micro-tasks. Review and approve to proceed.`);

      } else {
        throw new Error(proposalResult.error || 'Failed to create proposal');
      }

    } catch (error) {
      console.error('Error creating Meta-Agent proposal:', error);
      showStatus(`Error: ${error.message}`, 'error');
      addMessage('system', `Error: ${error.message}`);

      // Fall back to original Terragon-only flow
      showStatus('Falling back to direct Terragon submission...', 'info');
      await sendToTerragonDirect(task, answers);
    }
  }

  // Handle proposal approval
  async function handleProposalApprove(proposal) {
    showStatus('Executing approved proposal...', 'info');

    try {
      const approveResponse = await fetch('/api/meta-agent/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          proposalId: proposal.id
        })
      });

      if (!approveResponse.ok) {
        throw new Error(`Failed to approve proposal: ${approveResponse.status}`);
      }

      const result = await approveResponse.json();

      if (result.success) {
        // Close proposal modal
        setShowProposal(false);
        setCurrentProposal(null);

        // Update task in queue
        const task = proposal.originalTask;
        task.phase = 'executing';
        task.metaAgentProposalId = proposal.id;
        updateQueue(task);

        showStatus('✅ Proposal approved! Task execution started.', 'success');
        addMessage('assistant', 'Proposal approved! Meta-Agent is now executing the task...');

        // Execute the actual Terragon task
        await executeApprovedTask(proposal);

      } else {
        throw new Error(result.error || 'Failed to approve proposal');
      }

    } catch (error) {
      console.error('Error approving proposal:', error);
      showStatus(`Error: ${error.message}`, 'error');
    }
  }

  // Handle proposal rejection
  async function handleProposalReject(proposal) {
    showStatus('Rejecting proposal...', 'info');

    try {
      const rejectResponse = await fetch('/api/meta-agent/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          proposalId: proposal.id
        })
      });

      const result = await rejectResponse.json();

      // Close proposal modal
      setShowProposal(false);
      setCurrentProposal(null);

      showStatus('❌ Proposal rejected.', 'info');
      addMessage('assistant', 'Proposal rejected. You can create a new task with different requirements.');

    } catch (error) {
      console.error('Error rejecting proposal:', error);
      showStatus(`Error: ${error.message}`, 'error');
    }
  }

  // Handle proposal modification
  async function handleProposalModify(proposal, modifications) {
    showStatus('Modifying proposal...', 'info');

    try {
      const modifyResponse = await fetch('/api/meta-agent/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'modify',
          proposalId: proposal.id,
          modifications: modifications
        })
      });

      if (!modifyResponse.ok) {
        throw new Error(`Failed to modify proposal: ${modifyResponse.status}`);
      }

      const result = await modifyResponse.json();

      if (result.success) {
        // Update current proposal with modified version
        setCurrentProposal({
          ...result.proposal,
          originalTask: proposal.originalTask
        });

        showStatus('✏️ Proposal modified! Review the changes.', 'success');
        addMessage('assistant', 'Proposal has been modified based on your feedback. Please review the updated plan.');

      } else {
        throw new Error(result.error || 'Failed to modify proposal');
      }

    } catch (error) {
      console.error('Error modifying proposal:', error);
      showStatus(`Error: ${error.message}`, 'error');
    }
  }


  // Handle calibration completion
  async function handleCalibrationComplete(calibrationResult) {
    const { claudeMd, cleanup, calibrationData } = calibrationResult;

    // Mark calibration as complete
    setHasClaudeMd(true);
    setShowCalibration(false);

    // Show success message
    showStatus('🔥 Sacred calibration complete! CLAUDE.md is now your source of truth.', 'success');

    // If cleanup was approved, execute it
    if (cleanup && cleanup.length > 0) {
      showStatus(`Cleaning up ${cleanup.length} obsolete files...`, 'info');

      try {
        await fetch('/api/calibration/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: cleanup })
        });

        showStatus('✨ Cleanup complete! Your repository is now aligned with CLAUDE.md', 'success');
      } catch (error) {
        console.error('Cleanup failed:', error);
        showStatus('Cleanup failed, but calibration is complete', 'warning');
      }
    }
  }

  // Handle user settings save
  const handleUserSettingsSave = (newSettings) => {
    setUserSettings(newSettings);
    console.log('User settings updated:', newSettings);
  };

  // Execute the approved task
  async function executeApprovedTask(proposal) {
    try {
      // Create task with Meta-Agent structure
      const createResponse = await fetch('/api/meta-agent/create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: proposal.id,
          title: proposal.taskTitle,
          description: proposal.originalTask.description,
          decomposition: proposal.decomposition,
          sessionToken: state.sessionToken,
          githubRepoFullName: `${state.githubConfig.owner}/${state.githubConfig.repo}`,
          originalTask: proposal.originalTask,
          requirements: proposal.requirements,
          research: proposal.research
        })
      });

      if (createResponse.ok) {
        const createResult = await createResponse.json();

        if (createResult.success && createResult.task) {
          // Show progress modal
          setCurrentTaskId(createResult.task.taskId);
          setShowTaskProgress(true);

          // Update task
          const task = proposal.originalTask;
          task.terragonTaskId = createResult.task.terragon?.taskId;
          task.terragonUrl = createResult.task.terragon?.terragonUrl;
          task.metaAgentTaskId = createResult.task.taskId;
          task.taskPath = createResult.task.taskPath;
          task.phase = 'ready';
          updateQueue(task);

          showStatus('✅ Task executing successfully!', 'success');
          addMessage('assistant', `Task structure created at: ${createResult.task.taskPath}`);

          if (createResult.task.terragon?.terragonUrl) {
            addMessage('assistant', `Terragon task: ${createResult.task.terragon.terragonUrl}`);
          }
        }
      }

    } catch (error) {
      console.error('Error executing approved task:', error);
      showStatus(`Execution error: ${error.message}`, 'error');
    }
  }

  // Fallback function for direct Terragon submission
  async function sendToTerragonDirect(task, answers) {
    const enhancedPrompt = `Task: ${task.title}\nDescription: ${task.description}\n\n[Requirements:`;

    Object.entries(answers).forEach(([questionId, answer]) => {
      enhancedPrompt += `\n- ${questionId}: ${Array.isArray(answer) ? answer.join(', ') : answer}`;
    });

    enhancedPrompt += ']\n\nPlease create a detailed implementation plan.';

    try {
      const response = await fetch('/api/actions/terragon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: state.sessionToken,
          message: enhancedPrompt,
          githubRepoFullName: `${state.githubConfig.owner}/${state.githubConfig.repo}`,
          repoBaseBranchName: 'main',
          enrichContext: enrichContext
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.taskId) {
          task.terragonTaskId = result.taskId;
          task.terragonUrl = result.terragonUrl;
          task.phase = 'growing';
          updateQueue(task);
          showStatus('Task sent to Terragon!', 'success');
        }
      }
    } catch (error) {
      console.error('Fallback Terragon submission failed:', error);
    }
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

        {/* Calibration Status */}
        {hasClaudeMd !== null && (
          <div style={{
            background: hasClaudeMd ? '#001a00' : '#1a0000',
            padding: '15px',
            borderRadius: '10px',
            border: `1px solid ${hasClaudeMd ? '#00ff88' : '#ff6b6b'}`,
            marginBottom: '20px'
          }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{
                    color: hasClaudeMd ? '#00ff88' : '#ff6b6b',
                    margin: 0,
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    {hasClaudeMd ? '🔥 Sacred Document Active' : '📋 Repository Not Calibrated'}
                  </h3>
                  <p style={{
                    color: '#888',
                    fontSize: '12px',
                    margin: '5px 0 0 0'
                  }}>
                    {hasClaudeMd
                      ? 'CLAUDE.md is your source of truth'
                      : 'Create CLAUDE.md to enable sacred governance'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {hasClaudeMd && (
                    <button
                      onClick={() => window.open('/claude-md', '_blank')}
                      style={{
                        background: '#0066cc',
                        color: '#fff',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 'normal',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      📖 View Document
                    </button>
                  )}
                  <button
                    onClick={() => setShowCalibration(true)}
                    style={{
                      background: hasClaudeMd ? '#333' : '#ff6b6b',
                      color: '#fff',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: hasClaudeMd ? 'normal' : 'bold',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    {hasClaudeMd ? 'Update Calibration' : '🔥 Start Calibration'}
                  </button>
                </div>
              </div>
          </div>
        )}

        {/* User Settings Section */}
        <div style={{
          background: '#1a1a1a',
          padding: '20px',
          borderRadius: '10px',
          border: '1px solid #333',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{
                color: '#0088ff',
                margin: 0,
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                ⚙️ Meta-Agent Settings
              </h3>
              <p style={{
                color: '#888',
                fontSize: '12px',
                margin: '5px 0 0 0'
              }}>
                {userSettings
                  ? `Technical Level: ${userSettings.technicalKnowledge}, Style: ${userSettings.questioningStyle}`
                  : 'Configure how Meta-Agent generates questions for you'}
              </p>
            </div>
            <button
              onClick={() => setShowUserSettings(true)}
              style={{
                background: userSettings ? '#333' : '#0088ff',
                color: '#fff',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: userSettings ? 'normal' : 'bold',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              {userSettings ? 'Update Settings' : '⚙️ Configure'}
            </button>
          </div>
        </div>

        {/* Claude Auto-Updater Panel */}
        {hasClaudeMd && <ClaudeAutoUpdaterPanel />}

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
                  <li>Log in to <a href='https://www.terragonlabs.com' target='_blank' rel='noopener noreferrer' style={{ color: '#00ff88' }}>terragonlabs.com</a></li>
                  <li>Press F12 (Developer Tools)</li>
                  <li>Go to Application → Cookies</li>
                  <li>Find '__Secure-better-auth.session_token' cookie</li>
                  <li>Copy the value (e.g. JTgr3pSv...)</li>
                </ol>
                <p style={{ marginTop: '10px', fontSize: '11px' }}>
                  ⏰ Tokens last 24-48 hours typically
                </p>
              </details>
            </div>
            <input
              type='password'
              placeholder='Paste your __Secure-better-auth.session_token value here'
              value={sessionInput}
              onChange={(e) => setSessionInput(e.target.value)}
              style={{ fontFamily: 'Monaco, Menlo, monospace', fontSize: '11px' }}
            />
            <button onClick={() => connectToTerragon()}>
              {state.connected ? 'Reconnect' : 'Connect to Terragon'}
            </button>
            {state.connected && (
              <button
                onClick={() => {
                  setState(prev => ({ ...prev, connected: false, sessionToken: '' }));
                  localStorage.removeItem('terragonSession');
                  setSessionInput('');
                  showStatus('Disconnected from Terragon', 'info');
                }}
                style={{ marginLeft: '10px', background: '#ff3300' }}
              >
                Disconnect
              </button>
            )}
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
            <h2 style={{ color: '#00ff88', marginBottom: '15px' }}>Configuration</h2>
            <div style={{ marginBottom: '15px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>GitHub Repository</h3>
              <input
                type='text'
                placeholder='Repository owner'
                value={state.githubConfig.owner}
                onChange={(e) => setState(prev => ({ ...prev, githubConfig: { ...prev.githubConfig, owner: e.target.value } }))}
              />
              <input
                type='text'
                placeholder='Repository name'
                value={state.githubConfig.repo}
                onChange={(e) => setState(prev => ({ ...prev, githubConfig: { ...prev.githubConfig, repo: e.target.value } }))}
              />
              <button onClick={() => saveGitHubConfig(state.githubConfig.owner, state.githubConfig.repo)}>
                Save GitHub Settings
              </button>
            </div>
            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #333' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>AI Enhancement Options</h3>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '15px' }}>
                <input
                  type='checkbox'
                  checked={enrichContext}
                  onChange={(e) => setEnrichContext(e.target.checked)}
                  style={{ width: 'auto', marginBottom: 0 }}
                />
                <span style={{ fontSize: '14px' }}>
                  Enable smart context injection (detects intent & adds task structure info)
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type='checkbox'
                  checked={useMetaAgent}
                  onChange={(e) => setUseMetaAgent(e.target.checked)}
                  style={{ width: 'auto', marginBottom: 0 }}
                />
                <span style={{ fontSize: '14px', fontWeight: useMetaAgent ? 'bold' : 'normal', color: useMetaAgent ? '#00ff88' : '#ccc' }}>
                  🧠 Meta-Agent - Intelligent task planning (RECOMMENDED)
                </span>
              </label>
              <p style={{ fontSize: '12px', color: useMetaAgent ? '#00ff88' : '#888', marginTop: '5px', marginLeft: '25px' }}>
                {useMetaAgent ? '✅ Active: ' : '⚠️ Disabled: '}Meta-Agent will analyze, research, and create a detailed plan before execution
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          borderBottom: '2px solid #333',
          paddingBottom: '10px'
        }}>
          <button
            onClick={() => setCurrentView('queue')}
            style={{
              padding: '10px 20px',
              background: currentView === 'queue' ? '#00ff88' : 'transparent',
              color: currentView === 'queue' ? '#000' : '#00ff88',
              border: '2px solid #00ff88',
              borderRadius: '5px 5px 0 0',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.3s ease'
            }}
          >
            📋 Planning Queue
          </button>
          <button
            onClick={() => setCurrentView('workflow')}
            style={{
              padding: '10px 20px',
              background: currentView === 'workflow' ? '#00ff88' : 'transparent',
              color: currentView === 'workflow' ? '#000' : '#00ff88',
              border: '2px solid #00ff88',
              borderRadius: '5px 5px 0 0',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.3s ease'
            }}
          >
            🔗 Workflow Hierarchy
          </button>
        </div>

        {/* Content based on current view */}
        {currentView === 'queue' ? (
        <>
        <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '10px', border: '1px solid #333', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ color: '#00ff88', margin: 0 }}>📋 Planning Queue</h2>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={() => setShowTaskMonitor(true)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#333',
                  color: '#00aaff',
                  border: '1px solid #555',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                🤖 Task Monitor
              </button>
              {state.planningQueue.length > 0 && (
                <button
                  onClick={() => {
                  setState(prev => ({ ...prev, planningQueue: [] }));
                  localStorage.removeItem('planningQueue');
                  showStatus('All tasks cleared', 'info');
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
                Clear All Tasks
              </button>
            )}
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '10px' }}>New Task Planning Request</h3>
            <input
              type='text'
              placeholder='Task title...'
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <textarea
              rows='4'
              placeholder='Describe what you want to build...'
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
            />
            <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}>
              <option value='low'>Low Priority</option>
              <option value='medium'>Medium Priority</option>
              <option value='high'>High Priority</option>
            </select>
            <button onClick={submitToPlanningQueue} disabled={isSubmitting}>
              {isSubmitting ? '⏳ Submitting...' : '🌱 Submit to Planning Queue'}
            </button>
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
                    {task.taskPath && (
                      <span>
                        <a href={`file://${task.taskPath}`} style={{ color: '#ffaa00' }}>
                          📁 Task Folder
                        </a>
                      </span>
                    )}
                    {task.terragonUrl && (
                      <>
                        <span>
                          <a href={`/task/${task.terragonTaskId}`} style={{ color: '#00ff88', marginRight: '10px' }}>
                            Open Chat
                          </a>
                        </span>
                        <span>
                          <a href={task.terragonUrl} target='_blank' rel='noopener noreferrer' style={{ color: '#00aaff' }}>
                            View on Terragon
                          </a>
                        </span>
                      </>
                    )}
                    {task.terragonTaskId && <span>Task: {task.terragonTaskId}</span>}
                    {task.metaAgentTaskId && <span>Task ID: {task.metaAgentTaskId}</span>}
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
      </>
      ) : (
        /* Workflow Hierarchy View */
        <WorkflowHierarchy />
      )}

      {/* DEPRECATED Requirements Modal (old single-phase) */}
      <RequirementsModal
        show={showRequirements}
        onClose={() => setShowRequirements(false)}
        requirements={pendingRequirements}
        onSubmit={handleRequirementsSubmit}
      />

      {/* NEW: Pre-Research Modal (Phase 1) */}
      <PreResearchModal
        show={showPreResearch}
        onClose={() => {
          setShowPreResearch(false);
          setCurrentTask(null);
        }}
        task={currentTask}
        onSubmit={handlePreResearchSubmit}
        githubConfig={state.githubConfig}
        userSettings={userSettings}
      />

      {/* NEW: Post-Research Modal (Phase 2) */}
      <PostResearchModal
        show={showPostResearch}
        onClose={() => {
          setShowPostResearch(false);
          setPostResearchRequirements(null);
        }}
        requirements={postResearchRequirements}
        onSubmit={handlePostResearchSubmit}
      />

      {/* Proposal Review Modal */}
      <ProposalReviewModal
        isOpen={showProposal}
        onClose={() => setShowProposal(false)}
        proposal={currentProposal}
        onApprove={handleProposalApprove}
        onReject={handleProposalReject}
        onModify={handleProposalModify}
      />


      {/* Calibration Wizard */}
      <CalibrationWizard
        show={showCalibration}
        onClose={() => setShowCalibration(false)}
        onComplete={handleCalibrationComplete}
        githubRepo={`${state.githubConfig.owner}/${state.githubConfig.repo}`}
      />

      {/* User Settings Modal */}
      <UserSettingsModal
        show={showUserSettings}
        onClose={() => setShowUserSettings(false)}
        onSave={handleUserSettingsSave}
      />

      {/* Task Creation Progress */}
      <TaskCreationProgress
        show={showTaskProgress}
        taskId={currentTaskId}
        onClose={() => {
          setShowTaskProgress(false);
          setCurrentTaskId(null);
        }}
      />

      {/* Autonomous Task Monitor Dashboard */}
      <TaskMonitorDashboard
        show={showTaskMonitor}
        onClose={() => setShowTaskMonitor(false)}
      />
    </div>
  );
}
