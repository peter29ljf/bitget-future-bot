const fs = require('fs');
const path = require('path');
const bitgetClient = require('../api/client');

// 活跃交易文件路径
const tradesFilePath = path.join(__dirname, '../../data/active_trades.json');

/**
 * 从活跃交易中删除指定交易
 * @param {string} symbol - 交易对
 */
function removeActiveTrade(symbol) {
  try {
    // 读取现有交易
    const tradesData = fs.readFileSync(tradesFilePath, 'utf8');
    const trades = JSON.parse(tradesData);
    
    // 过滤掉要删除的交易
    const updatedTrades = trades.filter(trade => trade.symbol !== symbol);
    
    // 写入文件
    fs.writeFileSync(tradesFilePath, JSON.stringify(updatedTrades, null, 2));
    
    return true;
  } catch (error) {
    console.error('移除活跃交易失败:', error);
    return false;
  }
}

/**
 * 获取活跃交易信息
 * @param {string} symbol - 交易对
 * @returns {object|null} - 交易信息或null
 */
function getActiveTrade(symbol) {
  try {
    // 读取活跃交易
    const tradesData = fs.readFileSync(tradesFilePath, 'utf8');
    const trades = JSON.parse(tradesData);
    
    // 查找指定交易
    return trades.find(trade => trade.symbol === symbol) || null;
  } catch (error) {
    console.error('获取活跃交易失败:', error);
    return null;
  }
}

/**
 * 平仓操作
 * @param {object} req - 请求对象
 * @param {object} res - 响应对象
 */
async function closePosition(req, res) {
  try {
    const { symbol } = req.body;
    
    // 参数验证
    if (!symbol) {
      return res.status(400).json({ success: false, message: '缺少交易对参数' });
    }
    
    // 将交易对符号统一转为大写
    const normalizedSymbol = symbol.toUpperCase();
    
    // 格式化完整的交易对符号（添加_UMCBL后缀）
    const fullSymbol = normalizedSymbol.includes('_UMCBL') ? normalizedSymbol : `${normalizedSymbol}_UMCBL`;
    
    // 获取活跃交易信息
    const activeTrade = getActiveTrade(fullSymbol);
    if (!activeTrade) {
      return res.status(404).json({
        success: false,
        message: '找不到对应的活跃交易'
      });
    }
    
    // 准备平仓
    const holdSide = activeTrade.type === 'long' ? 'long' : 'short';
    
    // 调用平仓API
    const response = await bitgetClient.closePosition(fullSymbol, 'USDT', holdSide);
    
    if (response.code === '00000') {
      // 从活跃交易中删除
      removeActiveTrade(fullSymbol);
      
      return res.json({
        success: true,
        message: '平仓成功',
        data: {
          symbol: fullSymbol,
          holdSide: holdSide,
          closedAt: new Date().toISOString()
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        message: '平仓失败',
        error: response.msg
      });
    }
  } catch (error) {
    console.error('平仓操作失败:', error);
    return res.status(500).json({
      success: false,
      message: '平仓操作失败',
      error: error.message
    });
  }
}

/**
 * 平多仓位
 * @param {string} symbol - 交易对
 * @param {string} size - 平仓数量
 * @returns {object} - 平仓结果
 */
async function closeLongPosition(symbol, size) {
  try {
    // 将交易对符号统一转为大写
    const normalizedSymbol = symbol.toUpperCase();
    
    // 格式化完整的交易对符号（添加_UMCBL后缀）
    const fullSymbol = normalizedSymbol.includes('_UMCBL') ? normalizedSymbol : `${normalizedSymbol}_UMCBL`;
    
    console.log(`正在平多: ${fullSymbol}, 数量: ${size}`);
    
    // 准备平仓数据
    const closeData = {
      symbol: fullSymbol,
      marginCoin: 'USDT',
      marginMode: 'crossed',
      side: 'close_long',
      posSide: 'long',
      orderType: 'market',
      size: size,
      productType: 'umcbl'
    };
    
    // 调用下单API
    const response = await bitgetClient.sendRequest(
      'post',
      '/api/mix/v1/order/placeOrder',
      closeData
    );
    
    if (response && response.code === '00000') {
      // 从活跃交易中删除
      removeActiveTrade(fullSymbol);
      
      return {
        success: true,
        message: '平多成功',
        data: response.data
      };
    } else {
      console.error('平多失败:', response);
      return {
        success: false,
        message: response ? response.msg : '平多操作失败',
        error: response
      };
    }
  } catch (error) {
    console.error('平多操作异常:', error);
    return {
      success: false,
      message: '平多操作异常',
      error: error.message
    };
  }
}

/**
 * 平空仓位
 * @param {string} symbol - 交易对
 * @param {string} size - 平仓数量
 * @returns {object} - 平仓结果
 */
async function closeShortPosition(symbol, size) {
  try {
    // 将交易对符号统一转为大写
    const normalizedSymbol = symbol.toUpperCase();
    
    // 格式化完整的交易对符号（添加_UMCBL后缀）
    const fullSymbol = normalizedSymbol.includes('_UMCBL') ? normalizedSymbol : `${normalizedSymbol}_UMCBL`;
    
    console.log(`正在平空: ${fullSymbol}, 数量: ${size}`);
    
    // 准备平仓数据
    const closeData = {
      symbol: fullSymbol,
      marginCoin: 'USDT',
      marginMode: 'crossed',
      side: 'close_short',
      posSide: 'short',
      orderType: 'market',
      size: size,
      productType: 'umcbl'
    };
    
    // 调用下单API
    const response = await bitgetClient.sendRequest(
      'post',
      '/api/mix/v1/order/placeOrder',
      closeData
    );
    
    if (response && response.code === '00000') {
      // 从活跃交易中删除
      removeActiveTrade(fullSymbol);
      
      return {
        success: true,
        message: '平空成功',
        data: response.data
      };
    } else {
      console.error('平空失败:', response);
      return {
        success: false,
        message: response ? response.msg : '平空操作失败',
        error: response
      };
    }
  } catch (error) {
    console.error('平空操作异常:', error);
    return {
      success: false,
      message: '平空操作异常',
      error: error.message
    };
  }
}

module.exports = {
  closePosition,
  closeLongPosition,
  closeShortPosition
}; 