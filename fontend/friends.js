
// API基础URL
const BASE_URL = 'http://localhost:3000';

// 获取当前登录用户信息
const user = JSON.parse(localStorage.getItem('user') || 'null');

// 合并并简化用户登录检查逻辑
if (!user || !user.id || !user.username) {
    console.warn('用户未登录或用户信息不完整，重定向到登录页面。');
    window.location.href = '/sign page/index.html';
    throw new Error('未登录，脚本执行已停止');
}

// 连接到Socket.IO服务器
const socket = io({
    auth: {
        token: user.id // 使用用户ID作为简单的身份验证token
    }
});

// 加入自己的房间（用于接收私聊消息）
socket.emit('join', user.id);

// DOM元素
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const friendsList = document.getElementById('friends-list');
const requestsList = document.getElementById('requests-list');
const tabs = document.querySelectorAll('.tab');
const chatHeader = document.getElementById('chat-header');
const chatMessages = document.getElementById('chat-messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const imageInput = document.getElementById('imageInput');
const imageButton = document.getElementById('imageButton');

// 当前选中的好友
let selectedFriend = null;

// 加载好友列表
async function loadFriends() {
    try {
        const response = await fetch(`${BASE_URL}/api/friends/${user.id}`);
        const data = await response.json();
        
        friendsList.innerHTML = '';
        
        if (data.friends.length === 0) {
            friendsList.innerHTML = '<div class="no-friends">暂无好友</div>';
            return;
        }
        
        data.friends.forEach(friend => {
            const friendItem = document.createElement('div');
            friendItem.className = 'friend-item';
            friendItem.textContent = friend.username;
            friendItem.dataset.id = friend.id;
            friendItem.dataset.username = friend.username;
            
            friendItem.addEventListener('click', () => selectFriend(friend));
            
            friendsList.appendChild(friendItem);
        });
    } catch (error) {
        console.error('加载好友列表失败:', error);
    }
}

// 加载好友请求列表
async function loadFriendRequests() {
    try {
        const response = await fetch(`${BASE_URL}/api/friends/requests/${user.id}`);
        const data = await response.json();
        
        requestsList.innerHTML = '';
        
        if (data.requests.length === 0) {
            requestsList.innerHTML = '<div class="no-requests">暂无好友请求</div>';
            return;
        }
        
        data.requests.forEach(request => {
            const requestItem = document.createElement('div');
            requestItem.className = 'request-item';
            requestItem.innerHTML = `
                <div>${request.username} 请求添加您为好友</div>
                <div class="request-buttons">
                    <button class="accept-btn" data-id="${request.id}">接受</button>
                    <button class="reject-btn" data-id="${request.id}">拒绝</button>
                </div>
            `;
            
            requestsList.appendChild(requestItem);
        });
        
        // 使用事件委托处理按钮点击
        requestsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('accept-btn')) {
                handleFriendRequest(e.target.dataset.id, 'accepted');
            } else if (e.target.classList.contains('reject-btn')) {
                handleFriendRequest(e.target.dataset.id, 'rejected');
            }
        });
    } catch (error) {
        console.error('加载好友请求失败:', error);
    }
}

