const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 读取配置文件
const configPath = path.join(__dirname, '../../config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

class BitgetClient {
  constructor() {
    this.apiKey = config.api.apiKey;
    this.secretKey = config.api.secretKey;
    this.passphrase = config.api.passphrase;
    this.baseUrl = config.api.baseUrl;
    this.testMode = config.api.testMode;
  }

  // 生成签名
  generateSignature(timestamp, method, requestPath, body = '') {
    const message = timestamp + method.toUpperCase() + requestPath + body;
    console.log('签名信息:', {
      timestamp,
      method: method.toUpperCase(),
      requestPath,
      body,
      message
    });
    const hmac = crypto.createHmac('sha256', this.secretKey);
    const digest = hmac.update(message).digest();
    return Buffer.from(digest).toString('base64');
  }

  // 发送API请求
  async sendRequest(method, endpoint, data = {}) {
    const timestamp = Date.now().toString();
    let requestPath = endpoint;
    let url = this.baseUrl + endpoint;
    
    // 处理查询参数
    if (method === 'GET' && Object.keys(data).length > 0) {
      // 按字母顺序排序参数
      const sortedParams = Object.keys(data).sort().reduce((result, key) => {
        result[key] = data[key];
        return result;
      }, {});
      
      // 构建查询字符串
      const queryString = Object.keys(sortedParams)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(sortedParams[key])}`)
        .join('&');
      
      // 完整的请求路径
      requestPath = `${endpoint}?${queryString}`;
      url = `${this.baseUrl}${requestPath}`;
      
      // 构建待签名的消息
      const message = timestamp + method.toUpperCase() + requestPath;
      console.log('签名前的消息:', message);
      
      // 生成签名
      const hmac = crypto.createHmac('sha256', this.secretKey);
      const signature = hmac.update(message).digest('base64');
      
      // 设置头信息
      const headers = {
        'ACCESS-KEY': this.apiKey,
        'ACCESS-SIGN': signature,
        'ACCESS-TIMESTAMP': timestamp,
        'ACCESS-PASSPHRASE': this.passphrase,
        'Content-Type': 'application/json',
        'X-SIMULATED-TRADING': this.testMode ? '1' : '0'
      };
      
      console.log('请求头:', headers);
      console.log('请求URL:', url);
      
      // 发送请求
      try {
        const response = await axios({
          method,
          url,
          headers
        });
        
        return response.data;
      } catch (error) {
        console.error('API请求失败:', error.response ? error.response.data : error.message);
        throw error;
      }
    } else {
      // POST请求或没有参数的GET请求
      const body = method === 'GET' ? '' : JSON.stringify(data);
      
      // 构建待签名的消息
      const message = timestamp + method.toUpperCase() + endpoint + body;
      console.log('签名前的消息:', message);
      
      // 生成签名
      const hmac = crypto.createHmac('sha256', this.secretKey);
      const signature = hmac.update(message).digest('base64');
      
      // 设置头信息
      const headers = {
        'ACCESS-KEY': this.apiKey,
        'ACCESS-SIGN': signature,
        'ACCESS-TIMESTAMP': timestamp,
        'ACCESS-PASSPHRASE': this.passphrase,
        'Content-Type': 'application/json',
        'X-SIMULATED-TRADING': this.testMode ? '1' : '0'
      };
      
      console.log('请求头:', headers);
      console.log('请求URL:', url);
      
      // 发送请求
      try {
        const response = await axios({
          method,
          url,
          data: method === 'GET' ? null : data,
          headers
        });
        
        return response.data;
      } catch (error) {
        console.error('API请求失败:', error.response ? error.response.data : error.message);
        throw error;
      }
    }
  }
  
  // 获取合约信息
  async getContracts(productType = 'umcbl') {
    return this.sendRequest('GET', '/api/mix/v1/market/contracts', { productType });
  }
  
  // 获取当前价格
  async getTicker(symbol) {
    return this.sendRequest('GET', '/api/mix/v1/market/ticker', { symbol });
  }
  
  // 下单
  async placeOrder(orderData) {
    console.log('下单数据:', JSON.stringify(orderData, null, 2));
    
    // 复制一份数据以避免修改原始数据
    const modifiedOrderData = {...orderData};
    
    // 处理symbol格式，确保保留_UMCBL后缀
    if (modifiedOrderData.symbol && !modifiedOrderData.symbol.includes('_UMCBL')) {
      modifiedOrderData.symbol = modifiedOrderData.symbol + '_UMCBL';
      console.log('修正后的symbol:', modifiedOrderData.symbol);
    }

    // 确保双向持仓模式下有posSide参数
    if (!modifiedOrderData.posSide) {
      // 根据side自动添加对应的posSide
      if (modifiedOrderData.side === 'open_long' || modifiedOrderData.side === 'close_long') {
        modifiedOrderData.posSide = 'long';
        console.log('自动添加posSide: long');
      } else if (modifiedOrderData.side === 'open_short' || modifiedOrderData.side === 'close_short') {
        modifiedOrderData.posSide = 'short';
        console.log('自动添加posSide: short');
      }
    }
    
    // 根据Bitget最新文档，使用正确的API路径 - 与Python代码保持一致
    return this.sendRequest('POST', '/api/mix/v1/order/placeOrder', modifiedOrderData);
  }
  
  // 查询持仓
  async getPositions(productType = 'umcbl', marginCoin = 'USDT') {
    return this.sendRequest('GET', '/api/mix/v1/position/allPosition', { productType, marginCoin });
  }
  
  // 平仓操作
  async closePosition(symbol, marginCoin, holdSide) {
    try {
      // 先获取当前持仓信息
      const positionsResponse = await this.getPositions('umcbl', marginCoin);
      
      if (positionsResponse.code !== '00000' || !positionsResponse.data) {
        console.error('获取持仓信息失败:', positionsResponse.msg || '未知错误');
        // 如果无法获取持仓，使用固定值
        const formattedSymbol = symbol.includes('_UMCBL') ? symbol : symbol + '_UMCBL';
        
        const closeData = {
          symbol: formattedSymbol,
          marginCoin,
          marginMode: 'crossed',
          side: holdSide === 'long' ? 'close_long' : 'close_short',
          posSide: holdSide,
          orderType: 'market',
          size: '100', // 使用一个较大的值尝试平掉所有
          productType: 'umcbl'
        };
        
        console.log('平仓请求数据 (无持仓):', closeData);
        return this.placeOrder(closeData);
      }
      
      // 查找对应交易对和方向的持仓
      const position = positionsResponse.data.find(
        pos => pos.symbol === symbol && pos.holdSide === holdSide
      );
      
      if (!position) {
        console.error(`未找到${symbol}的${holdSide}持仓`);
        const formattedSymbol = symbol.includes('_UMCBL') ? symbol : symbol + '_UMCBL';
        
        const closeData = {
          symbol: formattedSymbol,
          marginCoin,
          marginMode: 'crossed',
          side: holdSide === 'long' ? 'close_long' : 'close_short',
          posSide: holdSide,
          orderType: 'market',
          size: '100', // 使用一个较大的值尝试平掉所有
          productType: 'umcbl'
        };
        
        console.log('平仓请求数据 (未找到特定持仓):', closeData);
        return this.placeOrder(closeData);
      }
      
      console.log('持仓信息:', position);
      const availableSize = position.available || position.total || '100';
      
      // 使用可用的持仓数量进行平仓
      const formattedSymbol = symbol.includes('_UMCBL') ? symbol : symbol + '_UMCBL';
      
      const closeData = {
        symbol: formattedSymbol,
        marginCoin,
        marginMode: 'crossed',
        side: holdSide === 'long' ? 'close_long' : 'close_short',
        posSide: holdSide,
        orderType: 'market',
        size: availableSize,
        productType: 'umcbl'
      };
      
      console.log('平仓请求数据 (找到持仓):', closeData);
      return this.placeOrder(closeData);
    } catch (error) {
      console.error('平仓准备失败:', error);
      // 发生错误时，尝试使用固定值平仓
      const formattedSymbol = symbol.includes('_UMCBL') ? symbol : symbol + '_UMCBL';
      
      const closeData = {
        symbol: formattedSymbol,
        marginCoin,
        marginMode: 'crossed',
        side: holdSide === 'long' ? 'close_long' : 'close_short',
        posSide: holdSide,
        orderType: 'market',
        size: '100', // 使用一个较大的值尝试平掉所有
        productType: 'umcbl'
      };
      
      console.log('平仓请求数据 (发生错误):', closeData);
      return this.placeOrder(closeData);
    }
  }

  // 获取账户信息
  async getAccountInfo(productType = 'umcbl', marginCoin = 'USDT') {
    console.log('获取账户信息...');
    return this.sendRequest('GET', '/api/mix/v1/account/accounts', { productType, marginCoin });
  }

  // 设置持仓模式
  async setPositionMode(holdMode = 'single_hold') {
    const positionModeData = {
      holdMode,
      productType: 'umcbl'
    };
    
    console.log('设置持仓模式请求数据:', positionModeData);
    return this.sendRequest('POST', '/api/mix/v1/account/setPositionMode', positionModeData);
  }

  /**
   * 获取当前持仓模式
   * @param {string} productType - 产品类型，例如：umcbl
   * @param {string} marginCoin - 保证金币种，例如：USDT
   * @returns {Promise<object>} - 返回持仓模式信息
   */
  async getPositionMode(productType, marginCoin) {
    const path = '/api/mix/v1/account/setPositionMode';
    const params = {
      productType,
      marginCoin
    };
    
    return this.sendRequest('GET', path, params, null);
  }
}

module.exports = new BitgetClient(); 