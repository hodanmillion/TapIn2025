import { useState } from 'react';
import api from '@/services/api';

export function NetworkTestPage() {
  const [results, setResults] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runTests = async () => {
    setTesting(true);
    setResults([]);
    
    // Test 1: Show configuration
    addResult(`=== Configuration ===`);
    addResult(`Base URL from env: ${import.meta.env.VITE_API_BASE_URL || 'Not set (using relative)'}`);
    addResult(`API defaults.baseURL: ${api.defaults.baseURL || 'Not set'}`);
    addResult(`Window location: ${window.location.origin}`);
    
    // Test 2: Direct fetch to health endpoint
    addResult(`\n=== Test 1: Direct fetch to nginx health ===`);
    try {
      const healthUrl = `${import.meta.env.VITE_API_BASE_URL || ''}/health`;
      addResult(`Fetching: ${healthUrl}`);
      const response = await fetch(healthUrl);
      addResult(`Response: ${response.status} ${response.statusText}`);
      const text = await response.text();
      addResult(`Body: ${text}`);
    } catch (error: any) {
      addResult(`Error: ${error.message}`);
    }
    
    // Test 3: Hex resolutions endpoint
    addResult(`\n=== Test 2: Hex resolutions via axios ===`);
    try {
      const response = await api.get('/api/v1/hex/resolutions');
      addResult(`Success! Status: ${response.status}`);
      addResult(`Data: ${JSON.stringify(response.data).substring(0, 100)}...`);
    } catch (error: any) {
      addResult(`Error: ${error.message}`);
      if (error.response) {
        addResult(`Response status: ${error.response.status}`);
        addResult(`Response data: ${JSON.stringify(error.response.data)}`);
      }
      if (error.config) {
        addResult(`Request URL: ${error.config.url}`);
        addResult(`Request baseURL: ${error.config.baseURL}`);
      }
    }
    
    // Test 4: Direct hex join test
    addResult(`\n=== Test 3: Hex join endpoint ===`);
    try {
      const testLat = 37.7749;
      const testLng = -122.4194;
      const joinUrl = `/api/v1/hex/join?lat=${testLat}&lng=${testLng}&resolution=8`;
      addResult(`Testing: POST ${joinUrl}`);
      
      const response = await api.post(joinUrl);
      addResult(`Success! Status: ${response.status}`);
      addResult(`Hex index: ${response.data.hex_cell?.h3_index}`);
    } catch (error: any) {
      addResult(`Error: ${error.message}`);
      if (error.response) {
        addResult(`Response status: ${error.response.status}`);
        addResult(`Response detail: ${error.response.data?.detail || error.response.data?.message || 'No detail'}`);
      }
    }
    
    setTesting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Network Test</h1>
        
        <button
          onClick={runTests}
          disabled={testing}
          className="mb-4 px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {testing ? 'Running Tests...' : 'Run Network Tests'}
        </button>
        
        <div className="bg-white rounded-lg shadow p-4">
          <pre className="whitespace-pre-wrap font-mono text-sm">
            {results.length === 0 ? 'Click "Run Network Tests" to start' : results.join('\n')}
          </pre>
        </div>
        
        <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
          <h3 className="font-semibold mb-2">Current Environment:</h3>
          <ul className="text-sm space-y-1">
            <li>VITE_API_BASE_URL: {import.meta.env.VITE_API_BASE_URL || 'Not set'}</li>
            <li>Mode: {import.meta.env.MODE}</li>
            <li>Dev: {import.meta.env.DEV ? 'Yes' : 'No'}</li>
            <li>Prod: {import.meta.env.PROD ? 'Yes' : 'No'}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}