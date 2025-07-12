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
  console.log('🧪 Comprehensive Block Functionality Test\n');
  
  try {
    // 1. Setup users
    console.log('1️⃣  Setting up test users...');
    
    // Register users
    await axios.post('http://localhost:8080/api/v1/auth/register', testUser1);
    await axios.post('http://localhost:8080/api/v1/auth/register', testUser2);
    
    // Login users
    const login1 = await axios.post('http://localhost:8080/api/v1/auth/login', {
      email: testUser1.email,
      password: testUser1.password
    });
    const token1 = login1.data.access_token;
    
    const login2 = await axios.post('http://localhost:8080/api/v1/auth/login', {
      email: testUser2.email,
      password: testUser2.password
    });
    const token2 = login2.data.access_token;
    
    // Get profiles
    const profile1 = await axios.get('http://localhost:3002/api/v1/profile/me', {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const profile2 = await axios.get('http://localhost:3002/api/v1/profile/me', {
      headers: { Authorization: `Bearer ${token2}` }
    });
    
    const userId1 = profile1.data.id;
    const userId2 = profile2.data.id;
    
    console.log(`✅ User 1: ${profile1.data.username} (${userId1})`);
    console.log(`✅ User 2: ${profile2.data.username} (${userId2})\n`);
    
    // 2. Test follow/block interaction
    console.log('2️⃣  Testing follow/block interaction...');
    
    // User 1 follows User 2
    await axios.post(`http://localhost:3002/api/v1/social/follow/${userId2}`, {}, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('✅ User 1 followed User 2');
    
    // User 1 blocks User 2 (should remove follow)
    await axios.post(`http://localhost:3002/api/v1/social/block/${userId2}`, 
      { reason: 'Testing block removes follow' }, 
      { headers: { Authorization: `Bearer ${token1}` }}
    );
    console.log('✅ User 1 blocked User 2');
    
    // Check followers count for User 2
    const user2AfterBlock = await axios.get(`http://localhost:3002/api/v1/profile/${testUser2.username}`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    console.log(`✅ User 2 followers count after block: ${user2AfterBlock.data._count?.followers || 0}\n`);
    
    // 3. Test blocked user restrictions
    console.log('3️⃣  Testing blocked user restrictions...');
    
    // User 1 tries to follow User 2 again (should fail)
    try {
      await axios.post(`http://localhost:3002/api/v1/social/follow/${userId2}`, {}, {
        headers: { Authorization: `Bearer ${token1}` }
      });
      console.log('❌ ERROR: Follow should have failed!');
    } catch (error) {
      console.log('✅ Follow correctly rejected:', error.response?.data?.error);
    }
    
    // User 2 tries to follow User 1 (should also fail due to block)
    try {
      await axios.post(`http://localhost:3002/api/v1/social/follow/${userId1}`, {}, {
        headers: { Authorization: `Bearer ${token2}` }
      });
      console.log('❌ ERROR: Reverse follow should have failed!');
    } catch (error) {
      console.log('✅ Reverse follow correctly rejected:', error.response?.data?.error);
    }
    
    console.log();
    
    // 4. Test block status checks
    console.log('4️⃣  Testing block status checks...');
    
    // Check block status from User 1's perspective
    const blockStatus1 = await axios.get(`http://localhost:3002/api/v1/social/blocked/${userId2}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('User 1 → User 2 block status:', blockStatus1.data);
    
    // Check block status from User 2's perspective
    const blockStatus2 = await axios.get(`http://localhost:3002/api/v1/social/blocked/${userId1}`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    console.log('User 2 → User 1 block status:', blockStatus2.data);
    
    console.log();
    
    // 5. Test unblock functionality
    console.log('5️⃣  Testing unblock functionality...');
    
    // Unblock
    await axios.delete(`http://localhost:3002/api/v1/social/unblock/${userId2}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('✅ User 1 unblocked User 2');
    
    // Now follow should work again
    await axios.post(`http://localhost:3002/api/v1/social/follow/${userId2}`, {}, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('✅ User 1 successfully followed User 2 after unblock');
    
    // Clean up - unfollow
    await axios.delete(`http://localhost:3002/api/v1/social/unfollow/${userId2}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('✅ Cleaned up follow relationship\n');
    
    console.log('🎉 All block functionality tests passed successfully!');
    
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