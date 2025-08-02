import { useEffect, useState, useRef } from 'react';

/**
 * Hook to get real-time task progress updates using Server-Sent Events
 */
export function useTaskProgress(taskId) {
  const [taskData, setTaskData] = useState(null);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (!taskId) return;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const url = `${baseUrl}/api/task-monitor/stream/${taskId}`;

    // Create EventSource connection
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log(`📡 SSE connected for task ${taskId}`);
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connected':
            console.log('✅ SSE connection established');
            break;
            
          case 'update':
            setTaskData(data.task);
            break;
            
          case 'complete':
            console.log('🏁 Task complete, closing connection');
            eventSource.close();
            setIsConnected(false);
            break;
            
          case 'error':
            console.error('❌ SSE error:', data.message);
            setError(data.message);
            break;
            
          default:
            console.log('📦 Unknown SSE message type:', data.type);
        }
      } catch (err) {
        console.error('Failed to parse SSE data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('❌ SSE connection error:', err);
      setError('Connection lost. Retrying...');
      setIsConnected(false);
      
      // EventSource will automatically reconnect
    };

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        console.log(`🔌 Closing SSE connection for task ${taskId}`);
        eventSourceRef.current.close();
      }
    };
  }, [taskId]);

  return {
    task: taskData,
    error,
    isConnected,
    closeConnection: () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setIsConnected(false);
      }
    }
  };
}