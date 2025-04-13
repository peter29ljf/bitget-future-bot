# Bitget双向持仓模式指南

本文档详细解释了如何在此系统中使用Bitget交易所的双向持仓模式。

## 什么是双向持仓模式？

双向持仓模式允许交易者在同一交易对上同时持有多头和空头仓位。这与单向持仓模式不同，单向持仓模式只允许持有一个方向的仓位。

## 双向持仓请求参数

在双向持仓模式下，API请求需要使用特定的参数组合：

### 开仓

开仓时需要指定以下参数：

- `side`: 开仓方向
  - `open_long` - 开多
  - `open_short` - 开空
  
- `posSide`: 持仓方向
  - `long` - 多头持仓
  - `short` - 空头持仓

### 平仓

平仓时需要指定以下参数：

- `side`: 平仓方向
  - `close_long` - 平多
  - `close_short` - 平空
  
- `posSide`: 持仓方向
  - `long` - 平多头持仓
  - `short` - 平空头持仓

## 示例代码

### 开多

```javascript
const openLongData = {
  symbol: 'BTCUSDT_UMCBL',
  marginCoin: 'USDT',
  marginMode: 'crossed', // 全仓模式
  side: 'open_long',     // 开多
  posSide: 'long',       // 多头持仓
  orderType: 'market',   // 市价单
  size: '0.001',         // 下单数量
  productType: 'umcbl'
};

// 可选: 设置止盈止损
openLongData.presetTakeProfitPrice = '85000.0';  // 止盈价格
openLongData.presetStopLossPrice = '80000.0';    // 止损价格
openLongData.presetTakeProfitPriceType = 'last_price'; // 触发类型
openLongData.presetStopLossPriceType = 'last_price';   // 触发类型

// 发送请求
const response = await bitgetClient.placeOrder(openLongData);
```

### 开空

```javascript
const openShortData = {
  symbol: 'BTCUSDT_UMCBL',
  marginCoin: 'USDT',
  marginMode: 'crossed', // 全仓模式
  side: 'open_short',    // 开空
  posSide: 'short',      // 空头持仓
  orderType: 'market',   // 市价单
  size: '0.001',         // 下单数量
  productType: 'umcbl'
};

// 可选: 设置止盈止损 (注意开空时止盈价格低于当前价格，止损价格高于当前价格)
openShortData.presetTakeProfitPrice = '79000.0';  // 止盈价格
openShortData.presetStopLossPrice = '84000.0';    // 止损价格
openShortData.presetTakeProfitPriceType = 'last_price'; // 触发类型
openShortData.presetStopLossPriceType = 'last_price';   // 触发类型

// 发送请求
const response = await bitgetClient.placeOrder(openShortData);
```

### 平多

```javascript
const closeLongData = {
  symbol: 'BTCUSDT_UMCBL',
  marginCoin: 'USDT',
  marginMode: 'crossed', // 全仓模式
  side: 'close_long',    // 平多
  posSide: 'long',       // 多头持仓
  orderType: 'market',   // 市价单
  size: '0.001',         // 平仓数量
  productType: 'umcbl'
};

// 发送请求
const response = await bitgetClient.placeOrder(closeLongData);
```

### 平空

```javascript
const closeShortData = {
  symbol: 'BTCUSDT_UMCBL',
  marginCoin: 'USDT',
  marginMode: 'crossed', // 全仓模式
  side: 'close_short',   // 平空
  posSide: 'short',      // 空头持仓
  orderType: 'market',   // 市价单
  size: '0.001',         // 平仓数量
  productType: 'umcbl'
};

// 发送请求
const response = await bitgetClient.placeOrder(closeShortData);
```

## 使用测试脚本

我们提供了以下脚本用于测试双向持仓功能：

- `testDualLong.js` - 测试开多
- `testDualShort.js` - 测试开空
- `testDualClose.js` - 测试平仓（自动平掉最近的仓位）

执行方法：

```bash
# 开多单
node testDualLong.js

# 开空单
node testDualShort.js

# 平仓（自动关闭最近一笔交易）
node testDualClose.js
```

## 注意事项

1. 价格精度：Bitget对不同交易对有不同的价格精度要求，通常需要保证价格是0.1的倍数
2. 交易对后缀：所有永续合约交易对都需要添加`_UMCBL`后缀，如`BTCUSDT_UMCBL`
3. 下单数量：不同交易对有不同的最小下单量要求，请参考Bitget官方文档
4. 模拟交易：本系统默认使用模拟交易（X-SIMULATED-TRADING: 1），如需切换到实盘，请修改API客户端配置

## 问题排查

如果遇到以下错误：

- `side mismatch` - 检查side和posSide参数是否匹配，开多时side应为open_long，posSide应为long
- `The price you enter should be a multiple of 0.1` - 调整价格精度，确保是0.1的倍数
- `sign signature error` - 检查API密钥和签名是否正确 