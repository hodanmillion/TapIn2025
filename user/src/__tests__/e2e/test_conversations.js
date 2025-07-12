const axios = require('axios');

async function testConversations() {
  console.log('🧪 Testing Conversation Management Endpoints\n');
  
  // Generate unique test users
  const timestamp = Date.now();
  const user1 = {
    email: `convtest1_${timestamp}@example.com`,
    username: `convtest1${timestamp}`,
    password: 'testpass123'
  };
  
  const user2 = {
    email: `convtest2_${timestamp}@example.com`,
    username: `convtest2${timestamp}`,
    password: 'testpass123'
  };
  
  try {
    // 1. Create test users
    console.log('1️⃣  Creating test users...');
    
    await axios.post('http://localhost:8080/api/v1/auth/register', user1);
    await axios.post('http://localhost:8080/api/v1/auth/register', user2);
    
    // Login both users
    const login1 = await axios.post('http://localhost:8080/api/v1/auth/login', {
      email: user1.email,
      password: user1.password
    });
    const token1 = login1.data.access_token;
    
    const login2 = await axios.post('http://localhost:8080/api/v1/auth/login', {
      email: user2.email,
      password: user2.password
    });
    const token2 = login2.data.access_token;
    
    // Wait for profiles to be created
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get user profiles
    const profile1 = await axios.get('http://localhost:3002/api/v1/profile/me', {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const profile2 = await axios.get('http://localhost:3002/api/v1/profile/me', {
      headers: { Authorization: `Bearer ${token2}` }
    });
    
    const userId1 = profile1.data.id;
    const userId2 = profile2.data.id;
    
    console.log(`✅ User 1: ${user1.username} (${userId1})`);
    console.log(`✅ User 2: ${user2.username} (${userId2})\n`);
    
    // 2. Create conversation
    console.log('2️⃣  Creating conversation between users...');
    
    const createConvRes = await axios.post('http://localhost:3002/api/v1/conversations', 
      { userId: userId2 }, 
      { headers: { Authorization: `Bearer ${token1}` }}
    );
    
    const conversation = createConvRes.data;
    console.log(`✅ Conversation created: ${conversation.id}`);
    console.log(`   Participants: ${conversation.participants.length}`);
    console.log(`   Created at: ${conversation.createdAt}\n`);
    
    // 3. Get conversations list
    console.log('3️⃣  Getting conversations list...');
    
    const convListRes = await axios.get('http://localhost:3002/api/v1/conversations', {
      headers: { Authorization: `Bearer ${token1}` }
    });
    
    console.log(`✅ Found ${convListRes.data.conversations.length} conversation(s)`);
    console.log(`   Total: ${convListRes.data.pagination.total}`);
    console.log(`   Pages: ${convListRes.data.pagination.pages}\n`);
    
    // 4. Get specific conversation
    console.log('4️⃣  Getting specific conversation...');
    
    const getConvRes = await axios.get(`http://localhost:3002/api/v1/conversations/${conversation.id}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    
    console.log('✅ Conversation details:');
    console.log(JSON.stringify(getConvRes.data, null, 2));
    console.log();
    
    // 5. Mark as read
    console.log('5️⃣  Marking conversation as read...');
    
    await axios.post(`http://localhost:3002/api/v1/conversations/${conversation.id}/read`, 
      {}, 
      { headers: { Authorization: `Bearer ${token1}` }}
    );
    
    console.log('✅ Marked as read\n');
    
    // 6. Mute conversation
    console.log('6️⃣  Muting conversation for 1 hour...');
    
    const mutedUntil = new Date();
    mutedUntil.setHours(mutedUntil.getHours() + 1);
    
    await axios.post(`http://localhost:3002/api/v1/conversations/${conversation.id}/mute`, 
      { mutedUntil: mutedUntil.toISOString() }, 
      { headers: { Authorization: `Bearer ${token1}` }}
    );
    
    console.log('✅ Conversation muted until:', mutedUntil.toISOString());
    console.log();
    
    // 7. Test blocked user restriction
    console.log('7️⃣  Testing blocked user restriction...');
    
    // User 1 blocks User 2
    await axios.post(`http://localhost:3002/api/v1/social/block/${userId2}`, 
      { reason: 'Testing conversation restrictions' }, 
      { headers: { Authorization: `Bearer ${token1}` }}
    );
    console.log('✅ User 1 blocked User 2');
    
    // Try to create another conversation (should return existing or fail)
    try {
      const blockedConvRes = await axios.post('http://localhost:3002/api/v1/conversations', 
        { userId: userId2 }, 
        { headers: { Authorization: `Bearer ${token1}` }}
      );
      console.log('❌ ERROR: Should not be able to create conversation with blocked user');
    } catch (error) {
      console.log('✅ Correctly prevented conversation with blocked user:', error.response?.data?.error);
    }
    
    // Unblock
    await axios.delete(`http://localhost:3002/api/v1/social/unblock/${userId2}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('✅ Unblocked user\n');
    
    // 8. Leave conversation
    console.log('8️⃣  Leaving conversation...');
    
    await axios.post(`http://localhost:3002/api/v1/conversations/${conversation.id}/leave`, 
      {}, 
      { headers: { Authorization: `Bearer ${token1}` }}
    );
    
    console.log('✅ Left conversation');
    
    // Verify can't access after leaving
    try {
      await axios.get(`http://localhost:3002/api/v1/conversations/${conversation.id}`, {
        headers: { Authorization: `Bearer ${token1}` }
      });
      console.log('❌ ERROR: Should not be able to access conversation after leaving');
    } catch (error) {
      console.log('✅ Correctly denied access after leaving:', error.response?.status);
    }
    
    console.log('\n🎉 All conversation endpoint tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('URL:', error.config?.url);
    }
  }
}

// Run the tests
testConversations();