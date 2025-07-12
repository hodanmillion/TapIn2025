const axios = require('axios');

async function testBlockFunctionality() {
  console.log('🧪 Testing Block Functionality\n');
  
  try {
    // 1. Login as existing users
    console.log('1️⃣  Logging in as test users...');
    
    const login1 = await axios.post('http://localhost:8080/api/v1/auth/login', {
      email: 'alice@example.com',
      password: 'password123'
    });
    const token1 = login1.data.access_token;
    
    const login2 = await axios.post('http://localhost:8080/api/v1/auth/login', {
      email: 'bob@example.com',
      password: 'password123'
    });
    const token2 = login2.data.access_token;
    
    // Get user info
    const user1 = await axios.get('http://localhost:8080/api/v1/users/me', {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const user2 = await axios.get('http://localhost:8080/api/v1/users/me', {
      headers: { Authorization: `Bearer ${token2}` }
    });
    
    console.log(`✅ User 1: ${user1.data.username} (${user1.data.id})`);
    console.log(`✅ User 2: ${user2.data.username} (${user2.data.id})\n`);
    
    // Get user service profiles by auth ID
    const authId1 = user1.data.id;
    const authId2 = user2.data.id;
    
    // For now, let's test with auth IDs directly as the user service might use auth IDs
    
    // 2. Check block relationship (should be none)
    console.log('2️⃣  Checking initial block relationship...');
    try {
      const blockCheck1 = await axios.get(`http://localhost:3002/api/v1/social/blocked/${authId2}`, {
        headers: { Authorization: `Bearer ${token1}` }
      });
      console.log('Block status:', blockCheck1.data);
    } catch (error) {
      console.log('Block check response:', error.response?.status, error.response?.data);
    }
    
    // 3. User 1 blocks User 2
    console.log('\n3️⃣  User 1 blocks User 2...');
    try {
      await axios.post(`http://localhost:3002/api/v1/social/block/${authId2}`, 
        { reason: 'Testing block functionality' }, 
        { headers: { Authorization: `Bearer ${token1}` }
      });
      console.log('✅ Block successful');
    } catch (error) {
      console.log('Block error:', error.response?.status, error.response?.data);
    }
    
    // 4. Get list of blocked users
    console.log('\n4️⃣  Getting list of blocked users...');
    try {
      const blockedList = await axios.get('http://localhost:3002/api/v1/social/blocked', {
        headers: { Authorization: `Bearer ${token1}` }
      });
      console.log('Blocked users:', JSON.stringify(blockedList.data, null, 2));
    } catch (error) {
      console.log('Blocked list error:', error.response?.status, error.response?.data);
    }
    
    // 5. Unblock user
    console.log('\n5️⃣  Unblocking User 2...');
    try {
      await axios.delete(`http://localhost:3002/api/v1/social/unblock/${authId2}`, {
        headers: { Authorization: `Bearer ${token1}` }
      });
      console.log('✅ Unblock successful');
    } catch (error) {
      console.log('Unblock error:', error.response?.status, error.response?.data);
    }
    
    console.log('\n✅ Block functionality test completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the tests
testBlockFunctionality();