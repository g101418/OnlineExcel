import os from 'os';

// 获取服务器的实际IP地址
function getServerIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1'; // 回退到本地地址
}

const SERVER_IP = getServerIp();
// console.log(`Server IP address: ${SERVER_IP}`);

const redirectLocalhost = (req, res, next) => {
  const host = req.headers.host;
  if (host && host.includes('localhost')) {
    const protocol = req.secure ? 'https' : 'http';
    const path = req.originalUrl;
    const redirectUrl = `${protocol}://${SERVER_IP}:${PORT}${path}`;
    return res.redirect(301, redirectUrl);
  }
  next();
}


export default redirectLocalhost;