// 处理好友请求（接受或拒绝）
async function handleFriendRequest(requestId, status) {
    console.log('处理好友请求:', requestId, status); // 添加调试日志
    try {
        const response = await fetch(`${BASE_URL}/api/friends/requests/${requestId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            alert(status === 'accepted' ? '已接受好友请求' : '已拒绝好友请求'); // 添加用户反馈
            // 重新加载好友请求列表和好友列表
            loadFriendRequests();
            if (status === 'accepted') {
                loadFriends();
            }
        }
    } catch (error) {
        console.error('处理好友请求失败:', error);
        alert('处理好友请求失败，请稍后重试'); // 添加错误提示
    }
}

// 搜索用户
// 搜索用户
searchInput.addEventListener('input', async () => {
    const query = searchInput.value.trim();
    
    if (query.length < 2) {
        searchResults.style.display = 'none';
        return;
    }
    
    // 显示加载状态
    searchResults.innerHTML = '<div class="search-result-item">搜索中...</div>';
    searchResults.style.display = 'block';
    
    try {
        const response = await fetch(`${BASE_URL}/api/users/search?query=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            throw new Error(`服务器响应错误: ${response.status}`);
        }
        
        const data = await response.json();
        
        searchResults.innerHTML = '';
        
        if (data.users.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item">没有找到用户</div>';
        } else {
            data.users.forEach(foundUser => {
                if (foundUser.id !== user.id) {
                    const resultItem = document.createElement('div');
                    resultItem.className = 'search-result-item';
                    resultItem.textContent = foundUser.username;
                    resultItem.dataset.id = foundUser.id;
                    
                    resultItem.addEventListener('click', () => sendFriendRequest(foundUser.id));
                    
                    searchResults.appendChild(resultItem);
                }
            });
        }
    } catch (error) {
        console.error('搜索用户失败:', error);
        searchResults.innerHTML = `<div class="search-result-item">搜索失败: ${error.message}</div>`;
    }
});

// 点击页面其他地方隐藏搜索结果
document.addEventListener('click', (e) => {
    if (e.target !== searchInput && e.target !== searchResults) {
        searchResults.style.display = 'none';
    }
});

// 发送好友请求
async function sendFriendRequest(friendId) {
    try {
        const response = await fetch(`${BASE_URL}/api/friends/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: user.id, friendId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('好友请求已发送');
            searchResults.style.display = 'none';
            searchInput.value = '';
        } else {
            alert(data.error || '发送好友请求失败');
        }
    } catch (error) {
        console.error('发送好友请求失败:', error);
        alert('发送好友请求失败，请稍后重试');
    }
}

// 选择好友进行聊天
function selectFriend(friend) {
    selectedFriend = friend;
    chatHeader.textContent = `与 ${friend.username} 聊天中`;
    messageInput.disabled = false;
    sendButton.disabled = false;
    
    // 加载与该好友的聊天记录
    loadChatHistory(friend.id);
    
    // 标记选中的好友
    document.querySelectorAll('.friend-item').forEach(item => {
        item.classList.remove('active');
        if (parseInt(item.dataset.id) === friend.id) {
            item.classList.add('active');
        }
    });
}

// 加载与特定好友的聊天记录
async function loadChatHistory(friendId) {
    chatMessages.innerHTML = '';
    
    try {
        const response = await fetch(`${BASE_URL}/api/messages/${user.id}/${friendId}`);
        const data = await response.json();
        
        data.messages.forEach(msg => {
            // 确保从数据库加载的消息包含 message_type 字段
            // 如果数据库中没有 message_type 字段，可以根据 message 内容进行推断
            // 例如：如果 message 是图片路径，则设置为 'image'，否则为 'text'
            if (!msg.message_type) {
                msg.message_type = msg.message && (msg.message.startsWith('uploads/images/') || msg.message.startsWith('/uploads/images/')) ? 'image' : 'text';
            }
            appendMessage(msg); 
        });
        
        // 滚动到最新消息
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        console.error('加载聊天记录失败:', error);
    }
}

// 移除 DOMContentLoaded 中原有的消息发送逻辑
// document.addEventListener('DOMContentLoaded', () => {
//     const message = messageInput.value.trim();
//     if (!message || !selectedFriend) return;
    
//     socket.emit('private message', {
//         senderId: user.id,
//         receiver_id: selectedFriend.id,
//         message
//     });
    
//     displayMessage(message, true);
    
//     messageInput.value = '';
// });



// 接收私聊消息
socket.on('private message', (data) => {
    // 如果当前正在与发送者聊天，则显示消息
    if (selectedFriend && data.senderId === selectedFriend.id) {
        appendMessage(data.message, false, 'text'); // 确保这里调用 appendMessage
    } else {
        // 否则可以显示通知
        // 这里可以添加通知逻辑
    }
});

// 接收图片消息
socket.on('receive_image', (data) => {
     // 确保消息是当前选定好友的
    if (selectedFriend && data.sender_id === selectedFriend.id) {
        // 构造一个符合 appendMessage 期望的消息对象
        const msg = {
            message: data.file_path || data.message, // 优先使用 file_path，如果不存在则使用 message
            sender_id: data.sender_id,
            message_type: 'image', // Ensure message_type is 'image'
            created_at: new Date().toISOString() // 使用当前时间作为消息时间
        };
        appendMessage(msg);
    } else {
        // 可以添加通知逻辑
    }
});

// 新增或修改的 appendMessage 函数，用于处理不同类型的消息
function appendMessage(message, isSent) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.sender_id === user.id ? 'sent' : 'received'}`;

    if (message.message_type === 'image') {
        const img = document.createElement('img');
        // 确保图片路径是完整的URL，并且处理反斜杠
        img.src = `${BASE_URL}${message.message.replace(/\\/g, '/')}`;
        img.alt = 'Image message';
        img.style.maxWidth = '200px'; // 设置图片最大宽度，防止过大
        messageElement.appendChild(img);
    } else if (message.message_type === 'text') {
        messageElement.textContent = message.message; // 假设文本消息内容在 message 字段
    } else {
        // 处理未知消息类型
        messageElement.textContent = 'Unsupported message type';
    }
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 切换标签页
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const tabName = tab.dataset.tab;
        if (tabName === 'friends') {
            friendsList.style.display = 'block';
            requestsList.style.display = 'none';
        } else {
            friendsList.style.display = 'none';
            requestsList.style.display = 'block';
        }
    });
});

