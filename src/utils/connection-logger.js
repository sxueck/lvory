const https = require('https');
const http = require('http');
const eventBus = require('./event-bus');
const universalApiClient = require('./universal-api-client');

class ConnectionLogger {
  constructor() {
    this.mainWindow = null;
    this.connectionGroups = {
      domain: new Map(),
      networkType: new Map(), 
      nodeGroup: new Map(),
      direction: new Map()
    };
    this.maxGroupEntries = 100;
    this.streamController = null;
    this.isStreaming = false;
    this.enabled = true;
    
    // 默认配置，会被动态更新
    this.clashApi = {
      host: '127.0.0.1',
      port: 9090,
      path: '/logs'
    };
    
    // 添加连接日志历史
    this.connectionLogHistory = [];
    this.maxLogHistory = 1000;
    
    // 连接状态管理
    this.connectionState = {
      retryCount: 0,
      maxRetries: 3,
      retryDelay: 5000,
      lastRetryTime: null,
      consecutiveFailures: 0,
      backoffMultiplier: 1.5,
      maxBackoffDelay: 30000,
      gracefulShutdown: false
    };
    
    // 监听状态管理 - 新增
    this.monitoringState = {
      isMonitoring: false,           // 是否正在监听
      lastStartTime: null,           // 最后启动时间
      preserveUntil: null,           // 保留监听状态直到此时间
      preserveDuration: 30000,       // 保留时长30秒
      pendingStart: false,           // 是否有待处理的启动请求
      startRequestId: null           // 启动请求ID，用于去重
    };
    
    // 使用事件总线监听状态变化，避免循环依赖
    this.singBoxStateListener = this.handleSingBoxStateChange.bind(this);
    this.initSingBoxStateListener();
  }

  initSingBoxStateListener() {
    try {
      // 使用事件总线监听状态变化，避免循环依赖
      eventBus.onStateChange('core-started', () => this.handleSingBoxStateChange({ type: 'core-started' }));
      eventBus.onStateChange('core-stopped', () => this.handleSingBoxStateChange({ type: 'core-stopped' }));
      eventBus.onStateChange('core-stopping', () => this.handleSingBoxStateChange({ type: 'core-stopping' }));
      eventBus.onStateChange('connection-monitor-enabled', () => this.handleSingBoxStateChange({ type: 'connection-monitor-enabled' }));
      eventBus.onStateChange('connection-monitor-disabled', () => this.handleSingBoxStateChange({ type: 'connection-monitor-disabled' }));
      eventBus.onStateChange('connection-monitor-max-retries', () => this.handleSingBoxStateChange({ type: 'connection-monitor-max-retries' }));
      console.log('ConnectionLogger: 已注册事件总线状态监听器');
    } catch (error) {
      console.error('ConnectionLogger: 注册事件总线状态监听器失败:', error);
    }
  }

  handleSingBoxStateChange(stateChange) {
    console.log('ConnectionLogger: 收到状态变化:', stateChange.type);
    
    switch (stateChange.type) {
      case 'core-started':
        // 内核启动时只更新配置，不自动开始监听
        this.connectionState.gracefulShutdown = false;
        this.resetConnectionState();
        this.updateApiConfig().then(() => {
          console.log('ConnectionLogger: 内核已启动，API配置已更新，等待激活条件');
        });
        break;
        
      case 'connection-monitor-enabled':
        // 只有在明确启用连接监控时才开始监听
        this.enabled = true;
        this.connectionState.gracefulShutdown = false;
        this.resetConnectionState();
        this.updateApiConfig().then(() => {
          if (!this.isStreaming) {
            console.log('ConnectionLogger: 连接监控已启用，开始监听');
            this.startConnectionLogStream();
          }
        });
        break;
        
      case 'core-stopped':
      case 'core-stopping':
      case 'connection-monitor-disabled':
        console.log('ConnectionLogger: 内核已停止或监控已禁用，优雅关闭连接监控');
        this.enabled = false;
        this.connectionState.gracefulShutdown = true;
        this.stopConnectionLogStream();
        break;
        
      case 'connection-monitor-max-retries':
        console.log('ConnectionLogger: 连接重试次数已达上限，停止连接');
        this.enabled = false;
        this.stopConnectionLogStream();
        break;
        
      default:
        break;
    }
  }

