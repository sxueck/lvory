/**
 * Mihomo 配置解析模块
 * 负责解析 mihomo 的 YAML 配置文件并提取关键信息
 */

const fs = require('fs');
const yaml = require('js-yaml');
const logger = require('../logger');
const ConfigAdapter = require('../core-manager/config-adapter');
const { CORE_TYPES } = require('../../constants/core-types');

class MihomoConfigParser extends ConfigAdapter {
  constructor() {
    super(CORE_TYPES.MIHOMO);
    this.defaultProxyConfig = {
      host: '127.0.0.1',
      port: 7890,
      enableSystemProxy: true
    };
  }

  /**
   * 解析配置文件并提取关键信息
   * @param {string} configPath 配置文件路径
   * @returns {Object} 解析结果，包含端口信息等
   */
  parseConfigFile(configPath) {
    try {
      const config = this._loadAndParseConfig(configPath);
      if (!config) return null;

      const result = {
        port: this.extractProxyPort(config),
        apiAddress: this.extractApiAddress(config),
        allowLan: config['allow-lan'] || false,
        mode: config['mode'] || 'rule',
        logLevel: config['log-level'] || 'info'
      };

      return result;
    } catch (error) {
      logger.error(`[MihomoConfigParser] 解析配置文件出错: ${error.message}`);
      return null;
    }
  }

  /**
   * 解析配置文件
   * @param {string} configPath 配置文件路径
   * @returns {Object} 解析结果
   */
  parseConfig(configPath) {
    return this.parseConfigFile(configPath);
  }

