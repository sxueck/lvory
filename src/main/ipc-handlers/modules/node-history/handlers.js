/**
 * 节点历史数据相关IPC处理程序
 */
const logger = require('../../../../utils/logger');
const nodeHistoryManager = require('../../../data-managers/node-history-manager');
const { createResponse } = require('../../core/utils');

// 处理程序对象
const handlers = {
  // 获取指定节点的历史数据
  'get-node-history': async (event, nodeTag) => {
    try {
      const history = await nodeHistoryManager.getNodeHistory(nodeTag);
      return createResponse(true, history);
    } catch (error) {
      logger.error(`获取节点历史数据失败: ${error.message}`);
      return createResponse(false, null, error);
    }
  },

  // 检查节点历史数据功能是否启用
  'is-node-history-enabled': () => {
    return createResponse(true, { enabled: nodeHistoryManager.isHistoryEnabled() });
  },

  // 加载所有节点历史数据
  'load-all-node-history': () => {
    try {
      const data = nodeHistoryManager.loadAllHistoryData();
      return createResponse(true, data);
    } catch (error) {
      logger.error(`加载所有节点历史数据失败: ${error.message}`);
      return createResponse(false, null, error);
    }
  },
  
  // 获取指定节点的累计流量数据
  'get-node-total-traffic': async (event, nodeTag) => {
    try {
      const traffic = await nodeHistoryManager.getTotalTraffic(nodeTag);
      return createResponse(true, traffic);
    } catch (error) {
      logger.error(`获取节点累计流量数据失败: ${error.message}`);
      return createResponse(false, null, error);
    }
  },
  
  // 获取所有节点的累计流量数据
  'get-all-nodes-total-traffic': () => {
    try {
      const data = nodeHistoryManager.getAllTotalTraffic();
      return createResponse(true, data);
    } catch (error) {
      logger.error(`获取所有节点累计流量数据失败: ${error.message}`);
      return createResponse(false, null, error);
    }
  },
  
  // 重置节点累计流量数据
  'reset-node-total-traffic': async (event, nodeTag) => {
    try {
      const result = await nodeHistoryManager.resetTotalTraffic(nodeTag);
      return createResponse(true, result);
    } catch (error) {
      logger.error(`重置节点累计流量数据失败: ${error.message}`);
      return createResponse(false, null, error);
    }
  }
};

// 导出处理程序
module.exports = {
  handlers
}; 