# Bitget 期货交易机器人

这是一个基于 Bitget API 的自动化期货交易机器人，支持接收外部交易信号并执行相应的交易操作。

## 功能特点

- 支持 BTCUSDT 等交易对的期货交易
- 可配置交易金额、杠杆倍数、止盈止损比例
- 实时监控持仓状态
- 自动执行止盈止损
- 支持 REST API 接收交易信号
- 支持 Web 界面查看交易状态和修改配置

## 安装步骤

1. 克隆项目到本地
2. 复制 `config.example.json` 为 `config.json`
3. 在 `config.json` 中填入您的 Bitget API 配置：
   ```json
   {
     "apiKey": "您的 API Key",
     "apiSecret": "您的 API Secret",
     "apiPassphrase": "您的 API Passphrase"
   }
   ```
4. 安装依赖：
   ```bash
   npm install
   ```
5. 启动服务：
   ```bash
   node server.js
   ```

## API 接口

### 发送交易信号
- 接口：`POST /api/signal`
- 参数：
  ```json
  {
    "COINNAME": "BTCUSDT",
    "SIDE": "BUY" // 或 "SELL"
  }
  ```

## 交易逻辑

### 2024-03-24 更新：优化交易逻辑
- 修复了无法正确平仓的问题
- 新的交易逻辑如下：

1. 空仓状态：
   - 收到买入信号 -> 开多单
   - 收到卖出信号 -> 开空单

2. 持有多单时：
   - 收到买入信号 -> 拒绝（防止重复开仓）
   - 收到卖出信号 -> 平多单（不再自动开空）

3. 持有空单时：
   - 收到买入信号 -> 平空单（不再自动开多）
   - 收到卖出信号 -> 拒绝（防止重复开仓）

## 配置说明

在 `config.json` 中可以设置：
- `defaultAmount`: 默认交易金额（USDT）
- `defaultLeverage`: 默认杠杆倍数
- `defaultTakeProfitPercentage`: 默认止盈百分比
- `defaultStopLossPercentage`: 默认止损百分比
- `testMode`: 是否使用测试模式

## 注意事项

1. 请确保您的 API Key 具有交易权限
2. 建议先使用测试模式（`testMode: true`）进行测试
3. 请根据您的风险承受能力设置合适的交易金额和杠杆倍数
4. 定期检查日志文件，确保系统运行正常

## 更新日志

### 2024-03-24
- 优化交易逻辑，修复平仓问题
- 改进错误处理和日志记录
- 优化持仓管理逻辑

### 2024-03-23
- 初始版本发布
- 实现基本的交易功能
- 添加 Web 界面 