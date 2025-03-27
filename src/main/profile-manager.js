/**
 * 配置文件管理模块
 * 负责扫描和解析sing-box配置文件
 */
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const logger = require('../utils/logger');
const profileEngine = require('./engine/profiles-engine');
const mappingDefinition = require('./engine/mapping-definition');
const { getAppDataDir } = require('../utils/paths');

// 当前配置文件路径
let currentConfigPath = null;

// 配置文件副本路径
let configCopyPath = null;

// 映射定义缓存
let mappingDefinitionCache = null;

/**
 * 获取配置目录
 * @returns {String} 配置目录路径
 */
const getConfigDir = () => {
  const appDataDir = getAppDataDir();
  const configDir = path.join(appDataDir, 'configs');
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  return configDir;
};

// 用户设置文件路径
const getUserSettingsPath = () => {
  const appDataDir = getAppDataDir();
  return path.join(appDataDir, 'settings.json');
};

// 加载用户设置
const loadUserSettings = () => {
  try {
    const settingsPath = getUserSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(settingsData);
    }
  } catch (error) {
    logger.error(`加载用户设置失败: ${error.message}`);
  }
  return {};
};

// 保存用户设置
const saveUserSettings = (settings) => {
  try {
    const settingsPath = getUserSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (error) {
    logger.error(`保存用户设置失败: ${error.message}`);
    return false;
  }
};

/**
 * 获取映射定义文件路径
 * @returns {String} 映射定义文件路径
 */
function getMappingDefinitionPath() {
  const appDataDir = getAppDataDir();
  return path.join(appDataDir, 'mapping-definition.json');
}

/**
 * 加载映射定义
 * @returns {Array} 映射规则数组
 */
function loadMappingDefinition() {
  if (mappingDefinitionCache) {
    return mappingDefinitionCache;
  }
  
  const mappingPath = getMappingDefinitionPath();
  
  // 如果映射定义文件不存在，创建默认映射定义
  if (!fs.existsSync(mappingPath)) {
    createDefaultMappingDefinition();
  }
  
  mappingDefinitionCache = profileEngine.loadMappingDefinition(mappingPath);
  return mappingDefinitionCache;
}

/**
 * 创建默认映射定义文件
 */
function createDefaultMappingDefinition() {
  try {
    const mappingPath = getMappingDefinitionPath();
    const defaultDefinition = mappingDefinition.getDefaultMappingDefinition();
    
    fs.writeFileSync(mappingPath, JSON.stringify(defaultDefinition, null, 2), 'utf8');
    logger.info(`已创建默认映射定义文件: ${mappingPath}`);
  } catch (error) {
    logger.error(`创建默认映射定义文件失败: ${error.message}`);
  }
}

/**
 * 应用配置映射，将用户配置转换为sing-box配置
 * @param {Object} userConfig 用户配置
 * @param {Object} targetConfig 现有sing-box配置（可选）
 * @returns {Object} 处理后的sing-box配置
 */
function applyConfigMapping(userConfig, targetConfig = {}) {
  try {
    const mappings = loadMappingDefinition();
    if (!mappings || mappings.length === 0) {
      logger.warn('未找到有效的映射定义，无法应用配置映射');
      return targetConfig;
    }
    
    const result = profileEngine.applyMappings(userConfig, targetConfig, mappings);
    logger.info('配置映射应用成功');
    return result;
  } catch (error) {
    logger.error(`应用配置映射失败: ${error.message}`);
    return targetConfig;
  }
}

/**
 * 获取配置文件副本路径，用于启动内核
 * 如果不存在副本，从当前配置文件创建一个
 * @returns {String} 配置文件副本的路径
 */
function getConfigCopyPath() {
  if (configCopyPath && fs.existsSync(configCopyPath)) {
    return configCopyPath;
  }
  
  // 获取当前配置文件路径
  const currentConfig = getConfigPath();
  if (!currentConfig || !fs.existsSync(currentConfig)) {
    logger.error('无法创建配置文件副本：当前配置文件不存在');
    return null;
  }
  
  // 创建临时目录中的副本
  try {
    const tempDir = path.join(os.tmpdir(), 'lvory');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const configFileName = path.basename(currentConfig);
    configCopyPath = path.join(tempDir, configFileName);
    
    // 复制配置文件
    fs.copyFileSync(currentConfig, configCopyPath);
    logger.info(`已在临时目录创建配置文件副本: ${configCopyPath}`);
    
    return configCopyPath;
  } catch (error) {
    logger.error(`创建配置文件副本失败: ${error.message}`);
    return null;
  }
}

/**
 * 更新配置文件副本
 * 将当前配置内容写入临时目录的副本中
 * @param {Object} configData 配置数据 (可选，不提供时直接复制当前配置文件)
 * @returns {Boolean} 是否更新成功
 */
function updateConfigCopy(configData = null) {
  try {
    const currentConfig = getConfigPath();
    if (!currentConfig || !fs.existsSync(currentConfig)) {
      logger.error('无法更新配置文件副本：当前配置文件不存在');
      return false;
    }
    
    // 确保临时目录存在
    const tempDir = path.join(os.tmpdir(), 'lvory');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const configFileName = path.basename(currentConfig);
    configCopyPath = path.join(tempDir, configFileName);
    
    // 如果提供了配置数据，直接写入副本
    if (configData) {
      fs.writeFileSync(configCopyPath, JSON.stringify(configData, null, 2), 'utf8');
    } else {
      // 否则复制当前配置文件
      fs.copyFileSync(currentConfig, configCopyPath);
    }
    
    logger.info(`已更新配置文件副本: ${configCopyPath}`);
    return true;
  } catch (error) {
    logger.error(`更新配置文件副本失败: ${error.message}`);
    return false;
  }
}

/**
 * 保存用户配置并应用映射到sing-box配置
 * @param {Object} userConfig 用户配置
 * @returns {Boolean} 是否保存成功
 */
function saveUserConfig(userConfig) {
  try {
    const appDataDir = getAppDataDir();
    const userConfigPath = path.join(appDataDir, 'user-config.json');
    
    // 保存用户配置
    fs.writeFileSync(userConfigPath, JSON.stringify(userConfig, null, 2), 'utf8');
    
    // 获取当前sing-box配置（如果存在）
    let targetConfig = {};
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8');
      targetConfig = JSON.parse(configContent);
    }
    
    // 应用映射
    const mappedConfig = applyConfigMapping(userConfig, targetConfig);
    
    // 保存映射后的sing-box配置
    fs.writeFileSync(configPath, JSON.stringify(mappedConfig, null, 2), 'utf8');
    
    // 更新配置文件副本
    updateConfigCopy(mappedConfig);
    
    logger.info(`用户配置和映射后的sing-box配置已保存`);
    return true;
  } catch (error) {
    logger.error(`保存用户配置并应用映射失败: ${error.message}`);
    return false;
  }
}