// 初始化加载
loadFriends();
loadFriendRequests();

// 获取当前登录用户信息并显示
document.addEventListener('DOMContentLoaded', () => {
    const currentUser = JSON.parse(localStorage.getItem('user')); // 将 'currentUser' 改为 'user'
    if (currentUser && currentUser.id && currentUser.username) { // 保持与文件开头一致的判断条件
        document.getElementById('username-display').textContent = currentUser.username;
        // 假设用户头像URL存储在currentUser.avatarUrl中，如果没有则使用默认头像
        // 使用相对路径，确保路径分隔符使用正斜杠
        document.getElementById('user-avatar').src = currentUser.avatarUrl || '生成像素风篮球头像 (2).png';
    } else {
        // 如果没有登录信息，重定向到登录页面
        console.warn('DOMContentLoaded: 用户未登录或用户信息不完整，重定向到登录页面。'); // 添加日志方便调试
        window.location.href = '/sign page/index.html';
    }
});

// 右键点击头像切换账号功能
document.getElementById('user-avatar').addEventListener('contextmenu', (e) => {
    e.preventDefault(); // 阻止默认右键菜单
    if (confirm('确定要切换账号吗？')) {
        localStorage.removeItem('user'); // 清除本地存储的用户信息，将 'currentUser' 改为 'user'
        window.location.href = '/sign page/index.html'; // 重定向到登录页面
    }
});


// 阻止表单默认提交行为，这对于文件输入尤其重要
messageForm.addEventListener('submit', (event) => {
    event.preventDefault(); // 阻止表单默认提交行为

    const message = messageInput.value.trim();
    if (!message || !selectedFriend) {
        console.warn('消息为空或未选择好友，无法发送。');
        return; // 如果消息为空或未选择好友，则不发送
    }

    // 发送私聊消息
    socket.emit('private message', {
        senderId: user.id,
        receiver_id: selectedFriend.id,
        message,
        message_type: 'text' // Add message_type for text messages
    });

    // 显示自己发送的消息
    const sentMsg = {
        message: message,
        sender_id: user.id,
        message_type: 'text',
        created_at: new Date().toISOString()
    };
    appendMessage(sentMsg); // 移除 true 参数

    // 清除消息输入框内容
    function clearMessageInput() {
        messageInput.value = '';
    }

    // 清除表情选择器中的表情
    function clearEmojiInput() {
        $('.emoji-picker-container').find('.emoji-button').html('&#x1F60A;'); // 重置表情按钮图标
        $('.emoji-picker-container').find('.emoji-wysiwyg-editor').html(''); // 清空表情输入框内容
    }

    // 在发送消息后调用这两个函数
    clearMessageInput();
    clearEmojiInput();
});

