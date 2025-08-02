/**
 * 配置文件转换器
 * 支持不同内核类型之间的配置格式转换
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('./logger');
const { CORE_TYPES, getCoreConfig } = require('../constants/core-types');

class ConfigConverter {
  constructor() {
    this.supportedConversions = [
      { from: CORE_TYPES.SINGBOX, to: CORE_TYPES.MIHOMO },
      { from: CORE_TYPES.MIHOMO, to: CORE_TYPES.SINGBOX }
    ];
  }

  /**
   * 检查是否支持指定的转换
   * @param {string} fromType 源内核类型
   * @param {string} toType 目标内核类型
   * @returns {boolean} 是否支持
   */
  isConversionSupported(fromType, toType) {
    return this.supportedConversions.some(
      conv => conv.from === fromType && conv.to === toType
    );
  }

  /**
   * 转换配置文件
   * @param {string} inputPath 输入文件路径
   * @param {string} outputPath 输出文件路径
   * @param {string} fromType 源内核类型
   * @param {string} toType 目标内核类型
   * @returns {Promise<Object>} 转换结果
   */
  async convertConfig(inputPath, outputPath, fromType, toType) {
    try {
      if (!this.isConversionSupported(fromType, toType)) {
        return {
          success: false,
          error: `不支持从 ${fromType} 到 ${toType} 的转换`
        };
      }

      if (!fs.existsSync(inputPath)) {
        return {
          success: false,
          error: `输入文件不存在: ${inputPath}`
        };
      }

      // 读取源配置
      const sourceConfig = await this._loadConfig(inputPath, fromType);
      if (!sourceConfig) {
        return {
          success: false,
          error: '无法读取源配置文件'
        };
      }

      // 转换配置
      let targetConfig;
      if (fromType === CORE_TYPES.SINGBOX && toType === CORE_TYPES.MIHOMO) {
        targetConfig = this._convertSingBoxToMihomo(sourceConfig);
      } else if (fromType === CORE_TYPES.MIHOMO && toType === CORE_TYPES.SINGBOX) {
        targetConfig = this._convertMihomoToSingBox(sourceConfig);
      } else {
        return {
          success: false,
          error: '不支持的转换类型'
        };
      }

      // 保存目标配置
      await this._saveConfig(outputPath, targetConfig, toType);

      logger.info(`配置转换成功: ${fromType} -> ${toType}`);
      return {
        success: true,
        inputPath,
        outputPath,
        fromType,
        toType
      };

    } catch (error) {
      logger.error('配置转换失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 加载配置文件
   * @param {string} filePath 文件路径
   * @param {string} coreType 内核类型
   * @returns {Promise<Object>} 配置对象
   * @private
   */
  async _loadConfig(filePath, coreType) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (coreType === CORE_TYPES.SINGBOX) {
      return JSON.parse(content);
    } else if (coreType === CORE_TYPES.MIHOMO) {
      return yaml.load(content);
    } else {
      throw new Error(`不支持的内核类型: ${coreType}`);
    }
  }

  /**
   * 保存配置文件
   * @param {string} filePath 文件路径
   * @param {Object} config 配置对象
   * @param {string} coreType 内核类型
   * @returns {Promise<void>}
   * @private
   */
  async _saveConfig(filePath, config, coreType) {
    let content;
    
    if (coreType === CORE_TYPES.SINGBOX) {
      content = JSON.stringify(config, null, 2);
    } else if (coreType === CORE_TYPES.MIHOMO) {
      content = yaml.dump(config, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false
      });
    } else {
      throw new Error(`不支持的内核类型: ${coreType}`);
    }

    // 确保目录存在
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf8');
  }

  /**
   * 将 sing-box 配置转换为 mihomo 配置
   * @param {Object} singboxConfig sing-box 配置
   * @returns {Object} mihomo 配置
   * @private
   */
  _convertSingBoxToMihomo(singboxConfig) {
    const mihomoConfig = {
      // 基本设置
      'allow-lan': false,
      mode: 'rule',
      'log-level': 'info',
      
      // 端口设置
      'mixed-port': 7890,
      
      // API 设置
      'external-controller': '127.0.0.1:9090',
      
      // DNS 设置
      dns: {
        enable: true,
        listen: '0.0.0.0:53',
        'default-nameserver': ['223.5.5.5', '8.8.8.8']
      },
      
      // 代理、代理组和规则
      proxies: [],
      'proxy-groups': [],
      rules: []
    };

    // 转换入站配置
    if (singboxConfig.inbounds) {
      for (const inbound of singboxConfig.inbounds) {
        if (inbound.type === 'mixed' && inbound.listen_port) {
          mihomoConfig['mixed-port'] = inbound.listen_port;
        }
        if (inbound.listen === '0.0.0.0') {
          mihomoConfig['allow-lan'] = true;
        }
      }
    }

    // 转换 API 配置
    if (singboxConfig.experimental && 
        singboxConfig.experimental.clash_api && 
        singboxConfig.experimental.clash_api.external_controller) {
      mihomoConfig['external-controller'] = singboxConfig.experimental.clash_api.external_controller;
    }

    // 转换日志配置
    if (singboxConfig.log && singboxConfig.log.level) {
      mihomoConfig['log-level'] = singboxConfig.log.level;
    }

    // 转换出站配置为代理
    if (singboxConfig.outbounds) {
      for (const outbound of singboxConfig.outbounds) {
        if (outbound.type !== 'direct' && outbound.type !== 'block') {
          const proxy = this._convertSingBoxOutboundToMihomoProxy(outbound);
          if (proxy) {
            mihomoConfig.proxies.push(proxy);
          }
        }
      }
    }

    // 添加基本代理组
    if (mihomoConfig.proxies.length > 0) {
      mihomoConfig['proxy-groups'].push({
        name: 'PROXY',
        type: 'select',
        proxies: [...mihomoConfig.proxies.map(p => p.name), 'DIRECT']
      });
    }

    // 转换路由规则
    if (singboxConfig.route && singboxConfig.route.rules) {
      for (const rule of singboxConfig.route.rules) {
        const mihomoRule = this._convertSingBoxRuleToMihomoRule(rule);
        if (mihomoRule) {
          mihomoConfig.rules.push(mihomoRule);
        }
      }
    }

    // 添加默认规则
    mihomoConfig.rules.push('MATCH,DIRECT');

    return mihomoConfig;
  }

  /**
   * 将 mihomo 配置转换为 sing-box 配置
   * @param {Object} mihomoConfig mihomo 配置
   * @returns {Object} sing-box 配置
   * @private
   */
  _convertMihomoToSingBox(mihomoConfig) {
    const singboxConfig = {
      log: {
        level: mihomoConfig['log-level'] || 'info'
      },
      
      inbounds: [
        {
          type: 'mixed',
          listen: mihomoConfig['allow-lan'] ? '0.0.0.0' : '127.0.0.1',
          listen_port: mihomoConfig['mixed-port'] || mihomoConfig.port || 7890
        }
      ],
      
      outbounds: [
        {
          type: 'direct',
          tag: 'direct'
        },
        {
          type: 'block',
          tag: 'block'
        }
      ],
      
      route: {
        rules: []
      }
    };

    // 添加 API 配置
    if (mihomoConfig['external-controller']) {
      singboxConfig.experimental = {
        clash_api: {
          external_controller: mihomoConfig['external-controller']
        }
      };
    }

    // 转换代理为出站
    if (mihomoConfig.proxies) {
      for (const proxy of mihomoConfig.proxies) {
        const outbound = this._convertMihomoProxyToSingBoxOutbound(proxy);
        if (outbound) {
          singboxConfig.outbounds.push(outbound);
        }
      }
    }

    // 转换规则
    if (mihomoConfig.rules) {
      for (const rule of mihomoConfig.rules) {
        const singboxRule = this._convertMihomoRuleToSingBoxRule(rule);
        if (singboxRule) {
          singboxConfig.route.rules.push(singboxRule);
        }
      }
    }

    return singboxConfig;
  }

  /**
   * 转换 sing-box 出站为 mihomo 代理
   * @param {Object} outbound sing-box 出站配置
   * @returns {Object|null} mihomo 代理配置
   * @private
   */
  _convertSingBoxOutboundToMihomoProxy(outbound) {
    // 基本的协议转换，实际使用时需要根据具体协议进行详细转换
    const baseProxy = {
      name: outbound.tag || 'proxy',
      server: outbound.server,
      port: outbound.server_port
    };

    switch (outbound.type) {
      case 'shadowsocks':
        return {
          ...baseProxy,
          type: 'ss',
          cipher: outbound.method,
          password: outbound.password
        };
      case 'vmess':
        return {
          ...baseProxy,
          type: 'vmess',
          uuid: outbound.uuid,
          alterId: outbound.alter_id || 0
        };
      case 'trojan':
        return {
          ...baseProxy,
          type: 'trojan',
          password: outbound.password
        };
      default:
        logger.warn(`不支持的出站类型转换: ${outbound.type}`);
        return null;
    }
  }

  /**
   * 转换 mihomo 代理为 sing-box 出站
   * @param {Object} proxy mihomo 代理配置
   * @returns {Object|null} sing-box 出站配置
   * @private
   */
  _convertMihomoProxyToSingBoxOutbound(proxy) {
    const baseOutbound = {
      tag: proxy.name,
      server: proxy.server,
      server_port: proxy.port
    };

    switch (proxy.type) {
      case 'ss':
        return {
          ...baseOutbound,
          type: 'shadowsocks',
          method: proxy.cipher,
          password: proxy.password
        };
      case 'vmess':
        return {
          ...baseOutbound,
          type: 'vmess',
          uuid: proxy.uuid,
          alter_id: proxy.alterId || 0
        };
      case 'trojan':
        return {
          ...baseOutbound,
          type: 'trojan',
          password: proxy.password
        };
      default:
        logger.warn(`不支持的代理类型转换: ${proxy.type}`);
        return null;
    }
  }

  /**
   * 转换 sing-box 规则为 mihomo 规则
   * @param {Object} rule sing-box 规则
   * @returns {string|null} mihomo 规则
   * @private
   */
  _convertSingBoxRuleToMihomoRule(rule) {
    // 简化的规则转换，实际使用时需要更详细的转换逻辑
    if (rule.domain_suffix) {
      return `DOMAIN-SUFFIX,${rule.domain_suffix.join(',')},${rule.outbound}`;
    }
    if (rule.domain_keyword) {
      return `DOMAIN-KEYWORD,${rule.domain_keyword.join(',')},${rule.outbound}`;
    }
    if (rule.geoip) {
      return `GEOIP,${rule.geoip},${rule.outbound}`;
    }
    return null;
  }

  /**
   * 转换 mihomo 规则为 sing-box 规则
   * @param {string} rule mihomo 规则
   * @returns {Object|null} sing-box 规则
   * @private
   */
  _convertMihomoRuleToSingBoxRule(rule) {
    const parts = rule.split(',');
    if (parts.length < 3) return null;

    const [type, value, outbound] = parts;

    switch (type) {
      case 'DOMAIN-SUFFIX':
        return {
          domain_suffix: [value],
          outbound
        };
      case 'DOMAIN-KEYWORD':
        return {
          domain_keyword: [value],
          outbound
        };
      case 'GEOIP':
        return {
          geoip: value,
          outbound
        };
      default:
        return null;
    }
  }
}

module.exports = new ConfigConverter();
