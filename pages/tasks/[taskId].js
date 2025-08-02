import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import fs from 'fs/promises';
import path from 'path';

export async function getServerSideProps({ params }) {
  const { taskId } = params;
  const taskPath = path.join(process.cwd(), 'tasks', `task-${taskId}`);
  
  try {
    // Check if task exists
    await fs.access(taskPath);
    
    // Read task.md file
    const taskMdPath = path.join(taskPath, 'task.md');
    let taskContent = '';
    
    try {
      taskContent = await fs.readFile(taskMdPath, 'utf-8');
    } catch (e) {
      taskContent = 'No task.md file found';
    }
    
    // Get list of files in task directory
    const files = await fs.readdir(taskPath);
    
    return {
      props: {
        taskId,
        taskContent,
        files
      }
    };
  } catch (error) {
    return {
      notFound: true
    };
  }
}

export default function TaskView({ taskId, taskContent, files }) {
  const router = useRouter();
  
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
        
        pre {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 5px;
          padding: 15px;
          overflow-x: auto;
          font-family: Monaco, Menlo, monospace;
          font-size: 13px;
          line-height: 1.5;
        }
        
        code {
          background: #2a2a2a;
          padding: 2px 5px;
          border-radius: 3px;
          font-family: Monaco, Menlo, monospace;
          font-size: 13px;
        }
        
        h1, h2, h3, h4, h5, h6 {
          color: #00ff88;
          margin: 20px 0 10px 0;
        }
        
        ul, ol {
          margin-left: 30px;
          line-height: 1.8;
        }
        
        a {
          color: #00aaff;
          text-decoration: none;
        }
        
        a:hover {
          text-decoration: underline;
        }
      `}</style>
      
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ color: '#00ff88', fontSize: '2em' }}>
            📁 Task {taskId}
          </h1>
          <button
            onClick={() => router.push('/')}
            style={{
              padding: '10px 20px',
              background: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '20px' }}>
          {/* Sidebar with files */}
          <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Files in Task</h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {files.map(file => (
                <li key={file} style={{ 
                  padding: '5px 10px', 
                  background: file === 'task.md' ? '#2a2a2a' : 'transparent',
                  borderRadius: '5px',
                  marginBottom: '5px',
                  cursor: 'pointer'
                }}>
                  {file === 'task.md' ? '📄' : '📎'} {file}
                </li>
              ))}
            </ul>
          </div>
          
          {/* Main content */}
          <div style={{ background: '#1a1a1a', padding: '30px', borderRadius: '10px', border: '1px solid #333' }}>
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(taskContent) }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple markdown renderer
function renderMarkdown(content) {
  return content
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^\* (.+)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}