// 添加拖拽事件监听器
messageForm.addEventListener('dragover', (event) => {
    event.preventDefault(); // 阻止默认行为，允许放置
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy'; // 显示为复制操作
});

messageForm.addEventListener('drop', (event) => {
    event.preventDefault(); // 阻止默认行为
    event.stopPropagation();

    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        // 检查文件类型是否为图片
        if (file.type.startsWith('image/')) {
            // 在这里添加对 selectedFriend 和 user 的检查
            if (!selectedFriend || !user) {
                console.error('发送图片失败：未选择好友或用户未登录。');
                alert('发送图片失败：请先选择一个好友进行聊天，并确保您已登录。');
                return; // 提前退出函数
            }

            const formData = new FormData();
            formData.append('image', file);
            formData.append('sender_id', user.id);
            formData.append('receiver_id', selectedFriend.id);

            try {
                // 显示上传进度提示
                const uploadingMessage = document.createElement('div');
                uploadingMessage.textContent = '图片上传中...';
                uploadingMessage.className = 'message sent';
                chatMessages.appendChild(uploadingMessage);

                fetch(`${BASE_URL}/api/upload`, {
                    method: 'POST',
                    body: formData,
                })
                .then(response => {
                    // 移除上传提示
                    chatMessages.removeChild(uploadingMessage);
                    if (!response.ok) {
                        return response.json().then(errorData => Promise.reject(errorData.error || '图片上传失败'));
                    }
                    return response.json();
                })
                .then(data => {
                    const imageMsg = {
                        senderId: user.id,
                        receiver_id: selectedFriend.id,
                        message: data.filePath, // Use data.filePath for the message content
                        message_type: 'image', // Explicitly set message_type to 'image'
                        timestamp: new Date().toISOString()
                    };
                    
                    // 在本地显示图片消息
                    appendMessage(imageMsg);

                    // 通过 WebSocket 发送图片消息
                    // console.log('Client sending private message with imageMsg:', imageMsg); // Remove this line
                    socket.emit('private message', imageMsg);

                    imageInput.value = ''; // 清空文件输入框
                })
                .catch(error => {
                    console.error('图片上传失败:', error);
                    alert('图片上传失败，请稍后重试');
                });

            } catch (error) {
                console.error('图片上传失败:', error);
                alert('图片上传失败，请稍后重试');
            }
        } else {
            alert('只支持发送图片文件。');
        }
    }
});

// 发送图片
imageButton.addEventListener('click', () => {
    // 检查是否选择了好友
    if (!selectedFriend) {
        alert('请先选择一个好友再发送图片');
        return;
    }
    imageInput.click();
});

imageInput.addEventListener('change', async () => {
    const file = imageInput.files[0];
    if (!file) {
        console.warn('未选择文件');
        return;
    }

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        imageInput.value = '';
        return;
    }

    if (selectedFriend) {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('sender_id', user.id);
        formData.append('receiver_id', selectedFriend.id);

        try {
            // 显示上传进度提示
            const uploadingMessage = document.createElement('div');
            uploadingMessage.textContent = '图片上传中...';
            uploadingMessage.className = 'message sent';
            chatMessages.appendChild(uploadingMessage);

            fetch(`${BASE_URL}/api/upload`, {
                method: 'POST',
                body: formData,
            })
            .then(response => {
                // 移除上传提示
                chatMessages.removeChild(uploadingMessage);
                if (!response.ok) {
                    return response.json().then(errorData => Promise.reject(errorData.error || '图片上传失败'));
                }
                return response.json();
            })
            .then(data => {
                const imageMsg = {
                    senderId: user.id,
                    receiver_id: selectedFriend.id,
                    message: data.filePath, // Use data.filePath for the message content
                    message_type: 'image', // Explicitly set message_type to 'image'
                    timestamp: new Date().toISOString()
                };
                
                // 在本地显示图片消息
                appendMessage(imageMsg);

                // 通过 WebSocket 发送图片消息
                // console.log('Client sending private message with imageMsg:', imageMsg); // Remove this line
                socket.emit('private message', imageMsg);

                imageInput.value = ''; // 清空文件输入框
            })
            .catch(error => {
                console.error('图片上传失败:', error);
                alert('图片上传失败，请稍后重试');
            });

        } catch (error) {
            console.error('图片上传失败:', error);
            alert('图片上传失败，请稍后重试');
        }
    } else {
        alert('请选择一个好友再发送图片');
    }
});

