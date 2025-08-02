/**
 * 通用映射引擎
 * 根据内核类型选择正确的配置映射规则
 */

const logger = require('../../utils/logger');
const { CORE_TYPES } = require('../../constants/core-types');
const { CONFIG_PATHS, NETWORK_CONSTANTS, DEFAULT_VALUES } = require('./mapping-definition');

class UniversalMappingEngine {
  constructor() {
    this.currentCoreType = CORE_TYPES.SINGBOX; // 默认值
  }

  /**
   * 设置当前内核类型
   * @param {string} coreType 内核类型
   */
  setCoreType(coreType) {
    this.currentCoreType = coreType;
    logger.info(`映射引擎切换到 ${coreType} 模式`);
  }

  /**
   * 获取当前内核类型的配置路径
   * @returns {Object} 配置路径对象
   */
  getConfigPaths() {
    if (this.currentCoreType === CORE_TYPES.MIHOMO) {
      return CONFIG_PATHS.MIHOMO;
    } else {
      return CONFIG_PATHS.SINGBOX;
    }
  }

  /**
   * 获取映射定义
   * @returns {Object} 映射定义
   */
  getMappingDefinition() {
    const paths = this.getConfigPaths();
    
    if (this.currentCoreType === CORE_TYPES.MIHOMO) {
      return this._getMihomoMappingDefinition(paths);
    } else {
      return this._getSingBoxMappingDefinition(paths);
    }
  }

  /**
   * 获取 sing-box 映射定义
   * @param {Object} paths 配置路径
   * @returns {Object} sing-box 映射定义
   * @private
   */
  _getSingBoxMappingDefinition(paths) {
    return {
      "mappings": [
        {
          "user_path": "settings.allow_lan",
          "target_path": paths.MIXED_INBOUND_LISTEN,
          "type": "boolean",
          "transform": "conditional",
          "condition": "value === true",
          "true_value": NETWORK_CONSTANTS.ALL_INTERFACES,
          "false_value": NETWORK_CONSTANTS.LOCALHOST,
          "description": "是否允许局域网连接"
        },
        {
          "user_path": "settings.proxy_port",
          "target_path": paths.MIXED_INBOUND_PORT,
          "type": "number",
          "transform": "direct",
          "default": DEFAULT_VALUES.PROXY_PORT,
          "description": "代理端口"
        },
        {
          "user_path": "settings.api_address",
          "target_path": paths.API_CONTROLLER,
          "type": "string",
          "transform": "direct",
          "default": DEFAULT_VALUES.API_ADDRESS,
          "description": "API控制器地址"
        },
        {
          "user_path": "settings.log_level",
          "target_path": paths.LOG_CONFIG + ".level",
          "type": "string",
          "transform": "direct",
          "default": DEFAULT_VALUES.LOG_LEVEL,
          "description": "日志级别"
        },
        {
          "user_path": "settings.log_disabled",
          "target_path": paths.LOG_CONFIG + ".disabled",
          "type": "boolean",
          "transform": "direct",
          "default": DEFAULT_VALUES.LOG_DISABLED,
          "description": "是否禁用日志"
        },
        {
          "user_path": "settings.tun_mode",
          "target_path": paths.TUN_INBOUND,
          "type": "object",
          "transform": "conditional",
          "condition": "value === true",
          "true_value": {
            "type": "tun",
            "inet4_address": NETWORK_CONSTANTS.TUN_IPV4_ADDRESS,
            "inet6_address": NETWORK_CONSTANTS.TUN_IPV6_ADDRESS,
            "auto_route": true,
            "strict_route": false
          },
          "false_value": null,
          "description": "TUN模式配置"
        }
      ]
    };
  }

