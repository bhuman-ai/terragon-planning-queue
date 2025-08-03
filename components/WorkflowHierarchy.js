import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, FileText, CheckCircle, Circle, AlertCircle } from 'lucide-react';

/**
 * Visual component to display the CLAUDE.md → task → checkpoint hierarchy
 */
export default function WorkflowHierarchy() {
  const [hierarchy, setHierarchy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    loadHierarchy();
  }, []);

  const loadHierarchy = async () => {
    try {
      // Load CLAUDE.md sections
      const sectionsRes = await fetch('/api/workflow/claude-sections');
      const sectionsData = await sectionsRes.json();

      // Load tasks
      const tasksRes = await fetch('/api/workflow/list-tasks');
      const tasksData = await tasksRes.json();

      setHierarchy({
        claudeSections: sectionsData.sections,
        tasks: tasksData.tasks || []
      });
    } catch (error) {
      console.error('Failed to load hierarchy:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (taskId) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
      case 'approved-for-merge':
        return <CheckCircle className='w-4 h-4 text-green-500' />;
      case 'in-progress':
        return <Circle className='w-4 h-4 text-yellow-500' />;
      case 'failed':
      case 'merge-rejected':
        return <AlertCircle className='w-4 h-4 text-red-500' />;
      default:
        return <Circle className='w-4 h-4 text-gray-400' />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'complete':
      case 'approved-for-merge':
        return 'text-green-600';
      case 'in-progress':
        return 'text-yellow-600';
      case 'failed':
      case 'merge-rejected':
        return 'text-red-600';
      case 'ready-for-merge':
        return 'text-blue-600';
      default:
        return 'text-gray-500';
    }
  };

  if (loading) {
    return (<div className='p-8 text-center'>
      <div className='inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900'></div>
      <p className='mt-2 text-gray-600'>Loading workflow hierarchy...</p>
    </div>);
  }

  return (
    <div className='bg-white rounded-lg shadow-lg p-6'>
      <div className='mb-6'>
        <h2 className='text-2xl font-bold text-gray-900 mb-2'>Workflow Hierarchy</h2>
        <p className='text-gray-600'>
          CLAUDE.md → project.md → task.md → checkpoint.md
        </p>
      </div>

      <div className='space-y-6'>;
        {/* CLAUDE.md Root */}
        <div className='border rounded-lg p-4 bg-purple-50 border-purple-200'>
          <div className='flex items-center space-x-2'>
            <FileText className='w-5 h-5 text-purple-600' />
            <span className='font-semibold text-purple-900'>CLAUDE.md</span>
            <span className='text-sm text-purple-600'>(Sacred Constitution)</span>
          </div>
          <p className='text-sm text-gray-600 mt-1 ml-7'>
            Defines HOW to work - principles, architecture, workflows
          </p>
        </div>

        {/* Arrow */}
        <div className='flex justify-center'>
          <div className='text-gray-400'>↓</div>
        </div>

        {/* project.md */}
        <div className='border rounded-lg p-4 bg-blue-50 border-blue-200'>
          <div className='flex items-center space-x-2'>
            <FileText className='w-5 h-5 text-blue-600' />
            <span className='font-semibold text-blue-900'>project.md</span>
            <span className='text-sm text-blue-600'>(Current State)</span>
          </div>
          <p className='text-sm text-gray-600 mt-1 ml-7'>
            Tracks WHAT is built - components, APIs, status
          </p>
        </div>

        {/* Arrow */}
        <div className='flex justify-center'>
          <div className='text-gray-400'>↓</div>
        </div>

        {/* Tasks */}
        <div className='space-y-3'>
          <h3 className='font-semibold text-gray-700'>Active Tasks</h3>

          {hierarchy?.tasks.length === 0 ? (
            <div className='text-gray-500 italic p-4 border border-dashed rounded'>
              No tasks created yet. Create one using the workflow CLI or API.
            </div>
          ) : (
            hierarchy?.tasks.map(task => (
              <div key={task.taskId} className='border rounded-lg overflow-hidden'>
                <div
                  className='p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors'
                  onClick={() => toggleTask(task.taskId)}
                >
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center space-x-2'>
                      {expandedTasks.has(task.taskId) ? (
                        <ChevronDown className='w-4 h-4 text-gray-500' />
                      ) : (
                        <ChevronRight className='w-4 h-4 text-gray-500' />
                      )}
                      {getStatusIcon(task.status)}
                      <span className='font-medium'>{task.taskId}</span>
                      <span className='text-gray-600'>{task.title}</span>
                    </div>
                    <span className={`text-sm font-medium ${getStatusColor(task.status)}`}>
                      {task.status.replace('-', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className='ml-8 mt-1 text-sm text-gray-500'>
                    Linked to: {task.claudeMdLink?.sectionPath || 'Unknown'}
                  </div>
                </div>

                {/* Checkpoints */}
                {expandedTasks.has(task.taskId) && (
                  <div className='bg-white border-t'>
                    {task.checkpoints.length === 0 ? (
                      <div className='p-4 pl-12 text-gray-500 italic'>
                        No checkpoints created yet
                      </div>
                    ) : (
                      task.checkpoints.map((checkpoint, idx) => (
                        <div
                          key={checkpoint.id}
                          className={`p-3 pl-12 flex items-center space-x-2 ${
                            idx < task.checkpoints.length - 1 ? 'border-b' : ''
                          } hover:bg-gray-50`}
                        >
                          {getStatusIcon(checkpoint.status)}
                          <span className='text-sm font-medium'>{checkpoint.id}</span>
                          <span className='text-sm text-gray-600'>{checkpoint.title}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Legend */}
        <div className='mt-6 pt-6 border-t'>
          <h4 className='text-sm font-semibold text-gray-700 mb-2'>Status Legend</h4>
          <div className='grid grid-cols-2 gap-2 text-sm'>
            <div className='flex items-center space-x-2'>
              <Circle className='w-4 h-4 text-gray-400' />
              <span>Pending</span>
            </div>
            <div className='flex items-center space-x-2'>
              <Circle className='w-4 h-4 text-yellow-500' />
              <span>In Progress</span>
            </div>
            <div className='flex items-center space-x-2'>
              <CheckCircle className='w-4 h-4 text-green-500' />
              <span>Complete</span>
            </div>
            <div className='flex items-center space-x-2'>
              <AlertCircle className='w-4 h-4 text-red-500' />
              <span>Failed/Rejected</span>
            </div>
          </div>
        </div>

        {/* Workflow Summary */}
        <div className='mt-6 p-4 bg-gray-100 rounded-lg'>
          <h4 className='font-semibold text-gray-700 mb-2'>Workflow Rules</h4>
          <ul className='text-sm text-gray-600 space-y-1'>
            <li>• All tasks must link to a CLAUDE.md section</li>
            <li>• Checkpoints must complete before task can merge</li>
            <li>• project.md updates require approved merge proposals</li>
            <li>• No direct edits - all changes flow through workflow</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
