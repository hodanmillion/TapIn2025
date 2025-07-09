# Fixed: Find Nearby Chats Navigation

## What was fixed
The "Find Nearby Chats" button now directly navigates to a local chat room instead of going to the search page.

## How it works now

1. **With location already granted:**
   - Click "Find Nearby Chats"
   - Immediately navigates to `/chat/{latitude}_{longitude}`

2. **Without location permission:**
   - Click "Find Nearby Chats"
   - Browser prompts for location permission
   - Once granted, automatically navigates to `/chat/{latitude}_{longitude}`

## Code changes

In `HomePage.tsx`:
```typescript
const handleFindNearby = () => {
  if (currentLocation) {
    // Navigate directly to chat room with coordinates
    const lat = currentLocation.coords.latitude;
    const lon = currentLocation.coords.longitude;
    const locationId = `${lat}_${lon}`;
    navigate(`/chat/${locationId}`);
  } else {
    hasRequestedLocation.current = true;
    requestLocation();
  }
};

// Auto-navigate when location becomes available
useEffect(() => {
  if (currentLocation && hasRequestedLocation.current && !isLoadingLocation) {
    const lat = currentLocation.coords.latitude;
    const lon = currentLocation.coords.longitude;
    const locationId = `${lat}_${lon}`;
    navigate(`/chat/${locationId}`);
    hasRequestedLocation.current = false;
  }
}, [currentLocation, isLoadingLocation, navigate]);
```

## Testing the fix

1. Go to `http://localhost:5173`
2. Login/Register
3. Click "Find Nearby Chats"
4. You should be taken directly to a chat room at `/chat/{your_coordinates}`

The chat room URL will look like: `/chat/40.7589_-73.9851` (example coordinates)