  async updateApiConfig() {
    try {
      if (typeof window !== 'undefined' && window.electron && window.electron.getCurrentConfig) {
        const result = await window.electron.getCurrentConfig();
        if (result.success && result.config) {
          const config = result.config;

          // 获取当前内核类型
          let coreType = 'singbox'; // 默认值
          if (window.electron.core && window.electron.core.getCurrentType) {
            try {
              const coreResult = await window.electron.core.getCurrentType();
              if (coreResult.success) {
                coreType = coreResult.coreType;
              }
            } catch (error) {
              console.warn('ConnectionLogger: 获取内核类型失败，使用默认值');
            }
          }

          // 更新通用 API 客户端的内核类型
          universalApiClient.setCoreType(coreType);

          // 根据内核类型获取API地址
          let apiAddress = null;
          if (coreType === 'mihomo') {
            // mihomo 使用 external-controller
            apiAddress = config['external-controller'];
          } else {
            // sing-box 使用 experimental.clash_api.external_controller
            if (config.experimental && config.experimental.clash_api && config.experimental.clash_api.external_controller) {
              apiAddress = config.experimental.clash_api.external_controller;
            }
          }

          if (apiAddress) {
            const [host, port] = apiAddress.split(':');
            this.clashApi.host = host || '127.0.0.1';
            this.clashApi.port = parseInt(port) || 9090;

            // 同时更新通用 API 客户端的配置
            universalApiClient.setApiConfig({
              host: this.clashApi.host,
              port: this.clashApi.port
            });

            console.log(`ConnectionLogger: 更新API配置 (${coreType}) ${this.clashApi.host}:${this.clashApi.port}`);
          } else {
            console.warn(`ConnectionLogger: 配置中未找到 ${coreType} 的API地址，使用默认配置`);
          }
        }
      } else {
        // 如果在主进程中，可以直接读取配置文件
        try {
          const profileManager = require('../main/profile-manager');
          const configPath = profileManager.getConfigPath();
          if (configPath) {
            const fs = require('fs');
            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configContent);
            
            if (config.experimental && config.experimental.clash_api && config.experimental.clash_api.external_controller) {
              const apiAddress = config.experimental.clash_api.external_controller;
              const [host, port] = apiAddress.split(':');
              this.clashApi.host = host || '127.0.0.1';
              this.clashApi.port = parseInt(port) || 9090;
              console.log(`ConnectionLogger: 更新API配置 ${this.clashApi.host}:${this.clashApi.port}`);
            } else {
              console.warn('ConnectionLogger: 配置文件中未找到clash_api.external_controller，使用默认配置');
            }
          }
        } catch (error) {
          console.log('ConnectionLogger: 无法从主进程获取配置，使用默认配置');
        }
      }
    } catch (error) {
      console.error('ConnectionLogger: 更新API配置失败:', error);
    }
  }

  resetConnectionState() {
    this.connectionState.retryCount = 0;
    this.connectionState.consecutiveFailures = 0;
    this.connectionState.lastRetryTime = null;
    
    // 如果不在保留期内，重置监听状态
    if (!this.monitoringState.preserveUntil || Date.now() >= this.monitoringState.preserveUntil) {
      this.monitoringState.isMonitoring = false;
      this.monitoringState.preserveUntil = null;
    }
    
    console.log('ConnectionLogger: 连接状态已重置');
  }

  setMainWindow(window) {
    this.mainWindow = window;
    // 主窗口设置时不自动启动连接流，等待明确的启用信号
    console.log('ConnectionLogger: 主窗口已设置，等待连接监控启用信号');
  }

  startConnectionLogStream() {
    // 检查是否已有监听在运行或监听状态被保留
    if (this.isStreaming || !this.enabled || this.connectionState.gracefulShutdown) {
      console.log('ConnectionLogger: 跳过启动连接流 - isStreaming:', this.isStreaming, 'enabled:', this.enabled, 'gracefulShutdown:', this.connectionState.gracefulShutdown);
      return;
    }
    
    // 检查监听状态是否被保留中
    if (this.monitoringState.preserveUntil && Date.now() < this.monitoringState.preserveUntil) {
      console.log('ConnectionLogger: 监听状态保留中，复用现有监听');
      return;
    }
    
    // 检查是否应该停止重试
    if (this.connectionState.retryCount >= this.connectionState.maxRetries) {
      console.log(`ConnectionLogger: 重试次数已达上限 (${this.connectionState.maxRetries})，停止连接`);
      this.enabled = false;
      
      // 通知sing-box记录重试失败
      try {
        eventBus.emitStateChange('connection-retry-failed');
      } catch (error) {
        console.error('ConnectionLogger: 通知重试失败时出错:', error);
      }
      
      return;
    }
    
    this.isStreaming = true;
    this.monitoringState.isMonitoring = true;
    this.monitoringState.lastStartTime = Date.now();
    
    // 通知前端连接监听已启动
    if (this.mainWindow) {
      this.mainWindow.webContents.send('connection-monitoring-started');
    }
    
    // 减少延迟，快速启动连接监听
    const isFirstAttempt = this.connectionState.retryCount === 0;
    const startDelay = isFirstAttempt ? 500 : 300;
    
    console.log(`ConnectionLogger: ${isFirstAttempt ? '首次' : '重试'}连接到 ${this.clashApi.host}:${this.clashApi.port}，延迟 ${startDelay}ms`);
    
    setTimeout(() => {
      if (this.enabled && !this.connectionState.gracefulShutdown) {
        this.connectToLogStream();
      }
    }, startDelay);
  }

  connectToLogStream() {
    try {
      const options = {
        hostname: this.clashApi.host,
        port: this.clashApi.port,
        path: this.clashApi.path + '?level=info',
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        timeout: 30000
      };

      console.log(`ConnectionLogger: 尝试连接到 ${options.hostname}:${options.port}${options.path}`);

      const req = http.request(options, (res) => {
        console.log(`连接到Clash API成功，状态码: ${res.statusCode}`);
        
        if (res.statusCode !== 200) {
          console.error(`ConnectionLogger: API返回非200状态码: ${res.statusCode}`);
          this.isStreaming = false;
          if (this.enabled && !this.connectionState.gracefulShutdown) {
            this.recordConnectionFailure();
            this.scheduleReconnect(`HTTP状态码 ${res.statusCode}`);
          }
          return;
        }
        
        // 重置连接失败计数
        this.connectionState.consecutiveFailures = 0;
        
        res.setEncoding('utf8');
        
        res.on('data', (chunk) => {
          try {
            const lines = chunk.split('\n').filter(line => line.trim());
            lines.forEach(line => {
              try {
                const logData = JSON.parse(line);
                this.handleConnectionLog(logData);
              } catch (parseError) {
                // 忽略解析错误的行
              }
            });
          } catch (error) {
            console.error('处理连接日志数据失败:', error);
          }
        });

        res.on('end', () => {
          console.log('连接日志流结束');
          this.isStreaming = false;
          if (!this.connectionState.gracefulShutdown) {
            this.monitoringState.isMonitoring = false;
          }
          if (this.enabled && !this.connectionState.gracefulShutdown) {
            this.scheduleReconnect('流结束');
          }
        });

        res.on('error', (error) => {
          if (this.connectionState.gracefulShutdown && (error.code === 'ECONNRESET' || error.message === 'aborted')) {
            console.log('ConnectionLogger: 连接流已优雅关闭');
          } else {
            console.error('连接日志流出错:', error);
          }
          
          this.isStreaming = false;
          if (!this.connectionState.gracefulShutdown) {
            this.monitoringState.isMonitoring = false;
          }
          if (this.enabled && !this.connectionState.gracefulShutdown) {
            this.recordConnectionFailure();
            this.scheduleReconnect('流错误');
          }
        });
      });

      req.on('error', (error) => {
        if (this.connectionState.gracefulShutdown && (error.code === 'ECONNRESET' || error.message === 'aborted')) {
          console.log('ConnectionLogger: 连接请求已优雅关闭');
          this.isStreaming = false;
          return;
        }
        
        console.error(`连接Clash API失败 (${this.clashApi.host}:${this.clashApi.port}):`, error.message);
        this.isStreaming = false;
        this.monitoringState.isMonitoring = false;
        
        // 特殊处理常见错误
        let reason = '连接失败';
        if (error.code === 'ECONNREFUSED') {
          reason = 'API服务未启动或端口被占用';
          console.log('ConnectionLogger: 建议检查sing-box是否正确配置了clash_api.external_controller');
        } else if (error.code === 'ENOTFOUND') {
          reason = 'API主机地址无法解析';
        } else if (error.code === 'ETIMEDOUT') {
          reason = 'API连接超时';
        }
        
        if (this.enabled && !this.connectionState.gracefulShutdown) {
          this.recordConnectionFailure();
          this.scheduleReconnect(reason);
        }
      });

      req.setTimeout(30000, () => {
        // 如果不是优雅关闭过程中的超时，才记录错误
        if (!this.connectionState.gracefulShutdown) {
          console.log('连接超时');
          req.destroy();
          this.isStreaming = false;
          
          if (this.enabled) {
            this.recordConnectionFailure();
            this.scheduleReconnect('连接超时');
          }
        }
      });

      req.end();
      this.streamController = req;

    } catch (error) {
      console.error('创建连接日志流失败:', error);
      this.isStreaming = false;
      
      if (this.enabled && !this.connectionState.gracefulShutdown) {
        this.recordConnectionFailure();
        this.scheduleReconnect('创建连接失败');
      }
    }
  }

  // 简化的日志解析器
  parseLogPayload(payload) {
    const result = {
      sessionId: '未知',
      domain: '未知',
      networkType: '未知',
      nodeGroup: '未知',
      direction: '未知',
      delay: '未知',
      originalPayload: payload
    };

    // 简化正则匹配，提高容错性
    const logMatch = payload.match(/\[(\d+)[^\]]*\]\s+(inbound|outbound)\/([^\/\[]+)(?:\[([^\]]+)\])?[:\s]+(.+)/);
    if (!logMatch) return result;

    const [, sessionId, direction, networkType, nodeGroup, connectionInfo] = logMatch;
    
    result.sessionId = sessionId;
    result.direction = direction;
    result.networkType = networkType || '未知';
    result.nodeGroup = nodeGroup || '未知';

    // 提取延迟信息
    const delayMatch = payload.match(/\[\d+\s+([^\]]+)\]/);
    if (delayMatch) {
      result.delay = delayMatch[1];
    }

    // 提取域名
    if (connectionInfo) {
      const domainMatch = connectionInfo.match(/(?:connection (?:to|from)\s+)?([^:\s]+)/);
      if (domainMatch) {
        result.domain = domainMatch[1];
      }
    }

    return result;
  }

  handleConnectionLog(logData) {
    if (!logData || !logData.payload) return;

    const parsedLog = this.parseLogPayload(logData.payload);
    const logEntry = {
      ...parsedLog,
      type: logData.type || 'info',
      timestamp: Date.now(),
      count: 1,
      payload: logData.payload
    };

    this.addToConnectionGroups(logEntry);
    this.sendConnectionGroupsToRenderer();
    this.sendConnectionLogToRenderer(logEntry);
  }

  sendConnectionLogToRenderer(logEntry) {
    if (this.mainWindow?.isDestroyed?.() === false) {
      const connectionLog = {
        type: logEntry.type,
        payload: logEntry.payload,
        timestamp: logEntry.timestamp,
        sessionId: logEntry.sessionId,
        domain: logEntry.domain,
        direction: logEntry.direction,
        networkType: logEntry.networkType,
        nodeGroup: logEntry.nodeGroup,
        delay: logEntry.delay,
        address: logEntry.domain
      };
      
      // 添加到历史记录
      this.addToConnectionLogHistory(connectionLog);
      
      // 发送单个连接日志到Activity组件
      this.mainWindow.webContents.send('connection-log', connectionLog);
    }
  }

  addToConnectionLogHistory(logEntry) {
    this.connectionLogHistory.push(logEntry);
    
    // 限制历史记录大小
    if (this.connectionLogHistory.length > this.maxLogHistory) {
      this.connectionLogHistory.shift();
    }
  }

  getConnectionLogHistory() {
    return this.connectionLogHistory;
  }

  addToConnectionGroups(logEntry) {
    ['domain', 'networkType', 'nodeGroup', 'direction'].forEach(groupType => {
      const groupMap = this.connectionGroups[groupType];
      const key = logEntry[groupType];
      
      if (groupMap.has(key)) {
        const existing = groupMap.get(key);
        existing.count += 1;
        existing.lastSeen = logEntry.timestamp;
        existing.recentLogs.push({
          payload: logEntry.originalPayload,
          timestamp: logEntry.timestamp,
          delay: logEntry.delay
        });
        
        if (existing.recentLogs.length > 10) {
          existing.recentLogs.shift();
        }
      } else {
        groupMap.set(key, {
          name: key,
          count: 1,
          firstSeen: logEntry.timestamp,
          lastSeen: logEntry.timestamp,
          recentLogs: [{
            payload: logEntry.originalPayload,
            timestamp: logEntry.timestamp,
            delay: logEntry.delay
          }]
        });
      }

      if (groupMap.size > this.maxGroupEntries) {
        const oldestKey = [...groupMap.entries()]
          .sort(([,a], [,b]) => a.lastSeen - b.lastSeen)[0][0];
        groupMap.delete(oldestKey);
      }
    });
  }

  sendConnectionGroupsToRenderer() {
    if (this.mainWindow?.isDestroyed?.() === false) {
      const groupsData = {
        domain: this.getGroupArray('domain'),
        networkType: this.getGroupArray('networkType'),
        nodeGroup: this.getGroupArray('nodeGroup'),
        direction: this.getGroupArray('direction')
      };
      
      this.mainWindow.webContents.send('connection-groups', groupsData);
    }
  }

  getGroupArray(groupType) {
    return [...this.connectionGroups[groupType].entries()]
      .map(([key, value]) => value)
      .sort((a, b) => b.count - a.count);
  }

  getConnectionGroups() {
    return {
      domain: this.getGroupArray('domain'),
      networkType: this.getGroupArray('networkType'), 
      nodeGroup: this.getGroupArray('nodeGroup'),
      direction: this.getGroupArray('direction')
    };
  }

  recordConnectionFailure() {
    this.connectionState.consecutiveFailures++;
    console.log(`ConnectionLogger: 记录连接失败，连续失败次数: ${this.connectionState.consecutiveFailures}`);
  }

  calculateBackoffDelay() {
    const baseDelay = this.connectionState.retryDelay;
    const backoffDelay = baseDelay * Math.pow(this.connectionState.backoffMultiplier, this.connectionState.consecutiveFailures);
    return Math.min(backoffDelay, this.connectionState.maxBackoffDelay);
  }

  scheduleReconnect(reason) {
    if (!this.enabled || this.connectionState.gracefulShutdown) {
      console.log(`ConnectionLogger: 跳过重连 - enabled: ${this.enabled}, gracefulShutdown: ${this.connectionState.gracefulShutdown}`);
      return;
    }

    this.connectionState.retryCount++;
    this.connectionState.lastRetryTime = Date.now();

    if (this.connectionState.retryCount >= this.connectionState.maxRetries) {
      console.log(`ConnectionLogger: 重试次数已达上限 (${this.connectionState.maxRetries})，停止重试`);
      this.enabled = false;
      
      // 通知记录重试失败
      try {
        eventBus.emitStateChange('connection-retry-failed');
      } catch (error) {
        console.error('ConnectionLogger: 通知重试失败时出错:', error);
      }
      
      return;
    }

    const delay = this.calculateBackoffDelay();
    console.log(`ConnectionLogger: 计划重连 (原因: ${reason}, 第 ${this.connectionState.retryCount}/${this.connectionState.maxRetries} 次重试, 延迟: ${delay}ms)`);

    setTimeout(() => {
      if (this.enabled && !this.connectionState.gracefulShutdown) {
        console.log(`ConnectionLogger: 执行重连尝试 ${this.connectionState.retryCount}`);
        this.startConnectionLogStream();
      } else {
        console.log('ConnectionLogger: 重连时发现服务已禁用或正在优雅关闭，取消重连');
      }
    }, delay);
  }

  clearConnectionHistory() {
    this.connectionGroups = {
      domain: new Map(),
      networkType: new Map(),
      nodeGroup: new Map(),
      direction: new Map()
    };
    this.connectionLogHistory = [];
    this.sendConnectionGroupsToRenderer();
    return { success: true };
  }

  stopConnectionLogStream() {
    console.log('ConnectionLogger: 停止连接日志流');
    this.isStreaming = false;
    this.connectionState.gracefulShutdown = true;
    
    // 设置监听状态保留时间，允许复用
    this.monitoringState.preserveUntil = Date.now() + this.monitoringState.preserveDuration;
    console.log(`ConnectionLogger: 监听状态将保留 ${this.monitoringState.preserveDuration}ms 以供复用`);
    
    if (this.streamController) {
      try {
        // 给一个短暂的延迟，让错误处理逻辑有时间检查 gracefulShutdown 标志
        setTimeout(() => {
          if (this.streamController) {
            this.streamController.destroy();
            this.streamController = null;
          }
        }, 10);
      } catch (error) {
        // 优雅关闭时忽略销毁错误
        console.log('ConnectionLogger: 连接流已关闭');
      }
    }
    
    // 延迟重置连接状态，确保错误处理完成
    setTimeout(() => {
      this.resetConnectionState();
    }, 100);
  }

  /**
   * 手动启动连接监听
   */
  startMonitoring() {
    if (!this.mainWindow) {
      console.log('ConnectionLogger: 主窗口未设置，无法启动监听');
      return false;
    }
    
    // 清理过期的保留状态
    this.cleanupExpiredPreservation();
    
    // 生成唯一的启动请求ID
    const requestId = Date.now() + Math.random();
    
    // 检查是否已经在监听中
    if (this.isStreaming && this.monitoringState.isMonitoring) {
      console.log('ConnectionLogger: 监听已在运行中，重置连接状态以显示最新数据');
      // 即使已在监听，也要通知前端清空状态以显示最新数据
      if (this.mainWindow) {
        this.mainWindow.webContents.send('connection-log-reset');
      }
      return true;
    }
    
    // 检查是否有保留的监听状态可以复用
    if (this.monitoringState.preserveUntil && Date.now() < this.monitoringState.preserveUntil) {
      console.log('ConnectionLogger: 复用保留的监听状态');
      this.enabled = true;
      this.connectionState.gracefulShutdown = false;
      this.monitoringState.isMonitoring = true;
      this.monitoringState.preserveUntil = null; // 清除保留状态
      
      // 立即启动连接流（如果还没有启动）
      if (!this.isStreaming) {
        this.startConnectionLogStream();
      } else {
        // 通知前端重置连接状态
        if (this.mainWindow) {
          this.mainWindow.webContents.send('connection-log-reset');
        }
      }
      return true;
    }
    
    // 防止重复启动请求
    if (this.monitoringState.pendingStart && this.monitoringState.startRequestId) {
      console.log('ConnectionLogger: 已有待处理的启动请求，跳过重复请求');
      return true;
    }
    
    console.log('ConnectionLogger: 收到启动监听请求');
    this.enabled = true;
    this.connectionState.gracefulShutdown = false;
    this.monitoringState.pendingStart = true;
    this.monitoringState.startRequestId = requestId;
    this.monitoringState.isMonitoring = true; // 立即设置为监听状态
    this.resetConnectionState();
    
    // 立即尝试启动，不等待配置更新
    if (!this.isStreaming) {
      console.log('ConnectionLogger: 立即启动连接监听');
      this.startConnectionLogStream();
    }
    
    // 异步更新配置
    this.updateApiConfig().then(() => {
      // 检查请求是否仍然有效（防止并发请求）
      if (this.monitoringState.startRequestId !== requestId) {
        console.log('ConnectionLogger: 启动请求已过期，跳过启动');
        return;
      }
      
      // 如果配置更新后需要重启连接流
      if (this.isStreaming) {
        this.stopConnectionLogStream();
        setTimeout(() => {
          this.startConnectionLogStream();
        }, 100);
      }
      
      this.monitoringState.pendingStart = false;
      this.monitoringState.startRequestId = null;
    }).catch(error => {
      console.error('ConnectionLogger: 更新配置时出错:', error);
      this.monitoringState.pendingStart = false;
      this.monitoringState.startRequestId = null;
    });
    
    return true;
  }

  /**
   * 手动停止连接监听
   */
  stopMonitoring() {
    console.log('ConnectionLogger: 收到停止监听请求');
    this.enabled = false;
    this.connectionState.gracefulShutdown = true;
    this.monitoringState.isMonitoring = false;
    
    // 清除任何待处理的启动请求
    this.monitoringState.pendingStart = false;
    this.monitoringState.startRequestId = null;
    
    this.stopConnectionLogStream();
  }

  /**
   * 清理过期的监听状态保留
   */
  cleanupExpiredPreservation() {
    if (this.monitoringState.preserveUntil && Date.now() >= this.monitoringState.preserveUntil) {
      console.log('ConnectionLogger: 清理过期的监听状态保留');
      this.monitoringState.preserveUntil = null;
      this.monitoringState.isMonitoring = false;
    }
  }

  // 析构函数 - 清理资源
  destroy() {
    console.log('ConnectionLogger: 正在销毁实例');
    this.stopConnectionLogStream();
    
    // 清理监听状态
    this.monitoringState.isMonitoring = false;
    this.monitoringState.preserveUntil = null;
    this.monitoringState.pendingStart = false;
    this.monitoringState.startRequestId = null;
    
    // 移除状态监听器
    try {
      eventBus.removeAllListeners('state-change');
      console.log('ConnectionLogger: 已移除事件总线状态监听器');
    } catch (error) {
      console.error('ConnectionLogger: 移除事件总线状态监听器失败:', error);
    }
  }

  // 兼容旧API的方法，现在会自动从配置获取
  setClashApi(host, port) {
    this.clashApi.host = host;
    this.clashApi.port = port;
    
    if (this.isStreaming) {
      this.stopConnectionLogStream();
      this.startConnectionLogStream();
    }
  }
}

module.exports = new ConnectionLogger();