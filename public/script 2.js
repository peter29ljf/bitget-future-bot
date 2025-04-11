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
const takeProfitInput = document.getElementById('take-profit');
const stopLossInput = document.getElementById('stop-loss');
const saveSettingsBtn = document.getElementById('save-settings');
const openLongBtn = document.getElementById('open-long');
const openShortBtn = document.getElementById('open-short');

// 交易设置
let tradeSettings = {
  amount: 100,
  takeProfitPercentage: 3,
  stopLossPercentage: 2,
  tradeMode: 'both'
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
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
  saveSettingsBtn.addEventListener('click', saveSettings);
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
  const savedSettings = localStorage.getItem('tradeSettings');
  if (savedSettings) {
    tradeSettings = JSON.parse(savedSettings);
    
    // 填充表单
    amountInput.value = tradeSettings.amount;
    takeProfitInput.value = tradeSettings.takeProfitPercentage;
    stopLossInput.value = tradeSettings.stopLossPercentage;
    
    // 设置交易模式单选按钮
    const tradeModeRadios = document.getElementsByName('trade-mode');
    for (const radio of tradeModeRadios) {
      if (radio.value === tradeSettings.tradeMode) {
        radio.checked = true;
        break;
      }
    }
  }
}

// 保存设置
function saveSettings() {
  // 获取表单值
  const amount = amountInput.value || 100;
  const takeProfitPercentage = takeProfitInput.value || 3;
  const stopLossPercentage = stopLossInput.value || 2;
  
  // 获取交易模式
  const tradeModeRadios = document.getElementsByName('trade-mode');
  let tradeMode = 'both';
  for (const radio of tradeModeRadios) {
    if (radio.checked) {
      tradeMode = radio.value;
      break;
    }
  }
  
  // 更新设置
  tradeSettings = {
    amount: parseFloat(amount),
    takeProfitPercentage: parseFloat(takeProfitPercentage),
    stopLossPercentage: parseFloat(stopLossPercentage),
    tradeMode
  };
  
  // 保存到本地存储
  localStorage.setItem('tradeSettings', JSON.stringify(tradeSettings));
  
  showNotification('设置已保存', 'success');
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
  
  // 使用当前设置
  const { amount, takeProfitPercentage, stopLossPercentage, tradeMode } = tradeSettings;
  
  // 检查交易模式与操作是否匹配
  if ((tradeMode === 'long-only' && action === 'SELL') || 
      (tradeMode === 'short-only' && action === 'BUY')) {
    showNotification(`当前交易模式不允许${action === 'BUY' ? '开多' : '开空'}`, 'error');
    return;
  }
  
  try {
    // 显示处理中
    showNotification('处理订单中...', 'loading');
    
    // 准备请求数据
    const requestData = {
      COINNAME: symbol,
      SIDE: action,
      amount: parseFloat(amount),
      takeProfitPercentage: parseFloat(takeProfitPercentage),
      stopLossPercentage: parseFloat(stopLossPercentage)
    };
    
    // 发送请求
    const response = await fetch('/api/signal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    if (response.ok) {
      const result = await response.json();
      
      if (result.success) {
        showNotification(result.message, 'success');
        // 刷新活跃交易列表
        loadActiveTrades();
      } else {
        showNotification(result.message || '交易失败', 'error');
      }
    } else {
      const errorData = await response.json();
      showNotification(errorData.message || '交易请求失败', 'error');
    }
  } catch (error) {
    console.error('下单时出错:', error);
    showNotification('下单请求出错', 'error');
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