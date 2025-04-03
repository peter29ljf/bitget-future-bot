const fs = require('fs');
const path = require('path');
const bitgetClient = require('../api/client');
const longPosition = require('./longPosition');
const shortPosition = require('./shortPosition');
const closePosition = require('./closePosition');

// 获取配置文件
const configPath = path.join(__dirname, '../../config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 活跃交易文件路径
const tradesFilePath = path.join(__dirname, '../../data/active_trades.json');

/**
 * 检查是否已有相同币种的活跃交易
 * @param {string} symbol - 交易对
 * @returns {object|null} - 返回交易对象或null
 */
function getActiveTradeForSymbol(symbol) {
  try {
    // 读取活跃交易
    const tradesData = fs.readFileSync(tradesFilePath, 'utf8');
    const trades = JSON.parse(tradesData);
    
    // 查找对应币种的交易
    return trades.find(trade => trade.symbol === symbol) || null;
  } catch (error) {
    console.error('检查活跃交易失败:', error);
    return null;
  }
}

/**
 * 处理交易信号
 * @param {object} req - 请求对象
 * @param {object} res - 响应对象
 */
async function handleSignal(req, res) {
  try {
    const { COINNAME, SIDE } = req.body;
    
    // 参数验证
    if (!COINNAME || !SIDE) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要参数，需要COINNAME和SIDE字段' 
      });
    }
    
    if (SIDE !== 'BUY' && SIDE !== 'SELL') {
      return res.status(400).json({ 
        success: false, 
        message: 'SIDE参数必须为BUY或SELL' 
      });
    }
    
    // 将交易对符号统一转为大写
    const normalizedCoinName = COINNAME.toUpperCase();
    
    // 格式化完整的交易对符号（添加_UMCBL后缀）
    const fullSymbol = normalizedCoinName.includes('_UMCBL') ? normalizedCoinName : `${normalizedCoinName}_UMCBL`;
    
    // 获取当前该币种的活跃交易
    const activeTrade = getActiveTradeForSymbol(fullSymbol);
    
    let actionTaken = '';
    let result = null;
    
    // 根据信号和当前持仓状态决定操作
    if (SIDE === 'BUY') {
      if (!activeTrade) {
        // 无仓位，开多
        console.log(`收到买入信号，${fullSymbol} 无仓位，执行开多操作`);
        
        // 模拟请求对象
        const openLongReq = {
          body: {
            symbol: normalizedCoinName,
            amount: config.trading.defaultAmount,
            takeProfitPercentage: config.trading.defaultTakeProfitPercentage,
            stopLossPercentage: config.trading.defaultStopLossPercentage
          }
        };
        
        // 模拟响应对象
        const openLongRes = {
          status: function(code) {
            this.statusCode = code;
            return this;
          },
          json: function(data) {
            this.data = data;
            return this;
          }
        };
        
        // 执行开多
        await longPosition.openLong(openLongReq, openLongRes);
        
        result = openLongRes.data;
        actionTaken = '开多';
      } else if (activeTrade.type === 'short') {
        // 有空仓，平空
        console.log(`收到买入信号，${fullSymbol} 有空仓，执行平仓操作`);
        
        // 模拟请求对象
        const closeReq = {
          body: {
            symbol: normalizedCoinName
          }
        };
        
        // 模拟响应对象
        const closeRes = {
          status: function(code) {
            this.statusCode = code;
            return this;
          },
          json: function(data) {
            this.data = data;
            return this;
          }
        };
        
        // 执行平仓
        await closePosition.closePosition(closeReq, closeRes);
        
        result = closeRes.data;
        actionTaken = '平空';
      } else {
        // 已有多仓，不操作
        return res.json({
          success: false,
          message: `已持有 ${normalizedCoinName} 多仓，忽略买入信号`,
          data: { activeTrade }
        });
      }
    } else if (SIDE === 'SELL') {
      if (!activeTrade) {
        // 无仓位，开空
        console.log(`收到卖出信号，${fullSymbol} 无仓位，执行开空操作`);
        
        // 模拟请求对象
        const openShortReq = {
          body: {
            symbol: normalizedCoinName,
            amount: config.trading.defaultAmount,
            takeProfitPercentage: config.trading.defaultTakeProfitPercentage,
            stopLossPercentage: config.trading.defaultStopLossPercentage
          }
        };
        
        // 模拟响应对象
        const openShortRes = {
          status: function(code) {
            this.statusCode = code;
            return this;
          },
          json: function(data) {
            this.data = data;
            return this;
          }
        };
        
        // 执行开空
        await shortPosition.openShort(openShortReq, openShortRes);
        
        result = openShortRes.data;
        actionTaken = '开空';
      } else if (activeTrade.type === 'long') {
        // 有多仓，平多
        console.log(`收到卖出信号，${fullSymbol} 有多仓，执行平仓操作`);
        
        // 模拟请求对象
        const closeReq = {
          body: {
            symbol: normalizedCoinName
          }
        };
        
        // 模拟响应对象
        const closeRes = {
          status: function(code) {
            this.statusCode = code;
            return this;
          },
          json: function(data) {
            this.data = data;
            return this;
          }
        };
        
        // 执行平仓
        await closePosition.closePosition(closeReq, closeRes);
        
        result = closeRes.data;
        actionTaken = '平多';
      } else {
        // 已有空仓，不操作
        return res.json({
          success: false,
          message: `已持有 ${normalizedCoinName} 空仓，忽略卖出信号`,
          data: { activeTrade }
        });
      }
    }
    
    // 返回操作结果
    return res.json({
      success: true,
      message: `信号处理成功，执行操作: ${actionTaken} ${normalizedCoinName}`,
      signal: { COINNAME: normalizedCoinName, SIDE },
      action: actionTaken,
      result: result
    });
    
  } catch (error) {
    console.error('信号处理失败:', error);
    return res.status(500).json({
      success: false,
      message: '信号处理失败',
      error: error.message
    });
  }
}

module.exports = {
  handleSignal
}; 