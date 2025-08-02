import { useState, useEffect } from 'react';
import ClaudeMdVersionHistory from './ClaudeMdVersionHistory';

export default function CalibrationWizard({ 
  show, 
  onClose, 
  onComplete,
  githubRepo 
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [calibrationData, setCalibrationData] = useState({
    projectName: '',
    vision: '',
    currentPhase: '',
    techStack: [],
    infrastructure: {},
    architecture: '',
    requirements: {},
    conventions: {},
    security: {},
    performance: {},
    teamWorkflow: {}
  });
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);

  // Calibration steps
  const steps = [
    { id: 'scan', title: 'Repository Scan', description: 'Analyzing your codebase...' },
    { id: 'interview', title: 'Project Interview', description: 'Understanding your project...' },
    { id: 'review', title: 'Review CLAUDE.md', description: 'Confirm your sacred document...' },
    { id: 'cleanup', title: 'Project Cleanup', description: 'Remove obsolete files...' }
  ];

  useEffect(() => {
    if (show && currentStep === 0) {
      startRepositoryScan();
    }
  }, [show]);

  const startRepositoryScan = async () => {
    setIsScanning(true);
    
    try {
      const response = await fetch('/api/calibration/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          repo: githubRepo,
          includePatterns: ['*.md', 'README*', 'docs/**', 'package.json', '*.config.js']
        })
      });

      if (!response.ok) throw new Error('Scan failed');
      
      const results = await response.json();
      setScanResults(results);
      setCalibrationData(prev => ({
        ...prev,
        projectName: results.projectName || githubRepo.split('/')[1],
        techStack: results.detectedTechStack || [],
        currentPhase: results.suggestedPhase || 'development'
      }));
      
      // Auto-advance to interview
      setTimeout(() => {
        setCurrentStep(1);
        generateInterviewQuestions(results);
      }, 2000);
      
    } catch (error) {
      console.error('Repository scan failed:', error);
      // Still advance to interview with minimal data
      setCurrentStep(1);
      generateInterviewQuestions({});
    } finally {
      setIsScanning(false);
    }
  };

  const generateInterviewQuestions = async (scanData) => {
    setIsGeneratingQuestions(true);
    
    try {
      const response = await fetch('/api/calibration/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanResults: scanData,
          existingAnswers: calibrationData
        })
      });

      if (!response.ok) throw new Error('Failed to generate questions');
      
      const data = await response.json();
      setQuestions(data.questions || getDefaultQuestions());
      
    } catch (error) {
      console.error('Failed to generate questions:', error);
      setQuestions(getDefaultQuestions());
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const getDefaultQuestions = () => [
    {
      id: 'vision',
      category: 'Project Overview',
      question: 'What is the vision and primary goal of this project?',
      type: 'text',
      required: true
    },
    {
      id: 'userbase',
      category: 'Project Overview',
      question: 'Who are the target users and what problems does this solve?',
      type: 'text',
      required: true
    },
    {
      id: 'architecture_pattern',
      category: 'Technical Architecture',
      question: 'What architectural pattern should this project follow?',
      type: 'single-choice',
      options: ['Monolithic', 'Microservices', 'Serverless', 'Event-Driven', 'Modular Monolith'],
      required: true
    },
    {
      id: 'deployment_target',
      category: 'Infrastructure',
      question: 'Where will this project be deployed?',
      type: 'multi-choice',
      options: ['Vercel', 'AWS', 'Google Cloud', 'Azure', 'Self-hosted', 'Edge Functions'],
      required: true
    },
    {
      id: 'coding_standards',
      category: 'Development Standards',
      question: 'What are the key coding principles and standards for this project?',
      type: 'text',
      multiline: true,
      required: true
    }
  ];

  const handleAnswer = (questionId, answer) => {
    setCalibrationData(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const generateClaudeMd = async () => {
    const response = await fetch('/api/calibration/generate-claude-md', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calibrationData,
        scanResults,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) throw new Error('Failed to generate CLAUDE.md');
    
    const { content, suggestedCleanup } = await response.json();
    return { content, suggestedCleanup };
  };

  const handleComplete = async () => {
    try {
      const { content, suggestedCleanup } = await generateClaudeMd();
      
      // Save CLAUDE.md
      await fetch('/api/calibration/save-claude-md', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      
      onComplete({
        claudeMd: content,
        cleanup: suggestedCleanup,
        calibrationData
      });
      
    } catch (error) {
      console.error('Failed to complete calibration:', error);
    }
  };

  if (!show) return null;

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3000
    }}>
      <div style={{
        backgroundColor: '#0a0a0a',
        border: '2px solid #ff6b6b',
        borderRadius: '12px',
        width: '90vw',
        maxWidth: '800px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 0 50px rgba(255, 107, 107, 0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '30px',
          borderBottom: '1px solid #333',
          background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)'
        }}>
          <h1 style={{
            color: '#ff6b6b',
            fontSize: '28px',
            margin: 0,
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}>
            🔥 Sacred Repository Calibration
          </h1>
          <p style={{
            color: '#888',
            marginTop: '10px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            Creating your holy source of truth - CLAUDE.md
          </p>
          
          {/* Progress */}
          <div style={{
            marginTop: '20px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '10px',
              fontSize: '12px',
              color: '#aaa'
            }}>
              <span>{currentStepData.title}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div style={{
              height: '6px',
              backgroundColor: '#1a1a1a',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: '#ff6b6b',
                transition: 'width 0.5s ease',
                boxShadow: '0 0 10px rgba(255, 107, 107, 0.5)'
              }} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          padding: '30px',
          overflowY: 'auto'
        }}>
          {currentStep === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              {isScanning ? (
                <>
                  <div style={{
                    fontSize: '48px',
                    marginBottom: '20px',
                    animation: 'pulse 2s infinite'
                  }}>
                    🔍
                  </div>
                  <h2 style={{ color: '#fff', marginBottom: '10px' }}>
                    Scanning Repository...
                  </h2>
                  <p style={{ color: '#888' }}>
                    Analyzing documentation, codebase structure, and dependencies
                  </p>
                </>
              ) : scanResults ? (
                <>
                  <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
                  <h2 style={{ color: '#00ff88', marginBottom: '10px' }}>
                    Scan Complete!
                  </h2>
                  <p style={{ color: '#888' }}>
                    Found {scanResults.fileCount || 0} relevant files
                  </p>
                </>
              ) : null}
            </div>
          )}

          {currentStep === 1 && (
            <div>
              {isGeneratingQuestions ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{ fontSize: '48px', marginBottom: '20px' }}>🤔</div>
                  <h2 style={{ color: '#fff' }}>Preparing interview questions...</h2>
                </div>
              ) : (
                <CalibrationInterview
                  questions={questions}
                  answers={calibrationData}
                  onAnswer={handleAnswer}
                  onComplete={() => setCurrentStep(2)}
                />
              )}
            </div>
          )}

          {currentStep === 2 && (
            <ClaudeMdReview
              content={calibrationData}
              repository={githubRepo}
              onConfirm={() => setCurrentStep(3)}
              onEdit={(updates) => setCalibrationData(updates)}
            />
          )}

          {currentStep === 3 && (
            <CleanupReview
              suggestions={scanResults?.cleanupSuggestions || []}
              onComplete={handleComplete}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 30px',
          borderTop: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              border: '1px solid #666',
              borderRadius: '6px',
              color: '#aaa',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Cancel Calibration
          </button>
          
          <div style={{
            fontSize: '12px',
            color: '#666'
          }}>
            This process cannot be undone
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// Sub-component for interview questions
function CalibrationInterview({ questions, answers, onAnswer, onComplete }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const currentQuestion = questions[currentQuestionIndex];
  
  if (!currentQuestion) return null;

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const canProceed = !currentQuestion.required || answers[currentQuestion.id];

  return (
    <div>
      <div style={{
        marginBottom: '30px',
        padding: '15px',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        border: '1px solid #333'
      }}>
        <div style={{
          fontSize: '12px',
          color: '#ff6b6b',
          marginBottom: '5px',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          {currentQuestion.category}
        </div>
        <h3 style={{
          color: '#fff',
          fontSize: '20px',
          margin: '10px 0',
          lineHeight: '1.4'
        }}>
          {currentQuestion.question}
        </h3>
      </div>

      {/* Question input based on type */}
      {currentQuestion.type === 'text' && (
        <textarea
          value={answers[currentQuestion.id] || ''}
          onChange={(e) => onAnswer(currentQuestion.id, e.target.value)}
          placeholder="Type your answer here..."
          style={{
            width: '100%',
            minHeight: currentQuestion.multiline ? '150px' : '100px',
            padding: '15px',
            backgroundColor: '#0f0f0f',
            border: '1px solid #333',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical',
            display: 'block',
            marginBottom: '20px',
            outline: 'none'
          }}
          autoFocus
        />
      )}

      {currentQuestion.type === 'single-choice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {currentQuestion.options.map(option => (
            <button
              key={option}
              onClick={() => onAnswer(currentQuestion.id, option)}
              style={{
                padding: '15px 20px',
                backgroundColor: answers[currentQuestion.id] === option ? '#ff6b6b22' : '#0f0f0f',
                border: answers[currentQuestion.id] === option ? '2px solid #ff6b6b' : '1px solid #333',
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '14px',
                transition: 'all 0.2s ease'
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {/* Multi choice */}
      {currentQuestion.type === 'multi-choice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {currentQuestion.options.map(option => {
            const currentAnswers = answers[currentQuestion.id] || [];
            const isSelected = currentAnswers.includes(option);
            
            return (
              <button
                key={option}
                onClick={() => {
                  const newAnswers = isSelected
                    ? currentAnswers.filter(a => a !== option)
                    : [...currentAnswers, option];
                  onAnswer(currentQuestion.id, newAnswers);
                }}
                style={{
                  padding: '12px 16px',
                  backgroundColor: isSelected ? '#ff6b6b22' : '#0f0f0f',
                  border: isSelected ? '2px solid #ff6b6b' : '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  textAlign: 'left'
                }}
              >
                <span style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '3px',
                  backgroundColor: isSelected ? '#ff6b6b' : 'transparent',
                  border: '2px solid #ff6b6b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  flexShrink: 0
                }}>
                  {isSelected && '✓'}
                </span>
                {option}
              </button>
            );
          })}
        </div>
      )}

      {/* Navigation */}
      <div style={{
        marginTop: '40px',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <button
          onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
          disabled={currentQuestionIndex === 0}
          style={{
            padding: '12px 24px',
            backgroundColor: '#333',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer',
            opacity: currentQuestionIndex === 0 ? 0.5 : 1,
            fontSize: '14px'
          }}
        >
          ← Previous
        </button>
        
        <div style={{
          fontSize: '14px',
          color: '#666'
        }}>
          Question {currentQuestionIndex + 1} of {questions.length}
        </div>
        
        <button
          onClick={handleNext}
          disabled={!canProceed}
          style={{
            padding: '12px 32px',
            backgroundColor: canProceed ? '#ff6b6b' : '#333',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            cursor: canProceed ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          {currentQuestionIndex === questions.length - 1 ? 'Review →' : 'Next →'}
        </button>
      </div>
    </div>
  );
}

// Sub-component for CLAUDE.md iterative review
function ClaudeMdReview({ content, repository, onConfirm, onEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedMarkdown, setEditedMarkdown] = useState('');
  const [generatedMarkdown, setGeneratedMarkdown] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Generate CLAUDE.md from interview data
  useEffect(() => {
    generateClaudeMd();
  }, [content]);

  const generateClaudeMd = async () => {
    setIsGenerating(true);
    
    try {
      const response = await fetch('/api/calibration/generate-claude-md', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewData: content,
          includeDevPrinciples: true
        })
      });

      if (!response.ok) throw new Error('Failed to generate CLAUDE.md');
      
      const data = await response.json();
      const markdown = data.claudeMarkdown;
      
      setGeneratedMarkdown(markdown);
      setEditedMarkdown(markdown);
      
    } catch (error) {
      console.error('Failed to generate CLAUDE.md:', error);
      // Fallback to basic template
      const fallbackMarkdown = generateBasicClaudeMd(content);
      setGeneratedMarkdown(fallbackMarkdown);
      setEditedMarkdown(fallbackMarkdown);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateBasicClaudeMd = (data) => {
    return `# ${data.projectName || 'Project'} - AI Context Template

## 1. Project Overview
- **Vision:** ${data.vision || 'Project vision not specified'}
- **Current Phase:** ${data.currentPhase || 'development'}
- **Key Architecture:** ${data.architecture_pattern || 'Standard web application'}
- **Development Strategy:** ${data.development_strategy || 'Iterative development'}

## 2. Project Structure
${data.projectName || 'Project'} follows a ${data.architecture_pattern || 'modular'} architecture pattern.

## 3. Coding Standards & AI Instructions

### General Instructions
- Your most important job is to manage your own context. Always read any relevant files BEFORE planning changes.
- Write code following KISS, YAGNI, and DRY principles.
- When in doubt follow proven best practices for implementation.
- Do not commit to git without user approval.
- Always consider industry standard libraries/frameworks first over custom implementations.
- Never mock anything. Never use placeholders. Never omit code.

### Technology Stack
${data.techStack?.map(tech => `- ${tech}`).join('\n') || '- Technology stack to be defined'}

### Security Standards
- Never trust external inputs - validate everything at the boundaries
- Keep secrets in environment variables, never in code
- Use secure authentication patterns for your platform

### Performance Requirements
- Target performance: ${data.performance_target || 'Standard web performance metrics'}
- Optimization focus: ${data.optimization_focus || 'User experience and code maintainability'}

## 4. Active Tasks
- [ ] Complete project calibration
- [ ] Implement core functionality

---
*Generated on ${new Date().toISOString().split('T')[0]} via calibration interview*`;
  };

  const validateMarkdown = (markdown) => {
    const errors = [];
    
    if (!markdown.includes('# ') && !markdown.includes('## 1. Project Overview')) {
      errors.push('Missing main project title or Project Overview section');
    }
    
    if (!markdown.includes('Project Overview') || !markdown.includes('Coding Standards')) {
      errors.push('Missing required sections (Project Overview, Coding Standards)');
    }
    
    if (markdown.includes('TODO') || markdown.includes('PLACEHOLDER')) {
      errors.push('Contains TODO items or placeholders that need to be filled');
    }
    
    if (markdown.length < 500) {
      errors.push('Document appears too short - may be missing important details');
    }
    
    return errors;
  };

  const handleSaveChanges = () => {
    const errors = validateMarkdown(editedMarkdown);
    setValidationErrors(errors);
    
    if (errors.length === 0) {
      onEdit({ ...content, claudeMarkdown: editedMarkdown });
      setIsEditing(false);
    }
  };

  const handleConfirm = async () => {
    const errors = validateMarkdown(editedMarkdown);
    
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Save the final CLAUDE.md to the repository
    try {
      const response = await fetch('/api/calibration/save-claude-md', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markdown: editedMarkdown,
          reviewNotes,
          interviewData: content,
          repository: repository,
          author: 'Calibration User'
        })
      });

      if (!response.ok) throw new Error('Failed to save CLAUDE.md');
      
      onConfirm();
    } catch (error) {
      console.error('Failed to save CLAUDE.md:', error);
      alert('Failed to save CLAUDE.md. Please try again.');
    }
  };

  if (isGenerating) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h2 style={{ color: '#fff', marginBottom: '20px' }}>
          🔮 Generating Your Sacred Document...
        </h2>
        <p style={{ color: '#888' }}>
          Analyzing your interview responses to create the perfect CLAUDE.md
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: '#fff', marginBottom: '10px' }}>
          📜 Review Your Sacred CLAUDE.md
        </h2>
        <p style={{ color: '#888', fontSize: '14px' }}>
          This document will serve as the holy source of truth for all AI interactions with your project.
          Review carefully and make any necessary edits before sanctifying.
        </p>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div style={{
          backgroundColor: '#ff3300',
          color: '#fff',
          padding: '15px',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 10px 0' }}>⚠️ Validation Issues:</h4>
          <ul style={{ margin: 0 }}>
            {validationErrors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Document Preview/Editor */}
      <div style={{
        backgroundColor: '#0f0f0f',
        border: '1px solid #333',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <div style={{
          padding: '15px 20px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ color: '#888', fontSize: '14px' }}>
            {isEditing ? '✏️ Editing Mode' : '👁️ Preview Mode'}
          </span>
          <button
            onClick={() => setIsEditing(!isEditing)}
            style={{
              padding: '6px 12px',
              backgroundColor: isEditing ? '#ff6b6b' : '#333',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {isEditing ? 'Preview' : 'Edit'}
          </button>
        </div>
        
        <div style={{ padding: '20px', maxHeight: '500px', overflowY: 'auto' }}>
          {isEditing ? (
            <textarea
              value={editedMarkdown}
              onChange={(e) => setEditedMarkdown(e.target.value)}
              placeholder="Edit your CLAUDE.md content here..."
              style={{
                width: '100%',
                minHeight: '400px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '13px',
                fontFamily: 'Monaco, Consolas, monospace',
                resize: 'vertical',
                lineHeight: '1.5'
              }}
            />
          ) : (
            <pre style={{
              color: '#e0e0e0',
              fontSize: '13px',
              fontFamily: 'Monaco, Consolas, monospace',
              margin: 0,
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap'
            }}>
              {editedMarkdown}
            </pre>
          )}
        </div>
      </div>

      {/* Review Notes */}
      <div style={{ marginBottom: '30px' }}>
        <label style={{ color: '#fff', display: 'block', marginBottom: '8px', fontSize: '14px' }}>
          Review Notes (Optional)
        </label>
        <textarea
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
          placeholder="Add any notes about this CLAUDE.md version..."
          style={{
            width: '100%',
            minHeight: '80px',
            backgroundColor: '#0f0f0f',
            border: '1px solid #333',
            borderRadius: '6px',
            padding: '12px',
            color: '#fff',
            fontSize: '13px'
          }}
        />
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          {isEditing && (
            <button
              onClick={handleSaveChanges}
              style={{
                padding: '12px 24px',
                backgroundColor: '#00ff88',
                border: 'none',
                borderRadius: '6px',
                color: '#000',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Save Changes
            </button>
          )}
          
          <button
            onClick={() => {
              setEditedMarkdown(generatedMarkdown);
              setValidationErrors([]);
              setIsEditing(false);
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: '#333',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Reset to Original
          </button>

          {repository && (
            <button
              onClick={() => setShowVersionHistory(true)}
              style={{
                padding: '12px 24px',
                backgroundColor: '#0088ff',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              📚 Version History
            </button>
          )}
        </div>
        
        <button
          onClick={handleConfirm}
          disabled={validationErrors.length > 0}
          style={{
            padding: '12px 32px',
            backgroundColor: validationErrors.length > 0 ? '#666' : '#ff6b6b',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            cursor: validationErrors.length > 0 ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          🔥 Sanctify & Save to Repository
        </button>
      </div>

      <div style={{
        marginTop: '15px',
        padding: '10px',
        backgroundColor: '#0a0a0a',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#666'
      }}>
        💡 This CLAUDE.md will be saved to your repository and used as the sacred source of truth for all AI interactions.
        Once sanctified, any future AI work will reference this document first.
      </div>

      {/* Version History Modal */}
      {repository && (
        <ClaudeMdVersionHistory
          repository={repository}
          show={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          onRestoreVersion={(version) => {
            setEditedMarkdown(version.content);
            setGeneratedMarkdown(version.content);
            setShowVersionHistory(false);
          }}
        />
      )}
    </div>
  );
}

// Sub-component for cleanup review
function CleanupReview({ suggestions, onComplete }) {
  const [selectedFiles, setSelectedFiles] = useState([]);

  return (
    <div>
      <h2 style={{ color: '#fff', marginBottom: '20px' }}>
        Suggested Cleanup
      </h2>
      
      <p style={{ color: '#888', marginBottom: '20px' }}>
        Based on your CLAUDE.md, these files appear to be obsolete:
      </p>

      <div style={{
        backgroundColor: '#0f0f0f',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '20px',
        maxHeight: '300px',
        overflowY: 'auto'
      }}>
        {suggestions.length === 0 ? (
          <p style={{ color: '#666', textAlign: 'center' }}>
            No cleanup suggestions - your repository is already clean!
          </p>
        ) : (
          suggestions.map((file, index) => (
            <label
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px',
                cursor: 'pointer',
                borderBottom: '1px solid #222'
              }}
            >
              <input
                type="checkbox"
                checked={selectedFiles.includes(file)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedFiles([...selectedFiles, file]);
                  } else {
                    setSelectedFiles(selectedFiles.filter(f => f !== file));
                  }
                }}
                style={{ marginRight: '10px' }}
              />
              <span style={{ color: '#aaa' }}>{file}</span>
            </label>
          ))
        )}
      </div>

      <div style={{
        marginTop: '30px',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <button
          onClick={() => onComplete({ cleanup: [] })}
          style={{
            padding: '12px 24px',
            backgroundColor: '#333',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Skip Cleanup
        </button>
        
        <button
          onClick={() => onComplete({ cleanup: selectedFiles })}
          style={{
            padding: '12px 32px',
            backgroundColor: '#ff6b6b',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          Complete Calibration 🎯
        </button>
      </div>
    </div>
  );
}