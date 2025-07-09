
interface ResolutionSelectorProps {
  currentResolution: number;
}

const RESOLUTION_LABELS = {
  6: 'City',
  7: 'District', 
  8: 'Neighborhood',
  9: 'Block',
  10: 'Building'
};

export function ResolutionSelector({ currentResolution }: ResolutionSelectorProps) {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600">Resolution:</span>
      <span className="text-sm font-medium text-primary-600">
        {RESOLUTION_LABELS[currentResolution as keyof typeof RESOLUTION_LABELS] || `Level ${currentResolution}`}
      </span>
    </div>
  );
}