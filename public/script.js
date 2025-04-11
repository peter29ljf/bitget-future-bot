// DOM 元素
const apiStatusEl = document.getElementById('api-status');
const modeStatusEl = document.getElementById('mode-status');
const activeTradesCountEl = document.getElementById('active-trades');
const tradesContainerEl = document.getElementById('trades-container');
const notificationEl = document.getElementById('notification');
const notificationMessageEl = document.getElementById('notification-message');
const closeNotificationBtn = document.getElementById('close-notification');
const settingsForm = document.getElementById('settings-form');
const symbolInput = document.getElementById('symbol');
const amountInput = document.getElementById('amount');
const leverageInput = document.getElementById('leverage');
const takeProfitInput = document.getElementById('take-profit');
const stopLossInput = document.getElementById('stop-loss');
const saveSettingsBtn = document.getElementById('save-settings');
const openLongBtn = document.getElementById('open-long');
const openShortBtn = document.getElementById('open-short');

// 交易设置
let tradeSettings = {
  amount: 100,
  leverage: 20,
  takeProfitPercentage: 3,
  stopLossPercentage: 2,
  tradeMode: 'both'
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('页面加载完成，开始初始化...');
  
  // 加载保存的设置
  loadSettings();
  
  // 检查API状态
  checkApiStatus();
  
  // 加载活跃交易
  loadActiveTrades();
  
  // 设置定时刷新
  setInterval(checkApiStatus, 30000);
  setInterval(loadActiveTrades, 10000);
  
  // 事件监听器
  saveSettingsBtn.addEventListener('click', () => {
    console.log('保存设置按钮被点击');
    const amount = parseFloat(amountInput.value);
    const leverage = parseInt(leverageInput.value);
    const takeProfit = parseFloat(takeProfitInput.value);
    const stopLoss = parseFloat(stopLossInput.value);
    
    console.log('表单值:', {
      amount,
      leverage,
      takeProfit,
      stopLoss
    });
    
    if (isNaN(amount) || isNaN(leverage) || isNaN(takeProfit) || isNaN(stopLoss)) {
      showNotification('请输入有效的数值', 'error');
      return;
    }
    
    saveSettings();
  });
  
  // 监听输入框变化
  amountInput.addEventListener('change', () => {
    console.log('买入金额变化:', amountInput.value);
  });
  
  leverageInput.addEventListener('change', () => {
    console.log('杠杆倍数变化:', leverageInput.value);
  });
  
  takeProfitInput.addEventListener('change', () => {
    console.log('止盈百分比变化:', takeProfitInput.value);
  });
  
  stopLossInput.addEventListener('change', () => {
    console.log('止损百分比变化:', stopLossInput.value);
  });
  
  openLongBtn.addEventListener('click', () => placeTrade('BUY'));
  openShortBtn.addEventListener('click', () => placeTrade('SELL'));
  closeNotificationBtn.addEventListener('click', hideNotification);
  
  // 为每个交易绑定关闭事件（通过事件委托）
  tradesContainerEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('close-trade-btn')) {
      const tradeId = e.target.dataset.tradeId;
      closeTrade(tradeId);
    }
  });
});

// 加载保存的设置
function loadSettings() {
  try {
    console.log('开始加载设置...');
    const savedSettings = localStorage.getItem('tradeSettings');
    console.log('从localStorage加载的设置:', savedSettings);
    
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      console.log('解析后的设置:', parsedSettings);
      
      // 更新全局设置对象
      tradeSettings = {
        amount: parseFloat(parsedSettings.amount) || 100,
        leverage: parseInt(parsedSettings.leverage) || 20,
        takeProfitPercentage: parseFloat(parsedSettings.takeProfitPercentage) || 3,
        stopLossPercentage: parseFloat(parsedSettings.stopLossPercentage) || 2,
        tradeMode: parsedSettings.tradeMode || 'both'
      };
      
      // 填充表单
      amountInput.value = tradeSettings.amount;
      leverageInput.value = tradeSettings.leverage;
      takeProfitInput.value = tradeSettings.takeProfitPercentage;
      stopLossInput.value = tradeSettings.stopLossPercentage;
      
      // 设置交易模式单选按钮
      const tradeModeRadios = document.getElementsByName('trade-mode');
      for (const radio of tradeModeRadios) {
        radio.checked = radio.value === tradeSettings.tradeMode;
      }
      
      console.log('设置已加载到表单:', {
        amountInput: amountInput.value,
        leverageInput: leverageInput.value,
        takeProfitInput: takeProfitInput.value,
        stopLossInput: stopLossInput.value,
        tradeMode: tradeSettings.tradeMode
      });
    } else {
      console.log('没有找到保存的设置，使用默认值');
      // 使用默认值
      amountInput.value = 100;
      leverageInput.value = 20;
      takeProfitInput.value = 3;
      stopLossInput.value = 2;
      document.querySelector('input[name="trade-mode"][value="both"]').checked = true;
    }
  } catch (error) {
    console.error('加载设置时出错:', error);
    showNotification('加载设置时出错，已重置为默认值', 'error');
    // 出错时重置为默认值
    amountInput.value = 100;
    leverageInput.value = 20;
    takeProfitInput.value = 3;
    stopLossInput.value = 2;
    document.querySelector('input[name="trade-mode"][value="both"]').checked = true;
  }
}

