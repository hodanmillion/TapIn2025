from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
import googlemaps
import httpx
from geopy import Nominatim
import structlog

from ..config import settings

logger = structlog.get_logger()

class GeocodingProvider(ABC):
    """Abstract base class for geocoding providers"""
    
    @abstractmethod
    async def geocode(self, address: str) -> Optional[Dict[str, Any]]:
        """Geocode an address"""
        pass
    
    @abstractmethod
    async def reverse_geocode(self, lat: float, lon: float) -> Optional[Dict[str, Any]]:
        """Reverse geocode coordinates"""
        pass
    
    @abstractmethod
    async def search_places(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search for places"""
        pass
    
    async def batch_geocode(self, addresses: List[str]) -> List[Optional[Dict[str, Any]]]:
        """Batch geocode multiple addresses"""
        results = []
        for address in addresses:
            result = await self.geocode(address)
            results.append(result)
        return results

class GoogleMapsProvider(GeocodingProvider):
    """Google Maps geocoding provider"""
    
    def __init__(self, api_key: str):
        self.client = googlemaps.Client(key=api_key)
    
    async def geocode(self, address: str) -> Optional[Dict[str, Any]]:
        """Geocode using Google Maps API"""
        try:
            results = self.client.geocode(address)
            if results:
                return self._format_result(results[0])
            return None
        except Exception as e:
            logger.error("Google Maps geocoding failed", error=str(e))
            return None
    
    async def reverse_geocode(self, lat: float, lon: float) -> Optional[Dict[str, Any]]:
        """Reverse geocode using Google Maps API"""
        try:
            results = self.client.reverse_geocode((lat, lon))
            if results:
                return self._format_result(results[0])
            return None
        except Exception as e:
            logger.error("Google Maps reverse geocoding failed", error=str(e))
            return None
    
    async def search_places(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search places using Google Maps API"""
        try:
            results = self.client.places(query)
            formatted = []
            for result in results.get('results', [])[:limit]:
                formatted_result = self._format_place_result(result)
                if formatted_result:
                    formatted.append(formatted_result)
            return formatted
        except Exception as e:
            logger.error("Google Maps place search failed", error=str(e))
            return []
    
    def _format_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Format Google Maps result"""
        location = result['geometry']['location']
        components = {}
        
        for component in result.get('address_components', []):
            types = component['types']
            if 'street_number' in types:
                components['street_number'] = component['long_name']
            elif 'route' in types:
                components['street_name'] = component['long_name']
            elif 'locality' in types:
                components['city'] = component['long_name']
            elif 'administrative_area_level_1' in types:
                components['state'] = component['short_name']
            elif 'country' in types:
                components['country'] = component['short_name']
            elif 'postal_code' in types:
                components['postal_code'] = component['long_name']
        
        return {
            'place_id': result['place_id'],
            'address_string': result['formatted_address'],
            'coordinates': {
                'latitude': location['lat'],
                'longitude': location['lng']
            },
            'components': components,
            'metadata': {
                'provider': 'google_maps',
                'types': result.get('types', [])
            }
        }
    
    def _format_place_result(self, result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Format Google Places result"""
        if 'geometry' not in result:
            return None
        
        location = result['geometry']['location']
        
        return {
            'place_id': result['place_id'],
            'address_string': result.get('formatted_address', result.get('name', '')),
            'coordinates': {
                'latitude': location['lat'],
                'longitude': location['lng']
            },
            'components': {},  # Places API has different structure
            'metadata': {
                'provider': 'google_places',
                'types': result.get('types', []),
                'rating': result.get('rating'),
                'price_level': result.get('price_level')
            }
        }

class NominatimProvider(GeocodingProvider):
    """OpenStreetMap Nominatim geocoding provider"""
    
    def __init__(self, user_agent: str = "address-service"):
        self.geolocator = Nominatim(user_agent=user_agent)
    
    async def geocode(self, address: str) -> Optional[Dict[str, Any]]:
        """Geocode using Nominatim"""
        try:
            location = self.geolocator.geocode(address, exactly_one=True)
            if location:
                return self._format_result(location.raw, location.latitude, location.longitude)
            return None
        except Exception as e:
            logger.error("Nominatim geocoding failed", error=str(e))
            return None
    
    async def reverse_geocode(self, lat: float, lon: float) -> Optional[Dict[str, Any]]:
        """Reverse geocode using Nominatim"""
        try:
            location = self.geolocator.reverse(f"{lat}, {lon}", exactly_one=True)
            if location:
                return self._format_result(location.raw, lat, lon)
            return None
        except Exception as e:
            logger.error("Nominatim reverse geocoding failed", error=str(e))
            return None
    
    async def search_places(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search places using Nominatim"""
        try:
            locations = self.geolocator.geocode(query, exactly_one=False, limit=limit)
            results = []
            for location in locations or []:
                result = self._format_result(location.raw, location.latitude, location.longitude)
                if result:
                    results.append(result)
            return results
        except Exception as e:
            logger.error("Nominatim place search failed", error=str(e))
            return []
    
    def _format_result(self, raw: Dict[str, Any], lat: float, lon: float) -> Dict[str, Any]:
        """Format Nominatim result"""
        address = raw.get('address', {})
        
        components = {
            'street_number': address.get('house_number'),
            'street_name': address.get('road'),
            'city': address.get('city') or address.get('town') or address.get('village'),
            'state': address.get('state'),
            'country': address.get('country'),
            'postal_code': address.get('postcode')
        }
        
        return {
            'place_id': f"osm_{raw.get('place_id', '')}",
            'address_string': raw.get('display_name', ''),
            'coordinates': {
                'latitude': lat,
                'longitude': lon
            },
            'components': components,
            'metadata': {
                'provider': 'nominatim',
                'osm_type': raw.get('osm_type'),
                'osm_id': raw.get('osm_id'),
                'class': raw.get('class'),
                'type': raw.get('type')
            }
        }

def get_geocoding_provider() -> GeocodingProvider:
    """Get configured geocoding provider"""
    if settings.GOOGLE_MAPS_API_KEY:
        return GoogleMapsProvider(settings.GOOGLE_MAPS_API_KEY)
    else:
        return NominatimProvider()