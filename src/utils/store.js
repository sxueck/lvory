/**
 * 数据存储模块
 * 用于持久化存储应用数据
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const os = require('os');

/**
 * 获取应用数据目录
 * @returns {String} 应用数据目录路径
 */
function getAppDataDir() {
  let appDir;
  
  // 根据不同平台获取合适的数据目录
  if (process.platform === 'win32') {
    // Windows平台 - 使用LOCALAPPDATA目录
    const appDataDir = process.env.LOCALAPPDATA || '';
    appDir = path.join(appDataDir, 'lvory');
  } else if (process.platform === 'darwin') {
    // macOS平台 - 使用Documents目录
    const homeDir = os.homedir();
    appDir = path.join(homeDir, 'Documents', 'lvory');
  } else {
    // Linux平台 - 使用~/.config目录
    const homeDir = os.homedir();
    appDir = path.join(homeDir, '.config', 'lvory');
  }
  
  // 确保目录存在
  if (!fs.existsSync(appDir)) {
    try {
      fs.mkdirSync(appDir, { recursive: true });
      console.log(`创建应用数据目录: ${appDir}`);
    } catch (error) {
      console.error(`创建应用数据目录失败: ${error.message}`);
    }
  }
  
  return appDir;
}

/**
 * 存储数据
 * @param {String} key 数据键
 * @param {Any} value 数据值
 * @returns {Promise<Boolean>} 是否成功
 */
async function set(key, value) {
  try {
    const appDataDir = getAppDataDir();
    const storePath = path.join(appDataDir, 'store.json');
    
    let storeData = {};
    // 如果文件存在，先读取现有数据
    if (fs.existsSync(storePath)) {
      try {
        const fileContent = fs.readFileSync(storePath, 'utf8');
        storeData = JSON.parse(fileContent);
      } catch (e) {
        console.error(`读取存储文件失败: ${e.message}`);
        // 文件可能损坏，使用空对象
        storeData = {};
      }
    }
    
    // 更新数据
    const keys = key.split('.');
    let current = storeData;
    
    // 处理嵌套键
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k] || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    // 设置最终值
    current[keys[keys.length - 1]] = value;
    
    // 写入文件
    fs.writeFileSync(storePath, JSON.stringify(storeData, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`存储数据失败: ${error.message}`);
    return false;
  }
}

/**
 * 获取数据
 * @param {String} key 数据键
 * @returns {Promise<Any>} 数据值
 */
async function get(key) {
  try {
    const appDataDir = getAppDataDir();
    const storePath = path.join(appDataDir, 'store.json');
    
    // 如果文件不存在，返回null
    if (!fs.existsSync(storePath)) {
      return null;
    }
    
    // 读取文件
    const fileContent = fs.readFileSync(storePath, 'utf8');
    const storeData = JSON.parse(fileContent);
    
    // 处理嵌套键
    const keys = key.split('.');
    let current = storeData;
    
    for (const k of keys) {
      if (current === null || current === undefined || !Object.prototype.hasOwnProperty.call(current, k)) {
        return null;
      }
      current = current[k];
    }
    
    return current;
  } catch (error) {
    console.error(`获取数据失败: ${error.message}`);
    return null;
  }
}

/**
 * 删除数据
 * @param {String} key 数据键
 * @returns {Promise<Boolean>} 是否成功
 */
async function remove(key) {
  try {
    const appDataDir = getAppDataDir();
    const storePath = path.join(appDataDir, 'store.json');
    
    // 如果文件不存在，直接返回成功
    if (!fs.existsSync(storePath)) {
      return true;
    }
    
    // 读取文件
    const fileContent = fs.readFileSync(storePath, 'utf8');
    const storeData = JSON.parse(fileContent);
    
    // 处理嵌套键
    const keys = key.split('.');
    let current = storeData;
    
    // 导航到倒数第二层
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (current === null || current === undefined || !Object.prototype.hasOwnProperty.call(current, k)) {
        // 键路径不存在，视为删除成功
        return true;
      }
      current = current[k];
    }
    
    // 删除最后一个键
    const lastKey = keys[keys.length - 1];
    if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, lastKey)) {
      delete current[lastKey];
    }
    
    // 写入文件
    fs.writeFileSync(storePath, JSON.stringify(storeData, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`删除数据失败: ${error.message}`);
    return false;
  }
}

module.exports = {
  set,
  get,
  remove
}; 