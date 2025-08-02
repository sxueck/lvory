/**
 * 映射定义模块
 * 定义用户配置到目标配置的映射规则
 */

// 常量定义
const NETWORK_CONSTANTS = {
  LOCALHOST: "127.0.0.1",
  ALL_INTERFACES: "0.0.0.0",
  DEFAULT_PROXY_PORT: 7890,
  DEFAULT_API_PORT: 9090,
  TUN_IPV4_ADDRESS: "172.18.0.1/30",
  TUN_IPV6_ADDRESS: "fdfe:dcba:9876::1/126"
};

const CONFIG_PATHS = {
  // sing-box 配置路径
  SINGBOX: {
    MIXED_INBOUND_LISTEN: "inbounds.[type=mixed].listen",
    MIXED_INBOUND_PORT: "inbounds.[type=mixed].listen_port",
    API_CONTROLLER: "experimental.clash_api.external_controller",
    LOG_CONFIG: "log",
    TUN_INBOUND: "inbounds.[type=tun]",
    OUTBOUNDS_BY_TAG: "outbounds.[tag={nodes[*].name}]"
  },

  // mihomo 配置路径
  MIHOMO: {
    MIXED_INBOUND_LISTEN: "allow-lan",
    MIXED_INBOUND_PORT: "mixed-port",
    API_CONTROLLER: "external-controller",
    LOG_CONFIG: "log-level",
    TUN_INBOUND: "tun",
    PROXIES: "proxies",
    PROXY_GROUPS: "proxy-groups",
    RULES: "rules"
  },

  // 向后兼容的旧路径
  MIXED_INBOUND_LISTEN: "inbounds.[type=mixed].listen",
  MIXED_INBOUND_PORT: "inbounds.[type=mixed].listen_port",
  API_CONTROLLER: "experimental.clash_api.external_controller",
  LOG_CONFIG: "log",
  TUN_INBOUND: "inbounds.[type=tun]",
  OUTBOUNDS_BY_TAG: "outbounds.[tag={nodes[*].name}]"
};

const DEFAULT_VALUES = {
  PROXY_PORT: NETWORK_CONSTANTS.DEFAULT_PROXY_PORT,
  API_ADDRESS: `${NETWORK_CONSTANTS.LOCALHOST}:${NETWORK_CONSTANTS.DEFAULT_API_PORT}`,
  LOG_ENABLED: true,
  LOG_LEVEL: "info",
  LOG_TIMESTAMP: true,
  LOG_DISABLED: false
};

/**
 * 获取默认的映射定义
 * @returns {Object} 默认映射定义对象
 */
function getDefaultMappingDefinition() {
  return {
    "mappings": [
      {
        "user_path": "settings.allow_lan",
        "target_path": CONFIG_PATHS.MIXED_INBOUND_LISTEN,
        "type": "boolean",
        "transform": "conditional",
        "condition": "value === true",
        "true_value": NETWORK_CONSTANTS.ALL_INTERFACES,
        "false_value": NETWORK_CONSTANTS.LOCALHOST,
        "description": "是否允许局域网连接"
      },
      {
        "user_path": "settings.proxy_port",
        "target_path": CONFIG_PATHS.MIXED_INBOUND_PORT,
        "type": "number",
        "default": DEFAULT_VALUES.PROXY_PORT,
        "description": "代理端口设置"
      },
      {
        "user_path": "settings.api_address",
        "target_path": CONFIG_PATHS.API_CONTROLLER,
        "type": "string",
        "default": DEFAULT_VALUES.API_ADDRESS,
        "description": "API地址设置"
      },
      {
        "user_path": "settings.log_enabled",
        "target_path": CONFIG_PATHS.LOG_CONFIG,
        "type": "boolean",
        "default": DEFAULT_VALUES.LOG_ENABLED,
        "transform": "conditional",
        "condition": "value === true",
        "true_value": {
          "level": "{settings.log_level}",
          "output": "{settings.log_output}",
          "disabled": "{settings.log_disabled}",
          "timestamp": "{settings.log_timestamp}"
        },
        "false_action": "remove",
        "conflict_strategy": "override",
        "description": "完整日志配置"
      },
      {
        "user_path": "settings.tun_mode",
        "target_path": CONFIG_PATHS.TUN_INBOUND,
        "type": "boolean",
        "transform": "conditional",
        "condition": "value === true",
        "true_value": {
          "tag": "tun-in",
          "type": "tun",
          "address": [
            NETWORK_CONSTANTS.TUN_IPV4_ADDRESS,
            NETWORK_CONSTANTS.TUN_IPV6_ADDRESS
          ],
          "auto_route": true,
          "strict_route": true,
          "stack": "system",
          "platform": {
            "http_proxy": {
              "enabled": true,
              "server": NETWORK_CONSTANTS.LOCALHOST,
              "server_port": "{settings.proxy_port}"
            }
          }
        },
        "false_action": "remove",
        "description": "TUN模式配置"
      },

      {
        "user_path": "nodes[*]",
        "target_path": CONFIG_PATHS.OUTBOUNDS_BY_TAG,
        "transform": "template",
        "template": {
          "type": "{nodes[*].protocol}",
          "tag": "{nodes[*].name}",
          "server": "{nodes[*].server}",
          "server_port": "{nodes[*].port}"
        },
        "description": "节点信息映射"
      }
    ]
  };
}