// 消息输入框高度自适应
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
});


// 假设您有一个函数用于将消息添加到聊天界面
function appendMessage(message) {
    const messagesContainer = document.getElementById('chat-messages'); // 修正为 chat-messages
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');

    // 判断消息是发送还是接收
    if (message.sender_id === user.id) { // 将 currentUser.id 替换为 user.id
        messageElement.classList.add('sent');
    } else {
        messageElement.classList.add('received');
    }

    // 创建消息内容容器
    const messageContentElement = document.createElement('div');
    messageContentElement.classList.add('message-content');

    if (message.message_type === 'text') {
        messageContentElement.textContent = message.message; // 确保这里使用 message.message
    } else if (message.message_type === 'image') {
        const img = document.createElement('img');
        if (message.message) {
            img.src = message.message; // Use the full URL directly
            img.alt = 'Image';
        } else {
            // Handle case where message is null or undefined, e.g., set a placeholder or log an error
            img.src = ''; // Or a placeholder image
            img.alt = 'Image not available';
            console.error('Image message is null or undefined for message:', message);
        }
        img.style.maxWidth = '100%';
        img.style.maxHeight = '200px';
        messageContentElement.appendChild(img);
    }

    // 将消息内容容器添加到消息元素中
    messageElement.appendChild(messageContentElement);

    // 添加时间戳
    const timestampElement = document.createElement('div');
    timestampElement.classList.add('timestamp');
    if (message.sender_id === user.id) {
        messageElement.classList.add('sent');
        timestampElement.classList.add('sent-timestamp');
    } else {
        messageElement.classList.add('received');
        timestampElement.classList.add('received-timestamp');
    }
    timestampElement.textContent = new Date(message.created_at).toLocaleTimeString();
    messageElement.prepend(timestampElement);

    messagesContainer.appendChild(messageElement);
    // 滚动到最新消息
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

socket.on('private message', (data) => {
    // 如果当前正在与发送者聊天，则显示消息
    if (selectedFriend && data.senderId === selectedFriend.id) {
        // 构造一个符合 appendMessage 期望的消息对象
        const msg = {
            message: data.message,
            sender_id: data.senderId,
            message_type: data.message_type, // Use message_type from data
            created_at: new Date().toISOString() // 使用当前时间作为消息时间
        };
        appendMessage(msg); // 移除 isSent 参数
    } else {
        // 否则可以显示通知
        // 这里可以添加通知逻辑
    }
});

// 添加新的事件监听器来处理接收到的图片消息
socket.on('receive_image', (data) => {
     // 确保消息是当前选定好友的
    if (selectedFriend && (data.sender_id === selectedFriend.id || data.receiver_id === selectedFriend.id)) {
        // 构造一个符合 appendMessage 期望的消息对象
        const msg = {
            file_path: data.file_path || data.message,
            sender_id: data.sender_id,
            message_type: 'image',
            created_at: new Date().toISOString() // 使用当前时间作为消息时间
        };
        appendMessage(msg); // 移除 isSent 参数
    }
});







    

// 图片压缩函数
function compressImage(file, quality = 0.8, maxWidth = 800) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // 尝试使用 image/webp 格式，如果不支持则回退到 image/jpeg
                let compressedDataUrl;
                try {
                    compressedDataUrl = canvas.toDataURL('image/webp', quality);
                } catch (e) {
                    console.warn('WebP not supported, falling back to JPEG.', e);
                    compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                }
                resolve(compressedDataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}







    
