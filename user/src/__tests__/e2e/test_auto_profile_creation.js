const axios = require('axios');

async function testAutoProfileCreation() {
  console.log('🧪 Testing Automatic User Profile Creation\n');
  
  // Generate unique test user
  const timestamp = Date.now();
  const testUser = {
    email: `autotest${timestamp}@example.com`,
    username: `autotest${timestamp}`,
    password: 'testpass123'
  };
  
  try {
    // 1. Register user through auth service
    console.log('1️⃣  Registering new user through auth service...');
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Username: ${testUser.username}`);
    
    const registerRes = await axios.post('http://localhost:8080/api/v1/auth/register', testUser);
    console.log('✅ User registered successfully\n');
    
    // 2. Wait a moment for event processing
    console.log('2️⃣  Waiting for event processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Event processing time elapsed\n');
    
    // 3. Login to get token
    console.log('3️⃣  Logging in to get access token...');
    const loginRes = await axios.post('http://localhost:8080/api/v1/auth/login', {
      email: testUser.email,
      password: testUser.password
    });
    const token = loginRes.data.access_token;
    console.log('✅ Login successful\n');
    
    // 4. Check if user profile was created automatically
    console.log('4️⃣  Checking if user profile was created automatically...');
    
    try {
      // Try to get the user's profile
      const profileRes = await axios.get('http://localhost:3002/api/v1/profile/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ User profile found!');
      console.log('   Profile details:');
      console.log(`   - ID: ${profileRes.data.id}`);
      console.log(`   - Username: ${profileRes.data.username}`);
      console.log(`   - Display Name: ${profileRes.data.displayName}`);
      console.log(`   - Auth ID: ${profileRes.data.authId}`);
      console.log(`   - Created At: ${profileRes.data.createdAt}\n`);
      
      console.log('🎉 Automatic user profile creation is working!');
      
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('❌ User profile was NOT created automatically');
        console.log('   The event-based profile creation might not be working');
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('URL:', error.config?.url);
    }
  }
}

// Run the test
testAutoProfileCreation();