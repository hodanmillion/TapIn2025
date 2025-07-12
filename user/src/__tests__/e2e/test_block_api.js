const axios = require('axios');

// Test user credentials
const testUser1 = {
  email: 'blocktest1@example.com',
  username: 'blocktest1',
  password: 'testpass123'
};

const testUser2 = {
  email: 'blocktest2@example.com',
  username: 'blocktest2',
  password: 'testpass123'
};

let token1, token2, userId1, userId2;

async function registerAndLogin(user) {
  try {
    // Try to register
    await axios.post('http://localhost:8080/api/v1/auth/register', user);
  } catch (error) {
    if (error.response?.status !== 400) {
      console.error('Registration error:', error.response?.data);
    }
  }
  
  // Login
  const loginRes = await axios.post('http://localhost:8080/api/v1/auth/login', {
    email: user.email,
    password: user.password
  });
  
  return loginRes.data.access_token;
}

async function getUserProfile(token) {
  // First get current user info from auth service
  const authRes = await axios.get('http://localhost:8080/api/v1/users/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  // Then get profile from user service
  const profileRes = await axios.get(`http://localhost:3002/api/v1/profile/${authRes.data.username}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  return profileRes.data;
}

async function testBlockFunctionality() {
  console.log('🧪 Testing Block Functionality\n');
  
  try {
    // 1. Setup - Register and login both users
    console.log('1️⃣  Setting up test users...');
    token1 = await registerAndLogin(testUser1);
    token2 = await registerAndLogin(testUser2);
    
    const profile1 = await getUserProfile(token1);
    const profile2 = await getUserProfile(token2);
    userId1 = profile1.id;
    userId2 = profile2.id;
    
    console.log(`✅ User 1: ${profile1.username} (${userId1})`);
    console.log(`✅ User 2: ${profile2.username} (${userId2})\n`);
    
    // 2. User 1 follows User 2
    console.log('2️⃣  User 1 follows User 2...');
    await axios.post(`http://localhost:3002/api/v1/social/follow/${userId2}`, {}, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('✅ Follow successful\n');
    
    // 3. Check block relationship (should be none)
    console.log('3️⃣  Checking initial block relationship...');
    const blockCheck1 = await axios.get(`http://localhost:3002/api/v1/social/blocked/${userId2}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('Block status:', blockCheck1.data);
    console.log('✅ No blocks exist\n');
    
    // 4. User 1 blocks User 2
    console.log('4️⃣  User 1 blocks User 2...');
    await axios.post(`http://localhost:3002/api/v1/social/block/${userId2}`, 
      { reason: 'Testing block functionality' }, 
      { headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('✅ Block successful\n');
    
    // 5. Check block relationship again
    console.log('5️⃣  Checking block relationship after blocking...');
    const blockCheck2 = await axios.get(`http://localhost:3002/api/v1/social/blocked/${userId2}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('Block status:', blockCheck2.data);
    console.log('✅ Block confirmed\n');
    
    // 6. Try to follow again (should fail)
    console.log('6️⃣  Trying to follow blocked user (should fail)...');
    try {
      await axios.post(`http://localhost:3002/api/v1/social/follow/${userId2}`, {}, {
        headers: { Authorization: `Bearer ${token1}` }
      });
      console.log('❌ ERROR: Follow should have failed!');
    } catch (error) {
      console.log('✅ Follow correctly rejected:', error.response?.data);
    }
    console.log();
    
    // 7. Get list of blocked users
    console.log('7️⃣  Getting list of blocked users...');
    const blockedList = await axios.get('http://localhost:3002/api/v1/social/blocked', {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('Blocked users:', JSON.stringify(blockedList.data, null, 2));
    console.log('✅ Blocked list retrieved\n');
    
    // 8. Unblock user
    console.log('8️⃣  Unblocking User 2...');
    await axios.delete(`http://localhost:3002/api/v1/social/unblock/${userId2}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('✅ Unblock successful\n');
    
    // 9. Check block relationship final
    console.log('9️⃣  Final block relationship check...');
    const blockCheck3 = await axios.get(`http://localhost:3002/api/v1/social/blocked/${userId2}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('Block status:', blockCheck3.data);
    console.log('✅ No blocks exist\n');
    
    console.log('🎉 All block functionality tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('URL:', error.config?.url);
    }
  }
}

// Run the tests
testBlockFunctionality();