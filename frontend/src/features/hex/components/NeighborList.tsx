import { NeighborHex } from '../hooks/useHexChat';

interface NeighborListProps {
  neighbors: NeighborHex[];
  onSelectNeighbor: (neighbor: NeighborHex) => void;
}

export function NeighborList({ neighbors, onSelectNeighbor }: NeighborListProps) {
  if (neighbors.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No neighbors found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {neighbors.map((neighbor) => (
        <button
          key={neighbor.h3_index}
          onClick={() => onSelectNeighbor(neighbor)}
          className="w-full p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">{neighbor.name}</div>
              <div className="text-xs text-gray-500">
                {neighbor.active_users} {neighbor.active_users === 1 ? 'person' : 'people'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">
                {neighbor.distance_km.toFixed(1)}km
              </div>
              <div className="text-xs text-gray-400">
                {neighbor.direction}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}