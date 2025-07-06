import geopandas as gpd
import pandas as pd
from shapely.geometry import Point, Polygon, MultiPoint
from shapely.ops import unary_union
import h3
import folium
from folium.plugins import HeatMap
import numpy as np
from typing import List, Dict, Tuple, Optional, Any
from sklearn.cluster import DBSCAN
import json

from ..models import (
    Coordinates, 
    LocationResponse, 
    SpatialCluster,
    BoundingBox,
    HeatmapData
)
import structlog

logger = structlog.get_logger()

class SpatialAnalysisService:
    def __init__(self):
        # Set up coordinate reference systems
        self.wgs84 = "EPSG:4326"  # Lat/Lon
        self.web_mercator = "EPSG:3857"  # For distance calculations
    
    def locations_to_geodataframe(
        self, 
        locations: List[LocationResponse]
    ) -> gpd.GeoDataFrame:
        """Convert locations to GeoPandas GeoDataFrame"""
        
        # Create points from coordinates
        points = [
            Point(loc.coordinates.longitude, loc.coordinates.latitude)
            for loc in locations
        ]
        
        # Create GeoDataFrame
        gdf = gpd.GeoDataFrame(
            {
                'id': [str(loc.id) for loc in locations],
                'place_id': [loc.place_id for loc in locations],
                'address': [loc.address_string for loc in locations],
                'city': [loc.components.city for loc in locations],
                'h3_index': [loc.h3_index for loc in locations],
            },
            geometry=points,
            crs=self.wgs84
        )
        
        return gdf
    
    def find_clusters(
        self,
        locations: List[LocationResponse],
        eps_meters: float = 500,
        min_samples: int = 3
    ) -> List[SpatialCluster]:
        """Find spatial clusters using DBSCAN"""
        
        if len(locations) < min_samples:
            return []
        
        # Convert to GeoDataFrame
        gdf = self.locations_to_geodataframe(locations)
        
        # Project to meter-based CRS for accurate distance calculations
        gdf_projected = gdf.to_crs(self.web_mercator)
        
        # Extract coordinates for clustering
        coords = np.array([[geom.x, geom.y] for geom in gdf_projected.geometry])
        
        # Perform DBSCAN clustering
        clustering = DBSCAN(eps=eps_meters, min_samples=min_samples).fit(coords)
        gdf['cluster'] = clustering.labels_
        
        # Process clusters
        clusters = []
        for cluster_id in set(clustering.labels_):
            if cluster_id == -1:  # Skip noise points
                continue
            
            cluster_points = gdf[gdf['cluster'] == cluster_id]
            cluster_locations = [
                loc for loc in locations 
                if str(loc.id) in cluster_points['id'].values
            ]
            
            # Calculate cluster properties
            cluster_geom = MultiPoint(cluster_points.geometry.tolist())
            centroid = cluster_geom.centroid
            
            # Calculate radius (maximum distance from centroid)
            distances = [
                centroid.distance(point) 
                for point in cluster_points.geometry
            ]
            radius = max(distances) if distances else 0
            
            # Calculate density (locations per square km)
            area_sqm = cluster_geom.convex_hull.area
            area_sqkm = area_sqm / 1_000_000
            density = len(cluster_locations) / area_sqkm if area_sqkm > 0 else 0
            
            # Convert centroid back to lat/lon
            centroid_latlon = gpd.GeoSeries([centroid], crs=self.web_mercator).to_crs(self.wgs84)[0]
            
            clusters.append(SpatialCluster(
                cluster_id=int(cluster_id),
                centroid=Coordinates(
                    latitude=centroid_latlon.y,
                    longitude=centroid_latlon.x
                ),
                locations=cluster_locations,
                radius_meters=radius,
                density=density
            ))
        
        return clusters
    
    def calculate_h3_indices(
        self,
        lat: float,
        lon: float,
        resolution: int = 7
    ) -> str:
        """Calculate H3 hex index for a coordinate"""
        return h3.latlng_to_cell(lat, lon, resolution)
    
    def create_h3_heatmap(
        self,
        locations: List[LocationResponse],
        resolution: int = 7
    ) -> Dict[str, float]:
        """Create H3-based density heatmap"""
        
        # Count locations per H3 hex
        hex_counts = {}
        for loc in locations:
            h3_index = self.calculate_h3_indices(
                loc.coordinates.latitude,
                loc.coordinates.longitude,
                resolution
            )
            hex_counts[h3_index] = hex_counts.get(h3_index, 0) + 1
        
        # Normalize to density (locations per hex)
        max_count = max(hex_counts.values()) if hex_counts else 1
        hex_density = {
            hex_id: count / max_count 
            for hex_id, count in hex_counts.items()
        }
        
        return hex_density
    
    def find_locations_in_polygon(
        self,
        locations: List[LocationResponse],
        polygon: Polygon
    ) -> List[LocationResponse]:
        """Find all locations within a polygon"""
        
        gdf = self.locations_to_geodataframe(locations)
        
        # Create polygon GeoDataFrame
        poly_gdf = gpd.GeoDataFrame([1], geometry=[polygon], crs=self.wgs84)
        
        # Spatial join
        locations_in_poly = gpd.sjoin(
            gdf, 
            poly_gdf, 
            predicate='within'
        )
        
        # Return matching locations
        matching_ids = set(locations_in_poly['id'].values)
        return [
            loc for loc in locations 
            if str(loc.id) in matching_ids
        ]
    
    def calculate_service_area(
        self,
        locations: List[LocationResponse],
        buffer_meters: float = 1000
    ) -> Tuple[Polygon, float]:
        """Calculate service area coverage"""
        
        if not locations:
            return None, 0.0
        
        gdf = self.locations_to_geodataframe(locations)
        gdf_projected = gdf.to_crs(self.web_mercator)
        
        # Buffer each point
        buffered = gdf_projected.buffer(buffer_meters)
        
        # Union all buffers
        service_area = unary_union(buffered)
        
        # Calculate area in square kilometers
        area_sqkm = service_area.area / 1_000_000
        
        # Convert back to lat/lon
        service_area_gdf = gpd.GeoDataFrame([1], geometry=[service_area], crs=self.web_mercator)
        service_area_latlon = service_area_gdf.to_crs(self.wgs84).geometry[0]
        
        return service_area_latlon, area_sqkm
    
    def create_folium_map(
        self,
        locations: List[LocationResponse],
        clusters: Optional[List[SpatialCluster]] = None,
        heatmap_data: Optional[HeatmapData] = None
    ) -> str:
        """Create interactive Folium map"""
        
        if not locations:
            # Default map centered on North America
            m = folium.Map(location=[40, -95], zoom_start=4)
            return m._repr_html_()
        
        # Calculate map center
        lats = [loc.coordinates.latitude for loc in locations]
        lons = [loc.coordinates.longitude for loc in locations]
        center = [np.mean(lats), np.mean(lons)]
        
        # Create map
        m = folium.Map(location=center, zoom_start=12)
        
        # Add location markers
        for loc in locations:
            folium.Marker(
                [loc.coordinates.latitude, loc.coordinates.longitude],
                popup=f"<b>{loc.address_string}</b><br>ID: {loc.place_id}",
                tooltip=loc.address_string
            ).add_to(m)
        
        # Add clusters if provided
        if clusters:
            for cluster in clusters:
                folium.Circle(
                    [cluster.centroid.latitude, cluster.centroid.longitude],
                    radius=cluster.radius_meters,
                    popup=f"Cluster {cluster.cluster_id}: {len(cluster.locations)} locations",
                    color='red',
                    fill=True,
                    fillColor='red',
                    fillOpacity=0.3
                ).add_to(m)
        
        # Add heatmap if provided
        if heatmap_data:
            heat_data = [
                [coord.latitude, coord.longitude, weight]
                for coord, weight in zip(heatmap_data.coordinates, heatmap_data.weights)
            ]
            HeatMap(heat_data).add_to(m)
        
        return m._repr_html_()
    
    def find_nearest_neighbors(
        self,
        target: Coordinates,
        locations: List[LocationResponse],
        k: int = 5
    ) -> List[Tuple[LocationResponse, float]]:
        """Find k nearest neighbors using spatial index"""
        
        if not locations:
            return []
        
        # Convert to GeoDataFrame
        gdf = self.locations_to_geodataframe(locations)
        
        # Create target point
        target_point = Point(target.longitude, target.latitude)
        
        # Project to meters for accurate distance
        gdf_projected = gdf.to_crs(self.web_mercator)
        target_projected = gpd.GeoSeries([target_point], crs=self.wgs84).to_crs(self.web_mercator)[0]
        
        # Calculate distances
        gdf_projected['distance'] = gdf_projected.geometry.distance(target_projected)
        
        # Sort by distance and get top k
        nearest = gdf_projected.nsmallest(k, 'distance')
        
        # Return locations with distances
        result = []
        for idx, row in nearest.iterrows():
            loc = next(l for l in locations if str(l.id) == row['id'])
            result.append((loc, row['distance']))
        
        return result
    
    def calculate_spatial_statistics(
        self,
        locations: List[LocationResponse]
    ) -> Dict[str, Any]:
        """Calculate various spatial statistics"""
        
        if not locations:
            return {
                'total_locations': 0,
                'coverage_area_sqkm': 0,
                'density_per_sqkm': 0,
                'mean_nearest_neighbor_distance': 0
            }
        
        gdf = self.locations_to_geodataframe(locations)
        gdf_projected = gdf.to_crs(self.web_mercator)
        
        # Coverage area (convex hull)
        all_points = MultiPoint(gdf_projected.geometry.tolist())
        convex_hull = all_points.convex_hull
        area_sqkm = convex_hull.area / 1_000_000
        
        # Density
        density = len(locations) / area_sqkm if area_sqkm > 0 else 0
        
        # Mean nearest neighbor distance
        distances = []
        for idx, point in gdf_projected.iterrows():
            others = gdf_projected[gdf_projected.index != idx]
            if len(others) > 0:
                nearest_dist = others.geometry.distance(point.geometry).min()
                distances.append(nearest_dist)
        
        mean_nn_distance = np.mean(distances) if distances else 0
        
        return {
            'total_locations': len(locations),
            'coverage_area_sqkm': area_sqkm,
            'density_per_sqkm': density,
            'mean_nearest_neighbor_distance': mean_nn_distance,
            'spatial_distribution': 'clustered' if mean_nn_distance < 500 else 'dispersed'
        }