/**
 * 通用 API 客户端
 * 提供与不同内核类型兼容的 API 调用接口
 */

const http = require('http');
const logger = require('./logger');
const { CORE_TYPES, API_ENDPOINTS } = require('../constants/core-types');

class UniversalApiClient {
  constructor() {
    this.currentCoreType = CORE_TYPES.SINGBOX;
    this.apiConfig = {
      host: '127.0.0.1',
      port: 9090
    };
  }

  /**
   * 设置当前内核类型
   * @param {string} coreType 内核类型
   */
  setCoreType(coreType) {
    this.currentCoreType = coreType;
    logger.info(`API客户端切换到 ${coreType} 模式`);
  }

  /**
   * 设置 API 配置
   * @param {Object} config API 配置
   */
  setApiConfig(config) {
    this.apiConfig = { ...this.apiConfig, ...config };
    logger.info(`API配置已更新: ${this.apiConfig.host}:${this.apiConfig.port}`);
  }

  /**
   * 获取 API 端点
   * @param {string} endpoint 端点名称
   * @returns {string} 端点路径
   */
  getEndpoint(endpoint) {
    const endpoints = API_ENDPOINTS[this.currentCoreType];
    return endpoints[endpoint] || endpoint;
  }

  /**
   * 发送 HTTP 请求
   * @param {string} method HTTP 方法
   * @param {string} path 请求路径
   * @param {Object} data 请求数据
   * @param {Object} options 请求选项
   * @returns {Promise<Object>} 响应结果
   */
  async request(method, path, data = null, options = {}) {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: this.apiConfig.host,
        port: this.apiConfig.port,
        path: path,
        method: method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers
        },
        timeout: options.timeout || 10000
      };

      if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH')) {
        const jsonData = JSON.stringify(data);
        requestOptions.headers['Content-Length'] = Buffer.byteLength(jsonData);
      }

      const req = http.request(requestOptions, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const result = {
              statusCode: res.statusCode,
              headers: res.headers,
              data: responseData ? JSON.parse(responseData) : null
            };

            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(result);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
            }
          } catch (error) {
            reject(new Error(`解析响应失败: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });

      if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH')) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  /**
   * 获取版本信息
   * @returns {Promise<Object>} 版本信息
   */
  async getVersion() {
    try {
      const endpoint = this.getEndpoint('version');
      const response = await this.request('GET', endpoint);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('获取版本信息失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取配置信息
   * @returns {Promise<Object>} 配置信息
   */
  async getConfig() {
    try {
      const endpoint = this.getEndpoint('config');
      const response = await this.request('GET', endpoint);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('获取配置信息失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新配置
   * @param {Object} config 新配置
   * @returns {Promise<Object>} 更新结果
   */
  async updateConfig(config) {
    try {
      const endpoint = this.getEndpoint('config');
      const response = await this.request('PATCH', endpoint, config);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('更新配置失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取代理信息
   * @returns {Promise<Object>} 代理信息
   */
  async getProxies() {
    try {
      const endpoint = this.getEndpoint('proxies');
      const response = await this.request('GET', endpoint);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('获取代理信息失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取连接信息
   * @returns {Promise<Object>} 连接信息
   */
  async getConnections() {
    try {
      const endpoint = this.getEndpoint('connections');
      const response = await this.request('GET', endpoint);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('获取连接信息失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取流量统计
   * @returns {Promise<Object>} 流量统计
   */
  async getTraffic() {
    try {
      const endpoint = this.getEndpoint('traffic');
      const response = await this.request('GET', endpoint);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('获取流量统计失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 创建日志流连接
   * @param {Function} onData 数据回调
   * @param {Function} onError 错误回调
   * @param {Function} onEnd 结束回调
   * @returns {Object} 请求对象
   */
  createLogStream(onData, onError, onEnd) {
    const endpoint = this.getEndpoint('logs');
    const options = {
      hostname: this.apiConfig.host,
      port: this.apiConfig.port,
      path: endpoint + '?level=info',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      timeout: 30000
    };

    const req = http.request(options, (res) => {
      if (res.statusCode !== 200) {
        if (onError) onError(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        if (onData) onData(chunk);
      });

      res.on('end', () => {
        if (onEnd) onEnd();
      });

      res.on('error', (error) => {
        if (onError) onError(error);
      });
    });

    req.on('error', (error) => {
      if (onError) onError(error);
    });

    req.on('timeout', () => {
      req.destroy();
      if (onError) onError(new Error('连接超时'));
    });

    return req;
  }

  /**
   * 测试 API 连接
   * @returns {Promise<Object>} 测试结果
   */
  async testConnection() {
    try {
      const startTime = Date.now();
      const response = await this.getVersion();
      const endTime = Date.now();
      
      if (response.success) {
        return {
          success: true,
          responseTime: endTime - startTime,
          version: response.data
        };
      } else {
        return {
          success: false,
          error: response.error
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取内核特定的状态信息
   * @returns {Promise<Object>} 状态信息
   */
  async getCoreStatus() {
    try {
      const results = await Promise.allSettled([
        this.getVersion(),
        this.getConfig(),
        this.getProxies(),
        this.getConnections()
      ]);

      const status = {
        coreType: this.currentCoreType,
        apiConfig: this.apiConfig,
        version: results[0].status === 'fulfilled' ? results[0].value.data : null,
        config: results[1].status === 'fulfilled' ? results[1].value.data : null,
        proxies: results[2].status === 'fulfilled' ? results[2].value.data : null,
        connections: results[3].status === 'fulfilled' ? results[3].value.data : null,
        errors: results.filter(r => r.status === 'rejected').map(r => r.reason.message)
      };

      return { success: true, data: status };
    } catch (error) {
      logger.error('获取内核状态失败:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new UniversalApiClient();