/**
 * 加载用户配置
 * @returns {Object} 用户配置
 */
function loadUserConfig() {
  try {
    const appDataDir = getAppDataDir();
    const userConfigPath = path.join(appDataDir, 'user-config.json');
    
    if (fs.existsSync(userConfigPath)) {
      const content = fs.readFileSync(userConfigPath, 'utf8');
      return JSON.parse(content);
    }
    
    // 返回默认用户配置
    return {
      settings: {
        proxy_port: 12345,
        allow_lan: false
      },
      nodes: []
    };
  } catch (error) {
    logger.error(`加载用户配置失败: ${error.message}`);
    return {
      settings: {
        proxy_port: 12345,
        allow_lan: false
      },
      nodes: []
    };
  }
}

/**
 * 扫描应用数据目录中的配置文件并解析
 * @returns {Array} 配置文件中的outbounds数组
 */
const scanProfileConfig = () => {
  try {
    const configDir = getConfigDir();
    let fileToUse = null;
    
    // 优先使用已设置的配置文件路径
    if (currentConfigPath && fs.existsSync(currentConfigPath)) {
      fileToUse = currentConfigPath;
      logger.info('使用当前已选择的配置文件:', currentConfigPath);
    } else {
      // 如果没有设置或文件不存在，则尝试从用户设置中加载
      const userSettings = loadUserSettings();
      if (userSettings.lastConfigPath && fs.existsSync(userSettings.lastConfigPath)) {
        fileToUse = userSettings.lastConfigPath;
        currentConfigPath = fileToUse;
        logger.info('从用户设置加载配置文件:', fileToUse);
      } else {
        // 否则使用默认配置文件
        const testConfigPath = path.join(configDir, 'profiles-test.json');
        const configFilePath = path.join(configDir, 'sing-box.json');
        
        // 检查配置文件是否存在
        if (fs.existsSync(testConfigPath)) {
          fileToUse = testConfigPath;
          logger.info('找到测试配置文件:', testConfigPath);
        } else if (fs.existsSync(configFilePath)) {
          fileToUse = configFilePath;
          logger.info('找到标准配置文件:', configFilePath);
        } else {
          logger.info('未找到配置文件');
          return [];
        }
        
        currentConfigPath = fileToUse;
      }
    }
    
    const configContent = fs.readFileSync(fileToUse, 'utf8');
    const config = JSON.parse(configContent);
    
    // 提取outbounds
    if (config && config.outbounds && Array.isArray(config.outbounds)) {
      logger.info('解析到的outbound tags:', config.outbounds.length);
      return config.outbounds;
    }
    
    return [];
  } catch (error) {
    logger.error('扫描配置文件失败:', error);
    return [];
  }
};

