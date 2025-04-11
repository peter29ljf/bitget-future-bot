/**
 * 精度调整工具
 * 用于自动调整不同币种的价格精度
 */

/**
 * 根据精度格式化价格
 * @param {number} price - 原始价格
 * @param {number} precision - 精度位数
 * @returns {string} - 格式化后的价格字符串
 */
function formatPrice(price, precision) {
  if (isNaN(price) || price <= 0) {
    throw new Error(`价格无效: ${price}`);
  }
  
  // 确保精度在有效范围内
  precision = Math.max(0, Math.min(10, precision));
  
  // 使用toFixed来格式化价格，然后确保没有尾随的零
  const formattedPrice = parseFloat(price.toFixed(precision)).toString();
  
  // 如果价格是整数，但需要精度，则添加小数点和零
  if (formattedPrice.indexOf('.') === -1 && precision > 0) {
    return formattedPrice + '.' + '0'.repeat(precision);
  }
  
  return formattedPrice;
}

/**
 * 智能调整价格精度
 * 从高精度开始尝试，如果失败则降低精度
 * @param {function} apiCall - API调用函数
 * @param {object} params - API参数
 * @param {string} priceField - 价格字段名称
 * @param {number} startPrecision - 起始精度
 * @param {number} minPrecision - 最低精度
 * @returns {Promise<object>} - API响应
 */
async function adjustPricePrecision(apiCall, params, priceField, startPrecision = 6, minPrecision = 0) {
  // 保存原始价格
  const originalPrice = params[priceField];
  
  // 从高精度开始尝试
  for (let precision = startPrecision; precision >= minPrecision; precision--) {
    try {
      // 格式化价格
      params[priceField] = formatPrice(originalPrice, precision);
      
      console.log(`尝试精度 ${precision}, ${priceField}: ${params[priceField]}`);
      
      // 调用API
      const response = await apiCall(params);
      
      // 如果成功返回
      if (response.code === '00000') {
        console.log(`精度 ${precision} 成功`);
        return response;
      }
      
      // 如果错误与精度无关
      if (!response.msg || !response.msg.includes('multiple')) {
        console.log(`API错误与精度无关: ${response.msg}`);
        return response;
      }
      
      console.log(`精度 ${precision} 失败, 尝试降低精度`);
    } catch (error) {
      console.error(`精度 ${precision} 出错:`, error.message);
    }
  }
  
  // 如果所有精度都失败
  throw new Error(`无法找到合适的价格精度，原始价格: ${originalPrice}`);
}

module.exports = {
  formatPrice,
  adjustPricePrecision
}; 