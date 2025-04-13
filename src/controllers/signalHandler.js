const fs = require('fs');
const path = require('path');
const bitgetClient = require('../api/client');
const longPosition = require('./longPosition');
const shortPosition = require('./shortPosition');
const closePosition = require('./closePosition');

// 配置文件路径
const configPath = path.join(__dirname, '../../config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const tradesFilePath = path.join(__dirname, '../../data/active_trades.json');
const settingsFilePath = path.join(__dirname, '../../data/settings.json');

function getTradeSettings() {
    try {
        const settingsData = fs.readFileSync(settingsFilePath, 'utf8');
        const settings = JSON.parse(settingsData);
        
        if (!settings.amount || !settings.leverage || 
            !settings.takeProfitPercentage || !settings.stopLossPercentage) {
            throw new Error('设置不完整');
        }
        
        return settings;
    } catch (error) {
        console.error('读取设置失败:', error);
        const defaultSettings = {
            amount: 40,
            leverage: 25,
            takeProfitPercentage: 5,
            stopLossPercentage: 5,
            tradeMode: 'dual_side'
        };
        fs.writeFileSync(settingsFilePath, JSON.stringify(defaultSettings, null, 2));
        console.log('已创建默认设置');
        return defaultSettings;
    }
}

async function checkTradeAllowed(symbol, side) {
    try {
        // 确保交易记录文件存在
        if (!fs.existsSync(tradesFilePath)) {
            fs.writeFileSync(tradesFilePath, '[]', 'utf8');
        }
        
        // 读取现有交易记录
        const tradesData = fs.readFileSync(tradesFilePath, 'utf8');
        const trades = JSON.parse(tradesData);
        const existingTrade = trades.find(trade => trade.symbol === symbol);

        // 1. 如果没有仓位，允许任何方向的交易
        if (!existingTrade) {
            console.log('没有现有仓位，允许开仓');
            return { allowed: true, shouldOpen: true };
        }

        // 2. 有多单的情况
        if (existingTrade.type === 'long') {
            if (side === 'BUY') {
                console.log('已有相同币种的多单，不允许重复开多');
                return { allowed: false, shouldOpen: false };
            } else if (side === 'SELL') {
                console.log('已有相同币种的多单，执行平多');
                await closePosition.closeLongPosition(symbol, existingTrade.size);
                return { allowed: true, shouldOpen: false };
            }
        }

        // 3. 有空单的情况
        if (existingTrade.type === 'short') {
            if (side === 'SELL') {
                console.log('已有相同币种的空单，不允许重复开空');
                return { allowed: false, shouldOpen: false };
            } else if (side === 'BUY') {
                console.log('已有相同币种的空单，执行平空');
                await closePosition.closeShortPosition(symbol, existingTrade.size);
                return { allowed: true, shouldOpen: false };
            }
        }

        return { allowed: true, shouldOpen: true };
    } catch (error) {
        console.error('检查交易许可失败:', error);
        return { allowed: false, shouldOpen: false };
    }
}

async function handleSignal(req, res) {
    try {
        const { COINNAME, SIDE } = req.body;
        
        if (!COINNAME || !SIDE) {
            return res.status(400).json({ 
                success: false, 
                message: '缺少必要参数' 
            });
        }

        const settings = getTradeSettings();
        
        console.log('\n收到交易信号:');
        console.log('------------------------');
        console.log('交易对:', COINNAME);
        console.log('方向:', SIDE);
        console.log('交易金额:', settings.amount, 'USDT');
        console.log('杠杆倍数:', settings.leverage, 'x');
        console.log('实际交易金额:', settings.amount * settings.leverage, 'USDT');
        console.log('止盈比例:', settings.takeProfitPercentage, '%');
        console.log('止损比例:', settings.stopLossPercentage, '%');
        console.log('------------------------\n');

        const tradeCheck = await checkTradeAllowed(COINNAME, SIDE);
        
        if (!tradeCheck.allowed) {
            return res.status(400).json({ 
                success: false, 
                message: '不允许交易，可能是因为已有相同币种的仓位' 
            });
        }

        // 如果不需要开新仓，直接返回成功
        if (!tradeCheck.shouldOpen) {
            return res.json({
                success: true,
                message: '已执行平仓操作'
            });
        }

        const tradeReq = {
            body: {
                symbol: COINNAME,
                amount: settings.amount,
                leverage: settings.leverage,
                takeProfitPercentage: settings.takeProfitPercentage,
                stopLossPercentage: settings.stopLossPercentage
            }
        };

        console.log('准备执行开仓，请求参数:', JSON.stringify(tradeReq.body, null, 2));

        if (SIDE === 'BUY') {
            return longPosition.openLong(tradeReq, res);
        } else if (SIDE === 'SELL') {
            return shortPosition.openShort(tradeReq, res);
        } else {
            return res.status(400).json({ 
                success: false, 
                message: '无效的交易方向' 
            });
        }
    } catch (error) {
        console.error('处理交易信号失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '处理交易信号失败', 
            error: error.message 
        });
    }
}

module.exports = {
    handleSignal
}; 