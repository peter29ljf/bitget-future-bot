const fs = require('fs');
const path = require('path');
const bitgetClient = require('../api/client');
const { adjustPricePrecision, formatPrice } = require('../utils/precision');

// 读取配置文件
const configPath = path.join(__dirname, '../../config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 活跃交易文件路径
const tradesFilePath = path.join(__dirname, '../../data/active_trades.json');

/**
 * 检查是否已有相同币种的活跃交易
 * @param {string} symbol - 交易对
 * @returns {boolean} - 是否已有活跃交易
 */
function hasActiveTradeForSymbol(symbol) {
  try {
    // 读取活跃交易
    const tradesData = fs.readFileSync(tradesFilePath, 'utf8');
    const trades = JSON.parse(tradesData);
    
    // 检查是否有相同币种的交易
    return trades.some(trade => trade.symbol === symbol);
  } catch (error) {
    console.error('检查活跃交易失败:', error);
    return false;
  }
}

/**
 * 添加活跃交易记录
 * @param {object} trade - 交易信息
 */
function addActiveTrade(trade) {
  try {
    // 读取现有交易
    const tradesData = fs.readFileSync(tradesFilePath, 'utf8');
    const trades = JSON.parse(tradesData);
    
    // 添加新交易
    trades.push({
      ...trade,
      timestamp: Date.now()
    });
    
    // 写入文件
    fs.writeFileSync(tradesFilePath, JSON.stringify(trades, null, 2));
  } catch (error) {
    console.error('添加活跃交易失败:', error);
  }
}

/**
 * 开空仓位
 * @param {object} req - 请求对象
 * @param {object} res - 响应对象
 */
async function openShort(req, res) {
  try {
    const { symbol, amount, takeProfitPercentage, stopLossPercentage } = req.body;
    
    // 参数验证
    if (!symbol) {
      return res.status(400).json({ success: false, message: '缺少交易对参数' });
    }
    
    // 将交易对符号统一转为大写
    const normalizedSymbol = symbol.toUpperCase();
    
    // 格式化完整的交易对符号（添加_UMCBL后缀）
    const fullSymbol = normalizedSymbol.includes('_UMCBL') ? normalizedSymbol : `${normalizedSymbol}_UMCBL`;
    
    // 检查是否已有相同币种的活跃交易
    if (hasActiveTradeForSymbol(fullSymbol)) {
      return res.status(400).json({ 
        success: false, 
        message: '同一币种在同一时间内不允许多次开单' 
      });
    }
    
    // 获取当前价格
    const tickerResponse = await bitgetClient.getTicker(fullSymbol);
    if (tickerResponse.code !== '00000') {
      return res.status(500).json({ 
        success: false, 
        message: '获取价格失败', 
        error: tickerResponse.msg 
      });
    }
    
    const currentPrice = parseFloat(tickerResponse.data.last);
    
    // 设置交易参数
    const tradeAmount = amount || config.trading.defaultAmount;
    const takeProfitRate = (takeProfitPercentage || config.trading.defaultTakeProfitPercentage) / 100;
    const stopLossRate = (stopLossPercentage || config.trading.defaultStopLossPercentage) / 100;
    
    // 计算止盈止损价格 (开空时，盈利方向相反)
    const takeProfitPrice = currentPrice * (1 - takeProfitRate);
    const stopLossPrice = currentPrice * (1 + stopLossRate);
    
    // 计算下单数量（基于USDT金额）
    const tradeValue = tradeAmount / currentPrice;
    // 保留3位小数并确保最小值不小于0.001
    const size = Math.max(0.001, Math.floor(tradeValue * 1000) / 1000).toString();
    
    // 创建订单数据
    const orderData = {
      symbol: fullSymbol,
      marginCoin: 'USDT',
      marginMode: 'crossed',
      side: 'open_short',
      posSide: 'short',
      orderType: 'market',
      size: size,
      productType: 'umcbl'
    };
    
    // 尝试不同精度的止盈止损价格
    for (let precision = 6; precision >= 1; precision--) {
      try {
        orderData.presetTakeProfitPrice = formatPrice(takeProfitPrice, precision);
        orderData.presetStopLossPrice = formatPrice(stopLossPrice, precision);
        orderData.presetTakeProfitPriceType = 'last_price';
        orderData.presetStopLossPriceType = 'last_price';
        
        console.log(`尝试精度 ${precision}, 当前价格: ${currentPrice}, 止盈价格: ${orderData.presetTakeProfitPrice}, 止损价格: ${orderData.presetStopLossPrice}`);
        console.log('下单数据:', JSON.stringify(orderData, null, 2));
        
        // 下单
        const response = await bitgetClient.placeOrder(orderData);
        console.log('API响应:', JSON.stringify(response, null, 2));
        
        if (response.code === '00000') {
          // 添加活跃交易记录
          addActiveTrade({
            orderId: response.data.orderId,
            symbol: fullSymbol,
            type: 'short',
            amount: tradeAmount,
            entryPrice: currentPrice,
            takeProfitPrice: takeProfitPrice,
            stopLossPrice: stopLossPrice,
            size: size,
            status: 'active'
          });
          
          return res.json({
            success: true,
            message: '开空成功',
            data: {
              orderId: response.data.orderId,
              symbol: fullSymbol,
              amount: tradeAmount,
              entryPrice: currentPrice,
              takeProfitPrice: orderData.presetTakeProfitPrice,
              stopLossPrice: orderData.presetStopLossPrice,
              size: size
            }
          });
        } else {
          console.log(`精度 ${precision} 失败，错误: ${response.msg}`);
          // 如果错误与精度无关，直接返回错误
          if (!response.msg || (!response.msg.includes('multiple') && !response.msg.includes('price'))) {
            return res.status(500).json({
              success: false,
              message: '开空失败',
              error: response.msg
            });
          }
          // 否则继续尝试下一个精度
        }
      } catch (error) {
        console.error(`精度 ${precision} 出错:`, error.message);
        // 继续尝试下一个精度
      }
    }
    
    // 如果所有精度都失败
    return res.status(500).json({
      success: false,
      message: '开空失败，无法找到合适的价格精度',
      error: '无法找到合适的价格精度'
    });
  } catch (error) {
    console.error('开空操作失败:', error);
    return res.status(500).json({
      success: false,
      message: '开空操作失败',
      error: error.message
    });
  }
}

module.exports = {
  openShort
}; 