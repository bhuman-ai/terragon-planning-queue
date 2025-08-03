/**
 * Security System Test Page
 * Test interface for Phase 2A security controls
 */

import { useState } from 'react';

export default function SecurityTest() {
  const [status, setStatus] = useState('Not initialized');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [verification, setVerification] = useState(null);

  const initializeSecurity = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/security/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();

      if (data.success) {
        setStatus('Initialized successfully');
        setResults(data);
      } else {
        setStatus(`Failed: ${data.message}`);
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  const checkSecurityStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/security/status');
      const data = await response.json();
      setResults(data);
      setStatus(data.success ? `Security Level: ${data.securityLevel}` : 'Status check failed');
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  const verifySacredDocument = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/security/verify-sacred', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Will default to CLAUDE.md
      });
      const data = await response.json();
      setVerification(data);
      setStatus(data.verification?.verified ? 'Sacred document verified' : 'Sacred document compromised!');
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🔐 Terragon Security System Test</h1>
      <p><strong>Phase 2A Critical Security Controls</strong></p>

      <div style={{ marginBottom: '20px' }}>
        <h2>Status: {status}</h2>
        {loading && <p>🔄 Loading...</p>}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={initializeSecurity}
          disabled={loading}
          style={{ marginRight: '10px', padding: '10px', backgroundColor: '#007acc', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          🚀 Initialize Security System
        </button>

        <button
          onClick={checkSecurityStatus}
          disabled={loading}
          style={{ marginRight: '10px', padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          📊 Check Security Status
        </button>

        <button
          onClick={verifySacredDocument}
          disabled={loading}
          style={{ padding: '10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          🛡️ Verify Sacred Document
        </button>
      </div>

      {results && (
        <div>
          <h3>Security Status Results</h3>
          <pre style={{
            backgroundColor: '#f8f9fa',
            padding: '15px',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '12px'
          }}>
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}

      {verification && (
        <div style={{ marginTop: '20px' }}>
          <h3>Sacred Document Verification</h3>
          <div style={{
            backgroundColor: verification.verification?.verified ? '#d4edda' : '#f8d7da',
            border: `1px solid ${verification.verification?.verified ? '#c3e6cb' : '#f5c6cb'}`,
            padding: '15px',
            borderRadius: '4px',
            marginBottom: '10px'
          }}>
            <strong>Status:</strong> {verification.verification?.verified ? '✅ VERIFIED' : '❌ COMPROMISED'}<br/>
            <strong>Sacred:</strong> {verification.verification?.sacred ? 'Yes' : 'No'}<br/>
            <strong>Action Required:</strong> {verification.actionRequired ? 'YES' : 'No'}<br/>
            <strong>Response Level:</strong> {verification.responseLevel}
          </div>

          {verification.recommendations && verification.recommendations.length > 0 && (
            <div>
              <h4>Recommendations:</h4>
              {verification.recommendations.map((rec, index) => (
                <div key={index} style={{
                  backgroundColor: rec.priority === 'CRITICAL' ? '#f8d7da' : '#fff3cd',
                  padding: '10px',
                  margin: '5px 0',
                  borderRadius: '4px',
                  border: `1px solid ${rec.priority === 'CRITICAL' ? '#f5c6cb' : '#ffeaa7'}`
                }}>
                  <strong>{rec.priority}:</strong> {rec.message}
                </div>
              ))}
            </div>
          )}

          <pre style={{
            backgroundColor: '#f8f9fa',
            padding: '15px',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '12px',
            marginTop: '10px'
          }}>
            {JSON.stringify(verification, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
        <h3>Security Components Implemented</h3>
        <ul>
          <li>✅ <strong>Agent Authentication:</strong> RSA-2048/Ed25519 certificates</li>
          <li>✅ <strong>Dual-Hash Integrity:</strong> SHA3-256 + BLAKE3 verification</li>
          <li>✅ <strong>Atomic Checkpoints:</strong> Race condition prevention</li>
          <li>✅ <strong>Sacred Document Protection:</strong> CLAUDE.md protection middleware</li>
        </ul>

        <p><strong>Security Level:</strong> Phase 2A Critical Controls Active</p>
        <p><small>These controls address the 3 critical vulnerabilities found in the security audit:
        agent authentication bypass, hash collision attacks, and timing attacks.</small></p>
      </div>
    </div>
  );
}
