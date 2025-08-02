/**
 * 配置适配器
 * 提供统一的配置解析和处理接口
 */

const fs = require('fs');
const path = require('path');
const { CONFIG_FIELD_MAPPING, getCoreConfig } = require('../../constants/core-types');
const logger = require('../logger');

class ConfigAdapter {
  constructor(coreType) {
    this.coreType = coreType;
    this.config = getCoreConfig(coreType);
    this.fieldMapping = CONFIG_FIELD_MAPPING[coreType];
  }

  /**
   * 解析配置文件
   * @param {string} configPath 配置文件路径
   * @returns {Object} 解析结果
   */
  parseConfig(configPath) {
    throw new Error('parseConfig method must be implemented by subclass');
  }

  /**
   * 验证配置文件
   * @param {string} configPath 配置文件路径
   * @returns {Object} 验证结果
   */
  validateConfig(configPath) {
    throw new Error('validateConfig method must be implemented by subclass');
  }

  /**
   * 从配置中提取代理端口
   * @param {Object} config 配置对象
   * @returns {number} 代理端口
   */
  extractProxyPort(config) {
    throw new Error('extractProxyPort method must be implemented by subclass');
  }

  /**
   * 从配置中提取API地址
   * @param {Object} config 配置对象
   * @returns {string} API地址
   */
  extractApiAddress(config) {
    throw new Error('extractApiAddress method must be implemented by subclass');
  }

  /**
   * 检查配置文件是否存在
   * @param {string} configPath 配置文件路径
   * @returns {boolean} 是否存在
   */
  configExists(configPath) {
    return fs.existsSync(configPath);
  }

  /**
   * 检查配置文件格式是否正确
   * @param {string} configPath 配置文件路径
   * @returns {boolean} 格式是否正确
   */
  isValidFormat(configPath) {
    const ext = path.extname(configPath).toLowerCase();
    return this.config.configExtensions.includes(ext);
  }

  /**
   * 获取默认配置值
   * @returns {Object} 默认配置
   */
  getDefaultConfig() {
    return {
      proxyPort: this.config.defaultProxyPort,
      apiAddress: this.config.defaultApiAddress,
      allowLan: false,
      logLevel: 'info'
    };
  }

  /**
   * 合并配置
   * @param {Object} baseConfig 基础配置
   * @param {Object} overrideConfig 覆盖配置
   * @returns {Object} 合并后的配置
   */
  mergeConfig(baseConfig, overrideConfig) {
    return {
      ...baseConfig,
      ...overrideConfig
    };
  }

  /**
   * 标准化配置格式
   * @param {Object} config 原始配置
   * @returns {Object} 标准化后的配置
   */
  normalizeConfig(config) {
    const normalized = {};
    
    // 提取标准字段
    normalized.proxyPort = this.extractProxyPort(config) || this.config.defaultProxyPort;
    normalized.apiAddress = this.extractApiAddress(config) || this.config.defaultApiAddress;
    
    return normalized;
  }

  /**
   * 读取配置文件内容
   * @param {string} configPath 配置文件路径
   * @returns {string} 文件内容
   * @protected
   */
  readConfigFile(configPath) {
    try {
      if (!this.configExists(configPath)) {
        throw new Error(`Configuration file does not exist: ${configPath}`);
      }

      if (!this.isValidFormat(configPath)) {
        throw new Error(`Invalid configuration file format: ${configPath}`);
      }

      return fs.readFileSync(configPath, 'utf8');
    } catch (error) {
      logger.error(`[ConfigAdapter] Failed to read config file: ${error.message}`);
      throw error;
    }
  }

  /**
   * 解析API地址字符串
   * @param {string} apiAddress API地址字符串
   * @returns {Object} 解析后的地址信息
   * @protected
   */
  parseApiAddress(apiAddress) {
    if (!apiAddress || typeof apiAddress !== 'string') {
      return {
        host: '127.0.0.1',
        port: 9090,
        full: '127.0.0.1:9090'
      };
    }

    const parts = apiAddress.split(':');
    const host = parts[0] || '127.0.0.1';
    const port = parseInt(parts[1]) || 9090;

    return {
      host,
      port,
      full: `${host}:${port}`
    };
  }

  /**
   * 验证端口号
   * @param {number} port 端口号
   * @returns {boolean} 是否有效
   * @protected
   */
  isValidPort(port) {
    return Number.isInteger(port) && port > 0 && port <= 65535;
  }

  /**
   * 获取配置文件统计信息
   * @param {string} configPath 配置文件路径
   * @returns {Object} 统计信息
   */
  getConfigStats(configPath) {
    try {
      const stats = fs.statSync(configPath);
      return {
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        extension: path.extname(configPath).toLowerCase()
      };
    } catch (error) {
      logger.error(`[ConfigAdapter] Failed to get config stats: ${error.message}`);
      return null;
    }
  }

  /**
   * 创建配置备份
   * @param {string} configPath 配置文件路径
   * @returns {string} 备份文件路径
   */
  createBackup(configPath) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${configPath}.backup.${timestamp}`;
      fs.copyFileSync(configPath, backupPath);
      logger.info(`[ConfigAdapter] Created backup: ${backupPath}`);
      return backupPath;
    } catch (error) {
      logger.error(`[ConfigAdapter] Failed to create backup: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ConfigAdapter;
