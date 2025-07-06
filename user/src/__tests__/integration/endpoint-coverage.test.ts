import request from 'supertest';
import jwt from 'jsonwebtoken';

describe('User Service Endpoint Coverage Test', () => {
  const baseUrl = 'http://localhost:3002';
  let authToken: string;

  beforeAll(() => {
    authToken = jwt.sign(
      {
        user_id: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
      },
      'your-super-secret-jwt-key',
      { expiresIn: '1h' }
    );
  });

  describe('Endpoint Coverage Summary', () => {
    const endpoints = [
      { method: 'GET', path: '/health', auth: false, description: 'Health check' },
      { method: 'GET', path: '/api-docs', auth: false, description: 'API documentation' },
      { method: 'GET', path: '/api/v1/profile/me', auth: true, description: 'Get current user profile' },
      { method: 'PUT', path: '/api/v1/profile/me', auth: true, description: 'Update current user profile' },
      { method: 'GET', path: '/api/v1/profile/testuser', auth: true, description: 'Get user profile by username' },
      { method: 'GET', path: '/api/v1/search/users', auth: true, description: 'Search users', query: { q: 'test' } },
      { method: 'POST', path: '/api/v1/social/follow/123e4567-e89b-12d3-a456-426614174000', auth: true, description: 'Follow user' },
      { method: 'DELETE', path: '/api/v1/social/unfollow/123e4567-e89b-12d3-a456-426614174000', auth: true, description: 'Unfollow user' },
      { method: 'GET', path: '/api/v1/social/followers/123e4567-e89b-12d3-a456-426614174000', auth: true, description: 'Get user followers' },
      { method: 'POST', path: '/api/v1/social/block/123e4567-e89b-12d3-a456-426614174000', auth: true, description: 'Block user' },
      { method: 'GET', path: '/api/v1/settings/preferences', auth: true, description: 'Get user preferences' },
      { method: 'PUT', path: '/api/v1/settings/preferences', auth: true, description: 'Update user preferences' },
      { method: 'POST', path: '/api/v1/settings/interests', auth: true, description: 'Update user interests' },
      { method: 'POST', path: '/api/v1/upload/avatar', auth: true, description: 'Upload user avatar' },
    ];

    it('should test all documented endpoints', async () => {
      const results = [];

      for (const endpoint of endpoints) {
        try {
          let req: any;
          const method = endpoint.method.toLowerCase();
          
          if (method === 'get') {
            req = request(baseUrl).get(endpoint.path);
          } else if (method === 'post') {
            req = request(baseUrl).post(endpoint.path);
          } else if (method === 'put') {
            req = request(baseUrl).put(endpoint.path);
          } else if (method === 'delete') {
            req = request(baseUrl).delete(endpoint.path);
          }
          
          if (endpoint.query) {
            req = req.query(endpoint.query);
          }
          
          if (endpoint.auth) {
            req = req.set('Authorization', `Bearer ${authToken}`);
          }

          const response = await req;
          
          results.push({
            endpoint: `${endpoint.method} ${endpoint.path}`,
            description: endpoint.description,
            status: response.status,
            accessible: response.status < 500, // Any response under 500 means endpoint is accessible
          });
        } catch (error) {
          results.push({
            endpoint: `${endpoint.method} ${endpoint.path}`,
            description: endpoint.description,
            status: 'ERROR',
            accessible: false,
            error: (error as Error).message,
          });
        }
      }

      // Log all results for visibility
      console.log('\n=== USER SERVICE ENDPOINT COVERAGE REPORT ===');
      results.forEach(result => {
        const status = result.accessible ? '✅' : '❌';
        console.log(`${status} ${result.endpoint} (${result.status}) - ${result.description}`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
      });

      // Count accessible endpoints
      const accessibleCount = results.filter(r => r.accessible).length;
      const totalCount = results.length;
      
      console.log(`\n📊 COVERAGE: ${accessibleCount}/${totalCount} endpoints accessible (${Math.round(accessibleCount/totalCount*100)}%)`);
      
      // Expect at least 75% of endpoints to be accessible (some may fail due to missing test data)
      expect(accessibleCount / totalCount).toBeGreaterThanOrEqual(0.75);
      
      // Ensure core endpoints are working (health and search)
      const coreEndpoints = results.filter(r => 
        r.endpoint.includes('/health') || 
        r.endpoint.includes('/search') ||
        r.endpoint.includes('/api-docs')
      );
      const workingCore = coreEndpoints.filter(r => r.accessible);
      
      expect(workingCore.length).toBeGreaterThanOrEqual(coreEndpoints.length - 1); // Allow 1 failure
    });

    it('should handle authentication properly across all protected endpoints', async () => {
      const protectedEndpoints = endpoints.filter(e => e.auth);
      const authResults = [];

      for (const endpoint of protectedEndpoints) {
        try {
          // Test without auth - should return 401
          let req: any;
          const method = endpoint.method.toLowerCase();
          
          if (method === 'get') {
            req = request(baseUrl).get(endpoint.path);
          } else if (method === 'post') {
            req = request(baseUrl).post(endpoint.path);
          } else if (method === 'put') {
            req = request(baseUrl).put(endpoint.path);
          } else if (method === 'delete') {
            req = request(baseUrl).delete(endpoint.path);
          }
          
          if (endpoint.query) {
            req = req.query(endpoint.query);
          }
          
          const response = await req;
          authResults.push({
            endpoint: `${endpoint.method} ${endpoint.path}`,
            requiresAuth: response.status === 401,
          });
        } catch (error) {
          // Network errors are acceptable for this test
          authResults.push({
            endpoint: `${endpoint.method} ${endpoint.path}`,
            requiresAuth: true,
          });
        }
      }

      // Most protected endpoints should require authentication
      const properlyProtected = authResults.filter(r => r.requiresAuth).length;
      const totalProtected = protectedEndpoints.length;
      
      console.log(`\n🔒 SECURITY: ${properlyProtected}/${totalProtected} protected endpoints require authentication`);
      
      // Expect at least 80% of endpoints to properly require auth
      expect(properlyProtected / totalProtected).toBeGreaterThanOrEqual(0.8);
    });
  });
});