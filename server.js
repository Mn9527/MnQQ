// server.js
const path = require('path');
const express = require('express');
const mysql = require('mysql2/promise');
const app = express();
const port = 3000; // 你可以选择其他端口
const bcrypt = require('bcrypt'); // 用于密码加密
const cors = require('cors'); // 用于处理跨域请求


// 引入 http 模块和 socket.io
const http = require('http');
const { Server } = require('socket.io');

// --- MySQL数据库连接配置 ---
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'MnQQ',
  port: 3306
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 初始化数据库表
async function initDatabase() {
  try {
    const connection = await pool.getConnection();
    console.log('成功连接到MySQL数据库');
    
    // 创建users表（如果不存在）
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 创建好友关系表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS friendships (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        friend_id INT NOT NULL,
        status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (friend_id) REFERENCES users(id),
        UNIQUE KEY unique_friendship (user_id, friend_id)
      )
    `);
    
    // 创建私聊消息表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS private_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id)
      )
    `);
    
    console.log('数据库表初始化成功');
    connection.release();
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1); // 如果数据库连接失败，退出应用
  }
}

// 在启动服务器前初始化数据库
initDatabase();

// --- 中间件 ---
// 解析 JSON 格式的请求体
app.use(express.json());
// 启用CORS
app.use(cors());
// 静态文件服务
app.use(express.static('fontend'));
app.use('/lib', express.static(path.join(__dirname, 'lib'))); // 新增的配置
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// ----------------

// --- 用户认证API ---

// 注册新用户
app.post('/api/register', async (req, res) => {
  console.log('POST /api/register - 注册新用户', req.body);

  // 验证请求体
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ error: '用户名和密码是必填项' });
  }

  try {
    // 检查用户名是否已存在
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [req.body.username]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    // 加密密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

    // 插入新用户
    const [result] = await pool.query(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [req.body.username, hashedPassword]
    );

    console.log('用户注册成功:', result.insertId);
    res.status(201).json({ message: '注册成功', userId: result.insertId });
  } catch (error) {
    console.error('用户注册失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 用户登录
app.post('/api/login', async (req, res) => {
  console.log('POST /api/login - 用户登录', req.body);

  // 验证请求体
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ error: '用户名和密码是必填项' });
  }

  try {
    // 查找用户
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [req.body.username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: '用户名或密码不正确' });
    }

    const user = users[0];

    // 验证密码
    const passwordMatch = await bcrypt.compare(req.body.password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: '用户名或密码不正确' });
    }

    // 登录成功，返回用户信息（不包含密码）
    const userInfo = {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt
    };

    console.log('用户登录成功:', userInfo.username);
    res.json({ message: '登录成功', user: userInfo });
  } catch (error) {
    console.error('用户登录失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// --- Socket.IO 集成 ---
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // 允许所有来源，实际项目中应限制为您的前端域名
    methods: ["GET", "POST"]
  }
});

// 在 Socket.IO 连接处理中添加身份验证
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // 简化身份验证，只要有token就通过
  if (!token) {
    return next(new Error('未授权'));
  }
  // 验证通过
  next();
});

const fs = require('fs').promises; // 使用 promises 版本方便异步操作
 // 将这行代码移动到文件顶部
const multer = require('multer'); // 引入 multer

// 确保图片上传目录存在
const uploadDir = path.join(__dirname, 'uploads', 'images');
fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

// 配置 multer 用于文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// 图片上传API
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '没有上传文件' });
  }
  // 返回图片的完整URL路径，前端可以直接使用
  const filePath = `${req.protocol}://${req.get('host')}/uploads/images/${req.file.filename}`;
  res.json({ filePath: filePath });
});

