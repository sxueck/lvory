/**
 * sing-box 执行工具模块
 * 封装所有与sing-box内核相关的操作
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const systemProxy = require('./system-proxy');
const logger = require('./logger');
const os = require('os');
const { getAppDataDir, getBinDir } = require('./paths');

class SingBox {
  constructor() {
    this.binPath = '';
    this.appDataDir = '';
    this.initialized = false;
    this.processHandlers = new Map(); // 存储运行中的进程及其处理程序
    this.outputCallback = null;
    this.exitCallback = null;
    this.statusCallback = null; // 添加状态回调
    this.process = null; // 存储当前运行的进程
    this.proxyConfig = {
      host: '127.0.0.1',
      port: 7890,
      enableSystemProxy: true
    };
    
    // 添加全局状态管理
    this.globalState = {
      isRunning: false,
      isInitialized: false,
      lastError: null,
      startTime: null,
      connectionMonitor: {
        enabled: false,
        retryCount: 0,
        maxRetries: 5,
        retryDelay: 3000,
        lastRetryTime: null
      }
    };
    
    // 状态监听器集合
    this.stateListeners = new Set();
    
    // 自动重启配置
    this.autoRestart = {
      enabled: false,
      maxAttempts: 3,
      attemptDelay: 5000,
      currentAttempts: 0
    };
  }

  /**
   * 初始化sing-box模块
   * @param {Object} options 初始化选项
   * @returns {Boolean} 是否已安装
   */
  init(options = {}) {
    if (this.initialized) return this.checkInstalled();
    this.appDataDir = getAppDataDir();
    const binDir = getBinDir();
    
    if (process.platform === 'win32') {
      this.binPath = path.join(binDir, 'sing-box.exe');
    } else if (process.platform === 'darwin') {
      this.binPath = path.join(binDir, 'sing-box');
    } else {
      this.binPath = path.join(binDir, 'sing-box');
    }
    
    // 合并代理配置
    if (options.proxyConfig) {
      this.proxyConfig = { ...this.proxyConfig, ...options.proxyConfig };
    }
    
    logger.info(`[SingBox] 初始化，可执行文件路径: ${this.binPath}`);
    this.initialized = true;
    
    return this.checkInstalled();
  }

  /**
   * 设置代理配置
   * @param {Object} config 代理配置
   */
  setProxyConfig(config) {
    if (config) {
      this.proxyConfig = { ...this.proxyConfig, ...config };
    }
  }

  /**
   * 添加状态监听器
   * @param {Function} listener 状态变化监听器
   */
  addStateListener(listener) {
    if (typeof listener === 'function') {
      this.stateListeners.add(listener);
      logger.info(`[SingBox] 添加状态监听器，当前监听器数量: ${this.stateListeners.size}`);
    }
  }

  /**
   * 移除状态监听器
   * @param {Function} listener 要移除的监听器
   */
  removeStateListener(listener) {
    this.stateListeners.delete(listener);
    logger.info(`[SingBox] 移除状态监听器，当前监听器数量: ${this.stateListeners.size}`);
  }

  /**
   * 通知所有状态监听器
   * @param {Object} stateChange 状态变化信息
   */
  notifyStateListeners(stateChange) {
    const notification = {
      ...stateChange,
      timestamp: Date.now(),
      globalState: { ...this.globalState }
    };
    
    logger.info(`[SingBox] 通知状态变化: ${JSON.stringify(stateChange)}`);
    
    this.stateListeners.forEach(listener => {
      try {
        listener(notification);
      } catch (error) {
        logger.error(`[SingBox] 状态监听器执行失败: ${error.message}`);
      }
    });
  }

  /**
   * 更新全局状态
   * @param {Object} updates 状态更新
   */
  updateGlobalState(updates) {
    const oldState = { ...this.globalState };
    this.globalState = { ...this.globalState, ...updates };
    
    // 通知状态变化
    this.notifyStateListeners({
      type: 'state-update',
      oldState,
      newState: { ...this.globalState },
      changes: updates
    });
  }

  /**
   * 获取全局状态
   */
  getGlobalState() {
    return { ...this.globalState };
  }

  /**
   * 重置连接监控状态
   */
  resetConnectionMonitor() {
    this.updateGlobalState({
      connectionMonitor: {
        enabled: false,
        retryCount: 0,
        maxRetries: 5,
        retryDelay: 3000,
        lastRetryTime: null
      }
    });
    
    this.notifyStateListeners({
      type: 'connection-monitor-reset',
      message: '连接监控已重置'
    });
  }

  /**
   * 启用连接监控
   */
  enableConnectionMonitor() {
    this.updateGlobalState({
      connectionMonitor: {
        ...this.globalState.connectionMonitor,
        enabled: true,
        retryCount: 0
      }
    });
    
    this.notifyStateListeners({
      type: 'connection-monitor-enabled',
      message: '连接监控已启用'
    });
  }

  /**
   * 禁用连接监控
   */
  disableConnectionMonitor() {
    this.updateGlobalState({
      connectionMonitor: {
        ...this.globalState.connectionMonitor,
        enabled: false
      }
    });
    
    this.notifyStateListeners({
      type: 'connection-monitor-disabled',
      message: '连接监控已禁用'
    });
  }

  /**
   * 记录连接重试
   */
  recordConnectionRetry() {
    const monitor = this.globalState.connectionMonitor;
    const newRetryCount = monitor.retryCount + 1;
    
    this.updateGlobalState({
      connectionMonitor: {
        ...monitor,
        retryCount: newRetryCount,
        lastRetryTime: Date.now()
      }
    });
    
    if (newRetryCount >= monitor.maxRetries) {
      logger.warn(`[SingBox] 连接重试次数已达到上限 (${monitor.maxRetries})`);
      this.disableConnectionMonitor();
      
      this.notifyStateListeners({
        type: 'connection-monitor-max-retries',
        message: `连接重试次数已达到上限 (${monitor.maxRetries})，停止重试`
      });
    }
  }

  /**
   * 设置自动重启配置
   * @param {Object} config 自动重启配置
   */
  setAutoRestart(config) {
    this.autoRestart = { ...this.autoRestart, ...config };
    logger.info(`[SingBox] 自动重启配置已更新: ${JSON.stringify(this.autoRestart)}`);
  }

  /**
   * 尝试自动重启
   * @param {Object} options 启动选项
   */
  async attemptAutoRestart(options) {
    if (!this.autoRestart.enabled) return;
    
    this.autoRestart.currentAttempts++;
    
    logger.info(`[SingBox] 尝试自动重启 (第${this.autoRestart.currentAttempts}/${this.autoRestart.maxAttempts}次)`);
    
    this.notifyStateListeners({
      type: 'auto-restart-attempt',
      attempt: this.autoRestart.currentAttempts,
      maxAttempts: this.autoRestart.maxAttempts,
      message: `尝试自动重启 (第${this.autoRestart.currentAttempts}/${this.autoRestart.maxAttempts}次)`
    });
    
    setTimeout(async () => {
      try {
        const result = await this.startCore(options);
        if (!result.success) {
          logger.error(`[SingBox] 自动重启失败: ${result.error}`);
          
          if (this.autoRestart.currentAttempts >= this.autoRestart.maxAttempts) {
            this.notifyStateListeners({
              type: 'auto-restart-failed',
              message: '自动重启已达到最大尝试次数，停止重启'
            });
          }
        } else {
          logger.info('[SingBox] 自动重启成功');
          this.autoRestart.currentAttempts = 0;
          
          this.notifyStateListeners({
            type: 'auto-restart-success',
            message: '自动重启成功'
          });
        }
      } catch (error) {
        logger.error(`[SingBox] 自动重启异常: ${error.message}`);
      }
    }, this.autoRestart.attemptDelay);
  }

  /**
   * 检查sing-box是否已安装
   * @returns {Boolean} 是否已安装
   */
  checkInstalled() {
    try {
      const exists = fs.existsSync(this.binPath);
      logger.info(`[SingBox] 检查安装状态: ${exists ? '已安装' : '未安装'}`);
      return exists;
    } catch (error) {
      logger.error(`[SingBox] 检查安装状态失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 解析配置文件并提取代理端口
   * @param {String} configPath 配置文件路径
   * @returns {Object} 解析结果，包含端口信息
   */
  parseConfigFile(configPath) {
    try {
      if (!fs.existsSync(configPath)) {
        logger.error(`[SingBox] 配置文件不存在: ${configPath}`);
        return null;
      }

      // 读取配置文件
      const configContent = fs.readFileSync(configPath, 'utf8');
      let config;
      
      try {
        config = JSON.parse(configContent);
      } catch (e) {
        logger.error(`[SingBox] 解析配置文件失败: ${e.message}`);
        return null;
      }

      // 提取代理端口信息
      const result = {
        port: this.proxyConfig.port // 默认端口
      };

      // 查找HTTP/SOCKS入站
      if (config.inbounds && Array.isArray(config.inbounds)) {
        logger.info(`[SingBox] 配置文件包含 ${config.inbounds.length} 个入站配置`);
        
        for (const inbound of config.inbounds) {
          logger.info(`[SingBox] 检查入站: 类型=${inbound.type}, 端口=${inbound.listen_port}`);
          
          // 优先查找http入站端口
          if (inbound.type === 'http' || inbound.type === 'mixed') {
            if (inbound.listen_port) {
              result.port = inbound.listen_port;
              logger.info(`[SingBox] 从配置文件解析到HTTP代理端口: ${result.port}`);
              break;
            }
          }
        }

        // 如果没有找到http入站，尝试查找socks入站
        if (result.port === this.proxyConfig.port) {
          for (const inbound of config.inbounds) {
            if (inbound.type === 'socks' || inbound.type === 'mixed') {
              if (inbound.listen_port) {
                result.port = inbound.listen_port;
                logger.info(`[SingBox] 从配置文件解析到SOCKS代理端口: ${result.port}`);
                break;
              }
            }
          }
        }
      } else {
        logger.warn(`[SingBox] 配置文件中没有找到入站配置`);
      }

      return result;
    } catch (error) {
      logger.error(`[SingBox] 解析配置文件出错: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取sing-box版本信息
   * @returns {Promise<Object>} 版本信息
   */
  async getVersion() {
    if (!this.checkInstalled()) {
      return { success: false, error: 'sing-box未安装' };
    }
    
    try {
      logger.info('[SingBox] 开始获取版本信息');
      const result = await this.execute(['version']);
      
      if (result.success) {
        const versionMatch = result.stdout.match(/sing-box version ([0-9]+\.[0-9]+\.[0-9]+)/i);
        const version = versionMatch ? versionMatch[1] : 'unknown';
        logger.info(`[SingBox] 成功获取版本: ${version}`);
        return { 
          success: true, 
          version, 
          fullOutput: result.stdout.trim() 
        };
      } else {
        logger.error(`[SingBox] 获取版本失败: ${result.stderr}`);
        return { 
          success: false, 
          error: result.stderr || '执行版本命令失败',
          exitCode: result.code 
        };
      }
    } catch (error) {
      logger.error(`[SingBox] 获取版本时发生异常: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查配置文件
   * @param {String} configPath 配置文件路径
   * @returns {Promise<Object>} 检查结果
   */
  async checkConfig(configPath) {
    if (!this.checkInstalled()) {
      return { success: false, error: 'sing-box未安装' };
    }
    
    try {
      logger.info(`[SingBox] 检查配置: ${configPath}`);
      return await this.execute(['check', '-c', configPath]);
    } catch (error) {
      logger.error(`[SingBox] 检查配置时发生异常: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 格式化配置文件
   * @param {String} configPath 配置文件路径
   * @returns {Promise<Object>} 格式化结果
   */
  async formatConfig(configPath) {
    if (!this.checkInstalled()) {
      return { success: false, error: 'sing-box未安装' };
    }
    
    try {
      logger.info(`[SingBox] 格式化配置: ${configPath}`);
      return await this.execute(['format', '-c', configPath]);
    } catch (error) {
      logger.error(`[SingBox] 格式化配置时发生异常: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 运行sing-box核心
   * @param {String} configPath 配置文件路径
   * @param {Function} outputCallback 输出回调
   * @param {Function} exitCallback 退出回调
   * @returns {Promise<Object>} 运行结果
   */
  async run(configPath, outputCallback, exitCallback) {
    try {
      logger.info(`[SingBox] 运行sing-box核心，配置文件: ${configPath}`);
      
      if (!this.checkInstalled()) {
        const errorMsg = 'sing-box核心尚未安装，请先安装核心';
        logger.error(`[SingBox] ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
      
      // 检查配置文件是否存在
      if (!fs.existsSync(configPath)) {
        const errorMsg = `配置文件不存在: ${configPath}`;
        logger.error(`[SingBox] ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
      
      // 解析配置文件并更新代理端口
      const configInfo = this.parseConfigFile(configPath);
      if (configInfo && configInfo.port) {
        logger.info(`[SingBox] 从配置文件解析到代理端口: ${configInfo.port}`);
        this.proxyConfig.port = configInfo.port;
      } else {
        logger.warn(`[SingBox] 未能从配置文件解析到代理端口，使用默认端口: ${this.proxyConfig.port}`);
      }
      
      const args = ['run', '-c', configPath];
      logger.info(`[SingBox] 执行命令: ${this.binPath} ${args.join(' ')}`);
      
      // 创建子进程 - 设置工作目录为应用数据目录
      const child = spawn(this.binPath, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: this.appDataDir // 设置工作目录为应用数据目录
      });
      
      // 存储进程信息
      const pid = child.pid;
      this.processHandlers.set(pid, {
        childProcess: child,
        configPath: configPath,
        startTime: new Date(),
        outputCallbacks: outputCallback ? [outputCallback] : [],
        exitCallbacks: exitCallback ? [exitCallback] : []
      });
      
      // 设置为当前活动进程
      this.process = {
        childProcess: child,
        pid: pid,
        configPath: configPath // 保存配置文件路径以便状态恢复
      };
      
      // 处理输出和错误
      if (child.stdout) {
        child.stdout.on('data', (data) => {
          try {
            const output = data.toString();
            logger.debug(`[SingBox] stdout: ${output}`);
            
            // 使用singbox方法记录到活动日志
            logger.singbox(output);
            
            // 处理输出回调
            if (outputCallback && typeof outputCallback === 'function') {
              outputCallback(output);
            }
            
            // 检查并处理tun设备模式的输出
            this.handleTunOutput(output);
          } catch (err) {
            logger.error(`[SingBox] 处理stdout时出错: ${err.message}`);
          }
        });
      }
      
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          try {
            const output = data.toString();
            logger.debug(`[SingBox] stderr: ${output}`);
            
            // 使用singbox方法记录到活动日志
            logger.singbox(output);
            
            // 处理输出回调
            if (outputCallback && typeof outputCallback === 'function') {
              outputCallback(output);
            }
          } catch (err) {
            logger.error(`[SingBox] 处理stderr时出错: ${err.message}`);
          }
        });
      }
      
      // 添加退出处理
      child.on('exit', (code) => {
        const exitInfo = `sing-box进程已退出，退出码: ${code}`;
        logger.info(exitInfo);
        
        // 清理状态
        this.cleanupProcess();
        
        // 回调函数传递退出事件
        if (exitCallback && typeof exitCallback === 'function') {
          exitCallback(code);
        }
      });
      
      child.on('error', (error) => {
        const errorMsg = `sing-box进程出错: ${error.message}`;
        logger.error(errorMsg);
        
        // 清理状态
        this.cleanupProcess();
        
        // 回调函数传递错误事件
        if (exitCallback && typeof exitCallback === 'function') {
          exitCallback(-1, error.message);
        }
      });
      
      return {
        success: true,
        pid: pid
      };
    } catch (error) {
      const errorMsg = `启动sing-box核心失败: ${error.message}`;
      logger.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * 停止运行的sing-box服务
   * @param {Number} pid 进程ID，如果不提供则停止所有进程
   * @returns {Object} 停止结果
   */
  stop(pid) {
    try {
      if (pid && this.processHandlers.has(pid)) {
        // 停止指定进程
        const process = this.processHandlers.get(pid);
        process.childProcess.kill();
        this.processHandlers.delete(pid);
        logger.info(`[SingBox] 已停止进程: ${pid}`);
        return { success: true };
      } else if (!pid) {
        // 停止所有进程
        let count = 0;
        for (const [pid, process] of this.processHandlers.entries()) {
          try {
            process.childProcess.kill();
            this.processHandlers.delete(pid);
            count++;
          } catch (e) {
            logger.error(`[SingBox] 停止进程 ${pid} 失败: ${e.message}`);
          }
        }
        logger.info(`[SingBox] 已停止 ${count} 个进程`);
        return { success: true, count };
      }
      
      return { success: false, error: '没有找到指定的进程' };
    } catch (error) {
      logger.error(`[SingBox] 停止服务时发生异常: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查sing-box是否正在运行
   * @returns {Boolean} 是否正在运行
   */
  isRunning() {
    return this.process !== null && this.processHandlers.size > 0;
  }
  
  /**
   * 设置状态变化回调
   * @param {Function} callback 状态变化回调
   */
  setStatusCallback(callback) {
    this.statusCallback = callback;
  }
  
  /**
   * 触发状态变化回调
   * @param {Boolean} isRunning 是否正在运行
   */
  triggerStatusCallback(isRunning) {
    if (this.statusCallback && typeof this.statusCallback === 'function') {
      this.statusCallback(isRunning);
    }
  }

  /**
   * 启动内核服务
   * @param {Object} options 启动选项
   * @param {string} options.configPath 配置文件路径
   * @param {Object} options.proxyConfig 代理配置
   * @param {boolean} options.enableSystemProxy 是否启用系统代理
   * @returns {Promise<Object>} 启动结果
   */
  async startCore(options = {}) {
    try {
      // 重置自动重启计数
      this.autoRestart.currentAttempts = 0;
      
      // 首先停止已存在的进程
      if (this.processHandlers.size > 0) {
        logger.info('[SingBox] 启动前停止现有进程');
        await this.stopCore();
      }
      
      const configPath = options.configPath;
      if (!configPath) {
        this.updateGlobalState({ 
          lastError: '没有指定配置文件',
          isRunning: false 
        });
        return { success: false, error: '没有指定配置文件' };
      }
      
      if (!fs.existsSync(configPath)) {
        const error = `配置文件不存在: ${configPath}`;
        this.updateGlobalState({ 
          lastError: error,
          isRunning: false 
        });
        return { success: false, error };
      }
      
      // 读取配置中的端口号
      const configInfo = this.parseConfigFile(configPath);
      if (configInfo && configInfo.port) {
        logger.info(`[SingBox] 从配置文件解析到代理端口: ${configInfo.port}`);
        this.proxyConfig.port = configInfo.port;
      }
      
      if (options.proxyConfig) {
        this.proxyConfig = { ...this.proxyConfig, ...options.proxyConfig };
      }
      
      logger.info(`[SingBox] 启动sing-box，配置文件: ${configPath}, 代理端口: ${this.proxyConfig.port}`);
      
      // 更新启动状态
      this.updateGlobalState({
        isRunning: false, // 启动中，还未完全运行
        isInitialized: true,
        lastError: null,
        startTime: Date.now()
      });
      
      // 定义输出回调
      const outputCallback = (data) => {
        if (this.outputCallback) this.outputCallback(data);
      };
      
      // 定义退出回调
      const exitCallback = (code, error) => {
        logger.info(`[SingBox] 进程退出，退出码: ${code}${error ? ', 错误: ' + error : ''}`);
        
        // 更新状态为停止
        this.updateGlobalState({
          isRunning: false,
          lastError: error || (code !== 0 ? `进程异常退出，退出码: ${code}` : null)
        });
        
        // 清理进程记录
        this.processHandlers.clear();
        this.process = null;
        
        // 通知核心停止事件
        this.notifyStateListeners({
          type: 'core-stopped',
          exitCode: code,
          error: error,
          message: '内核服务已停止'
        });
        
        // 禁用系统代理
        this.disableSystemProxy().catch(err => {
          logger.error('[SingBox] 禁用系统代理失败:', err);
        });
        
        // 禁用连接监控
        this.disableConnectionMonitor();
        
        // 触发状态回调
        this.triggerStatusCallback(false);
        
        // 检查是否需要自动重启
        if (this.autoRestart.enabled && this.autoRestart.currentAttempts < this.autoRestart.maxAttempts) {
          this.attemptAutoRestart(options);
        }
        
        if (this.exitCallback) this.exitCallback({ code, error });
      };
      
      // 执行sing-box run命令
      const result = await this.run(configPath, outputCallback, exitCallback);
      
      if (result.success) {
        logger.info('[SingBox] 启动成功');
        
        // 保存配置文件路径到进程信息中
        if (this.process) {
          this.process.configPath = configPath;
        }
        
        // 更新运行状态
        this.updateGlobalState({
          isRunning: true,
          lastError: null
        });
        
        // 通知核心启动事件 - 不自动启用连接监控
        this.notifyStateListeners({
          type: 'core-started',
          configPath: configPath,
          proxyPort: this.proxyConfig.port,
          message: '内核服务已启动'
        });
        
        // 设置系统代理
        if (this.proxyConfig.enableSystemProxy) {
          logger.info(`[SingBox] 正在设置系统代理: ${this.proxyConfig.host}:${this.proxyConfig.port}`);
          await this.enableSystemProxy();
        } else {
          logger.info('[SingBox] 未启用系统代理');
        }
        
        // 触发状态回调
        this.triggerStatusCallback(true);
      } else {
        // 启动失败，更新状态
        this.updateGlobalState({
          isRunning: false,
          lastError: result.error || '启动失败'
        });
        
        this.notifyStateListeners({
          type: 'core-start-failed',
          error: result.error,
          message: '内核服务启动失败'
        });
      }
      
      return result;
    } catch (error) {
      const errorMsg = `启动sing-box核心服务失败: ${error.message}`;
      logger.error(errorMsg);
      
      this.updateGlobalState({
        isRunning: false,
        lastError: errorMsg
      });
      
      this.notifyStateListeners({
        type: 'core-start-error',
        error: errorMsg,
        message: '启动过程中发生异常'
      });
      
      return { success: false, error: errorMsg };
    }
  }
  
  /**
   * 停止内核服务
   * @returns {Promise<Boolean>} 成功返回true，失败返回false
   */
  async stopCore() {
    try {
      logger.info('[SingBox] 开始停止内核服务');
      
      // 通知即将停止
      this.notifyStateListeners({
        type: 'core-stopping',
        message: '正在停止内核服务'
      });
      
      // 禁用连接监控
      this.disableConnectionMonitor();
      
      // 保存停止状态，确保下次启动不会尝试恢复
      try {
        // 修改状态为未运行，然后保存
        await this.saveState();
        logger.info('[SingBox] 已保存停止状态');
      } catch (err) {
        logger.error('[SingBox] 保存停止状态失败:', err);
      }
      
      // 禁用系统代理
      if (this.proxyConfig.enableSystemProxy) {
        logger.info('[SingBox] 禁用系统代理');
        await this.disableSystemProxy();
      }
      
      // 停止所有sing-box进程
      for (const [pid, handler] of this.processHandlers.entries()) {
        logger.info(`[SingBox] 正在停止进程 PID: ${pid}`);
        if (handler && handler.childProcess) {
          try {
            process.kill(pid);
          } catch (e) {
            logger.warn(`[SingBox] 无法终止进程 ${pid}: ${e.message}`);
          }
        }
      }
      
      // 清空进程集合
      this.processHandlers.clear();
      this.process = null;
      
      // 更新全局状态
      this.updateGlobalState({
        isRunning: false,
        lastError: null
      });
      
      // 通知完全停止
      this.notifyStateListeners({
        type: 'core-stopped',
        exitCode: 0,
        message: '内核服务已完全停止'
      });
      
      // 触发状态回调
      this.triggerStatusCallback(false);
      
      return { success: true, message: '已停止所有sing-box进程' };
    } catch (error) {
      logger.error('[SingBox] 停止进程失败:', error);
      
      this.updateGlobalState({
        lastError: error.message
      });
      
      this.notifyStateListeners({
        type: 'core-stop-error',
        error: error.message,
        message: '停止内核服务时发生错误'
      });
      
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 启用系统代理
   * @returns {Promise<Boolean>} 是否成功
   */
  async enableSystemProxy() {
    try {
      const { host, port } = this.proxyConfig;
      logger.info(`[SingBox] 启用系统代理: ${host}:${port}`);
      
      const result = await systemProxy.setGlobalProxy({ host, port });
      if (result) {
        logger.info('[SingBox] 系统代理已启用');
      } else {
        logger.error('[SingBox] 系统代理启用失败');
      }
      
      return result;
    } catch (error) {
      logger.error(`[SingBox] 启用系统代理时发生异常: ${error.message}`);
      return false;
    }
  }
  
  /**
   * 禁用系统代理
   * @returns {Promise<Boolean>} 是否成功
   */
  async disableSystemProxy() {
    try {
      logger.info('[SingBox] 禁用系统代理');
      
      const result = await systemProxy.removeGlobalProxy();
      if (result) {
        logger.info('[SingBox] 系统代理已禁用');
      } else {
        logger.error('[SingBox] 系统代理禁用失败');
      }
      
      return result;
    } catch (error) {
      logger.error(`[SingBox] 禁用系统代理时发生异常: ${error.message}`);
      return false;
    }
  }
  
  /**
   * 获取内核运行状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    try {
      const isRunning = this.processHandlers.size > 0;
      const runningPids = Array.from(this.processHandlers.keys());
      
      let processDetails = [];
      if (isRunning) {
        // 收集每个进程的基本信息
        for (const pid of runningPids) {
          processDetails.push({
            pid,
            uptime: this.processHandlers.has(pid) ? '运行中' : '未知'
          });
        }
      }
      
      return {
        success: true,
        isRunning,
        processCount: this.processHandlers.size,
        processes: runningPids,
        processDetails: processDetails,
        lastCheckedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`[SingBox] 获取状态时发生异常: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 设置输出回调
   * @param {Function} callback 回调函数
   */
  setOutputCallback(callback) {
    this.outputCallback = callback;
  }
  
  /**
   * 设置退出回调
   * @param {Function} callback 回调函数
   */
  setExitCallback(callback) {
    this.exitCallback = callback;
  }

  /**
   * 执行sing-box命令
   * @param {Array} args 命令参数
   * @param {Number} timeout 超时时间(毫秒)
   * @returns {Promise<Object>} 执行结果
   */
  execute(args, timeout = 10000) {
    return new Promise((resolve, reject) => {
      logger.info(`[SingBox] 执行命令: ${this.binPath} ${args.join(' ')}`);
      
      try {
        const childProcess = spawn(this.binPath, args, {
          cwd: path.dirname(this.binPath),
          windowsHide: true
        });
        
        let stdout = '';
        let stderr = '';
        let timeoutId = null;
        
        // 设置超时
        if (timeout > 0) {
          timeoutId = setTimeout(() => {
            try {
              childProcess.kill();
            } catch (e) {}
            reject(new Error(`命令执行超时(${timeout}ms)`));
          }, timeout);
        }
        
        // 处理标准输出
        childProcess.stdout.on('data', (data) => {
          const chunk = data.toString();
          stdout += chunk;
        });
        
        // 处理错误输出
        childProcess.stderr.on('data', (data) => {
          const chunk = data.toString();
          stderr += chunk;
        });
        
        // 处理错误
        childProcess.on('error', (error) => {
          if (timeoutId) clearTimeout(timeoutId);
          reject(error);
        });
        
        // 处理进程结束
        childProcess.on('close', (code) => {
          if (timeoutId) clearTimeout(timeoutId);
          
          if (code === 0) {
            resolve({ success: true, stdout, stderr, code });
          } else {
            resolve({ success: false, code, stdout, stderr });
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // 清理进程相关的状态
  cleanupProcess() {
    if (this.process) {
      try {
        // 尝试终止进程（如果仍在运行）
        this.process.childProcess.kill();
      } catch (e) {
        logger.error(`尝试终止进程失败: ${e.message}`);
      }
    }
    
    // 从processHandlers中移除
    if (this.pid && this.processHandlers.has(this.pid)) {
      this.processHandlers.delete(this.pid);
    }
    
    // 更新状态
    this.process = null;
    this.pid = null;
    this.configPath = null;
    
    // 更新全局状态
    this.updateGlobalState({
      isRunning: false
    });
    
    // 通知进程清理完成
    this.notifyStateListeners({
      type: 'process-cleanup',
      message: '进程状态已清理'
    });
    
    logger.info('进程状态已清理');
  }

  /**
   * 设置主窗口，用于日志传递
   * @param {BrowserWindow} window - Electron的主窗口对象
   */
  setMainWindow(window) {
    this.mainWindow = window;
    logger.info('SingBox模块已连接到主窗口');
  }

  /**
   * 处理TUN设备相关的输出
   * @param {String} output - 进程输出内容
   */
  handleTunOutput(output) {
    // 目前只是一个占位方法，未来可能会处理TUN设备的特殊输出
    // 比如提取TUN接口信息、路由信息等
    if (output && output.includes('tun')) {
      logger.info(`[SingBox] 检测到TUN相关输出: ${output.trim()}`);
    }
  }

  // 保存状态
  async saveState() {
    const state = {
      isRunning: this.isRunning(),
      configPath: this.process?.configPath,
      proxyConfig: this.proxyConfig,
      lastRunTime: new Date().toISOString(),
      isDev: process.env.NODE_ENV === 'development'
    };
    // 懒加载store，避免循环依赖
    const store = require('./store');
    await store.set('singbox.state', state);
  }

  // 加载状态
  async loadState() {
    try {
      if (process.env.NODE_ENV === 'development') {
        logger.info('[SingBox] 开发模式下不加载状态');
        return null;
      }
      
      // 懒加载store，避免循环依赖
      const store = require('./store');
      const state = await store.get('singbox.state');
      
      // 检查是否从开发模式切换到生产模式
      if (state && state.isDev === true && process.env.NODE_ENV !== 'development') {
        logger.info('[SingBox] 从开发模式切换到生产模式，不加载之前的状态');
        return null;
      }
      
      return state;
    } catch (error) {
      logger.error(`[SingBox] 加载状态失败: ${error.message}`);
      return null;
    }
  }
}

// 导出单例
module.exports = new SingBox(); 