// 保存设置
function saveSettings() {
  try {
    console.log('开始保存设置...');
    
    // 获取表单值
    const amount = parseFloat(amountInput.value);
    const leverage = parseInt(leverageInput.value);
    const takeProfitPercentage = parseFloat(takeProfitInput.value);
    const stopLossPercentage = parseFloat(stopLossInput.value);
    
    // 获取交易模式
    const tradeModeRadios = document.getElementsByName('trade-mode');
    let tradeMode = 'both';
    for (const radio of tradeModeRadios) {
      if (radio.checked) {
        tradeMode = radio.value;
        break;
      }
    }
    
    // 转换前端交易模式到后端格式
    let serverTradeMode = 'dual_side';
    if (tradeMode === 'long-only') {
      serverTradeMode = 'long_only';
    } else if (tradeMode === 'short-only') {
      serverTradeMode = 'short_only';
    }
    
    // 更新全局设置对象
    tradeSettings = {
      amount: isNaN(amount) ? 100 : amount,
      leverage: isNaN(leverage) ? 20 : leverage,
      takeProfitPercentage: isNaN(takeProfitPercentage) ? 3 : takeProfitPercentage,
      stopLossPercentage: isNaN(stopLossPercentage) ? 2 : stopLossPercentage,
      tradeMode
    };
    
    console.log('准备保存的设置:', tradeSettings);
    
    // 保存到本地存储
    localStorage.setItem('tradeSettings', JSON.stringify(tradeSettings));
    
    console.log('设置已保存到localStorage');
    
    // 准备发送到服务器的数据
    const serverSettings = {
      amount: tradeSettings.amount,
      leverage: tradeSettings.leverage,
      takeProfitPercentage: tradeSettings.takeProfitPercentage,
      stopLossPercentage: tradeSettings.stopLossPercentage,
      tradeMode: serverTradeMode
    };
    
    console.log('准备发送到服务器的设置:', serverSettings);
    
    // 发送设置到服务器
    fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(serverSettings)
    })
    .then(response => response.json())
    .then(data => {
      console.log('服务器响应:', data);
      if (data.success) {
        showNotification('设置已同步到服务器', 'success');
      } else {
        showNotification('服务器保存设置失败: ' + data.message, 'error');
      }
    })
    .catch(error => {
      console.error('发送设置到服务器时出错:', error);
      showNotification('无法连接到服务器', 'error');
    });
    
    // 验证保存是否成功
    const savedSettings = localStorage.getItem('tradeSettings');
    console.log('验证保存的设置:', savedSettings);
    
    // 重新加载设置以确认
    loadSettings();
    
    showNotification('设置已保存到本地', 'success');
  } catch (error) {
    console.error('保存设置时出错:', error);
    showNotification('保存设置时出错', 'error');
  }
}

// 检查API状态
async function checkApiStatus() {
  try {
    const response = await fetch('/api/status');
    if (response.ok) {
      const data = await response.json();
      
      // 更新API状态
      if (data.apiConnected) {
        apiStatusEl.innerHTML = 'API状态: <span class="status-ok">已连接</span>';
      } else {
        apiStatusEl.innerHTML = 'API状态: <span class="status-error">未连接</span>';
      }
      
      // 更新交易模式
      modeStatusEl.innerHTML = `模式: <span class="status-ok">${data.isTestMode ? '模拟交易' : '实盘交易'}</span>`;
    } else {
      apiStatusEl.innerHTML = 'API状态: <span class="status-error">错误</span>';
      showNotification('无法连接到服务器', 'error');
    }
  } catch (error) {
    console.error('检查API状态时出错:', error);
    apiStatusEl.innerHTML = 'API状态: <span class="status-error">错误</span>';
    showNotification('检查API状态时出错', 'error');
  }
}

