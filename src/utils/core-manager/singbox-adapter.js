/**
 * SingBox 内核适配器
 * 基于 BaseCore 实现 sing-box 内核的管理功能
 * 这个适配器包装了现有的 SingBox 类，使其符合 BaseCore 接口
 */

const BaseCore = require('./base-core');
const { CORE_TYPES } = require('../../constants/core-types');
const logger = require('../logger');

class SingBoxAdapter extends BaseCore {
  constructor() {
    super(CORE_TYPES.SINGBOX);
    // 延迟加载 SingBox 实例以避免循环依赖
    this._singboxInstance = null;
  }

  /**
   * 获取 SingBox 实例
   * @returns {Object} SingBox 实例
   */
  getSingBoxInstance() {
    if (!this._singboxInstance) {
      this._singboxInstance = require('../sing-box');
    }
    return this._singboxInstance;
  }

  /**
   * 启动内核
   * @param {Object} options 启动选项
   * @returns {Promise<Object>} 启动结果
   */
  async startCore(options = {}) {
    try {
      this.startTime = new Date();
      const singbox = this.getSingBoxInstance();
      const result = await singbox.startCore(options);
      
      if (result.success) {
        this.isRunning = true;
        this.lastError = null;
      } else {
        this.lastError = result.error;
      }
      
      return result;
    } catch (error) {
      this.lastError = error.message;
      logger.error('[SingBoxAdapter] 启动内核失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 停止内核
   * @returns {Promise<Object>} 停止结果
   */
  async stopCore() {
    try {
      const singbox = this.getSingBoxInstance();
      const result = await singbox.stopCore();
      
      if (result.success) {
        this.isRunning = false;
        this.startTime = null;
      } else {
        this.lastError = result.error;
      }
      
      return result;
    } catch (error) {
      this.lastError = error.message;
      logger.error('[SingBoxAdapter] 停止内核失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取内核运行状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    try {
      const singbox = this.getSingBoxInstance();
      const singboxStatus = singbox.getStatus();
      
      return {
        ...this.getBaseStatus(),
        ...singboxStatus
      };
    } catch (error) {
      logger.error('[SingBoxAdapter] 获取状态失败:', error);
      return {
        ...this.getBaseStatus(),
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取详细的内核运行状态
   * @returns {Object} 详细状态信息
   */
  getDetailedStatus() {
    try {
      const singbox = this.getSingBoxInstance();
      const detailedStatus = singbox.getDetailedStatus();
      
      return {
        ...this.getBaseStatus(),
        ...detailedStatus
      };
    } catch (error) {
      logger.error('[SingBoxAdapter] 获取详细状态失败:', error);
      return {
        ...this.getBaseStatus(),
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取内核版本信息
   * @returns {Promise<Object>} 版本信息
   */
  async getVersion() {
    try {
      const singbox = this.getSingBoxInstance();
      return await singbox.getVersion();
    } catch (error) {
      logger.error('[SingBoxAdapter] 获取版本失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查内核是否已安装
   * @returns {Promise<Object>} 检查结果
   */
  async checkInstalled() {
    try {
      const singbox = this.getSingBoxInstance();
      const installed = singbox.checkInstalled();
      
      if (installed) {
        // 尝试获取版本信息来验证二进制文件是否可用
        const versionResult = await this.getVersion();
        return {
          success: true,
          installed: versionResult.success,
          path: singbox.binPath,
          version: versionResult.version || null
        };
      } else {
        return {
          success: true,
          installed: false,
          path: singbox.binPath
        };
      }
    } catch (error) {
      logger.error('[SingBoxAdapter] 检查安装状态失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 验证配置文件
   * @param {string} configPath 配置文件路径
   * @returns {Promise<Object>} 验证结果
   */
  async checkConfig(configPath) {
    try {
      const singbox = this.getSingBoxInstance();
      return await singbox.checkConfig(configPath);
    } catch (error) {
      logger.error('[SingBoxAdapter] 验证配置失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 格式化配置文件
   * @param {string} configPath 配置文件路径
   * @returns {Promise<Object>} 格式化结果
   */
  async formatConfig(configPath) {
    try {
      const singbox = this.getSingBoxInstance();
      return await singbox.formatConfig(configPath);
    } catch (error) {
      logger.error('[SingBoxAdapter] 格式化配置失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 下载内核
   * @returns {Promise<Object>} 下载结果
   */
  async downloadCore() {
    try {
      const singbox = this.getSingBoxInstance();
      return await singbox.downloadCore();
    } catch (error) {
      logger.error('[SingBoxAdapter] 下载内核失败:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = SingBoxAdapter;
