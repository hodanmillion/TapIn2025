const axios = require('axios');

async function testAutoProfileCreation() {
  console.log('🧪 Testing Automatic User Profile Creation (Verbose)\n');
  
  // Generate unique test user
  const timestamp = Date.now();
  const testUser = {
    email: `verbose${timestamp}@example.com`,
    username: `verbose${timestamp}`,
    password: 'testpass123'
  };
  
  try {
    console.log('📝 Test user details:');
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Username: ${testUser.username}\n`);
    
    // First check if profile exists (should not)
    console.log('1️⃣  First checking if profile exists (should not)...');
    try {
      const checkRes = await axios.get(`http://localhost:3002/api/v1/profile/${testUser.username}`);
      console.log('❌ Profile already exists (unexpected):', checkRes.data);
      return;
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Profile does not exist yet (expected)\n');
      } else {
        throw error;
      }
    }
    
    // Register user
    console.log('2️⃣  Registering user through auth service...');
    const registerRes = await axios.post('http://localhost:8080/api/v1/auth/register', testUser);
    console.log('✅ Registration successful');
    console.log(`   Auth User ID: ${registerRes.data.id || 'not returned'}\n`);
    
    // Wait for event processing
    console.log('3️⃣  Waiting for event processing...');
    for (let i = 1; i <= 3; i++) {
      console.log(`   Waiting... ${i}s`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log();
    
    // Login to get token
    console.log('4️⃣  Logging in...');
    const loginRes = await axios.post('http://localhost:8080/api/v1/auth/login', {
      email: testUser.email,
      password: testUser.password
    });
    const token = loginRes.data.access_token;
    console.log('✅ Login successful\n');
    
    // Check profile via /me endpoint
    console.log('5️⃣  Checking profile via /me endpoint...');
    try {
      const meRes = await axios.get('http://localhost:3002/api/v1/profile/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Profile found via /me!');
      console.log(JSON.stringify(meRes.data, null, 2));
    } catch (error) {
      console.log('❌ Profile not found via /me:', error.response?.status);
    }
    console.log();
    
    // Check profile via username
    console.log('6️⃣  Checking profile via username...');
    try {
      const profileRes = await axios.get(`http://localhost:3002/api/v1/profile/${testUser.username}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Profile found via username!');
      console.log(JSON.stringify(profileRes.data, null, 2));
    } catch (error) {
      console.log('❌ Profile not found via username:', error.response?.status);
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