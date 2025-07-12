const axios = require('axios');
const WebSocket = require('ws');

function parseJWT(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(Buffer.from(base64, 'base64').toString().split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
}

async function testDMChat() {
  console.log('🧪 Testing Direct Message Chat Functionality\n');
  
  // Generate unique test users
  const timestamp = Date.now();
  const user1 = {
    email: `dmtest1_${timestamp}@example.com`,
    username: `dmtest1${timestamp}`,
    password: 'testpass123'
  };
  
  const user2 = {
    email: `dmtest2_${timestamp}@example.com`,
    username: `dmtest2${timestamp}`,
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
    
    // Extract user IDs from JWT tokens
    const jwt1 = parseJWT(token1);
    const jwt2 = parseJWT(token2);
    const authUserId1 = jwt1.user_id;
    const authUserId2 = jwt2.user_id;
    
    // Wait for profiles to be created
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get user profiles
    const profile1 = await axios.get('http://localhost:3002/api/v1/profile/me', {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const profile2 = await axios.get('http://localhost:3002/api/v1/profile/me', {
      headers: { Authorization: `Bearer ${token2}` }
    });
    
    const profileUserId1 = profile1.data.id;
    const profileUserId2 = profile2.data.id;
    
    console.log(`✅ User 1: ${user1.username} (auth: ${authUserId1}, profile: ${profileUserId1})`);
    console.log(`✅ User 2: ${user2.username} (auth: ${authUserId2}, profile: ${profileUserId2})\n`);
    
    // 2. Create conversation using profile user IDs
    console.log('2️⃣  Creating conversation...');
    
    const createConvRes = await axios.post('http://localhost:3002/api/v1/conversations', 
      { userId: profileUserId2 }, 
      { headers: { Authorization: `Bearer ${token1}` }}
    );
    
    const conversation = createConvRes.data;
    console.log(`✅ Conversation created: ${conversation.id}\n`);
    
    // 3. Connect both users to WebSocket
    console.log('3️⃣  Connecting to DM WebSocket...');
    
    const ws1 = new WebSocket(`ws://localhost:3001/ws/dm/${conversation.id}`);
    const ws2 = new WebSocket(`ws://localhost:3001/ws/dm/${conversation.id}`);
    
    const messages1 = [];
    const messages2 = [];
    
    // Set up WebSocket handlers
    ws1.on('message', (data) => {
      const msg = JSON.parse(data);
      messages1.push(msg);
      console.log('User 1 received:', JSON.stringify(msg));
    });
    
    ws2.on('message', (data) => {
      const msg = JSON.parse(data);
      messages2.push(msg);
      console.log('User 2 received:', JSON.stringify(msg));
    });
    
    ws1.on('error', (err) => {
      console.error('User 1 WebSocket error:', err);
    });
    
    ws2.on('error', (err) => {
      console.error('User 2 WebSocket error:', err);
    });
    
    // Wait for connections
    await new Promise((resolve) => {
      let connected = 0;
      ws1.on('open', () => {
        console.log('✅ User 1 WebSocket connected');
        if (++connected === 2) resolve();
      });
      ws2.on('open', () => {
        console.log('✅ User 2 WebSocket connected');
        if (++connected === 2) resolve();
      });
    });
    
    // 4. Join DM conversation - use auth user IDs from JWT
    console.log('\n4️⃣  Joining DM conversation...');
    
    const joinMsg1 = {
      type: 'JoinDM',
      data: {
        conversation_id: conversation.id,
        user_id: authUserId1, // Use auth user ID from JWT
        username: user1.username,
        token: token1
      }
    };
    
    const joinMsg2 = {
      type: 'JoinDM',
      data: {
        conversation_id: conversation.id,
        user_id: authUserId2, // Use auth user ID from JWT
        username: user2.username,
        token: token2
      }
    };
    
    console.log('Sending User 1 join:', JSON.stringify(joinMsg1));
    ws1.send(JSON.stringify(joinMsg1));
    
    console.log('Sending User 2 join:', JSON.stringify(joinMsg2));
    ws2.send(JSON.stringify(joinMsg2));
    
    // Wait for join confirmation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 5. Send messages
    console.log('\n5️⃣  Sending messages...');
    
    ws1.send(JSON.stringify({
      type: 'DMMessage',
      data: {
        conversation_id: conversation.id,
        content: 'Hello from User 1!'
      }
    }));
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    ws2.send(JSON.stringify({
      type: 'DMMessage',
      data: {
        conversation_id: conversation.id,
        content: 'Hi User 1, this is User 2!'
      }
    }));
    
    // Wait for messages to be delivered
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 6. Test typing indicator
    console.log('\n6️⃣  Testing typing indicators...');
    
    ws1.send(JSON.stringify({
      type: 'DMTyping',
      data: {
        conversation_id: conversation.id,
        is_typing: true
      }
    }));
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    ws1.send(JSON.stringify({
      type: 'DMTyping',
      data: {
        conversation_id: conversation.id,
        is_typing: false
      }
    }));
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 7. Get message history
    console.log('\n7️⃣  Getting message history...');
    
    const historyRes = await axios.get(`http://localhost:3001/api/dm/${conversation.id}/messages`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    
    console.log(`✅ Retrieved ${historyRes.data.messages.length} messages`);
    historyRes.data.messages.forEach(msg => {
      console.log(`   - ${msg.sender_username}: ${msg.content}`);
    });
    
    // 8. Test read receipts
    console.log('\n8️⃣  Testing read receipts...');
    
    ws2.send(JSON.stringify({
      type: 'DMRead',
      data: {
        conversation_id: conversation.id,
        user_id: authUserId2 // Use auth user ID
      }
    }));
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`   - Messages sent: 2`);
    console.log(`   - Messages received by User 1: ${messages1.length}`);
    console.log(`   - Messages received by User 2: ${messages2.length}`);
    console.log(`   - Message history count: ${historyRes.data.messages.length}`);
    
    // Clean up
    ws1.close();
    ws2.close();
    
    console.log('\n🎉 All DM chat tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('URL:', error.config?.url);
    }
  }
}

// Run the tests
testDMChat();