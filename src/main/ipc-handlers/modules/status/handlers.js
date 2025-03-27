/**
 * 状态检查相关IPC处理程序
 * 提供统一的状态检查接口，合并节点状态和服务状态检查功能
 */
const logger = require('../../../../utils/logger');
const singbox = require('../../../../utils/sing-box');
const { createResponse } = require('../../core/utils');
const nodeConnectionMonitor = require('../../../data-managers/node-connection-monitor');
const zod = require('zod'); // 添加zod依赖用于参数校验

// 状态类型枚举验证
const StatusTypeSchema = zod.enum(['node', 'service', 'combined']);

// 节流控制映射
const statusThrottle = new Map();
const DEFAULT_THROTTLE_INTERVAL = 2000; // 2秒默认节流间隔

// 不同类型的状态检查节流间隔（毫秒）
const THROTTLE_INTERVALS = {
  node: 3000,      // 节点状态检查
  service: 2000,   // 服务状态检查
  combined: 5000   // 组合状态检查
};

/**
 * 获取节点连接数据
 * @returns {Promise<Array>} 节点连接数据
 */
async function fetchNodeConnections() {
  try {
    if (!nodeConnectionMonitor) {
      return [];
    }
    return await nodeConnectionMonitor.getActiveConnections();
  } catch (error) {
    logger.error('获取节点连接数据失败:', error);
    return [];
  }
}

/**
 * 获取服务状态
 * @returns {Promise<Object>} 服务状态
 */
async function getServiceStatus() {
  try {
    const status = singbox.getStatus();
    const isRunning = singbox.isRunning();
    
    return {
      success: true,
      isRunning,
      processCount: status.processCount,
      processes: status.processes,
      processDetails: status.processDetails,
      lastCheckedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('获取服务状态失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 获取节点状态
 * @returns {Promise<Object>} 节点状态
 */
async function getNodeStatus() {
  try {
    // 获取节点连接数据
    const nodeConnections = await fetchNodeConnections();
    
    return {
      success: true,
      connections: nodeConnections,
      lastCheckedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('获取节点状态失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 获取组合状态
 * @returns {Promise<Object>} 组合状态
 */
async function getCombinedStatus() {
  try {
    const [serviceStatus, nodeStatus] = await Promise.all([
      getServiceStatus(),
      getNodeStatus()
    ]);
    
    return {
      success: true,
      service: serviceStatus,
      node: nodeStatus,
      lastCheckedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('获取组合状态失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 执行状态检查
 * @param {String} type 状态类型
 * @returns {Promise<Object>} 状态检查结果
 */
async function checkStatus(type) {
  // 根据类型获取不同的状态
  switch (type) {
    case 'node':
      return await getNodeStatus();
    case 'service':
      return await getServiceStatus();
    case 'combined':
    default:
      return await getCombinedStatus();
  }
}

// 状态检查处理程序对象
const handlers = {
  // 统一状态检查接口
  'unified-status': async (event, type = 'combined', force = false) => {
    try {
      // 参数校验
      const validatedType = StatusTypeSchema.parse(type);
      
      // 节流控制
      const now = Date.now();
      const lastCheck = statusThrottle.get(validatedType) || 0;
      const throttleInterval = THROTTLE_INTERVALS[validatedType] || DEFAULT_THROTTLE_INTERVAL;
      
      if (!force && now - lastCheck < throttleInterval) {
        logger.debug(`状态检查节流: ${validatedType}, 跳过`);
        return createResponse(true, { 
          throttled: true, 
          message: '状态检查过于频繁，返回缓存结果',
          lastCheckedAt: new Date(lastCheck).toISOString(),
          nextAllowedAt: new Date(lastCheck + throttleInterval).toISOString()
        });
      }
      
      // 更新节流时间戳
      statusThrottle.set(validatedType, now);
      
      // 执行状态检查
      const status = await checkStatus(validatedType);
      return createResponse(status.success, status);
    } catch (error) {
      if (error instanceof zod.ZodError) {
        return createResponse(false, null, { 
          message: '无效的状态类型，支持的类型: node, service, combined' 
        });
      }
      
      logger.error('状态检查失败:', error);
      return createResponse(false, null, error);
    }
  }
};

// 导出处理程序
module.exports = {
  handlers,
  fetchNodeConnections,
  getServiceStatus,
  getNodeStatus,
  getCombinedStatus,
  checkStatus
}; 