# Bitget 合约网络自动交易系统

## 项目概述

本项目是一个基于Bitget API的合约交易机器人，提供用户友好的网页界面进行交易控制。系统支持自动开仓、平仓操作，并可设置止盈止损策略。关键功能是确保同一币种在同一时间内只允许有一个仓位（多头或空头）。

![界面预览](docs/ui_preview.png)

## 主要功能

- **实盘/模拟交易切换**：支持真实市场交易和模拟测试环境
- **自动止盈止损**：为每笔交易自动设置止盈和止损价格
- **简洁直观的网页控制界面**：可视化操作交易参数和策略
- **实时显示API连接状态和活跃交易**：随时了解系统状态和盈亏情况
- **交易参数全局设置**：允许设置统一的交易金额、止盈止损比例
- **交易模式选择**：支持多空都做、只做多或只做空模式
- **活跃交易管理**：直观展示当前持仓，支持一键平仓
- **自动精度调整**：针对不同币种的价格精度进行自动适配

## 技术栈

- **后端**: Node.js + Express
- **前端**: 原生JavaScript + HTML + CSS
- **API**: Bitget REST API
- **数据存储**: 本地JSON文件

## 安装说明

### 前置条件

- Node.js v16.0+
- Bitget 交易所API密钥

### 安装步骤

1. 克隆本仓库到本地
```bash
git clone https://github.com/peter29ljf/bitget-trading-bot.git
cd bitget-trading-bot
```

2. 安装依赖
```bash
npm install
```

3. 配置API密钥
复制 `docs/config.example.json` 到项目根目录，并重命名为 `config.json`：

```bash
cp docs/config.example.json config.json
```

然后修改 `config.json` 文件，填入您的Bitget API信息。配置文件结构如下：

```json
{
  "api": {
    "apiKey": "您的Bitget API Key",
    "secretKey": "您的Bitget Secret Key",
    "passphrase": "您的Bitget API密码",
    "baseUrl": "https://api.bitget.com",
    "testMode": true
  },
  "trading": {
    "defaultAmount": 10,
    "defaultTakeProfitPercentage": 3,
    "defaultStopLossPercentage": 3
  }
}
```

注意：
* 将`testMode`设置为`true`表示使用模拟交易模式（推荐先测试）
* 设置为`false`将使用实盘交易，请谨慎操作
* `defaultAmount`: 默认交易金额（USDT）
* `defaultTakeProfitPercentage`: 默认止盈百分比
* `defaultStopLossPercentage`: 默认止损百分比

4. 启动服务器
```bash
node server.js
```

5. 访问控制面板
打开浏览器，访问 `http://localhost:3000`

## 使用说明

### 全局设置

在控制面板的"全局设置"区域，您可以配置以下交易参数：

- **买入金额(USDT)**: 每次交易的USDT金额
- **止盈百分比(%)**: 价格上涨或下跌该百分比时触发止盈
- **止损百分比(%)**: 价格下跌或上涨该百分比时触发止损
- **交易模式**: 可选择"多空都做"、"只做多"或"只做空"

设置完成后点击"保存设置"按钮，这些设置将应用于后续所有交易。

### 交易操作

在"交易操作"区域：

1. 在交易对输入框中输入交易对（例如：BTCUSDT）
2. 点击"开多"或"开空"按钮发起交易
3. 系统会自动执行开仓操作并设置止盈止损

### 活跃交易管理

"活跃交易"区域将显示所有当前持仓的交易，包括：

- 交易对名称
- 持仓方向（多/空）
- 入场价格
- 当前价格
- 实时盈亏百分比
- 止盈止损价格

每个交易卡片底部有"平仓"按钮，点击可立即平仓结束交易。

### 交易限制

- **同币种单一仓位**: 系统确保同一币种在同一时间内只允许有一个持仓
- **交易模式限制**: 如果设置了"只做多"或"只做空"，系统会拒绝执行不符合当前模式的交易

## 项目结构

```
project/
├── config.json           # API配置文件
├── server.js             # 主服务器文件
├── package.json          # 项目依赖
├── data/
│   └── active_trades.json # 活跃交易记录
├── docs/
│   ├── config.example.json   # 配置文件示例
│   ├── dual_position_guide.md # 双向持仓指南
│   └── ui_preview.png        # 界面预览图
├── src/
│   ├── api/              # Bitget API相关代码
│   │   └── client.js     # API客户端
│   ├── controllers/      # 逻辑控制器
│   │   ├── signalHandler.js # 信号处理器
│   │   ├── longPosition.js  # 开多仓操作
│   │   ├── shortPosition.js # 开空仓操作
│   │   ├── closePosition.js # 平仓操作
│   │   └── monitor.js       # 监控系统
│   └── utils/            # 工具函数
│       └── precision.js  # 精度调整算法
└── public/               # 前端文件
    ├── index.html        # 主页面
    ├── styles.css        # 样式
    └── script.js         # 前端脚本
```

## 注意事项

- **风险警告**: 交易加密货币存在风险，请确保理解交易逻辑后再使用本系统
- **API权限**: 建议只授予API必要的交易权限，不要给予提币权限
- **测试模式**: 首次使用建议开启测试模式(testMode=true)进行模拟交易
- **服务器运行**: 交易机器人需要持续运行才能正常执行止盈止损功能

## 常见问题解答

**Q: 如何确保API连接安全?**
A: API密钥只存储在本地config.json文件中，不会上传到任何服务器。请确保保护好您的服务器安全。

**Q: 为什么我的止盈止损没有触发?**
A: 请确保服务器始终在线运行，因为止盈止损逻辑需要通过持续监控价格来执行。

**Q: 如何从实盘模式切换到测试模式?**
A: 在config.json文件中将"testMode"的值设置为true，然后重启服务器。

**Q: 交易货币对格式是什么?**
A: 输入交易对时，格式为"BTCUSDT"（不区分大小写），系统会自动处理。

## 贡献指南

欢迎提交Pull Request或Issue来帮助改进这个项目。建议的贡献方向：

- 增加更多交易策略
- 改进用户界面
- 添加更多交易所支持
- 完善文档和使用示例

## 许可证

本项目采用MIT许可证。详情请参阅[LICENSE](LICENSE)文件。

## 免责声明

本软件仅供教育和研究目的使用。作者对使用本软件进行的任何交易不承担责任。交易加密货币存在风险，请谨慎使用并自行承担风险。

## 问题反馈

如果您在使用过程中遇到任何问题，或有任何建议，欢迎在 [Issues](https://github.com/peter29ljf/bitget-future-bot/issues) 页面提出。
