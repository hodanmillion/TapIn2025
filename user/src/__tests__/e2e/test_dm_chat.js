const axios = require('axios');
const WebSocket = require('ws');

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
    console.log('2️⃣  Creating conversation...');
    
    const createConvRes = await axios.post('http://localhost:3002/api/v1/conversations', 
      { userId: userId2 }, 
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
      console.log('User 1 received:', msg.type);
    });
    
    ws2.on('message', (data) => {
      const msg = JSON.parse(data);
      messages2.push(msg);
      console.log('User 2 received:', msg.type);
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
    
    // 4. Join DM conversation
    console.log('\n4️⃣  Joining DM conversation...');
    
    ws1.send(JSON.stringify({
      type: 'JoinDM',
      data: {
        conversation_id: conversation.id,
        user_id: userId1,
        username: user1.username,
        token: token1
      }
    }));
    
    ws2.send(JSON.stringify({
      type: 'JoinDM',
      data: {
        conversation_id: conversation.id,
        user_id: userId2,
        username: user2.username,
        token: token2
      }
    }));
    
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
        user_id: userId2
      }
    }));
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
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