/**
 * @returns {Object} 完整的TUN配置模板
 */
function getTunConfigTemplate() {
  return {
    "tag": "tun-in",
    "type": "tun",
    "address": [
      NETWORK_CONSTANTS.TUN_IPV4_ADDRESS,
      NETWORK_CONSTANTS.TUN_IPV6_ADDRESS
    ],
    "auto_route": true,
    "strict_route": true,
    "stack": "system",
    "platform": {
      "http_proxy": {
        "enabled": true,
        "server": NETWORK_CONSTANTS.LOCALHOST,
        "server_port": "{settings.proxy_port}"
      }
    }
  };
}

// 协议模板的公共字段
const COMMON_NODE_FIELDS = {
  "tag": "{nodes[*].name}",
  "server": "{nodes[*].server}",
  "server_port": "{nodes[*].port}"
};

/**
 * 获取特定协议的映射模板
 * @param {String} protocol 协议类型
 * @returns {Object} 特定协议的映射模板
 */
function getProtocolTemplate(protocol) {
  // 协议特定字段定义
  const protocolSpecificFields = {
    "shadowsocks": {
      "method": "{nodes[*].method}",
      "password": "{nodes[*].password}"
    },
    "vmess": {
      "uuid": "{nodes[*].uuid}",
      "alter_id": "{nodes[*].alter_id}",
      "security": "{nodes[*].security}"
    },
    "trojan": {
      "password": "{nodes[*].password}"
    }
  };

  const specificFields = protocolSpecificFields[protocol] || {};

  return {
    "type": protocol,
    ...COMMON_NODE_FIELDS,
    ...specificFields
  };
}

/**
 * 创建针对特定协议的映射定义
 * @param {String} protocol 协议类型
 * @returns {Object} 映射定义对象
 */
function createProtocolMapping(protocol) {
  return {
    "user_path": `nodes[protocol=${protocol}]`,
    "target_path": "outbounds.[tag={nodes[*].name}]",
    "transform": "template",
    "template": getProtocolTemplate(protocol),
    "description": `${protocol}节点映射`
  };
}

/**
 * 获取默认日志配置模板
 * @returns {Object} 默认日志配置
 */
function getDefaultLogConfig() {
  return {
    "disabled": DEFAULT_VALUES.LOG_DISABLED,
    "level": DEFAULT_VALUES.LOG_LEVEL,
    "timestamp": DEFAULT_VALUES.LOG_TIMESTAMP
  };
}

/**
 * 创建条件映射配置
 * @param {String} userPath 用户配置路径
 * @param {String} targetPath 目标配置路径
 * @param {String} trueValue 条件为真时的值
 * @param {String} falseValue 条件为假时的值
 * @param {String} description 描述
 * @returns {Object} 条件映射配置
 */
function createConditionalMapping(userPath, targetPath, trueValue, falseValue, description) {
  return {
    "user_path": userPath,
    "target_path": targetPath,
    "type": "boolean",
    "transform": "conditional",
    "condition": "value === true",
    "true_value": trueValue,
    "false_value": falseValue,
    "description": description
  };
}

/**
 * 创建简单映射配置
 * @param {String} userPath 用户配置路径
 * @param {String} targetPath 目标配置路径
 * @param {String} type 数据类型
 * @param {*} defaultValue 默认值
 * @param {String} description 描述
 * @returns {Object} 简单映射配置
 */
function createSimpleMapping(userPath, targetPath, type, defaultValue, description) {
  return {
    "user_path": userPath,
    "target_path": targetPath,
    "type": type,
    "default": defaultValue,
    "description": description
  };
}

module.exports = {
  // 常量导出
  NETWORK_CONSTANTS,
  CONFIG_PATHS,
  DEFAULT_VALUES,
  COMMON_NODE_FIELDS,

  // 函数导出
  getDefaultMappingDefinition,
  getTunConfigTemplate,
  getProtocolTemplate,
  createProtocolMapping,
  getDefaultLogConfig,
  createConditionalMapping,
  createSimpleMapping
};