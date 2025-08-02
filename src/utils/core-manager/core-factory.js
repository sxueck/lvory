/**
 * 内核工厂类
 * 负责创建和管理不同类型的内核实例
 */

const { CORE_TYPES, isSupportedCoreType } = require('../../constants/core-types');
const logger = require('../logger');

class CoreFactory {
  constructor() {
    this.coreInstances = new Map();
    this.currentCoreType = null;
  }

  /**
   * 创建内核实例
   * @param {string} coreType 内核类型
   * @returns {Object} 内核实例
   */
  createCore(coreType) {
    if (!isSupportedCoreType(coreType)) {
      throw new Error(`Unsupported core type: ${coreType}`);
    }

    // 如果实例已存在，直接返回
    if (this.coreInstances.has(coreType)) {
      return this.coreInstances.get(coreType);
    }

    let coreInstance;
    try {
      switch (coreType) {
        case CORE_TYPES.SINGBOX:
          const SingBoxAdapter = require('./singbox-adapter');
          coreInstance = new SingBoxAdapter();
          break;
        case CORE_TYPES.MIHOMO:
          const Mihomo = require('../mihomo');
          coreInstance = new Mihomo();
          break;
        default:
          throw new Error(`Unknown core type: ${coreType}`);
      }

      // 缓存实例
      this.coreInstances.set(coreType, coreInstance);
      logger.info(`[CoreFactory] Created ${coreType} core instance`);
      
      return coreInstance;
    } catch (error) {
      logger.error(`[CoreFactory] Failed to create ${coreType} core:`, error);
      throw error;
    }
  }

  /**
   * 获取当前活动的内核实例
   * @returns {Object} 当前内核实例
   */
  getCurrentCore() {
    const coreType = this.getCurrentCoreType();
    return this.createCore(coreType);
  }

  /**
   * 获取当前内核类型
   * @returns {string} 内核类型
   */
  getCurrentCoreType() {
    if (this.currentCoreType) {
      return this.currentCoreType;
    }

    try {
      const settingsManager = require('../../main/settings-manager');
      const settings = settingsManager.getSettings();
      this.currentCoreType = settings.coreType || CORE_TYPES.SINGBOX;
      return this.currentCoreType;
    } catch (error) {
      logger.warn('[CoreFactory] Failed to get core type from settings, using default');
      this.currentCoreType = CORE_TYPES.SINGBOX;
      return this.currentCoreType;
    }
  }

  /**
   * 设置当前内核类型
   * @param {string} coreType 内核类型
   */
  setCurrentCoreType(coreType) {
    if (!isSupportedCoreType(coreType)) {
      throw new Error(`Unsupported core type: ${coreType}`);
    }
    
    this.currentCoreType = coreType;
    logger.info(`[CoreFactory] Current core type set to: ${coreType}`);
  }

  /**
   * 切换内核类型
   * @param {string} newCoreType 新的内核类型
   * @returns {Promise<Object>} 切换结果
   */
  async switchCoreType(newCoreType) {
    try {
      if (!isSupportedCoreType(newCoreType)) {
        return { success: false, error: `Unsupported core type: ${newCoreType}` };
      }

      const currentCoreType = this.getCurrentCoreType();
      if (currentCoreType === newCoreType) {
        return { success: true, message: 'Already using the specified core type' };
      }

      // 停止当前内核
      const currentCore = this.getCurrentCore();
      if (currentCore && typeof currentCore.getStatus === 'function') {
        const status = currentCore.getStatus();
        if (status.isRunning) {
          logger.info(`[CoreFactory] Stopping current core: ${currentCoreType}`);
          await currentCore.stopCore();
        }
      }

      // 更新设置
      const settingsManager = require('../../main/settings-manager');
      await settingsManager.saveSettings({ coreType: newCoreType });

      // 更新当前内核类型
      this.setCurrentCoreType(newCoreType);

      logger.info(`[CoreFactory] Successfully switched from ${currentCoreType} to ${newCoreType}`);
      return { 
        success: true, 
        message: `Successfully switched to ${newCoreType}`,
        previousCore: currentCoreType,
        currentCore: newCoreType
      };
    } catch (error) {
      logger.error('[CoreFactory] Failed to switch core type:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取指定类型的内核实例
   * @param {string} coreType 内核类型
   * @returns {Object} 内核实例
   */
  getCore(coreType) {
    return this.createCore(coreType);
  }

  /**
   * 检查内核是否已创建
   * @param {string} coreType 内核类型
   * @returns {boolean} 是否已创建
   */
  hasCoreInstance(coreType) {
    return this.coreInstances.has(coreType);
  }

  /**
   * 清理内核实例
   * @param {string} coreType 内核类型（可选，不指定则清理所有）
   */
  clearCoreInstance(coreType = null) {
    if (coreType) {
      if (this.coreInstances.has(coreType)) {
        this.coreInstances.delete(coreType);
        logger.info(`[CoreFactory] Cleared ${coreType} core instance`);
      }
    } else {
      this.coreInstances.clear();
      logger.info('[CoreFactory] Cleared all core instances');
    }
  }

  /**
   * 获取所有已创建的内核实例
   * @returns {Map} 内核实例映射
   */
  getAllCoreInstances() {
    return new Map(this.coreInstances);
  }

  /**
   * 检查所有内核的状态
   * @returns {Object} 所有内核的状态
   */
  getAllCoreStatus() {
    const status = {};
    for (const [coreType, coreInstance] of this.coreInstances) {
      try {
        if (typeof coreInstance.getStatus === 'function') {
          status[coreType] = coreInstance.getStatus();
        } else {
          status[coreType] = { error: 'Status method not available' };
        }
      } catch (error) {
        status[coreType] = { error: error.message };
      }
    }
    return status;
  }
}

// 创建单例实例
const coreFactory = new CoreFactory();

module.exports = coreFactory;
