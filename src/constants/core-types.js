/**
 * 内核类型常量定义
 * 定义支持的内核类型和相关配置
 */

// 内核类型枚举
const CORE_TYPES = {
  SINGBOX: 'singbox',
  MIHOMO: 'mihomo'
};

// 内核配置信息
const CORE_CONFIG = {
  [CORE_TYPES.SINGBOX]: {
    name: 'sing-box',
    displayName: 'sing-box',
    configFormat: 'json',
    configExtensions: ['.json'],
    apiPath: 'experimental.clash_api.external_controller',
    defaultApiAddress: '127.0.0.1:9090',
    defaultProxyPort: 7890,
    binaryName: process.platform === 'win32' ? 'sing-box.exe' : 'sing-box',
    downloadUrl: {
      github: 'https://github.com/SagerNet/sing-box/releases',
      pattern: 'sing-box-{version}-{platform}-{arch}'
    },
    supportedFeatures: {
      tun: true,
      clash_api: true,
      mixed_port: true,
      system_proxy: true
    }
  },
  [CORE_TYPES.MIHOMO]: {
    name: 'mihomo',
    displayName: 'mihomo',
    configFormat: 'yaml',
    configExtensions: ['.yaml', '.yml'],
    apiPath: 'external-controller',
    defaultApiAddress: '127.0.0.1:9090',
    defaultProxyPort: 7890,
    binaryName: process.platform === 'win32' ? 'mihomo.exe' : 'mihomo',
    downloadUrl: {
      github: 'https://github.com/MetaCubeX/mihomo/releases',
      pattern: 'mihomo-{platform}-{arch}'
    },
    supportedFeatures: {
      tun: true,
      clash_api: true,
      mixed_port: true,
      system_proxy: true
    }
  }
};

// API 端点映射
const API_ENDPOINTS = {
  [CORE_TYPES.SINGBOX]: {
    version: '/version',
    config: '/configs',
    proxies: '/proxies',
    connections: '/connections',
    traffic: '/traffic',
    logs: '/logs'
  },
  [CORE_TYPES.MIHOMO]: {
    version: '/version',
    config: '/configs',
    proxies: '/proxies',
    connections: '/connections',
    traffic: '/traffic',
    logs: '/logs'
  }
};

// 配置字段映射
const CONFIG_FIELD_MAPPING = {
  [CORE_TYPES.SINGBOX]: {
    proxyPort: 'inbounds.[type=mixed].listen_port',
    apiAddress: 'experimental.clash_api.external_controller',
    allowLan: 'inbounds.[type=mixed].listen',
    logLevel: 'log.level',
    tunMode: 'inbounds.[type=tun]'
  },
  [CORE_TYPES.MIHOMO]: {
    proxyPort: 'mixed-port',
    apiAddress: 'external-controller',
    allowLan: 'allow-lan',
    logLevel: 'log-level',
    tunMode: 'tun'
  }
};

// 平台架构映射
const PLATFORM_ARCH_MAPPING = {
  win32: {
    x64: { platform: 'windows', arch: 'amd64' },
    arm64: { platform: 'windows', arch: 'arm64' }
  },
  darwin: {
    x64: { platform: 'darwin', arch: 'amd64' },
    arm64: { platform: 'darwin', arch: 'arm64' }
  },
  linux: {
    x64: { platform: 'linux', arch: 'amd64' },
    arm64: { platform: 'linux', arch: 'arm64' }
  }
};

/**
 * 获取当前平台的架构信息
 * @returns {Object} 平台和架构信息
 */
function getCurrentPlatformArch() {
  const platform = process.platform;
  const arch = process.arch;
  
  if (PLATFORM_ARCH_MAPPING[platform] && PLATFORM_ARCH_MAPPING[platform][arch]) {
    return PLATFORM_ARCH_MAPPING[platform][arch];
  }
  
  // 默认值
  return { platform: 'linux', arch: 'amd64' };
}

/**
 * 验证内核类型是否支持
 * @param {string} coreType 内核类型
 * @returns {boolean} 是否支持
 */
function isSupportedCoreType(coreType) {
  return Object.values(CORE_TYPES).includes(coreType);
}

/**
 * 获取内核配置
 * @param {string} coreType 内核类型
 * @returns {Object} 内核配置
 */
function getCoreConfig(coreType) {
  if (!isSupportedCoreType(coreType)) {
    throw new Error(`Unsupported core type: ${coreType}`);
  }
  return CORE_CONFIG[coreType];
}

/**
 * 获取所有支持的内核类型
 * @returns {Array} 内核类型列表
 */
function getSupportedCoreTypes() {
  return Object.values(CORE_TYPES).map(type => ({
    value: type,
    label: CORE_CONFIG[type].displayName,
    config: CORE_CONFIG[type]
  }));
}

module.exports = {
  CORE_TYPES,
  CORE_CONFIG,
  API_ENDPOINTS,
  CONFIG_FIELD_MAPPING,
  PLATFORM_ARCH_MAPPING,
  getCurrentPlatformArch,
  isSupportedCoreType,
  getCoreConfig,
  getSupportedCoreTypes
};
