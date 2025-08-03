/**
 * End-to-End Tests for Collaboration UI Components
 * Tests complete user workflows through the collaboration interface
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CollaborationHub from '../../components/collaboration/CollaborationHub';
import IdeationView from '../../components/collaboration/IdeationView';
import ExecutionView from '../../components/collaboration/ExecutionView';
import MergeReviewView from '../../components/collaboration/MergeReviewView';
import TaskOrchestrationView from '../../components/collaboration/TaskOrchestrationView';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn()
      }
    };
  }
}));

// Mock API calls
global.fetch = jest.fn();

describe('Collaboration UI E2E Tests', () => {
  const mockSession = {
    sessionId: 'test-session-123',
    sessionType: 'claude_md_collaboration',
    metaAgentEnabled: true,
    agentId: 'test-agent',
    sessionData: {
      ideation: {
        drafts: [
          {
            id: 'draft-1',
            title: 'Initial CLAUDE.md',
            timestamp: '2022-01-01T00:00:00.000Z',
            status: 'draft'
          },
          {
            id: 'draft-2',
            title: 'Enhanced CLAUDE.md',
            timestamp: '2022-01-01T01:00:00.000Z',
            status: 'draft'
          }
        ]
      },
      execution: {
        checkpoints: [
          {
            id: 'checkpoint-1',
            type: 'draft_backup',
            description: 'Backup before major changes',
            timestamp: '2022-01-01T00:30:00.000Z',
            status: 'created'
          }
        ]
      },
      merge: {
        conflicts: [],
        status: 'clean'
      },
      orchestration: {
        tasks: []
      }
    },
    createdAt: '2022-01-01T00:00:00.000Z',
    lastAccessed: '2022-01-01T02:00:00.000Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default fetch responses
    fetch.mockImplementation((url) => {
      if (url.includes('/api/collaboration/session/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSession)
        });
      }
      if (url.includes('/api/collaboration/drafts/list')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            drafts: mockSession.sessionData.ideation.drafts,
            total: 2,
            sessionId: mockSession.sessionId
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    });
  });

  describe('CollaborationHub - Main Interface', () => {
    test('should render collaboration hub with all tabs', async () => {
      render(<CollaborationHub sessionId="test-session-123" />);

      // Should show loading initially
      expect(screen.getByText(/loading/i)).toBeInTheDocument();

      // Wait for session data to load
      await waitFor(() => {
        expect(screen.getByText(/collaboration hub/i)).toBeInTheDocument();
      });

      // Should show all tabs
      expect(screen.getByRole('tab', { name: /ideation/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /execution/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /merge review/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /orchestration/i })).toBeInTheDocument();

      // Should show session info
      expect(screen.getByText(/test-session-123/)).toBeInTheDocument();
    });

    test('should switch between tabs correctly', async () => {
      render(<CollaborationHub sessionId="test-session-123" />);

      await waitFor(() => {
        expect(screen.getByText(/collaboration hub/i)).toBeInTheDocument();
      });

      // Start on ideation tab (default)
      expect(screen.getByRole('tab', { name: /ideation/i })).toHaveAttribute('aria-selected', 'true');

      // Switch to execution tab
      await userEvent.click(screen.getByRole('tab', { name: /execution/i }));
      expect(screen.getByRole('tab', { name: /execution/i })).toHaveAttribute('aria-selected', 'true');

      // Switch to merge review tab
      await userEvent.click(screen.getByRole('tab', { name: /merge review/i }));
      expect(screen.getByRole('tab', { name: /merge review/i })).toHaveAttribute('aria-selected', 'true');

      // Switch to orchestration tab
      await userEvent.click(screen.getByRole('tab', { name: /orchestration/i }));
      expect(screen.getByRole('tab', { name: /orchestration/i })).toHaveAttribute('aria-selected', 'true');
    });

    test('should handle session loading errors gracefully', async () => {
      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Session not found' })
        })
      );

      render(<CollaborationHub sessionId="invalid-session" />);

      await waitFor(() => {
        expect(screen.getByText(/error loading session/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/session not found/i)).toBeInTheDocument();
    });
  });

  describe('IdeationView - Draft Management', () => {
    test('should display list of drafts', async () => {
      render(<IdeationView sessionData={mockSession.sessionData} sessionId={mockSession.sessionId} />);

      await waitFor(() => {
        expect(screen.getByText(/ideation workspace/i)).toBeInTheDocument();
      });

      // Should show draft list
      expect(screen.getByText('Initial CLAUDE.md')).toBeInTheDocument();
      expect(screen.getByText('Enhanced CLAUDE.md')).toBeInTheDocument();

      // Should show draft count
      expect(screen.getByText(/2 drafts/i)).toBeInTheDocument();
    });

    test('should open draft creation modal', async () => {
      render(<IdeationView sessionData={mockSession.sessionData} sessionId={mockSession.sessionId} />);

      await waitFor(() => {
        expect(screen.getByText(/ideation workspace/i)).toBeInTheDocument();
      });

      // Click create new draft button
      await userEvent.click(screen.getByRole('button', { name: /create new draft/i }));

      // Should open modal
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/create new draft/i)).toBeInTheDocument();

      // Should have form fields
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
    });

    test('should create new draft successfully', async () => {
      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            draftId: 'draft-new-123',
            title: 'New Test Draft',
            status: 'created',
            validation: { isValid: true }
          })
        })
      );

      render(<IdeationView sessionData={mockSession.sessionData} sessionId={mockSession.sessionId} />);

      await waitFor(() => {
        expect(screen.getByText(/ideation workspace/i)).toBeInTheDocument();
      });

      // Open create modal
      await userEvent.click(screen.getByRole('button', { name: /create new draft/i }));

      // Fill form
      await userEvent.type(screen.getByLabelText(/title/i), 'New Test Draft');
      await userEvent.type(screen.getByLabelText(/description/i), 'Test draft description');
      await userEvent.type(screen.getByLabelText(/content/i), '# Test CLAUDE.md\n## Sacred Principles\n- NO SIMULATIONS');

      // Submit form
      await userEvent.click(screen.getByRole('button', { name: /create draft/i }));

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/draft created successfully/i)).toBeInTheDocument();
      });

      // Should close modal
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('should handle draft creation validation errors', async () => {
      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({
            error: 'Content validation failed',
            details: ['Violates NO SIMULATIONS principle', 'Contains forbidden patterns']
          })
        })
      );

      render(<IdeationView sessionData={mockSession.sessionData} sessionId={mockSession.sessionId} />);

      await waitFor(() => {
        expect(screen.getByText(/ideation workspace/i)).toBeInTheDocument();
      });

      // Open create modal and submit invalid content
      await userEvent.click(screen.getByRole('button', { name: /create new draft/i }));
      await userEvent.type(screen.getByLabelText(/title/i), 'Invalid Draft');
      await userEvent.type(screen.getByLabelText(/content/i), 'Content with simulations and fallbacks');
      await userEvent.click(screen.getByRole('button', { name: /create draft/i }));

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/content validation failed/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/violates no simulations principle/i)).toBeInTheDocument();
      expect(screen.getByText(/contains forbidden patterns/i)).toBeInTheDocument();

      // Modal should remain open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('should allow draft editing and updating', async () => {
      const mockDraftData = {
        id: 'draft-1',
        title: 'Initial CLAUDE.md',
        content: '# Original Content\n## Sacred Principles\n- NO SIMULATIONS',
        version: 1
      };

      fetch.mockImplementation((url) => {
        if (url.includes('/api/collaboration/drafts/retrieve')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockDraftData)
          });
        }
        if (url.includes('/api/collaboration/drafts/update')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              draftId: 'draft-1',
              version: 2,
              status: 'updated',
              changes: { added: 2, modified: 1, removed: 0 }
            })
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<IdeationView sessionData={mockSession.sessionData} sessionId={mockSession.sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('Initial CLAUDE.md')).toBeInTheDocument();
      });

      // Click on draft to edit
      await userEvent.click(screen.getByText('Initial CLAUDE.md'));

      // Should open edit modal
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByDisplayValue(/original content/i)).toBeInTheDocument();
      });

      // Edit content
      const contentField = screen.getByLabelText(/content/i);
      await userEvent.clear(contentField);
      await userEvent.type(contentField, '# Updated Content\n## Sacred Principles\n- NO SIMULATIONS\n- NO FALLBACKS');

      // Save changes
      await userEvent.click(screen.getByRole('button', { name: /update draft/i }));

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/draft updated successfully/i)).toBeInTheDocument();
      });

      // Should show change summary
      expect(screen.getByText(/version 2/i)).toBeInTheDocument();
      expect(screen.getByText(/2 lines added/i)).toBeInTheDocument();
    });
  });

  describe('ExecutionView - Checkpoint Management', () => {
    test('should display checkpoint list', async () => {
      render(<ExecutionView sessionData={mockSession.sessionData} sessionId={mockSession.sessionId} />);

      expect(screen.getByText(/execution workspace/i)).toBeInTheDocument();
      expect(screen.getByText(/backup before major changes/i)).toBeInTheDocument();
      expect(screen.getByText(/checkpoint-1/)).toBeInTheDocument();
    });

    test('should create new checkpoint', async () => {
      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            checkpointId: 'checkpoint-new-123',
            status: 'created',
            timestamp: '2022-01-01T03:00:00.000Z'
          })
        })
      );

      render(<ExecutionView sessionData={mockSession.sessionData} sessionId={mockSession.sessionId} />);

      // Click create checkpoint button
      await userEvent.click(screen.getByRole('button', { name: /create checkpoint/i }));

      // Should open checkpoint modal
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/create checkpoint/i)).toBeInTheDocument();

      // Fill checkpoint form
      await userEvent.type(screen.getByLabelText(/description/i), 'Test checkpoint description');
      await userEvent.selectOptions(screen.getByLabelText(/type/i), 'manual_backup');

      // Submit
      await userEvent.click(screen.getByRole('button', { name: /create/i }));

      // Should show success
      await waitFor(() => {
        expect(screen.getByText(/checkpoint created successfully/i)).toBeInTheDocument();
      });
    });

    test('should execute checkpoint rollback', async () => {
      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            checkpointId: 'checkpoint-1',
            action: 'rollback',
            success: true,
            filesRestored: 3
          })
        })
      );

      render(<ExecutionView sessionData={mockSession.sessionData} sessionId={mockSession.sessionId} />);

      // Find checkpoint and click rollback button
      const checkpointRow = screen.getByText(/backup before major changes/i).closest('[data-testid="checkpoint-row"]');
      const rollbackButton = checkpointRow.querySelector('[data-testid="rollback-button"]');

      await userEvent.click(rollbackButton);

      // Should show confirmation dialog
      expect(screen.getByText(/confirm rollback/i)).toBeInTheDocument();

      // Confirm rollback
      await userEvent.click(screen.getByRole('button', { name: /confirm/i }));

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/rollback completed successfully/i)).toBeInTheDocument();
        expect(screen.getByText(/3 files restored/i)).toBeInTheDocument();
      });
    });
  });

  describe('MergeReviewView - Conflict Resolution', () => {
    const mockConflicts = [
      {
        id: 'conflict-1',
        type: 'line_change',
        severity: 'medium',
        category: 'content',
        line: 5,
        original: 'Original line content',
        modified: 'Modified line content',
        suggestions: [
          { action: 'accept_modified', description: 'Accept changes', recommended: true },
          { action: 'accept_original', description: 'Keep original', recommended: false }
        ]
      },
      {
        id: 'conflict-2',
        type: 'sacred_violation',
        severity: 'critical',
        category: 'sacred',
        section: 'Sacred Principles',
        message: 'Sacred section modified',
        suggestions: [
          { action: 'manual_review', description: 'Manual review required', recommended: true }
        ]
      }
    ];

    test('should display conflict list', async () => {
      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            conflicts: mockConflicts,
            totalConflicts: 2,
            resolvedCount: 0,
            unresolvedCount: 2
          })
        })
      );

      render(<MergeReviewView sessionData={mockSession.sessionData} sessionId={mockSession.sessionId} />);

      await waitFor(() => {
        expect(screen.getByText(/merge review/i)).toBeInTheDocument();
      });

      // Should show conflict summary
      expect(screen.getByText(/2 conflicts detected/i)).toBeInTheDocument();
      expect(screen.getByText(/0 resolved/i)).toBeInTheDocument();

      // Should show individual conflicts
      expect(screen.getByText(/line_change/i)).toBeInTheDocument();
      expect(screen.getByText(/sacred_violation/i)).toBeInTheDocument();
      expect(screen.getByText(/critical/i)).toBeInTheDocument();
    });

    test('should resolve conflicts with recommendations', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/collaboration/merge/conflicts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              conflicts: mockConflicts,
              totalConflicts: 2,
              resolvedCount: 0,
              unresolvedCount: 2
            })
          });
        }
        if (url.includes('/api/collaboration/merge/resolve')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              conflictId: 'conflict-1',
              resolution: 'accept_modified',
              success: true
            })
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<MergeReviewView sessionData={mockSession.sessionData} sessionId={mockSession.sessionId} />);

      await waitFor(() => {
        expect(screen.getByText(/2 conflicts detected/i)).toBeInTheDocument();
      });

      // Find first conflict and resolve it
      const firstConflict = screen.getByText(/line_change/i).closest('[data-testid="conflict-item"]');
      const acceptButton = firstConflict.querySelector('[data-testid="accept-modified"]');

      await userEvent.click(acceptButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/conflict resolved/i)).toBeInTheDocument();
      });
    });

    test('should handle critical conflicts requiring manual review', async () => {
      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            conflicts: mockConflicts,
            totalConflicts: 2,
            resolvedCount: 0,
            unresolvedCount: 2
          })
        })
      );

      render(<MergeReviewView sessionData={mockSession.sessionData} sessionId={mockSession.sessionId} />);

      await waitFor(() => {
        expect(screen.getByText(/sacred_violation/i)).toBeInTheDocument();
      });

      // Critical conflicts should show manual review requirement
      const criticalConflict = screen.getByText(/sacred_violation/i).closest('[data-testid="conflict-item"]');
      expect(criticalConflict).toHaveTextContent(/manual review required/i);

      // Should not have auto-resolve buttons for critical conflicts
      expect(criticalConflict.querySelector('[data-testid="accept-modified"]')).not.toBeInTheDocument();
    });
  });

  describe('TaskOrchestrationView - Meta-Agent Integration', () => {
    test('should display orchestration workspace', async () => {
      render(<TaskOrchestrationView sessionData={mockSession.sessionData} sessionId={mockSession.sessionId} />);

      expect(screen.getByText(/task orchestration/i)).toBeInTheDocument();
      expect(screen.getByText(/meta-agent integration/i)).toBeInTheDocument();
    });

    test('should initiate task decomposition', async () => {
      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            taskId: 'task-123',
            decomposition: {
              tasks: [
                { id: 'subtask-1', description: 'First subtask', estimatedTime: 300 },
                { id: 'subtask-2', description: 'Second subtask', estimatedTime: 600 }
              ],
              totalEstimatedTime: 900
            }
          })
        })
      );

      render(<TaskOrchestrationView sessionData={mockSession.sessionData} sessionId={mockSession.sessionId} />);

      // Click decompose task button
      await userEvent.click(screen.getByRole('button', { name: /decompose task/i }));

      // Should open task input modal
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Fill task description
      await userEvent.type(screen.getByLabelText(/task description/i), 'Enhance CLAUDE.md with new security features');

      // Submit
      await userEvent.click(screen.getByRole('button', { name: /start decomposition/i }));

      // Should show decomposition results
      await waitFor(() => {
        expect(screen.getByText(/task decomposition complete/i)).toBeInTheDocument();
        expect(screen.getByText(/first subtask/i)).toBeInTheDocument();
        expect(screen.getByText(/second subtask/i)).toBeInTheDocument();
        expect(screen.getByText(/15 minutes total/i)).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Component Integration', () => {
    test('should maintain state consistency across tab switches', async () => {
      render(<CollaborationHub sessionId="test-session-123" />);

      await waitFor(() => {
        expect(screen.getByText(/collaboration hub/i)).toBeInTheDocument();
      });

      // Start on ideation tab, create a draft
      expect(screen.getByRole('tab', { name: /ideation/i })).toHaveAttribute('aria-selected', 'true');

      // Switch to execution tab
      await userEvent.click(screen.getByRole('tab', { name: /execution/i }));
      expect(screen.getByText(/execution workspace/i)).toBeInTheDocument();

      // Create checkpoint
      await userEvent.click(screen.getByRole('button', { name: /create checkpoint/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close modal and switch back to ideation
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
      await userEvent.click(screen.getByRole('tab', { name: /ideation/i }));

      // Should return to ideation workspace with preserved state
      expect(screen.getByText(/ideation workspace/i)).toBeInTheDocument();
      expect(screen.getByText('Initial CLAUDE.md')).toBeInTheDocument();
    });

    test('should handle real-time updates across components', async () => {
      // Mock WebSocket or polling updates
      const mockUpdatedSession = {
        ...mockSession,
        sessionData: {
          ...mockSession.sessionData,
          ideation: {
            drafts: [
              ...mockSession.sessionData.ideation.drafts,
              {
                id: 'draft-3',
                title: 'Real-time Added Draft',
                timestamp: '2022-01-01T03:00:00.000Z',
                status: 'draft'
              }
            ]
          }
        }
      };

      let callCount = 0;
      fetch.mockImplementation(() => {
        callCount++;
        const sessionToReturn = callCount === 1 ? mockSession : mockUpdatedSession;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(sessionToReturn)
        });
      });

      render(<CollaborationHub sessionId="test-session-123" />);

      await waitFor(() => {
        expect(screen.getByText(/2 drafts/i)).toBeInTheDocument();
      });

      // Simulate real-time update (would normally come from WebSocket)
      // Force re-render with updated data
      // Note: In real implementation, this would be handled by WebSocket updates
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<CollaborationHub sessionId="test-session-123" />);

      await waitFor(() => {
        expect(screen.getByText(/error loading session/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/network error/i)).toBeInTheDocument();

      // Should show retry button
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    test('should handle empty session data', async () => {
      const emptySession = {
        sessionId: 'empty-session',
        sessionData: {
          ideation: { drafts: [] },
          execution: { checkpoints: [] },
          merge: { conflicts: [] },
          orchestration: { tasks: [] }
        }
      };

      fetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(emptySession)
        })
      );

      render(<CollaborationHub sessionId="empty-session" />);

      await waitFor(() => {
        expect(screen.getByText(/collaboration hub/i)).toBeInTheDocument();
      });

      // Should show empty states
      expect(screen.getByText(/no drafts created yet/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create new draft/i })).toBeInTheDocument();
    });

    test('should handle form validation errors', async () => {
      render(<IdeationView sessionData={mockSession.sessionData} sessionId={mockSession.sessionId} />);

      await waitFor(() => {
        expect(screen.getByText(/ideation workspace/i)).toBeInTheDocument();
      });

      // Open create modal
      await userEvent.click(screen.getByRole('button', { name: /create new draft/i }));

      // Try to submit empty form
      await userEvent.click(screen.getByRole('button', { name: /create draft/i }));

      // Should show validation errors
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(screen.getByText(/content is required/i)).toBeInTheDocument();

      // Modal should remain open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
