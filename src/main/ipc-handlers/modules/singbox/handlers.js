/**
 * SingBox相关IPC处理程序
 */
const logger = require('../../../../utils/logger');
const singbox = require('../../../../utils/sing-box');
const profileManager = require('../../../profile-manager');
const coreDownloader = require('../../../core-downloader');
const fs = require('fs');
const { getMainWindow, createResponse, sendToMainWindow } = require('../../core/utils');

// SingBox相关处理程序对象
const handlers = {
  // 检查sing-box是否安装
  'singbox-check-installed': async () => {
    return createResponse(true, { installed: singbox.checkInstalled() });
  },
  
  // 获取sing-box版本
  'singbox-get-version': async () => {
    try {
      const versionInfo = await singbox.getVersion();
      return versionInfo;
    } catch (error) {
      logger.error('获取sing-box版本失败:', error);
      return createResponse(false, null, error);
    }
  },
  
  // 获取sing-box状态
  'singbox-get-status': async () => {
    try {
      const status = singbox.getStatus();
      return createResponse(true, {
        isRunning: singbox.isRunning(),
        processCount: status.processCount,
        processes: status.processes,
        processDetails: status.processDetails,
        proxyConfig: singbox.proxyConfig
      });
    } catch (error) {
      logger.error('获取sing-box状态失败:', error);
      return createResponse(false, null, error);
    }
  },
  
  // 获取规则集
  'get-rule-sets': async () => {
    try {
      const config = profileManager.getCurrentConfig();
      return createResponse(true, { ruleSets: config?.rule_sets || [] });
    } catch (error) {
      logger.error('获取规则集失败:', error);
      return createResponse(false, null, error);
    }
  },
  
  // 获取节点组
  'get-node-groups': async () => {
    try {
      const config = profileManager.getCurrentConfig();
      return createResponse(true, { nodeGroups: config?.outbounds || [] });
    } catch (error) {
      logger.error('获取节点组失败:', error);
      return createResponse(false, null, error);
    }
  },
  
  // 检查配置
  'singbox-check-config': async (event, { configPath }) => {
    try {
      return await singbox.checkConfig(configPath);
    } catch (error) {
      logger.error('检查配置错误:', error);
      return createResponse(false, null, error);
    }
  },
  
  // 格式化配置
  'singbox-format-config': async (event, { configPath }) => {
    try {
      return await singbox.formatConfig(configPath);
    } catch (error) {
      logger.error('格式化配置错误:', error);
      return createResponse(false, null, error);
    }
  },
  
  // 启动sing-box内核
  'singbox-start-core': async (event, options) => {
    try {
      let configPath;
      if (options && options.configPath) {
        // 创建配置副本
        const originalPath = options.configPath;
        if (fs.existsSync(originalPath)) {
          profileManager.updateConfigCopy();
          configPath = profileManager.getConfigCopyPath();
        } else {
          configPath = originalPath;
        }
      } else {
        // 使用默认配置的副本
        configPath = profileManager.getConfigCopyPath();
      }
      
      const proxyConfig = options && options.proxyConfig ? options.proxyConfig : {
        host: '127.0.0.1',
        port: 7890,
        enableSystemProxy: true  // 默认启用系统代理
      };
      
      // 启动内核前检查版本
      logger.info('启动内核前检查版本');
      const versionResult = await singbox.getVersion();
      if (versionResult.success) {
        sendToMainWindow('core-version-update', {
          version: versionResult.version,
          fullOutput: versionResult.fullOutput
        });
      }
      
      logger.info(`启动sing-box内核，使用配置文件副本: ${configPath}`);
      
      // 启动内核
      const result = await singbox.startCore({ 
        configPath,
        proxyConfig,
        enableSystemProxy: proxyConfig.enableSystemProxy
      });
      
      return result;
    } catch (error) {
      logger.error('启动sing-box内核失败:', error);
      return createResponse(false, null, error);
    }
  },
  
  // 停止sing-box内核
  'singbox-stop-core': async () => {
    try {
      logger.info('停止sing-box内核');
      return await singbox.stopCore();
    } catch (error) {
      logger.error('停止sing-box内核失败:', error);
      return createResponse(false, null, error);
    }
  },
  
  // 下载sing-box核心
  'singbox-download-core': async () => {
    try {
      const mainWindow = getMainWindow();
      return await coreDownloader.downloadCore(mainWindow);
    } catch (error) {
      logger.error('下载sing-box核心失败:', error);
      return createResponse(false, null, error);
    }
  },
  
  // 下载核心
  'download-core': async (event) => {
    try {
      const mainWindow = getMainWindow();
      const result = await coreDownloader.downloadCore(mainWindow);
      // 如果下载成功，尝试获取版本信息
      if (result.success) {
        setTimeout(async () => {
          const versionInfo = await singbox.getVersion();
          if (versionInfo.success) {
            // 通知渲染进程更新版本信息
            sendToMainWindow('core-version-update', {
              version: versionInfo.version,
              fullOutput: versionInfo.fullOutput
            });
          }
        }, 500); // 稍微延迟以确保文件已正确解压并可访问
      }
      return result;
    } catch (error) {
      logger.error('下载内核处理器错误:', error);
      return createResponse(false, null, error);
    }
  },
  
  // 注册sing-box运行服务的IPC处理程序
  'singbox-run': async (event, args) => {
    try {
      const { configPath } = args;
      
      // 检查是否已有运行的进程
      if (singbox.process) {
        logger.info('检测到已有运行的sing-box进程，正在终止');
        try {
          await singbox.stopCore();
        } catch (e) {
          logger.error('终止旧进程失败:', e);
        }
      }
      
      // 定义输出回调，将sing-box输出传递给渲染进程
      const outputCallback = (data) => {
        sendToMainWindow('singbox-output', data);
      };
      
      // 定义退出回调
      const exitCallback = (code, error) => {
        logger.info(`sing-box进程退出，退出码: ${code}${error ? ', 错误: ' + error : ''}`);
        sendToMainWindow('singbox-exit', { code, error });
      };
      
      // 解析配置文件中的端口
      const configInfo = singbox.parseConfigFile(configPath);
      if (configInfo && configInfo.port) {
        logger.info(`从配置文件解析到代理端口: ${configInfo.port}`);
        // 只更新端口，保持其他设置不变
        singbox.setProxyConfig({
          ...singbox.proxyConfig,
          port: configInfo.port
        });
      }
      
      logger.info(`启动sing-box服务，配置文件: ${configPath}, 代理端口: ${singbox.proxyConfig.port}`);
      
      const result = await singbox.run(configPath, outputCallback, exitCallback);
      return result;
    } catch (error) {
      logger.error('运行服务错误:', error);
      return createResponse(false, null, error);
    }
  },
  
  // 停止运行的sing-box服务
  'singbox-stop': async () => {
    try {
      // 先禁用系统代理
      await singbox.disableSystemProxy();
      
      return await singbox.stopCore();
    } catch (error) {
      logger.error('停止服务错误:', error);
      return createResponse(false, null, error);
    }
  }
};

// 导出所有处理程序
module.exports = {
  handlers
}; 