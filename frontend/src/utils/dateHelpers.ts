export const formatMessageTime = (timestamp: string | Date): string => {
  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date:', timestamp);
      return 'Invalid date';
    }
    
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  } catch (error) {
    console.error('Error formatting date:', error, timestamp);
    return 'Invalid date';
  }
};

export const formatRelativeTime = (timestamp: string | Date): string => {
  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date:', timestamp);
      return 'Invalid date';
    }
    
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / 60000);
    
    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  } catch (error) {
    console.error('Error formatting relative time:', error, timestamp);
    return 'Invalid date';
  }
};