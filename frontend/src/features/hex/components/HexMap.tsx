import { HexCell, NeighborHex } from '../hooks/useHexChat';

interface HexMapProps {
  hexCell: HexCell;
  neighbors: NeighborHex[];
  userPosition?: { lat: number; lng: number };
}

export function HexMap({ hexCell, neighbors }: HexMapProps) {
  return (
    <div className="h-full bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="text-2xl mb-2">🗺️</div>
        <p className="text-sm text-gray-600">
          Map view for {hexCell.display_name}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {neighbors.length} neighbors nearby
        </p>
      </div>
    </div>
  );
}