// 加载活跃交易
async function loadActiveTrades() {
  try {
    const response = await fetch('/api/trades');
    if (response.ok) {
      const trades = await response.json();
      
      // 更新活跃交易计数
      activeTradesCountEl.innerHTML = `活跃交易: <span class="status-ok">${trades.length}</span>`;
      
      // 清空容器
      tradesContainerEl.innerHTML = '';
      
      if (trades.length === 0) {
        tradesContainerEl.innerHTML = '<p class="no-trades">没有活跃交易</p>';
        return;
      }
      
      // 渲染每个交易
      trades.forEach(trade => {
        const profitClass = 
          parseFloat(trade.profitPercentage) > 0 ? 'profit-positive' : 
          parseFloat(trade.profitPercentage) < 0 ? 'profit-negative' : '';
        
        const tradeTypeClass = trade.type.includes('long') ? 'trade-long' : 'trade-short';
        const tradeTypeText = trade.type.includes('long') ? '多' : '空';
        
        const tradeElement = document.createElement('div');
        tradeElement.className = `trade-card ${tradeTypeClass}`;
        tradeElement.innerHTML = `
          <div class="trade-header">
            <h3>${trade.symbol.replace('_UMCBL', '')}</h3>
            <span class="trade-type">${tradeTypeText}</span>
          </div>
          <div class="trade-details">
            <div class="trade-detail">
              <span class="detail-label">金额:</span>
              <span class="detail-value">${trade.amount} USDT</span>
            </div>
            <div class="trade-detail">
              <span class="detail-label">入场价:</span>
              <span class="detail-value">${trade.entryPrice}</span>
            </div>
            <div class="trade-detail">
              <span class="detail-label">当前价:</span>
              <span class="detail-value">${trade.currentPrice}</span>
            </div>
            <div class="trade-detail">
              <span class="detail-label">盈亏:</span>
              <span class="detail-value ${profitClass}">${trade.profitPercentage}%</span>
            </div>
            <div class="trade-detail">
              <span class="detail-label">止盈价:</span>
              <span class="detail-value">${trade.takeProfitPrice}</span>
            </div>
            <div class="trade-detail">
              <span class="detail-label">止损价:</span>
              <span class="detail-value">${trade.stopLossPrice}</span>
            </div>
          </div>
          <button class="close-trade-btn" data-trade-id="${trade.orderId}">平仓</button>
        `;
        
        tradesContainerEl.appendChild(tradeElement);
      });
    } else {
      showNotification('无法加载活跃交易', 'error');
    }
  } catch (error) {
    console.error('加载活跃交易时出错:', error);
    showNotification('加载活跃交易时出错', 'error');
  }
}

// 下单交易
async function placeTrade(action) {
  const symbol = symbolInput.value.trim().toUpperCase();
  if (!symbol) {
    showNotification('请输入交易对', 'error');
    return;
  }
  
  // 检查交易模式
  if ((action === 'BUY' && tradeSettings.tradeMode === 'short-only') ||
      (action === 'SELL' && tradeSettings.tradeMode === 'long-only')) {
    showNotification('当前交易模式不允许此操作', 'error');
    return;
  }
  
  try {
    const response = await fetch(`/api/${action === 'BUY' ? 'open-long' : 'open-short'}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbol,
        amount: tradeSettings.amount * tradeSettings.leverage,
        takeProfitPercentage: tradeSettings.takeProfitPercentage,
        stopLossPercentage: tradeSettings.stopLossPercentage
      })
    });
    
    const data = await response.json();
    if (data.success) {
      showNotification(`${action === 'BUY' ? '开多' : '开空'}订单已提交`, 'success');
      loadActiveTrades();
    } else {
      showNotification(data.message || '下单失败', 'error');
    }
  } catch (error) {
    console.error('下单时出错:', error);
    showNotification('下单时出错', 'error');
  }
}

// 平仓交易
async function closeTrade(tradeId) {
  try {
    showNotification('处理平仓中...', 'loading');
    
    const response = await fetch(`/api/close/${tradeId}`, {
      method: 'POST'
    });
    
    if (response.ok) {
      const result = await response.json();
      
      if (result.success) {
        showNotification('平仓成功', 'success');
        // 刷新活跃交易列表
        loadActiveTrades();
      } else {
        showNotification(result.message || '平仓失败', 'error');
      }
    } else {
      const errorData = await response.json();
      showNotification(errorData.message || '平仓请求失败', 'error');
    }
  } catch (error) {
    console.error('平仓时出错:', error);
    showNotification('平仓请求出错', 'error');
  }
}

// 显示通知
function showNotification(message, type = 'info') {
  notificationMessageEl.textContent = message;
  notificationEl.className = `notification notification-${type}`;
  notificationEl.style.display = 'flex';
  
  // 自动隐藏（除了loading类型）
  if (type !== 'loading') {
    setTimeout(hideNotification, 5000);
  }
}

// 隐藏通知
function hideNotification() {
  notificationEl.style.display = 'none';
} 