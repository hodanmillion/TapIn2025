import { useAuth } from '@/features/auth/hooks/useAuth';
import { useHexChat } from '@/features/hex/hooks/useHexChat';
import { useState } from 'react';

const RESOLUTION_OPTIONS = [
  { value: 6, label: 'City', description: 'Join city-wide chat (~10km)' },
  { value: 7, label: 'District', description: 'Join district chat (~2.5km)' },
  { value: 8, label: 'Neighborhood', description: 'Join neighborhood chat (~700m)' },
  { value: 9, label: 'Block', description: 'Join local block chat (~200m)' },
];

export function HomePage() {
  const { user } = useAuth();
  const { joinNearbyHex, loading } = useHexChat();
  const [selectedResolution, setSelectedResolution] = useState(8); // Default to neighborhood
  
  const handleJoinChat = () => {
    joinNearbyHex(selectedResolution);
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
            Welcome to Tap In
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Connect with people in your area through hexagonal neighborhood cells
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <p className="text-lg text-gray-700">Hello, {user?.username}!</p>
            </div>
            
            {/* Resolution selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose your chat radius:
              </label>
              <div className="space-y-2">
                {RESOLUTION_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedResolution === option.value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="resolution"
                      value={option.value}
                      checked={selectedResolution === option.value}
                      onChange={(e) => setSelectedResolution(Number(e.target.value))}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-gray-600">{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            
            {/* Join button */}
            <button
              onClick={handleJoinChat}
              disabled={loading}
              className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Finding your neighborhood...
                </>
              ) : (
                '🔷 Join Neighborhood Chat'
              )}
            </button>
            
            {/* Info section */}
            <div className="mt-6 text-center text-sm text-gray-600">
              <p>Your location will determine which hexagonal cell you join.</p>
              <p className="mt-2">Everyone in the same hex sees the same chat.</p>
            </div>
          </div>
        </div>
        
        {/* Visual representation */}
        <div className="mt-12 flex justify-center">
          <div className="relative">
            <svg width="300" height="260" viewBox="0 0 300 260">
              {/* Draw hexagonal grid */}
              {[0, 1, 2].map((row) => 
                [0, 1, 2, 3].map((col) => {
                  const x = 75 + col * 52 + (row % 2) * 26;
                  const y = 50 + row * 45;
                  const isCenter = row === 1 && col === 1;
                  
                  return (
                    <g key={`${row}-${col}`}>
                      <polygon
                        points={`${x},${y-25} ${x+22},${y-12} ${x+22},${y+12} ${x},${y+25} ${x-22},${y+12} ${x-22},${y-12}`}
                        fill={isCenter ? '#3B82F6' : '#E5E7EB'}
                        stroke={isCenter ? '#2563EB' : '#9CA3AF'}
                        strokeWidth="2"
                      />
                      {isCenter && (
                        <text x={x} y={y+5} textAnchor="middle" className="fill-white text-sm font-medium">
                          You
                        </text>
                      )}
                    </g>
                  );
                })
              )}
            </svg>
            <div className="absolute -bottom-8 left-0 right-0 text-center text-sm text-gray-600">
              Hexagonal neighborhood cells
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}