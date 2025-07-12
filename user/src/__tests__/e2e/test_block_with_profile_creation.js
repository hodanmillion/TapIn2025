const axios = require('axios');

// Generate unique test users
const randomId = Math.floor(Math.random() * 10000);
const testUser1 = {
  email: `blocktest${randomId}a@example.com`,
  username: `blocktest${randomId}a`,
  password: 'testpass123'
};

const testUser2 = {
  email: `blocktest${randomId}b@example.com`,
  username: `blocktest${randomId}b`,
  password: 'testpass123'
};

async function testBlockFunctionality() {
  console.log('🧪 Testing Block Functionality\n');
  
  try {
    // 1. Register and login users
    console.log('1️⃣  Creating test users...');
    
    // Register user 1
    try {
      await axios.post('http://localhost:8080/api/v1/auth/register', testUser1);
      console.log('✅ User 1 registered');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('User 1 already exists');
      } else {
        throw error;
      }
    }
    
    // Register user 2
    try {
      await axios.post('http://localhost:8080/api/v1/auth/register', testUser2);
      console.log('✅ User 2 registered');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('User 2 already exists');
      } else {
        throw error;
      }
    }
    
    // Login users
    const login1 = await axios.post('http://localhost:8080/api/v1/auth/login', {
      email: testUser1.email,
      password: testUser1.password
    });
    const token1 = login1.data.access_token;
    console.log('✅ User 1 logged in');
    
    const login2 = await axios.post('http://localhost:8080/api/v1/auth/login', {
      email: testUser2.email,
      password: testUser2.password
    });
    const token2 = login2.data.access_token;
    console.log('✅ User 2 logged in\n');
    
    // 2. Get auth user info
    console.log('2️⃣  Getting auth user info...');
    const authUser1 = await axios.get('http://localhost:8080/api/v1/users/me', {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const authUser2 = await axios.get('http://localhost:8080/api/v1/users/me', {
      headers: { Authorization: `Bearer ${token2}` }
    });
    
    console.log(`Auth User 1: ${authUser1.data.username} (id: ${authUser1.data.id})`);
    console.log(`Auth User 2: ${authUser2.data.username} (id: ${authUser2.data.id})\n`);
    
    // 3. Create user profiles in user service database directly
    console.log('3️⃣  Creating user profiles in user service...');
    
    // First, let's try to get current user profile (which should create it if it doesn't exist)
    let userId1, userId2;
    
    try {
      const profile1 = await axios.get('http://localhost:3002/api/v1/profile/me', {
        headers: { Authorization: `Bearer ${token1}` }
      });
      userId1 = profile1.data.id;
      console.log(`✅ User 1 profile exists: ${profile1.data.username} (id: ${userId1})`);
    } catch (error) {
      console.log('User 1 profile error:', error.response?.status, error.response?.data);
      
      // If profile doesn't exist, we need to check how the user service creates profiles
      // For now, let's use the auth user IDs as user IDs (this might be the issue)
      userId1 = authUser1.data.id;
    }
    
    try {
      const profile2 = await axios.get('http://localhost:3002/api/v1/profile/me', {
        headers: { Authorization: `Bearer ${token2}` }
      });
      userId2 = profile2.data.id;
      console.log(`✅ User 2 profile exists: ${profile2.data.username} (id: ${userId2})`);
    } catch (error) {
      console.log('User 2 profile error:', error.response?.status, error.response?.data);
      userId2 = authUser2.data.id;
    }
    
    console.log();
    
    // 4. Test block functionality
    console.log('4️⃣  Testing block endpoints...\n');
    
    // Check initial block status
    console.log('Checking initial block status...');
    try {
      const initialCheck = await axios.get(`http://localhost:3002/api/v1/social/blocked/${userId2}`, {
        headers: { Authorization: `Bearer ${token1}` }
      });
      console.log('Initial block status:', initialCheck.data);
    } catch (error) {
      console.log('Initial check error:', error.response?.status, error.response?.data);
    }
    
    // Block user 2
    console.log('\nUser 1 blocks User 2...');
    try {
      await axios.post(`http://localhost:3002/api/v1/social/block/${userId2}`, 
        { reason: 'Testing block functionality' }, 
        { headers: { Authorization: `Bearer ${token1}` }}
      );
      console.log('✅ Block created successfully');
    } catch (error) {
      console.log('Block error:', error.response?.status, error.response?.data);
    }
    
    // Get list of blocked users
    console.log('\nGetting list of blocked users...');
    try {
      const blockedList = await axios.get('http://localhost:3002/api/v1/social/blocked', {
        headers: { Authorization: `Bearer ${token1}` }
      });
      console.log('Blocked users:', JSON.stringify(blockedList.data, null, 2));
    } catch (error) {
      console.log('Blocked list error:', error.response?.status, error.response?.data);
    }
    
    // Unblock user
    console.log('\nUnblocking User 2...');
    try {
      await axios.delete(`http://localhost:3002/api/v1/social/unblock/${userId2}`, {
        headers: { Authorization: `Bearer ${token1}` }
      });
      console.log('✅ Unblock successful');
    } catch (error) {
      console.log('Unblock error:', error.response?.status, error.response?.data);
    }
    
    console.log('\n✅ Block functionality test completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('URL:', error.config?.url);
    }
  }
}

// Run the tests
testBlockFunctionality();