import { useState } from 'react';
import api from '@/services/api';

export function DebugPage() {
  const [results, setResults] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testConnectivity = async () => {
    setTesting(true);
    setResults([]);
    
    // Show current configuration
    addResult(`Base URL: ${import.meta.env.VITE_API_BASE_URL || 'Using relative path /'}`);
    addResult(`Environment: ${import.meta.env.MODE}`);
    
    // Test basic connectivity
    try {
      addResult('Testing health endpoint...');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/health`);
      addResult(`Frontend health: ${response.ok ? 'OK' : 'Failed'} (${response.status})`);
    } catch (error: any) {
      addResult(`Frontend health error: ${error.message}`);
    }

    // Test auth service
    try {
      addResult('Testing auth service...');
      const response = await api.get('/api/v1/auth/health').catch(err => err.response);
      if (response?.status === 200) {
        addResult('Auth service: Connected ✓');
      } else {
        addResult(`Auth service: Failed (${response?.status || 'Network Error'})`);
      }
    } catch (error: any) {
      addResult(`Auth service error: ${error.message}`);
    }

    // Test registration endpoint
    try {
      addResult('Testing registration endpoint...');
      const testData = {
        email: `test${Date.now()}@example.com`,
        username: `test${Date.now()}`,
        password: 'testpass123'
      };
      
      const response = await api.post('/api/v1/auth/register', testData).catch(err => err.response);
      
      if (response?.status === 201 || response?.status === 200) {
        addResult('Registration endpoint: Working ✓');
      } else if (response?.status === 400) {
        addResult(`Registration endpoint: Reachable but validation failed (${response.data?.error || response.data?.message})`);
      } else {
        addResult(`Registration endpoint: Failed (${response?.status || 'Network Error'})`);
      }
    } catch (error: any) {
      addResult(`Registration error: ${error.message}`);
    }

    // Network info
    try {
      const networkInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        onLine: navigator.onLine
      };
      addResult(`Network info: ${JSON.stringify(networkInfo, null, 2)}`);
    } catch (error: any) {
      addResult(`Network info error: ${error.message}`);
    }

    setTesting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Network Debug</h1>
        
        <button
          onClick={testConnectivity}
          disabled={testing}
          className="mb-4 px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Run Connectivity Test'}
        </button>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-2">Test Results:</h2>
          <div className="space-y-1 font-mono text-sm">
            {results.length === 0 ? (
              <p className="text-gray-500">Click "Run Connectivity Test" to start</p>
            ) : (
              results.map((result, index) => (
                <div key={index} className={result.includes('✓') ? 'text-green-600' : result.includes('Failed') || result.includes('error') ? 'text-red-600' : 'text-gray-700'}>
                  {result}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
          <h3 className="font-semibold mb-2">Troubleshooting Tips:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Make sure your phone and computer are on the same WiFi network</li>
            <li>Check that Docker services are running: docker-compose ps</li>
            <li>Your computer's IP in .env.mobile should be: {import.meta.env.VITE_API_BASE_URL?.match(/\d+\.\d+\.\d+\.\d+/)?.[0] || 'Not set'}</li>
            <li>Auth service should be accessible at port 8080</li>
          </ul>
        </div>
      </div>
    </div>
  );
}