/**
 * 获取配置文件路径
 * @returns {String} 配置文件路径
 */
const getConfigPath = () => {  
  // 尝试从用户设置中加载上次使用的配置路径
  const userSettings = loadUserSettings();
  if (userSettings.lastConfigPath && fs.existsSync(userSettings.lastConfigPath)) {
    currentConfigPath = userSettings.lastConfigPath;
    logger.info(`从用户设置加载配置文件路径: ${currentConfigPath}`);
    return currentConfigPath;
  }
  
  // 否则使用默认配置路径
  const configDir = getConfigDir();
  const configFilePath = path.join(configDir, 'sing-box.json');
  
  // 检查配置文件是否存在
  if (fs.existsSync(testConfigPath)) {
    currentConfigPath = testConfigPath;
  } else if (fs.existsSync(configFilePath)) {
    currentConfigPath = configFilePath;
  } else {
    currentConfigPath = configFilePath;
  }
  
  return currentConfigPath;
};

/**
 * 设置当前配置文件路径
 * @param {String} configPath 配置文件路径
 * @returns {Boolean} 是否设置成功
 */
const setConfigPath = (configPath) => {
  if (!configPath || !fs.existsSync(configPath)) {
    return false;
  }
  
  currentConfigPath = configPath;
  logger.info(`当前配置文件路径已设置为: ${configPath}`);
  
  // 保存到用户设置
  const userSettings = loadUserSettings();
  userSettings.lastConfigPath = configPath;
  saveUserSettings(userSettings);
  logger.info(`配置文件路径已保存到用户设置`);
  
  return true;
};

// 获取应用设置
const getAppSettings = () => {
  const userSettings = loadUserSettings();
  return userSettings.appSettings || {};
};

// 保存应用设置
const saveAppSettings = (appSettings) => {
  const userSettings = loadUserSettings();
  userSettings.appSettings = appSettings;
  return saveUserSettings(userSettings);
};

// 更新单个应用设置项
const updateAppSetting = (key, value) => {
  const userSettings = loadUserSettings();
  if (!userSettings.appSettings) {
    userSettings.appSettings = {};
  }
  userSettings.appSettings[key] = value;
  return saveUserSettings(userSettings);
};

module.exports = {
  scanProfileConfig,
  getConfigPath,
  setConfigPath,
  getConfigCopyPath,
  updateConfigCopy,
  loadUserSettings,
  saveUserSettings,
  getAppSettings,
  saveAppSettings,
  updateAppSetting,
  loadUserConfig,
  saveUserConfig,
  applyConfigMapping,
  loadMappingDefinition,
  getMappingDefinitionPath
}; 