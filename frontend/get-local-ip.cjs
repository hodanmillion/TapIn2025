const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return '127.0.0.1';
}

console.log('Your local IP address is:', getLocalIP());
console.log('\nUse this IP in your .env.mobile file:');
console.log(`VITE_API_BASE_URL=http://${getLocalIP()}:3080`);