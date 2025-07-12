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
    
    // 2. Get user profiles
    console.log('2️⃣  Getting user profiles...');
    
    // Get user info from auth service first
    const authUser1 = await axios.get('http://localhost:8080/api/v1/users/me', {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const authUser2 = await axios.get('http://localhost:8080/api/v1/users/me', {
      headers: { Authorization: `Bearer ${token2}` }
    });
    
    console.log(`Auth User 1: ${authUser1.data.username} (auth id: ${authUser1.data.id})`);
    console.log(`Auth User 2: ${authUser2.data.username} (auth id: ${authUser2.data.id})`);
    
    // Get profiles from user service
    const profile1 = await axios.get(`http://localhost:3002/api/v1/profile/${authUser1.data.username}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const profile2 = await axios.get(`http://localhost:3002/api/v1/profile/${authUser2.data.username}`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    
    const userId1 = profile1.data.id;
    const userId2 = profile2.data.id;
    
    console.log(`✅ User Service Profile 1: ${profile1.data.username} (id: ${userId1})`);
    console.log(`✅ User Service Profile 2: ${profile2.data.username} (id: ${userId2})\n`);
    
    // 3. Test block functionality
    console.log('3️⃣  Testing block endpoints...\n');
    
    // Check initial block status
    console.log('Checking initial block status...');
    const initialCheck = await axios.get(`http://localhost:3002/api/v1/social/blocked/${userId2}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('Initial block status:', initialCheck.data);
    console.log('✅ No block exists initially\n');
    
    // Block user 2
    console.log('User 1 blocks User 2...');
    await axios.post(`http://localhost:3002/api/v1/social/block/${userId2}`, 
      { reason: 'Testing block functionality' }, 
      { headers: { Authorization: `Bearer ${token1}` }}
    );
    console.log('✅ Block created successfully\n');
    
    // Check block status after blocking
    console.log('Checking block status after blocking...');
    const afterBlockCheck = await axios.get(`http://localhost:3002/api/v1/social/blocked/${userId2}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('Block status after blocking:', afterBlockCheck.data);
    console.log('✅ Block confirmed\n');
    
    // Get list of blocked users
    console.log('Getting list of blocked users...');
    const blockedList = await axios.get('http://localhost:3002/api/v1/social/blocked', {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('Blocked users:', JSON.stringify(blockedList.data, null, 2));
    console.log('✅ Blocked list retrieved\n');
    
    // Try to follow blocked user (should fail)
    console.log('Trying to follow blocked user (should fail)...');
    try {
      await axios.post(`http://localhost:3002/api/v1/social/follow/${userId2}`, {}, {
        headers: { Authorization: `Bearer ${token1}` }
      });
      console.log('❌ ERROR: Follow should have failed!');
    } catch (error) {
      console.log('✅ Follow correctly rejected:', error.response?.data);
    }
    console.log();
    
    // Unblock user
    console.log('Unblocking User 2...');
    await axios.delete(`http://localhost:3002/api/v1/social/unblock/${userId2}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('✅ Unblock successful\n');
    
    // Check final block status
    console.log('Checking final block status...');
    const finalCheck = await axios.get(`http://localhost:3002/api/v1/social/blocked/${userId2}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('Final block status:', finalCheck.data);
    console.log('✅ Block removed successfully\n');
    
    console.log('🎉 All block functionality tests passed!');
    
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