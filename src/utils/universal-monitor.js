/**
 * 通用监控模块
 * 提供与内核类型无关的统一监控接口
 */

const logger = require('./logger');
const universalApiClient = require('./universal-api-client');
const { CORE_TYPES } = require('../constants/core-types');

class UniversalMonitor {
  constructor() {
    this.currentCoreType = CORE_TYPES.SINGBOX;
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.monitoringFrequency = 5000; // 5秒
    this.listeners = new Map();
    this.lastStats = null;
  }

  /**
   * 设置当前内核类型
   * @param {string} coreType 内核类型
   */
  setCoreType(coreType) {
    this.currentCoreType = coreType;
    universalApiClient.setCoreType(coreType);
    logger.info(`监控模块切换到 ${coreType} 模式`);
  }

  /**
   * 设置 API 配置
   * @param {Object} config API 配置
   */
  setApiConfig(config) {
    universalApiClient.setApiConfig(config);
  }

  /**
   * 添加监控事件监听器
   * @param {string} event 事件名称
   * @param {Function} callback 回调函数
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * 移除监控事件监听器
   * @param {string} event 事件名称
   * @param {Function} callback 回调函数
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 触发监控事件
   * @param {string} event 事件名称
   * @param {*} data 事件数据
   * @private
   */
  _emit(event, data) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`监控事件回调执行失败 (${event}):`, error);
        }
      });
    }
  }

  /**
   * 开始监控
   * @param {Object} options 监控选项
   */
  startMonitoring(options = {}) {
    if (this.isMonitoring) {
      logger.warn('监控已在运行中');
      return;
    }

    this.monitoringFrequency = options.frequency || this.monitoringFrequency;
    this.isMonitoring = true;

    logger.info(`开始监控 ${this.currentCoreType} 内核状态`);

    // 立即执行一次监控
    this._performMonitoring();

    // 设置定时监控
    this.monitoringInterval = setInterval(() => {
      this._performMonitoring();
    }, this.monitoringFrequency);

    this._emit('monitoring-started', { coreType: this.currentCoreType });
  }

  /**
   * 停止监控
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info(`停止监控 ${this.currentCoreType} 内核状态`);
    this._emit('monitoring-stopped', { coreType: this.currentCoreType });
  }

  /**
   * 执行监控
   * @private
   */
  async _performMonitoring() {
    try {
      const stats = await this._collectStats();
      
      if (stats.success) {
        this._emit('stats-updated', stats.data);
        
        // 检测变化
        if (this.lastStats) {
          const changes = this._detectChanges(this.lastStats, stats.data);
          if (changes.length > 0) {
            this._emit('stats-changed', changes);
          }
        }
        
        this.lastStats = stats.data;
      } else {
        this._emit('monitoring-error', { error: stats.error });
      }
    } catch (error) {
      logger.error('监控执行失败:', error);
      this._emit('monitoring-error', { error: error.message });
    }
  }

  /**
   * 收集统计信息
   * @returns {Promise<Object>} 统计信息
   * @private
   */
  async _collectStats() {
    try {
      const results = await Promise.allSettled([
        universalApiClient.getVersion(),
        universalApiClient.getConfig(),
        universalApiClient.getProxies(),
        universalApiClient.getConnections(),
        universalApiClient.getTraffic()
      ]);

      const stats = {
        timestamp: Date.now(),
        coreType: this.currentCoreType,
        version: this._extractResult(results[0]),
        config: this._extractResult(results[1]),
        proxies: this._extractResult(results[2]),
        connections: this._extractResult(results[3]),
        traffic: this._extractResult(results[4])
      };

      // 计算衍生统计信息
      stats.derived = this._calculateDerivedStats(stats);

      return { success: true, data: stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 提取 Promise 结果
   * @param {Object} result Promise 结果
   * @returns {*} 提取的数据
   * @private
   */
  _extractResult(result) {
    if (result.status === 'fulfilled' && result.value.success) {
      return result.value.data;
    }
    return null;
  }

  /**
   * 计算衍生统计信息
   * @param {Object} stats 原始统计信息
   * @returns {Object} 衍生统计信息
   * @private
   */
  _calculateDerivedStats(stats) {
    const derived = {};

    // 连接统计
    if (stats.connections) {
      derived.connectionCount = stats.connections.connections ? stats.connections.connections.length : 0;
      derived.activeConnections = derived.connectionCount;
    }

    // 代理统计
    if (stats.proxies) {
      if (this.currentCoreType === CORE_TYPES.MIHOMO) {
        derived.proxyCount = stats.proxies.proxies ? Object.keys(stats.proxies.proxies).length : 0;
      } else {
        // sing-box 的代理统计可能需要不同的处理方式
        derived.proxyCount = 0;
      }
    }

    // 流量统计
    if (stats.traffic) {
      derived.totalUpload = stats.traffic.up || 0;
      derived.totalDownload = stats.traffic.down || 0;
      derived.totalTraffic = derived.totalUpload + derived.totalDownload;
    }

    return derived;
  }

  /**
   * 检测统计信息变化
   * @param {Object} oldStats 旧统计信息
   * @param {Object} newStats 新统计信息
   * @returns {Array} 变化列表
   * @private
   */
  _detectChanges(oldStats, newStats) {
    const changes = [];

    // 检测连接数变化
    if (oldStats.derived && newStats.derived) {
      if (oldStats.derived.connectionCount !== newStats.derived.connectionCount) {
        changes.push({
          type: 'connection-count-changed',
          oldValue: oldStats.derived.connectionCount,
          newValue: newStats.derived.connectionCount,
          change: newStats.derived.connectionCount - oldStats.derived.connectionCount
        });
      }

      // 检测流量变化
      if (oldStats.derived.totalTraffic !== newStats.derived.totalTraffic) {
        changes.push({
          type: 'traffic-changed',
          oldValue: oldStats.derived.totalTraffic,
          newValue: newStats.derived.totalTraffic,
          change: newStats.derived.totalTraffic - oldStats.derived.totalTraffic
        });
      }
    }

    return changes;
  }

  /**
   * 获取当前统计信息
   * @returns {Object|null} 当前统计信息
   */
  getCurrentStats() {
    return this.lastStats;
  }

  /**
   * 测试 API 连接
   * @returns {Promise<Object>} 测试结果
   */
  async testConnection() {
    return await universalApiClient.testConnection();
  }

  /**
   * 获取监控状态
   * @returns {Object} 监控状态
   */
  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      coreType: this.currentCoreType,
      frequency: this.monitoringFrequency,
      lastUpdate: this.lastStats ? this.lastStats.timestamp : null,
      listenerCount: Array.from(this.listeners.values()).reduce((total, callbacks) => total + callbacks.length, 0)
    };
  }

  /**
   * 手动刷新统计信息
   * @returns {Promise<Object>} 刷新结果
   */
  async refreshStats() {
    const stats = await this._collectStats();
    if (stats.success) {
      this.lastStats = stats.data;
      this._emit('stats-updated', stats.data);
    }
    return stats;
  }
}

module.exports = new UniversalMonitor();
