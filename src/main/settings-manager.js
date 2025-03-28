const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { getAppDataDir } = require('../utils/paths');
const nodeHistoryManager = require('./data-managers/node-history-manager');

class SettingsManager {
  constructor() {
    this.settings = {
      proxyPort: '7890',
      apiAddress: '127.0.0.1:9090',
      allowLan: false,
      tunMode: false,
      autoStart: false,
      autoRestart: false,
      checkUpdateOnBoot: true,
      
      // Nodes 相关设置
      nodeAdvancedMonitoring: false,
      nodeExitStatusMonitoring: false,
      nodeExitIPPurity: false,
      keepNodeTrafficHistory: false, // 新增保留节点流量历史数据设置
      
      // 多云互联设置
      cloudInterconnection: false,
      backendAddress: '',
      
      // 高级设置
      animationEffect: true,
      gpuAcceleration: false,
      kernelWatchdog: true,
      usePrivateProtocol: false,
      logRotationPeriod: 7,
      extraLogSaving: false,
      language: 'zh_CN' // 默认语言：中文
    };
  }

  // 加载设置
  async loadSettings() {
    try {
      const appDataDir = getAppDataDir();
      const settingsPath = path.join(appDataDir, 'settings.json');
      
      if (!fs.existsSync(settingsPath)) {
        return this.settings;
      }
      
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      const savedSettings = JSON.parse(settingsData);
      
      // 合并保存的设置和默认设置
      this.settings = {
        ...this.settings,
        ...savedSettings
      };
      
      // 同步开机自启动状态
      await this.syncAutoLaunch();
      
      // 同步节点历史数据设置
      nodeHistoryManager.setEnabled(this.settings.keepNodeTrafficHistory);
      
      logger.info('设置已加载');
      return this.settings;
    } catch (error) {
      logger.error('加载设置失败:', error);
      return this.settings;
    }
  }

  // 保存设置
  async saveSettings(settings) {
    try {
      const appDataDir = getAppDataDir();
      const settingsPath = path.join(appDataDir, 'settings.json');
      
      // 更新内存中的设置
      this.settings = {
        ...this.settings,
        ...settings
      };
      
      // 保存到文件
      fs.writeFileSync(settingsPath, JSON.stringify(this.settings, null, 2));
      
      // 如果设置中包含autoStart，同步开机自启动状态
      if ('autoStart' in settings) {
        await this.setAutoLaunch(settings.autoStart);
      }
      
      // 如果设置中包含keepNodeTrafficHistory，更新节点历史数据管理器的设置
      if ('keepNodeTrafficHistory' in settings) {
        nodeHistoryManager.setEnabled(settings.keepNodeTrafficHistory);
      }
      
      logger.info('设置已保存');
      return { success: true };
    } catch (error) {
      logger.error('保存设置失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 获取当前设置
  getSettings() {
    return this.settings;
  }

  // 设置开机自启动
  async setAutoLaunch(enable) {
    try {
      if (enable) {
        app.setLoginItemSettings({
          openAtLogin: true,
          path: app.getPath('exe'),
          args: []
        });
      } else {
        app.setLoginItemSettings({
          openAtLogin: false
        });
      }
      
      // 更新内存中的设置
      this.settings.autoStart = enable;
      
      logger.info(`开机自启动已${enable ? '启用' : '禁用'}`);
      return { success: true };
    } catch (error) {
      logger.error('设置开机自启动失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 获取开机自启动状态
  async getAutoLaunch() {
    try {
      const settings = app.getLoginItemSettings();
      return { success: true, enabled: settings.openAtLogin };
    } catch (error) {
      logger.error('获取开机自启动状态失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 同步开机自启动状态
  async syncAutoLaunch() {
    try {
      const { enabled } = await this.getAutoLaunch();
      this.settings.autoStart = enabled;
    } catch (error) {
      logger.error('同步开机自启动状态失败:', error);
    }
  }
}

// 创建单例实例
const settingsManager = new SettingsManager();
module.exports = settingsManager; 