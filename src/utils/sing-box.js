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
const { getAppDataDir } = require('./paths');

/**
 * 获取应用数据目录 - 不再使用这个函数，改用paths模块中的统一实现
 * @deprecated 请使用paths模块中的getAppDataDir函数
 */
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
  }

  /**
   * 初始化sing-box模块
   * @param {Object} options 初始化选项
   * @returns {Boolean} 是否已安装
   */
  init(options = {}) {
    if (this.initialized) return this.checkInstalled();
    
    // 使用推荐的应用数据目录
    this.appDataDir = getAppDataDir();
    
    // 创建bin目录
    const binDir = path.join(this.appDataDir, 'bin');
    if (!fs.existsSync(binDir)) {
      try {
        fs.mkdirSync(binDir, { recursive: true });
      } catch (error) {
        logger.error(`[SingBox] 创建bin目录失败: ${error.message}`);
      }
    }
    
    // 根据不同平台设置二进制文件路径
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
        configPath: configPath
      };
      
      logger.info(`sing-box进程已启动，PID: ${pid}`);
      
      // 添加输出处理
      child.stdout.on('data', (data) => {
        const output = data.toString();
        // 通过日志系统记录SingBox输出
        logger.singbox(output);
        // 回调函数传递输出
        if (outputCallback && typeof outputCallback === 'function') {
          outputCallback(output);
        }
      });
      
      child.stderr.on('data', (data) => {
        const output = data.toString();
        // 分析输出内容来决定日志类型
        // sing-box的大多数输出都以时间戳+INFO开头，即使从stderr输出
        if (output.includes('ERROR') || output.includes('error') || output.includes('Error')) {
          // 真正的错误日志
          logger.error(`SingBox错误: ${output}`);
        } else {
          // 普通日志
          logger.singbox(output);
        }
        
        // 回调函数传递输出
        if (outputCallback && typeof outputCallback === 'function') {
          outputCallback(output);
        }
      });
      
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
      // 首先停止已存在的进程
      if (this.processHandlers.size > 0) {
        logger.info('[SingBox] 启动前停止现有进程');
        await this.stopCore();
      }
      
      const configPath = options.configPath;
      if (!configPath) {
        return { success: false, error: '没有指定配置文件' };
      }
      
      if (!fs.existsSync(configPath)) {
        return { success: false, error: `配置文件不存在: ${configPath}` };
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
      
      // 定义输出回调
      const outputCallback = (data) => {
        if (this.outputCallback) this.outputCallback(data);
      };
      
      // 定义退出回调
      const exitCallback = (code, error) => {
        logger.info(`[SingBox] 进程退出，退出码: ${code}${error ? ', 错误: ' + error : ''}`);
        
        // 清理进程记录
        this.processHandlers.clear();
        this.process = null;
        
        // 禁用系统代理
        this.disableSystemProxy().catch(err => {
          logger.error('[SingBox] 禁用系统代理失败:', err);
        });
        
        // 触发状态回调
        this.triggerStatusCallback(false);
        
        if (this.exitCallback) this.exitCallback({ code, error });
      };
      
      // 执行sing-box run命令
      const result = await this.run(configPath, outputCallback, exitCallback);
      
      if (result.success) {
        logger.info('[SingBox] 启动成功');
        
        // 设置系统代理
        if (this.proxyConfig.enableSystemProxy) {
          logger.info(`[SingBox] 正在设置系统代理: ${this.proxyConfig.host}:${this.proxyConfig.port}`);
          await this.enableSystemProxy();
        } else {
          logger.info('[SingBox] 未启用系统代理');
        }
        
        // 触发状态回调
        this.triggerStatusCallback(true);
      }
      
      return result;
    } catch (error) {
      const errorMsg = `启动sing-box核心服务失败: ${error.message}`;
      logger.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  }
  
  /**
   * 停止内核服务
   * @returns {Object} 停止结果
   */
  async stopCore() {
    try {
      // 禁用系统代理
      await this.disableSystemProxy();
      
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
      
      // 触发状态回调
      this.triggerStatusCallback(false);
      
      return { success: true, message: '已停止所有sing-box进程' };
    } catch (error) {
      logger.error('[SingBox] 停止进程失败:', error);
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
      const proxyServer = `${host}:${port}`;
      logger.info(`[SingBox] 启用系统代理: ${proxyServer}`);
      
      const result = await systemProxy.enableProxy(proxyServer);
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
      
      const result = await systemProxy.disableProxy();
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
    
    // 更新状态对象
    if (this.status) {
      this.status.isRunning = false;
    }
    
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
}

// 导出单例
module.exports = new SingBox(); 