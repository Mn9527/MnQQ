// 获取DOM元素
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const btn = document.getElementById('btn');

// 默认显示登录表单
registerForm.style.opacity = '0';
registerForm.style.pointerEvents = 'none';
registerForm.style.zIndex = '1';
loginForm.style.opacity = '1';
loginForm.style.pointerEvents = 'auto';
loginForm.style.zIndex = '2';

// 切换到注册表单
function register() {
    loginForm.style.opacity = '0';
    loginForm.style.pointerEvents = 'none';
    loginForm.style.zIndex = '1';
    registerForm.style.opacity = '1';
    registerForm.style.pointerEvents = 'auto';
    registerForm.style.zIndex = '2';
    btn.style.left = '110px';
}

// 切换到登录表单
function login() {
    loginForm.style.opacity = '1';
    loginForm.style.pointerEvents = 'auto';
    loginForm.style.zIndex = '2';
    registerForm.style.opacity = '0';
    registerForm.style.pointerEvents = 'none';
    registerForm.style.zIndex = '1';
    btn.style.left = '0';
}

// 显示消息函数
function showMessage(formId, message, isError = false) {
    // 移除之前的消息
    const oldMessage = document.querySelector('.message');
    if (oldMessage) {
        oldMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.className = isError ? 'message error' : 'message success';
    
    const formBox = document.querySelector('.form-box');
    formBox.appendChild(messageDiv);
    
    // 3秒后自动移除消息
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// 处理注册表单提交
registerForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // 验证密码是否匹配
    if (password !== confirmPassword) {
        showMessage('register-form', '两次输入的密码不一致', true);
        return;
    }
    
    try {
        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('register-form', '注册成功！请登录');
            // 清空表单
            registerForm.reset();
            // 切换到登录表单
            setTimeout(() => {
                login();
            }, 1500);
        } else {
            showMessage('register-form', data.error || '注册失败，请重试', true);
        }
    } catch (error) {
        showMessage('register-form', '服务器连接错误，请稍后重试', true);
        console.error('注册错误:', error);
    }
});

// 处理登录表单提交
loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('login-form', '登录成功！');
            // 打印从服务器获取的用户信息，检查其结构和内容
            console.log('从服务器获取的用户信息:', data.user);
            // 存储用户信息到本地存储
            localStorage.setItem('user', JSON.stringify(data.user));
            console.log('script.js 存储的用户信息:', data.user); // 添加这一行
            setTimeout(() => {
                window.location.href = '/friends.html';
            }, 1500);
        } else {
            showMessage('login-form', data.error || '登录失败，请检查用户名和密码', true);
        }
    } catch (error) {
        showMessage('login-form', '服务器连接错误，请稍后重试', true);
        console.error('登录错误:', error);
    }
});