io.on('connection', (socket) => {
  console.log('一个新的客户端连接了:', socket.id);
  
  // 用户加入自己的房间（用于私聊）
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`用户 ${userId} 加入了自己的房间`);
  });
  
  // 监听客户端发送的聊天消息
  socket.on('chat message', (msg) => {
    console.log('收到消息:', msg);
    // 将消息广播给所有连接的客户端
    io.emit('chat message', msg); // 广播消息
  });
  
  // 监听私聊消息
  socket.on('private message', async (data) => {
    const { senderId, receiver_id, message, message_type } = data; // 将 receiverId 改为 receiver_id
    console.log('Server received private message data:', data);
    console.log('Message content before saving:', message);
    
    try {
      // 保存消息到数据库
      await pool.query(
        'INSERT INTO private_messages (sender_id, receiver_id, message, message_type) VALUES (?, ?, ?, ?)',
        [senderId, receiver_id, message, message_type] // 使用 receiver_id
      );
      
      // 发送消息给接收者
      io.to(`user_${receiver_id}`).emit('private message', {
        senderId,
        message,
        message_type,
        timestamp: new Date()
      });
      
      // 确认消息已发送
      socket.emit('message sent', { success: true, receiver_id });
    } catch (error) {
      console.error('发送私聊消息失败:', error);
      socket.emit('message sent', { success: false, error: '发送消息失败' });
    }
  });

  // 监听客户端发送的图片数据
  // ...

  // 监听客户端断开连接
  socket.on('disconnect', () => {
    console.log('客户端断开连接:', socket.id);
  });
});

// --- 启动服务器 ---
httpServer.listen(port, () => {
  console.log(`服务器已启动，监听端口 ${port}`);
  console.log(`HTTP 服务器地址: http://localhost:${port}`);
  console.log(`WebSocket 服务器地址: ws://localhost:${port}`);
});

// 添加好友相关API

// 搜索用户
app.get('/api/users/search', async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: '搜索关键词不能为空' });
  }
  
  try {
    const [users] = await pool.query(
      'SELECT id, username, createdAt FROM users WHERE username LIKE ?',
      [`%${query}%`]
    );
    
    res.json({ users });
  } catch (error) {
    console.error('搜索用户失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 发送好友请求
app.post('/api/friends/request', async (req, res) => {
  const { userId, friendId } = req.body;
  
  if (!userId || !friendId) {
    return res.status(400).json({ error: '用户ID和好友ID不能为空' });
  }
  
  if (userId === friendId) {
    return res.status(400).json({ error: '不能添加自己为好友' });
  }
  
  try {
    // 检查是否已经是好友或有待处理的请求
    const [existingFriendships] = await pool.query(
      'SELECT * FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [userId, friendId, friendId, userId]
    );
    
    if (existingFriendships.length > 0) {
      return res.status(409).json({ error: '已经是好友或有待处理的请求' });
    }
    
    // 创建好友请求
    await pool.query(
      'INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)',
      [userId, friendId]
    );
    
    res.status(201).json({ message: '好友请求已发送' });
  } catch (error) {
    console.error('发送好友请求失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取好友请求列表
app.get('/api/friends/requests/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const [requests] = await pool.query(
      `SELECT f.id, f.user_id, f.status, f.created_at, u.username 
       FROM friendships f 
       JOIN users u ON f.user_id = u.id 
       WHERE f.friend_id = ? AND f.status = 'pending'`,
      [userId]
    );
    
    res.json({ requests });
  } catch (error) {
    console.error('获取好友请求失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 接受或拒绝好友请求
app.put('/api/friends/requests/:requestId', async (req, res) => {
  const { requestId } = req.params;
  const { status } = req.body;
  
  if (status !== 'accepted' && status !== 'rejected') {
    return res.status(400).json({ error: '状态值无效' });
  }
  
  try {
    await pool.query(
      'UPDATE friendships SET status = ? WHERE id = ?',
      [status, requestId]
    );
    
    res.json({ message: `好友请求已${status === 'accepted' ? '接受' : '拒绝'}` });
  } catch (error) {
    console.error('处理好友请求失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取好友列表
app.get('/api/friends/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const [friends] = await pool.query(
      `SELECT u.id, u.username, u.createdAt 
       FROM users u 
       JOIN friendships f ON (u.id = f.friend_id OR u.id = f.user_id) 
       WHERE (f.user_id = ? OR f.friend_id = ?) 
       AND f.status = 'accepted' 
       AND u.id != ?`,
      [userId, userId, userId]
    );
    
    res.json({ friends });
  } catch (error) {
    console.error('获取好友列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取与特定好友的聊天记录
app.get('/api/messages/:userId/:friendId', async (req, res) => {
  const { userId, friendId } = req.params;
  
  try {
    const [messages] = await pool.query(
      `SELECT * FROM private_messages 
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) 
       ORDER BY created_at ASC`,
      [userId, friendId, friendId, userId]
    );
    
    res.json({ messages });
  } catch (error) {
    console.error('获取聊天记录失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

