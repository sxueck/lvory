/**
 * 内核基类
 * 定义所有内核管理器必须实现的接口
 */

const { getCoreConfig } = require('../../constants/core-types');
const logger = require('../logger');

class BaseCore {
  constructor(coreType) {
    this.coreType = coreType;
    this.config = getCoreConfig(coreType);
    this.isRunning = false;
    this.lastError = null;
    this.startTime = null;
  }

  /**
   * 启动内核
   * @param {Object} options 启动选项
   * @param {string} options.configPath 配置文件路径
   * @param {Object} options.proxyConfig 代理配置
   * @param {boolean} options.enableSystemProxy 是否启用系统代理
   * @param {boolean} options.tunMode 是否启用TUN模式
   * @returns {Promise<Object>} 启动结果
   */
  async startCore(options = {}) {
    throw new Error('startCore method must be implemented by subclass');
  }

  /**
   * 停止内核
   * @returns {Promise<Object>} 停止结果
   */
  async stopCore() {
    throw new Error('stopCore method must be implemented by subclass');
  }

  /**
   * 获取内核运行状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    throw new Error('getStatus method must be implemented by subclass');
  }

  /**
   * 获取详细的内核运行状态
   * @returns {Object} 详细状态信息
   */
  getDetailedStatus() {
    throw new Error('getDetailedStatus method must be implemented by subclass');
  }

  /**
   * 获取内核版本信息
   * @returns {Promise<Object>} 版本信息
   */
  async getVersion() {
    throw new Error('getVersion method must be implemented by subclass');
  }

  /**
   * 检查内核是否已安装
   * @returns {Promise<Object>} 检查结果
   */
  async checkInstalled() {
    throw new Error('checkInstalled method must be implemented by subclass');
  }

  /**
   * 验证配置文件
   * @param {string} configPath 配置文件路径
   * @returns {Promise<Object>} 验证结果
   */
  async checkConfig(configPath) {
    throw new Error('checkConfig method must be implemented by subclass');
  }

  /**
   * 格式化配置文件
   * @param {string} configPath 配置文件路径
   * @returns {Promise<Object>} 格式化结果
   */
  async formatConfig(configPath) {
    throw new Error('formatConfig method must be implemented by subclass');
  }

  /**
   * 下载内核
   * @returns {Promise<Object>} 下载结果
   */
  async downloadCore() {
    throw new Error('downloadCore method must be implemented by subclass');
  }

  /**
   * 获取内核二进制文件路径
   * @returns {string} 二进制文件路径
   */
  getBinaryPath() {
    const utils = require('../../main/utils');
    const path = require('path');
    const appDataDir = utils.getAppDataDir();
    return path.join(appDataDir, 'bin', this.config.binaryName);
  }

  /**
   * 获取内核类型
   * @returns {string} 内核类型
   */
  getCoreType() {
    return this.coreType;
  }

  /**
   * 获取内核配置
   * @returns {Object} 内核配置
   */
  getCoreConfig() {
    return this.config;
  }

  /**
   * 获取内核显示名称
   * @returns {string} 显示名称
   */
  getDisplayName() {
    return this.config.displayName;
  }

  /**
   * 检查是否支持指定功能
   * @param {string} feature 功能名称
   * @returns {boolean} 是否支持
   */
  supportsFeature(feature) {
    return this.config.supportedFeatures[feature] || false;
  }

  /**
   * 更新内核状态
   * @param {Object} status 状态信息
   * @protected
   */
  updateStatus(status) {
    this.isRunning = status.isRunning || false;
    this.lastError = status.error || null;
    if (status.isRunning && !this.startTime) {
      this.startTime = new Date();
    } else if (!status.isRunning) {
      this.startTime = null;
    }
  }

  /**
   * 记录日志
   * @param {string} level 日志级别
   * @param {string} message 日志消息
   * @param {*} data 附加数据
   * @protected
   */
  log(level, message, data = null) {
    const prefix = `[${this.config.displayName}]`;
    if (data) {
      logger[level](`${prefix} ${message}`, data);
    } else {
      logger[level](`${prefix} ${message}`);
    }
  }

  /**
   * 获取运行时长
   * @returns {number} 运行时长（毫秒）
   */
  getUptime() {
    if (!this.isRunning || !this.startTime) {
      return 0;
    }
    return Date.now() - this.startTime.getTime();
  }

  /**
   * 获取基本状态信息
   * @returns {Object} 基本状态
   * @protected
   */
  getBaseStatus() {
    return {
      coreType: this.coreType,
      displayName: this.config.displayName,
      isRunning: this.isRunning,
      lastError: this.lastError,
      uptime: this.getUptime(),
      startTime: this.startTime ? this.startTime.toISOString() : null
    };
  }
}

module.exports = BaseCore;
