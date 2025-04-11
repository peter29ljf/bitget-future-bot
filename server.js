const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const signalHandler = require('./src/controllers/signalHandler');
const longPosition = require('./src/controllers/longPosition');
const shortPosition = require('./src/controllers/shortPosition');
const closePosition = require('./src/controllers/closePosition');
const monitor = require('./src/controllers/monitor');
const bitgetClient = require('./src/api/client');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// 确保active_trades.json文件存在
const tradesFilePath = path.join(dataDir, 'active_trades.json');
if (!fs.existsSync(tradesFilePath)) {
  fs.writeFileSync(tradesFilePath, JSON.stringify([]));
}

// 确保settings.json文件存在
const settingsFilePath = path.join(dataDir, 'settings.json');
if (!fs.existsSync(settingsFilePath)) {
  const defaultSettings = {
    amount: 40,
    leverage: 25,
    takeProfitPercentage: 5,
    stopLossPercentage: 5
  };
  fs.writeFileSync(settingsFilePath, JSON.stringify(defaultSettings, null, 2));
}

// 启动服务器和监控系统
async function initializeServer() {
  try {
    // 启动监控系统
    monitor.start();

    // 启动服务器
    app.listen(PORT, () => {
      console.log(`服务器已启动: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
  }
}

// 中间件
app.use(bodyParser.json());
app.use(express.static('public'));

// 路由
app.get('/api/status', async (req, res) => {
  try {
    const accountInfo = await bitgetClient.getAccountInfo();
    res.json({
      apiConnected: accountInfo.code === '00000',
      isTestMode: true
    });
  } catch (error) {
    console.error('获取API状态失败:', error);
    res.json({
      apiConnected: false,
      isTestMode: true
    });
  }
});

// 获取活跃交易
app.get('/api/trades', (req, res) => {
  try {
    const tradesData = fs.readFileSync(tradesFilePath, 'utf8');
    const trades = JSON.parse(tradesData);
    res.json(trades);
  } catch (error) {
    console.error('读取活跃交易失败:', error);
    res.json([]);
  }
});

// 处理交易信号
app.post('/api/signal', signalHandler.handleSignal);

// 开多
app.post('/api/open-long', longPosition.openLong);

// 开空
app.post('/api/open-short', shortPosition.openShort);

// 平仓
app.post('/api/close/:tradeId', async (req, res) => {
  try {
    const tradeId = req.params.tradeId;
    
    // 读取活跃交易
    const tradesData = fs.readFileSync(tradesFilePath, 'utf8');
    let trades = JSON.parse(tradesData);
    
    // 找到要平仓的交易
    const tradeIndex = trades.findIndex(trade => trade.orderId === tradeId);
    if (tradeIndex === -1) {
      return res.status(404).json({ success: false, message: '未找到该交易' });
    }
    
    const trade = trades[tradeIndex];
    
    // 调用平仓逻辑
    let result;
    if (trade.type === 'long') {
      result = await closePosition.closeLongPosition(trade.symbol, trade.size);
    } else if (trade.type === 'short') {
      result = await closePosition.closeShortPosition(trade.symbol, trade.size);
    } else {
      return res.status(400).json({ success: false, message: '不支持的交易类型' });
    }
    
    if (result && result.success) {
      // 从活跃交易列表中移除
      trades.splice(tradeIndex, 1);
      fs.writeFileSync(tradesFilePath, JSON.stringify(trades, null, 2));
      
      res.json({ success: true, message: '平仓成功' });
    } else {
      res.status(400).json({ success: false, message: result.message || '平仓失败' });
    }
  } catch (error) {
    console.error('平仓失败:', error);
    res.status(500).json({ success: false, message: '平仓操作失败' });
  }
});

// 获取设置
app.get('/api/settings', (req, res) => {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
    console.log('\n当前设置:');
    console.log('------------------------');
    console.log('交易金额:', settings.amount, 'USDT');
    console.log('杠杆倍数:', settings.leverage, 'x');
    console.log('止盈比例:', settings.takeProfitPercentage, '%');
    console.log('止损比例:', settings.stopLossPercentage, '%');
    console.log('------------------------\n');
    res.json(settings);
  } catch (error) {
    console.error('获取设置失败:', error);
    res.status(500).json({ success: false, message: '获取设置失败' });
  }
});

// 保存设置
app.post('/api/settings', (req, res) => {
  try {
    console.log('\n收到设置更新请求:');
    console.log('------------------------');
    console.log('请求体:', req.body);
    console.log('------------------------\n');

    const settings = req.body;
    
    // 验证必要的字段
    const requiredFields = ['amount', 'leverage', 'takeProfitPercentage', 'stopLossPercentage', 'tradeMode'];
    const missingFields = requiredFields.filter(field => !settings[field]);
    
    if (missingFields.length > 0) {
      console.error('缺少必要字段:', missingFields);
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要字段', 
        missingFields 
      });
    }

    // 验证字段类型和范围
    if (typeof settings.amount !== 'number' || settings.amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: '交易金额必须是大于0的数字' 
      });
    }

    if (typeof settings.leverage !== 'number' || settings.leverage <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: '杠杆倍数必须是大于0的数字' 
      });
    }

    if (typeof settings.takeProfitPercentage !== 'number' || settings.takeProfitPercentage <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: '止盈比例必须是大于0的数字' 
      });
    }

    if (typeof settings.stopLossPercentage !== 'number' || settings.stopLossPercentage <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: '止损比例必须是大于0的数字' 
      });
    }

    if (!['dual_side', 'long_only', 'short_only'].includes(settings.tradeMode)) {
      return res.status(400).json({ 
        success: false, 
        message: '无效的交易模式' 
      });
    }

    console.log('\n验证通过，准备保存设置:');
    console.log('------------------------');
    console.log('交易金额:', settings.amount, 'USDT');
    console.log('杠杆倍数:', settings.leverage, 'x');
    console.log('止盈比例:', settings.takeProfitPercentage, '%');
    console.log('止损比例:', settings.stopLossPercentage, '%');
    console.log('交易模式:', settings.tradeMode);
    console.log('------------------------\n');

    // 保存设置
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    
    console.log('设置已保存到文件');
    
    // 读取保存的设置进行验证
    const savedSettings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
    console.log('\n验证保存的设置:');
    console.log('------------------------');
    console.log(savedSettings);
    console.log('------------------------\n');

    res.json({ 
      success: true, 
      message: '设置已保存', 
      settings: savedSettings 
    });
  } catch (error) {
    console.error('保存设置失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '保存设置失败', 
      error: error.message 
    });
  }
});

// 启动服务器
initializeServer(); 