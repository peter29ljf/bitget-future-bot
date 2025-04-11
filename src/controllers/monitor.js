const fs = require('fs');
const path = require('path');
const bitgetClient = require('../api/client');

// 活跃交易文件路径
const tradesFilePath = path.join(__dirname, '../../data/active_trades.json');

// 定时监控间隔（毫秒）
const MONITOR_INTERVAL = 60000; // 1分钟

/**
 * 读取活跃交易
 * @returns {Array} - 活跃交易数组
 */
function getActiveTrades() {
  try {
    const tradesData = fs.readFileSync(tradesFilePath, 'utf8');
    return JSON.parse(tradesData);
  } catch (error) {
    console.error('读取活跃交易失败:', error);
    return [];
  }
}

/**
 * 更新活跃交易
 * @param {Array} trades - 更新后的交易数组
 */
function updateActiveTrades(trades) {
  try {
    fs.writeFileSync(tradesFilePath, JSON.stringify(trades, null, 2));
  } catch (error) {
    console.error('更新活跃交易失败:', error);
  }
}

/**
 * 监控活跃交易
 * 检查是否已触发止盈止损或手动平仓
 */
async function monitorTrades() {
  console.log('开始监控活跃交易...');
  
  const trades = getActiveTrades();
  if (trades.length === 0) {
    console.log('没有活跃交易需要监控');
    return;
  }
  
  console.log(`当前有 ${trades.length} 个活跃交易`);
  
  // 更新每个交易的状态
  let hasUpdates = false;
  for (const trade of trades) {
    try {
      // 获取最新价格
      const tickerResponse = await bitgetClient.getTicker(trade.symbol);
      if (tickerResponse.code !== '00000') {
        console.error(`获取 ${trade.symbol} 价格失败:`, tickerResponse.msg);
        continue;
      }
      
      const currentPrice = parseFloat(tickerResponse.data.last);
      trade.currentPrice = currentPrice;
      
      // 获取仓位状态
      const positionsResponse = await bitgetClient.getPositions('umcbl', 'USDT');
      if (positionsResponse.code !== '00000') {
        console.error('获取仓位信息失败:', positionsResponse.msg);
        continue;
      }
      
      // 查找对应仓位
      const position = positionsResponse.data.find(pos => 
        pos.symbol === trade.symbol && 
        pos.holdSide === (trade.type === 'long' ? 'long' : 'short')
      );
      
      // 如果仓位不存在，说明已经平仓
      if (!position) {
        console.log(`${trade.symbol} ${trade.type} 仓位已关闭，从活跃交易中移除`);
        trade.status = 'closed';
        hasUpdates = true;
        continue;
      }
      
      // 计算盈亏百分比
      let profitPercentage;
      if (trade.type === 'long') {
        profitPercentage = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
      } else {
        profitPercentage = ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;
      }
      
      trade.profitPercentage = profitPercentage.toFixed(2);
      hasUpdates = true;
      
      console.log(`${trade.symbol} ${trade.type}: 入场价=${trade.entryPrice}, 当前价=${currentPrice}, 盈亏=${trade.profitPercentage}%`);
    } catch (error) {
      console.error(`监控 ${trade.symbol} 失败:`, error);
    }
  }
  
  // 过滤出仍然活跃的交易
  const activeTrades = trades.filter(trade => trade.status !== 'closed');
  
  // 如果有更新，写入文件
  if (hasUpdates) {
    updateActiveTrades(activeTrades);
  }
}

/**
 * 启动监控系统
 */
function start() {
  // 立即执行一次
  monitorTrades();
  
  // 设置定时执行
  setInterval(monitorTrades, MONITOR_INTERVAL);
  
  console.log(`监控系统已启动，间隔 ${MONITOR_INTERVAL/1000} 秒`);
}

module.exports = {
  start,
  monitorTrades
}; 