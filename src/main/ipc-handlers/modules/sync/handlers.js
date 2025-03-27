/**
 * 同步操作相关IPC处理程序
 * 提供节流控制的同步操作接口
 */
const logger = require('../../../../utils/logger');
const { createResponse } = require('../../core/utils');
const zod = require('zod'); // 添加zod依赖用于参数校验

// 同步类型定义
const SYNC_TYPES = {
  PROFILE: 'profile',
  CONFIG: 'config',
  NODE: 'node',
  RULE: 'rule',
  ALL: 'all'
};

// 节流间隔配置（毫秒）
const THROTTLE_INTERVALS = {
  [SYNC_TYPES.PROFILE]: 5000,
  [SYNC_TYPES.CONFIG]: 3000,
  [SYNC_TYPES.NODE]: 2000,
  [SYNC_TYPES.RULE]: 4000,
  [SYNC_TYPES.ALL]: 10000
};

// 最后同步时间记录
const lastSyncTimes = {};

// 检查是否需要节流
function shouldThrottle(syncType) {
  const now = Date.now();
  const lastSync = lastSyncTimes[syncType] || 0;
  const interval = THROTTLE_INTERVALS[syncType];
  
  if (now - lastSync < interval) {
    return true;
  }
  
  lastSyncTimes[syncType] = now;
  return false;
}

/**
 * 同步配置文件
 * @returns {Promise<Object>} 同步结果
 */
async function syncProfiles() {
  // 模拟同步操作
  await new Promise(resolve => setTimeout(resolve, 500));
  return { success: true, message: '配置文件同步成功' };
}

/**
 * 同步配置
 * @returns {Promise<Object>} 同步结果
 */
async function syncConfig() {
  // 模拟同步操作
  await new Promise(resolve => setTimeout(resolve, 300));
  return { success: true, message: '配置同步成功' };
}

/**
 * 同步节点
 * @returns {Promise<Object>} 同步结果
 */
async function syncNodes() {
  // 模拟同步操作
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { success: true, message: '节点同步成功', count: 42 };
}

/**
 * 同步规则
 * @returns {Promise<Object>} 同步结果
 */
async function syncRules() {
  // 模拟同步操作
  await new Promise(resolve => setTimeout(resolve, 2000));
  return { success: true, message: '规则同步成功', count: 15 };
}

/**
 * 同步所有
 * @returns {Promise<Object>} 同步结果
 */
async function syncAll() {
  try {
    // 并行执行所有同步操作
    const [profileResult, configResult, nodeResult, ruleResult] = await Promise.all([
      syncProfiles(),
      syncConfig(),
      syncNodes(),
      syncRules()
    ]);
    
    // 检查是否所有操作都成功
    const allSuccess = profileResult.success && 
                      configResult.success && 
                      nodeResult.success && 
                      ruleResult.success;
    
    if (allSuccess) {
      return {
        success: true,
        message: '所有同步操作成功完成',
        details: {
          profile: profileResult,
          config: configResult,
          node: nodeResult,
          rule: ruleResult
        }
      };
    } else {
      // 部分操作失败
      return {
        success: false,
        message: '部分同步操作失败',
        details: {
          profile: profileResult,
          config: configResult,
          node: nodeResult,
          rule: ruleResult
        }
      };
    }
  } catch (error) {
    logger.error('全部同步操作失败:', error);
    return { success: false, error: error.message };
  }
}

// 同步处理程序对象
const handlers = {
  // 统一同步接口
  'universal-sync': async (event, { type, options = {} }) => {
    try {
      if (!type || !SYNC_TYPES[type.toUpperCase()]) {
        return createResponse(false, null, { 
          message: '无效的同步类型' 
        });
      }

      // 检查节流
      if (shouldThrottle(type)) {
        return createResponse(false, null, {
          message: '同步操作过于频繁，请稍后再试'
        });
      }

      let result;
      const syncType = type.toLowerCase();
      switch (syncType) {
        case SYNC_TYPES.PROFILE:
          result = await handlers['sync-profiles'](event, options);
          break;
        case SYNC_TYPES.CONFIG:
          result = await handlers['sync-config'](event, options);
          break;
        case SYNC_TYPES.NODE:
          result = await handlers['sync-nodes'](event, options);
          break;
        case SYNC_TYPES.RULE:
          result = await handlers['sync-rules'](event, options);
          break;
        case SYNC_TYPES.ALL:
          result = await handlers['sync-all'](event, options);
          break;
      }

      return createResponse(true, {
        type: syncType,
        timestamp: new Date().toISOString(),
        result
      });
    } catch (error) {
      logger.error(`同步操作失败 (${type}):`, error);
      return createResponse(false, null, error);
    }
  },

  // 同步配置文件
  'sync-profiles': async (event, options = {}) => {
    try {
      const result = await syncProfiles();
      return createResponse(result.success, result);
    } catch (error) {
      logger.error('同步配置文件失败:', error);
      return createResponse(false, null, error);
    }
  },

  // 同步配置
  'sync-config': async (event, options = {}) => {
    try {
      const result = await syncConfig();
      return createResponse(result.success, result);
    } catch (error) {
      logger.error('同步配置失败:', error);
      return createResponse(false, null, error);
    }
  },

  // 同步节点
  'sync-nodes': async (event, options = {}) => {
    try {
      const result = await syncNodes();
      return createResponse(result.success, result);
    } catch (error) {
      logger.error('同步节点失败:', error);
      return createResponse(false, null, error);
    }
  },

  // 同步规则
  'sync-rules': async (event, options = {}) => {
    try {
      const result = await syncRules();
      return createResponse(result.success, result);
    } catch (error) {
      logger.error('同步规则失败:', error);
      return createResponse(false, null, error);
    }
  },

  // 同步所有
  'sync-all': async (event, options = {}) => {
    try {
      const result = await syncAll();
      return createResponse(result.success, result);
    } catch (error) {
      logger.error('同步所有配置失败:', error);
      return createResponse(false, null, error);
    }
  }
};

// 导出所有功能
module.exports = {
  handlers,
  syncProfiles,
  syncConfig,
  syncNodes,
  syncRules,
  syncAll,
  shouldThrottle,
  SYNC_TYPES,
  THROTTLE_INTERVALS
}; 