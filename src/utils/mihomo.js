/**
 * Mihomo 内核管理器
 * 基于 BaseCore 实现 mihomo 内核的管理功能
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const BaseCore = require('./core-manager/base-core');
const MihomoConfigParser = require('./mihomo/config-parser');
const ProcessManager = require('./sing-box/process-manager');
const StateManager = require('./sing-box/state-manager');
const { CORE_TYPES } = require('../constants/core-types');
const logger = require('./logger');

class Mihomo extends BaseCore {
  constructor() {
    super(CORE_TYPES.MIHOMO);
    this.processManager = new ProcessManager();
    this.stateManager = new StateManager();
    this.configParser = new MihomoConfigParser();
    this.proxyConfig = null;
  }

  /**
   * 启动内核服务
   * @param {Object} options 启动选项
   * @returns {Promise<Object>} 启动结果
   */
  async startCore(options = {}) {
    try {
      if (this.processManager.processHandlers.size > 0) {
        this.log('info', '启动前停止现有进程');
        await this.stopCore();
      }
      
      const configPath = options.configPath;
      if (!configPath) {
        this.stateManager.updateGlobalState({ 
          lastError: '没有指定配置文件',
          isRunning: false 
        });
        return { success: false, error: '没有指定配置文件' };
      }
      
      if (!fs.existsSync(configPath)) {
        const error = `配置文件不存在: ${configPath}`;
        this.stateManager.updateGlobalState({ 
          lastError: error,
          isRunning: false 
        });
        return { success: false, error };
      }

      // 验证配置文件
      const configValidation = this.configParser.validateConfig(configPath);
      if (!configValidation.valid) {
        const error = `配置文件验证失败: ${configValidation.error}`;
        this.stateManager.updateGlobalState({ 
          lastError: error,
          isRunning: false 
        });
        return { success: false, error };
      }

      // 获取二进制文件路径
      const binaryPath = this.getBinaryPath();
      if (!fs.existsSync(binaryPath)) {
        const error = `mihomo 内核不存在: ${binaryPath}`;
        this.stateManager.updateGlobalState({ 
          lastError: error,
          isRunning: false 
        });
        return { success: false, error };
      }

      // 保存代理配置
      this.proxyConfig = options.proxyConfig || {
        host: '127.0.0.1',
        port: 7890,
        enableSystemProxy: false
      };

      // 构建启动参数
      const args = ['-f', configPath];
      if (options.tunMode) {
        // mihomo 的 TUN 模式通过配置文件控制，这里可以添加额外参数
        this.log('info', 'TUN 模式已启用');
      }

      this.log('info', `启动 mihomo 内核，配置文件: ${configPath}`);
      this.log('info', `二进制文件: ${binaryPath}`);
      this.log('info', `启动参数: ${args.join(' ')}`);

      // 启动进程
      const result = await this._startMihomoProcess(binaryPath, args, {
        cwd: path.dirname(configPath),
        env: { ...process.env },
        configPath
      });

      if (result.success) {
        this.updateStatus({ isRunning: true, error: null });
        this.stateManager.updateGlobalState({ 
          isRunning: true,
          lastError: null,
          configPath,
          proxyConfig: this.proxyConfig
        });
        
        this.log('info', 'mihomo 内核启动成功');
        
        // 设置系统代理（如果启用）
        if (options.enableSystemProxy && this.proxyConfig) {
          await this._setSystemProxy(true);
        }
      } else {
        this.updateStatus({ isRunning: false, error: result.error });
        this.stateManager.updateGlobalState({ 
          isRunning: false,
          lastError: result.error
        });
      }

      return result;
    } catch (error) {
      this.log('error', '启动 mihomo 内核失败:', error);
      this.updateStatus({ isRunning: false, error: error.message });
      this.stateManager.updateGlobalState({ 
        isRunning: false,
        lastError: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * 停止内核服务
   * @returns {Promise<Object>} 停止结果
   */
  async stopCore() {
    try {
      this.log('info', '正在停止 mihomo 内核');

      // 清除系统代理
      if (this.proxyConfig && this.proxyConfig.enableSystemProxy) {
        await this._setSystemProxy(false);
      }

      const result = await this._stopMihomoProcess();
      
      this.updateStatus({ isRunning: false, error: null });
      this.stateManager.updateGlobalState({ 
        isRunning: false,
        lastError: null
      });

      this.log('info', 'mihomo 内核已停止');
      return result;
    } catch (error) {
      this.log('error', '停止 mihomo 内核失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取内核运行状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    try {
      const processStatus = this.processManager.getRunningStatus();
      const baseStatus = this.getBaseStatus();
      
      return {
        success: true,
        ...baseStatus,
        ...processStatus,
        lastCheckedAt: new Date().toISOString()
      };
    } catch (error) {
      this.log('error', `获取状态时发生异常: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取详细的内核运行状态
   * @returns {Object} 详细状态信息
   */
  getDetailedStatus() {
    try {
      const processStatus = this.processManager.getRunningStatus();
      const baseStatus = this.getBaseStatus();

      return {
        success: true,
        ...baseStatus,
        ...processStatus,
        lastCheckedAt: new Date().toISOString(),
        proxyConfig: this.proxyConfig,
        globalState: this.stateManager.getGlobalState(),
        coreType: this.coreType,
        displayName: this.getDisplayName()
      };
    } catch (error) {
      this.log('error', `获取详细状态时发生异常: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取内核版本信息
   * @returns {Promise<Object>} 版本信息
   */
  async getVersion() {
    try {
      const binaryPath = this.getBinaryPath();
      if (!fs.existsSync(binaryPath)) {
        return { success: false, error: 'mihomo 内核不存在' };
      }

      const result = await this._executeCommand(binaryPath, ['-v']);
      if (result.success) {
        // mihomo 版本输出格式: mihomo version v1.18.10
        const versionMatch = result.stdout.match(/mihomo version (v[\d.]+)/);
        const version = versionMatch ? versionMatch[1] : result.stdout.trim();
        
        return {
          success: true,
          version,
          fullOutput: result.stdout.trim()
        };
      } else {
        return result;
      }
    } catch (error) {
      this.log('error', '获取版本信息失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查内核是否已安装
   * @returns {Promise<Object>} 检查结果
   */
  async checkInstalled() {
    try {
      const binaryPath = this.getBinaryPath();
      const installed = fs.existsSync(binaryPath);
      
      if (installed) {
        // 尝试获取版本信息来验证二进制文件是否可用
        const versionResult = await this.getVersion();
        return {
          success: true,
          installed: versionResult.success,
          path: binaryPath,
          version: versionResult.version || null
        };
      } else {
        return {
          success: true,
          installed: false,
          path: binaryPath
        };
      }
    } catch (error) {
      this.log('error', '检查安装状态失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 验证配置文件
   * @param {string} configPath 配置文件路径
   * @returns {Promise<Object>} 验证结果
   */
  async checkConfig(configPath) {
    try {
      return this.configParser.validateConfig(configPath);
    } catch (error) {
      this.log('error', '验证配置文件失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 格式化配置文件
   * @param {string} configPath 配置文件路径
   * @returns {Promise<Object>} 格式化结果
   */
  async formatConfig(configPath) {
    try {
      return await this.configParser.formatConfig(configPath);
    } catch (error) {
      this.log('error', '格式化配置文件失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 下载内核
   * @returns {Promise<Object>} 下载结果
   */
  async downloadCore() {
    try {
      const universalDownloader = require('../main/core-downloader-universal');
      const utils = require('../main/ipc-handlers/utils');
      const mainWindow = utils.getMainWindow();

      this.log('info', '开始下载 mihomo 内核');

      const result = await universalDownloader.downloadCore(this.coreType, null, mainWindow);

      if (result.success) {
        this.log('info', `mihomo 内核下载成功: ${result.version}`);
      } else {
        this.log('error', `mihomo 内核下载失败: ${result.error}`);
      }

      return result;
    } catch (error) {
      this.log('error', '下载内核时发生异常:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 执行命令
   * @param {string} command 命令
   * @param {Array} args 参数
   * @returns {Promise<Object>} 执行结果
   * @private
   */
  async _executeCommand(command, args = []) {
    return new Promise((resolve) => {
      const child = spawn(command, args, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, stdout, stderr });
        } else {
          resolve({ success: false, error: stderr || stdout, code });
        }
      });

      child.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
    });
  }

  /**
   * 启动 mihomo 进程
   * @param {string} binaryPath 二进制文件路径
   * @param {Array} args 启动参数
   * @param {Object} options 启动选项
   * @returns {Promise<Object>} 启动结果
   * @private
   */
  async _startMihomoProcess(binaryPath, args, options = {}) {
    return new Promise((resolve) => {
      try {
        const child = spawn(binaryPath, args, {
          cwd: options.cwd || process.cwd(),
          env: options.env || process.env,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true
        });

        const pid = child.pid;

        // 添加到进程管理器
        this.processManager.addProcessHandler(pid, {
          childProcess: child,
          configPath: options.configPath,
          outputCallback: (data) => this.log('info', data.trim()),
          exitCallback: (code) => {
            this.log('info', `mihomo 进程退出，退出码: ${code}`);
            this.updateStatus({ isRunning: false });
          },
          tunMode: false,
          logFilePath: null
        });

        // 设置进程事件处理
        this._setupProcessHandlers(child);

        // 等待进程启动
        setTimeout(() => {
          if (child.killed) {
            resolve({ success: false, error: '进程启动失败' });
          } else {
            resolve({ success: true, pid });
          }
        }, 1000);

      } catch (error) {
        resolve({ success: false, error: error.message });
      }
    });
  }

  /**
   * 停止 mihomo 进程
   * @returns {Promise<Object>} 停止结果
   * @private
   */
  async _stopMihomoProcess() {
    try {
      this.processManager.cleanupAllProcesses();
      return { success: true, message: '已停止所有 mihomo 进程' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 设置进程事件处理器
   * @param {Object} child 子进程
   * @private
   */
  _setupProcessHandlers(child) {
    if (child.stdout) {
      child.stdout.on('data', (data) => {
        const output = data.toString();
        this.log('info', output.trim());
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        const output = data.toString();
        this.log('error', output.trim());
      });
    }

    child.on('exit', (code) => {
      this.log('info', `mihomo 进程已退出，退出码: ${code}`);
      this.processManager.cleanupProcess();
      this.updateStatus({ isRunning: false });
    });

    child.on('error', (error) => {
      this.log('error', `mihomo 进程出错: ${error.message}`);
      this.processManager.cleanupProcess();
      this.updateStatus({ isRunning: false, error: error.message });
    });
  }

  /**
   * 设置系统代理
   * @param {boolean} enable 是否启用
   * @returns {Promise<void>}
   * @private
   */
  async _setSystemProxy(enable) {
    try {
      const systemProxy = require('./system-proxy');
      if (enable && this.proxyConfig) {
        await systemProxy.setProxy(this.proxyConfig.host, this.proxyConfig.port);
        this.log('info', `系统代理已设置: ${this.proxyConfig.host}:${this.proxyConfig.port}`);
      } else {
        await systemProxy.clearProxy();
        this.log('info', '系统代理已清除');
      }
    } catch (error) {
      this.log('error', '设置系统代理失败:', error);
    }
  }
}

module.exports = new Mihomo();
