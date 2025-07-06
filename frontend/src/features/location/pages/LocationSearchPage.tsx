import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { locationService } from '@/services/location.service';
import { Location } from '@/types';
import toast from 'react-hot-toast';

export function LocationSearchPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const results = await locationService.searchAddresses(searchQuery);
      setLocations(results);
      if (results.length === 0) {
        toast.error('No locations found');
      }
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationSelect = async (location: Location) => {
    try {
      // Get or create the location
      const fullLocation = await locationService.getOrCreateLocation({
        place_id: location.place_id,
        address: location.address_string,
        coordinates: location.coordinates,
      });
      
      // Navigate to chat for this location
      navigate(`/location/${fullLocation.id}`);
    } catch (error) {
      toast.error('Failed to join location');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Search Locations</h1>

        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex space-x-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter an address or place name..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        <div className="space-y-4">
          {locations.map((location) => (
            <div
              key={location.id}
              onClick={() => handleLocationSelect(location)}
              className="bg-white p-4 rounded-lg shadow hover:shadow-md cursor-pointer transition-shadow"
            >
              <h3 className="font-semibold text-lg">{location.address_string}</h3>
              {location.components && (
                <p className="text-gray-600 text-sm">
                  {[
                    location.components.city,
                    location.components.state,
                    location.components.country,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>

        {locations.length === 0 && !isLoading && searchQuery && (
          <p className="text-center text-gray-500 mt-8">
            No locations found. Try a different search term.
          </p>
        )}
      </div>
    </div>
  );
}