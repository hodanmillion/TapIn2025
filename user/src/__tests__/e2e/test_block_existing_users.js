const axios = require('axios');

async function testBlockFunctionality() {
  console.log('🧪 Testing Block Functionality with Existing Users\n');
  
  try {
    // 1. Login as existing users
    console.log('1️⃣  Logging in as test users...');
    
    // Login user 1
    const login1 = await axios.post('http://localhost:8080/api/v1/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    const token1 = login1.data.access_token;
    console.log('✅ User 1 logged in');
    
    // Login user 2
    const login2 = await axios.post('http://localhost:8080/api/v1/auth/login', {
      email: 'wstest@example.com',
      password: 'password123'
    });
    const token2 = login2.data.access_token;
    console.log('✅ User 2 logged in\n');
    
    // Get user profiles from user service
    console.log('2️⃣  Getting user profiles...');
    
    // Get profile 1
    let profile1;
    try {
      const profileRes1 = await axios.get('http://localhost:3002/api/v1/profile/testuser', {
        headers: { Authorization: `Bearer ${token1}` }
      });
      profile1 = profileRes1.data;
      console.log(`✅ User 1: ${profile1.username} (${profile1.id})`);
    } catch (error) {
      console.log('User 1 profile error:', error.response?.status, error.response?.data);
    }
    
    // Get profile 2
    let profile2;
    try {
      const profileRes2 = await axios.get('http://localhost:3002/api/v1/profile/wstest', {
        headers: { Authorization: `Bearer ${token2}` }
      });
      profile2 = profileRes2.data;
      console.log(`✅ User 2: ${profile2.username} (${profile2.id})\n`);
    } catch (error) {
      console.log('User 2 profile error:', error.response?.status, error.response?.data);
    }
    
    if (!profile1 || !profile2) {
      console.log('❌ Could not get user profiles, aborting test');
      return;
    }
    
    // 3. Check initial block status
    console.log('3️⃣  Checking initial block status...');
    try {
      const blockCheck = await axios.get(`http://localhost:3002/api/v1/social/blocked/${profile2.id}`, {
        headers: { Authorization: `Bearer ${token1}` }
      });
      console.log('Block status:', blockCheck.data);
    } catch (error) {
      console.log('Block check error:', error.response?.status, error.response?.data);
    }
    
    // 4. Block user 2
    console.log('\n4️⃣  User 1 blocks User 2...');
    try {
      await axios.post(`http://localhost:3002/api/v1/social/block/${profile2.id}`, 
        { reason: 'Testing block functionality' }, 
        { headers: { Authorization: `Bearer ${token1}` }}
      );
      console.log('✅ Block successful');
    } catch (error) {
      console.log('Block error:', error.response?.status, error.response?.data);
    }
    
    // 5. Get blocked users list
    console.log('\n5️⃣  Getting blocked users list...');
    try {
      const blockedList = await axios.get('http://localhost:3002/api/v1/social/blocked', {
        headers: { Authorization: `Bearer ${token1}` }
      });
      console.log('Blocked users:', JSON.stringify(blockedList.data, null, 2));
    } catch (error) {
      console.log('Blocked list error:', error.response?.status, error.response?.data);
    }
    
    // 6. Unblock user
    console.log('\n6️⃣  Unblocking User 2...');
    try {
      await axios.delete(`http://localhost:3002/api/v1/social/unblock/${profile2.id}`, {
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