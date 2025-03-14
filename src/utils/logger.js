/**
 * 日志管理工具
 * 用于收集和转发日志到Activity中
 */

const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { app } = require('electron');

class Logger {
  constructor() {
    this.enabled = true;
    this.logDir = path.join(os.homedir(), 'AppData', 'Roaming', 'lvory', 'logs');
    this.logFile = path.join(this.logDir, `log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
    this.mainWindow = null;
    
    // 确保日志目录存在
    this.ensureLogDirectory();
    
    // 日志缓存，用于保存历史记录和发送到前端
    this.logHistory = [];
    this.maxLogHistory = 1000; // 最大保存的日志条数
    
    // 初始化消息
    this.info('日志系统初始化完成');
  }
  
  /**
   * 确保日志目录存在
   */
  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
        console.log(`创建日志目录: ${this.logDir}`);
      }
    } catch (error) {
      console.error(`创建日志目录失败: ${error.message}`);
    }
  }
  
  /**
   * 设置主窗口
   * @param {BrowserWindow} window Electron主窗口
   */
  setMainWindow(window) {
    this.mainWindow = window;
    this.info('主窗口已连接到日志系统');
  }
  
  /**
   * 记录日志并发送到Activity
   * @param {String} type 日志类型
   * @param {String} message 日志消息
   * @param {Object} data 额外数据
   */
  log(type, message, data = {}) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      type,
      timestamp,
      message,
      data
    };
    
    // 控制台输出
    console.log(`[${timestamp}] [${type}] ${message}`);
    
    // 写入文件
    this.writeToFile(logEntry);
    
    // 添加到历史记录
    this.addToHistory(logEntry);
    
    // 发送到渲染进程
    this.sendToRenderer(logEntry);
  }
  
  /**
   * 写入日志文件
   * @param {Object} logEntry 日志条目
   */
  writeToFile(logEntry) {
    try {
      const logLine = `[${logEntry.timestamp}] [${logEntry.type}] ${logEntry.message}\n`;
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error(`写入日志文件失败: ${error.message}`);
    }
  }
  
  /**
   * 发送日志到渲染进程
   * @param {Object} logEntry 日志条目
   */
  sendToRenderer(logEntry) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('activity-log', logEntry);
    }
  }
  
  /**
   * 记录信息日志
   * @param {String} message 日志消息
   * @param {Object} data 额外数据
   */
  info(message, data = {}) {
    this.log('INFO', message, data);
  }
  
  /**
   * 记录警告日志
   * @param {String} message 日志消息
   * @param {Object} data 额外数据
   */
  warn(message, data = {}) {
    this.log('WARN', message, data);
  }
  
  /**
   * 记录错误日志
   * @param {String} message 日志消息
   * @param {Object} data 额外数据
   */
  error(message, data = {}) {
    this.log('ERROR', message, data);
  }
  
  /**
   * 记录sing-box日志
   * @param {String} message 日志消息
   * @param {Object} data 额外数据
   */
  singbox(message, data = {}) {
    this.log('SINGBOX', message, data);
  }
  
  /**
   * 记录系统日志
   * @param {String} message 日志消息
   * @param {Object} data 额外数据
   */
  system(message, data = {}) {
    this.log('SYSTEM', message, data);
  }
  
  /**
   * 记录网络日志
   * @param {String} message 日志消息
   * @param {Object} data 额外数据
   */
  network(message, data = {}) {
    this.log('NETWORK', message, data);
  }
  
  /**
   * 添加日志到历史记录
   * @param {Object} logEntry - 日志条目
   */
  addToHistory(logEntry) {
    this.logHistory.push(logEntry);
    
    // 限制历史记录大小
    if (this.logHistory.length > this.maxLogHistory) {
      this.logHistory.shift();
    }
  }
  
  /**
   * 获取日志历史
   * @returns {Array} 日志历史记录
   */
  getHistory() {
    return this.logHistory;
  }
  
  /**
   * 清除日志历史
   */
  clearHistory() {
    this.logHistory = [];
    return { success: true };
  }
  
  // 输出启动日志
  logStartup() {
    console.log('==================================================');
    console.log('  LVORY 应用程序启动');
    console.log('==================================================');
    console.log('  时间: ' + new Date().toLocaleString());
    console.log('  平台: ' + process.platform);
    console.log('  Node.js: ' + process.version);
    console.log('  Electron: ' + process.versions.electron);
    console.log('==================================================');
    
    this.info('LVORY 应用程序启动');
    this.info('初始化日志系统');
  }
}

// 导出单例
module.exports = new Logger(); 