  /**
   * 验证配置文件
   * @param {string} configPath 配置文件路径
   * @returns {Object} 验证结果
   */
  validateConfig(configPath) {
    try {
      const parseResult = this.parseConfigFile(configPath);
      if (!parseResult) {
        return {
          valid: false,
          error: '无法解析配置文件'
        };
      }

      const validationResult = this._validateConfigStructure(configPath);
      if (!validationResult.valid) {
        return validationResult;
      }

      const config = validationResult.config;
      
      return {
        valid: true,
        proxyPort: parseResult.port || this.defaultProxyConfig.port,
        apiAddress: parseResult.apiAddress || this.config.defaultApiAddress,
        proxiesCount: config.proxies ? config.proxies.length : 0,
        proxyGroupsCount: config['proxy-groups'] ? config['proxy-groups'].length : 0,
        rulesCount: config.rules ? config.rules.length : 0,
        hasProxies: !!(config.proxies && config.proxies.length > 0),
        hasProxyGroups: !!(config['proxy-groups'] && config['proxy-groups'].length > 0),
        hasRules: !!(config.rules && config.rules.length > 0),
        hasTunMode: !!(config.tun && config.tun.enable),
        mode: config.mode || 'rule'
      };
    } catch (error) {
      logger.error(`[MihomoConfigParser] 验证配置文件失败: ${error.message}`);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * 从配置中提取代理端口
   * @param {Object} config 配置对象
   * @returns {number} 代理端口
   */
  extractProxyPort(config) {
    if (!config) return this.defaultProxyConfig.port;

    // mihomo 支持多种端口配置方式
    const portFields = ['mixed-port', 'port', 'socks-port', 'http-port'];
    
    for (const field of portFields) {
      if (config[field] && this.isValidPort(config[field])) {
        logger.info(`[MihomoConfigParser] 从配置文件解析到代理端口 (${field}): ${config[field]}`);
        return config[field];
      }
    }

    logger.warn(`[MihomoConfigParser] 配置文件中没有找到有效的代理端口，使用默认端口: ${this.defaultProxyConfig.port}`);
    return this.defaultProxyConfig.port;
  }

  /**
   * 从配置中提取API地址
   * @param {Object} config 配置对象
   * @returns {string} API地址
   */
  extractApiAddress(config) {
    if (!config) return this.config.defaultApiAddress;

    const apiAddress = config['external-controller'];
    if (apiAddress && typeof apiAddress === 'string') {
      logger.info(`[MihomoConfigParser] 从配置文件解析到API地址: ${apiAddress}`);
      return apiAddress;
    }

    logger.warn(`[MihomoConfigParser] 配置文件中没有找到API地址，使用默认地址: ${this.config.defaultApiAddress}`);
    return this.config.defaultApiAddress;
  }

  /**
   * 加载并解析配置文件
   * @param {string} configPath 配置文件路径
   * @returns {Object|null} 解析后的配置对象
   * @private
   */
  _loadAndParseConfig(configPath) {
    try {
      const configContent = this.readConfigFile(configPath);
      return yaml.load(configContent);
    } catch (error) {
      logger.error(`[MihomoConfigParser] 解析YAML配置文件失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 验证配置文件结构
   * @param {string} configPath 配置文件路径
   * @returns {Object} 验证结果
   * @private
   */
  _validateConfigStructure(configPath) {
    try {
      const config = this._loadAndParseConfig(configPath);
      if (!config) {
        return {
          valid: false,
          error: '无法解析YAML配置文件'
        };
      }

      // 检查基本结构
      if (typeof config !== 'object') {
        return {
          valid: false,
          error: '配置文件格式错误：根节点必须是对象'
        };
      }

      // 检查必要字段（mihomo 配置相对宽松）
      const warnings = [];
      
      if (!config.proxies && !config['proxy-providers']) {
        warnings.push('没有找到代理配置 (proxies 或 proxy-providers)');
      }

      if (!config['proxy-groups']) {
        warnings.push('没有找到代理组配置 (proxy-groups)');
      }

      if (!config.rules && !config['rule-providers']) {
        warnings.push('没有找到规则配置 (rules 或 rule-providers)');
      }

      if (warnings.length > 0) {
        logger.warn(`[MihomoConfigParser] 配置文件警告: ${warnings.join(', ')}`);
      }

      return {
        valid: true,
        config,
        warnings
      };
    } catch (error) {
      return {
        valid: false,
        error: `配置文件结构验证失败: ${error.message}`
      };
    }
  }

  /**
   * 格式化配置文件
   * @param {string} configPath 配置文件路径
   * @returns {Promise<Object>} 格式化结果
   */
  async formatConfig(configPath) {
    try {
      const config = this._loadAndParseConfig(configPath);
      if (!config) {
        return { success: false, error: '无法解析配置文件' };
      }

      // 创建备份
      const backupPath = this.createBackup(configPath);

      // 格式化并写入文件
      const formattedYaml = yaml.dump(config, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false
      });

      fs.writeFileSync(configPath, formattedYaml, 'utf8');

      logger.info(`[MihomoConfigParser] 配置文件已格式化: ${configPath}`);
      return { 
        success: true, 
        message: '配置文件格式化成功',
        backupPath
      };
    } catch (error) {
      logger.error(`[MihomoConfigParser] 格式化配置文件失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取配置文件中的代理列表
   * @param {string} configPath 配置文件路径
   * @returns {Array} 代理列表
   */
  getProxies(configPath) {
    try {
      const config = this._loadAndParseConfig(configPath);
      if (!config || !config.proxies) {
        return [];
      }

      return config.proxies.map(proxy => ({
        name: proxy.name,
        type: proxy.type,
        server: proxy.server,
        port: proxy.port
      }));
    } catch (error) {
      logger.error(`[MihomoConfigParser] 获取代理列表失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 获取配置文件中的代理组列表
   * @param {string} configPath 配置文件路径
   * @returns {Array} 代理组列表
   */
  getProxyGroups(configPath) {
    try {
      const config = this._loadAndParseConfig(configPath);
      if (!config || !config['proxy-groups']) {
        return [];
      }

      return config['proxy-groups'].map(group => ({
        name: group.name,
        type: group.type,
        proxies: group.proxies || []
      }));
    } catch (error) {
      logger.error(`[MihomoConfigParser] 获取代理组列表失败: ${error.message}`);
      return [];
    }
  }
}

module.exports = MihomoConfigParser;
