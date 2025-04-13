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
    this.secretKey = config.api.apiSecret;
    this.passphrase = config.api.apiPassphrase;
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
    try {
      const timestamp = Date.now().toString();
      let requestPath = endpoint;
      let url = this.baseUrl + endpoint;
      
      console.log('准备发送API请求:', {
        method,
        endpoint,
        baseUrl: this.baseUrl,
        data
      });
      
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
          'X-SIMULATED-TRADING': this.testMode ? '1' : '0',
          'Accept': 'application/json'
        };
        
        console.log('请求头:', headers);
        console.log('请求URL:', url);
        
        // 发送请求
        const response = await axios({
          method,
          url,
          headers,
          timeout: 30000, // 增加超时时间到30秒
          validateStatus: function (status) {
            return status >= 200 && status < 500; // 接受 400 状态码以获取错误信息
          }
        });
        
        console.log('API响应:', response.data);
        return response.data;
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
          'X-SIMULATED-TRADING': this.testMode ? '1' : '0',
          'Accept': 'application/json'
        };
        
        console.log('请求头:', headers);
        console.log('请求URL:', url);
        
        // 发送请求
        const response = await axios({
          method,
          url,
          data: method === 'GET' ? null : data,
          headers,
          timeout: 30000, // 增加超时时间到30秒
          validateStatus: function (status) {
            return status >= 200 && status < 500; // 接受 400 状态码以获取错误信息
          }
        });
        
        console.log('API响应:', response.data);
        return response.data;
      }
    } catch (error) {
      console.error('API请求失败:', {
        message: error.message,
        response: error.response ? {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        } : null,
        config: error.config ? {
          url: error.config.url,
          data: error.config.data,
          method: error.config.method,
          headers: error.config.headers
        } : null
      });
      throw error;
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
    
    // 根据Bitget最新文档，使用正确的API路径
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
      
      // 找到对应的持仓
      const position = positionsResponse.data.find(pos => 
        pos.symbol === symbol && pos.holdSide === holdSide
      );
      
      if (!position) {
        console.log('未找到对应持仓:', { symbol, holdSide });
        return { success: false, message: '未找到对应持仓' };
      }
      
      // 创建平仓订单
      const closeData = {
        symbol: position.symbol,
        marginCoin,
        marginMode: position.marginMode,
        side: holdSide === 'long' ? 'close_long' : 'close_short',
        posSide: holdSide,
        orderType: 'market',
        size: position.total,
        productType: 'umcbl'
      };
      
      console.log('平仓请求数据:', closeData);
      return this.placeOrder(closeData);
      
    } catch (error) {
      console.error('平仓操作失败:', error);
      return { success: false, message: '平仓操作失败', error: error.message };
    }
  }
  
  // 获取账户信息
  async getAccountInfo(productType = 'umcbl', marginCoin = 'USDT') {
    try {
      console.log('正在获取账户信息...');
      console.log('请求参数:', { productType, marginCoin });
      
      const response = await this.sendRequest('GET', '/api/v2/mix/account/accounts', { 
        productType: 'USDT-FUTURES',
        marginCoin: marginCoin.toUpperCase()
      });
      
      console.log('账户信息响应:', response);
      
      if (!response) {
        throw new Error('API响应为空');
      }
      
      return response;
    } catch (error) {
      console.error('获取账户信息失败:', error);
      if (error.response) {
        console.error('API错误详情:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      }
      throw error;
    }
  }
}

module.exports = new BitgetClient(); 