  /**
   * 获取 mihomo 映射定义
   * @param {Object} paths 配置路径
   * @returns {Object} mihomo 映射定义
   * @private
   */
  _getMihomoMappingDefinition(paths) {
    return {
      "mappings": [
        {
          "user_path": "settings.allow_lan",
          "target_path": paths.MIXED_INBOUND_LISTEN,
          "type": "boolean",
          "transform": "direct",
          "default": false,
          "description": "是否允许局域网连接"
        },
        {
          "user_path": "settings.proxy_port",
          "target_path": paths.MIXED_INBOUND_PORT,
          "type": "number",
          "transform": "direct",
          "default": DEFAULT_VALUES.PROXY_PORT,
          "description": "混合代理端口"
        },
        {
          "user_path": "settings.api_address",
          "target_path": paths.API_CONTROLLER,
          "type": "string",
          "transform": "direct",
          "default": DEFAULT_VALUES.API_ADDRESS,
          "description": "外部控制器地址"
        },
        {
          "user_path": "settings.log_level",
          "target_path": paths.LOG_CONFIG,
          "type": "string",
          "transform": "direct",
          "default": DEFAULT_VALUES.LOG_LEVEL,
          "description": "日志级别"
        },
        {
          "user_path": "settings.tun_mode",
          "target_path": paths.TUN_INBOUND,
          "type": "object",
          "transform": "conditional",
          "condition": "value === true",
          "true_value": {
            "enable": true,
            "stack": "system",
            "dns-hijack": ["any:53"],
            "auto-route": true,
            "auto-detect-interface": true
          },
          "false_value": {
            "enable": false
          },
          "description": "TUN模式配置"
        },
        {
          "user_path": "settings.mode",
          "target_path": "mode",
          "type": "string",
          "transform": "direct",
          "default": "rule",
          "description": "运行模式"
        }
      ]
    };
  }

  /**
   * 应用映射到配置
   * @param {Object} userSettings 用户设置
   * @param {Object} targetConfig 目标配置
   * @returns {Object} 应用映射后的配置
   */
  applyMappings(userSettings, targetConfig) {
    const mappingDef = this.getMappingDefinition();
    const result = JSON.parse(JSON.stringify(targetConfig)); // 深拷贝

    for (const mapping of mappingDef.mappings) {
      try {
        const userValue = this._getValueByPath(userSettings, mapping.user_path);
        const mappedValue = this._transformValue(userValue, mapping);
        
        if (mappedValue !== undefined) {
          this._setValueByPath(result, mapping.target_path, mappedValue);
          logger.debug(`映射应用: ${mapping.user_path} -> ${mapping.target_path} = ${JSON.stringify(mappedValue)}`);
        }
      } catch (error) {
        logger.warn(`映射应用失败: ${mapping.user_path} -> ${mapping.target_path}`, error);
      }
    }

    return result;
  }

  /**
   * 根据路径获取值
   * @param {Object} obj 对象
   * @param {string} path 路径
   * @returns {*} 值
   * @private
   */
  _getValueByPath(obj, path) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  /**
   * 根据路径设置值
   * @param {Object} obj 对象
   * @param {string} path 路径
   * @param {*} value 值
   * @private
   */
  _setValueByPath(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    const lastKey = keys[keys.length - 1];
    if (value === null) {
      delete current[lastKey];
    } else {
      current[lastKey] = value;
    }
  }

  /**
   * 转换值
   * @param {*} value 原始值
   * @param {Object} mapping 映射配置
   * @returns {*} 转换后的值
   * @private
   */
  _transformValue(value, mapping) {
    // 如果值为 undefined，使用默认值
    if (value === undefined && mapping.default !== undefined) {
      value = mapping.default;
    }

    switch (mapping.transform) {
      case 'direct':
        return value;
        
      case 'conditional':
        if (mapping.condition) {
          // 简单的条件评估
          const conditionResult = this._evaluateCondition(value, mapping.condition);
          return conditionResult ? mapping.true_value : mapping.false_value;
        }
        return value;
        
      default:
        return value;
    }
  }

  /**
   * 评估条件
   * @param {*} value 值
   * @param {string} condition 条件表达式
   * @returns {boolean} 条件结果
   * @private
   */
  _evaluateCondition(value, condition) {
    try {
      // 简单的条件评估，实际使用时可能需要更安全的实现
      return eval(condition.replace(/value/g, JSON.stringify(value)));
    } catch (error) {
      logger.warn(`条件评估失败: ${condition}`, error);
      return false;
    }
  }

  /**
   * 验证配置
   * @param {Object} config 配置对象
   * @returns {Object} 验证结果
   */
  validateConfig(config) {
    const errors = [];
    const warnings = [];
    
    const paths = this.getConfigPaths();
    
    // 检查必要的配置项
    if (this.currentCoreType === CORE_TYPES.MIHOMO) {
      if (!config['mixed-port'] && !config.port) {
        errors.push('缺少代理端口配置 (mixed-port 或 port)');
      }
      
      if (!config['external-controller']) {
        warnings.push('缺少外部控制器配置 (external-controller)');
      }
      
      if (!config.proxies || config.proxies.length === 0) {
        warnings.push('没有配置代理节点');
      }
    } else {
      if (!config.inbounds || config.inbounds.length === 0) {
        errors.push('缺少入站配置 (inbounds)');
      }
      
      if (!config.outbounds || config.outbounds.length === 0) {
        errors.push('缺少出站配置 (outbounds)');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = new UniversalMappingEngine();
