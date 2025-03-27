/**
 * 更新相关IPC处理程序
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const logger = require('../../../utils/logger');
const { getAppDataDir } = require('../../../../utils/paths');
const { createResponse, getMainWindow } = require('../../../utils');

// 获取配置文件目录
function getConfigDir() {
  // 使用getAppDataDir而不是app.getPath('userData')，保持一致性
  const appDataDir = getAppDataDir();
  const configDir = path.join(appDataDir, 'configs');
  
  // 确保目录存在
  if (!fs.existsSync(configDir)) {
    try {
      fs.mkdirSync(configDir, { recursive: true });
    } catch (error) {
      logger.error(`创建配置目录失败: ${error.message}`);
    }
  }
  
  return configDir;
}

// 读取元数据缓存
function readMetaCache() {
  try {
    const configDir = getConfigDir();
    const metaCachePath = path.join(configDir, 'meta.cache');
    
    if (!fs.existsSync(metaCachePath)) {
      return {};
    }
    
    const data = fs.readFileSync(metaCachePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    logger.error('读取元数据缓存失败:', error);
    return {};
  }
}

// 写入元数据缓存
function writeMetaCache(data) {
  try {
    const configDir = getConfigDir();
    const metaCachePath = path.join(configDir, 'meta.cache');
    
    fs.writeFileSync(metaCachePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    logger.error('写入元数据缓存失败:', error);
    return false;
  }
}

// 处理程序对象
const handlers = {
  // 更新配置文件并更新状态
  'updateProfile': async (event, fileName) => {
    try {
      if (!fileName) {
        return createResponse(false, null, { message: '文件名不能为空' });
      }
      
      const configDir = getConfigDir();
      
      // 获取元数据
      let metaCache = readMetaCache();
      let metadata = metaCache[fileName];
      
      // 如果没有元数据，则无法更新
      if (!metadata || !metadata.url) {
        return createResponse(false, null, { message: '找不到该文件的更新来源' });
      }
      
      // 开始更新
      logger.info(`开始更新配置文件: ${fileName}, URL: ${metadata.url}`);
      
      // 使用适当的协议
      const parsedUrl = new URL(metadata.url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      return new Promise((resolve, reject) => {
        // 创建请求
        const request = protocol.get(metadata.url, (response) => {
          // 检查状态码
          if (response.statusCode !== 200) {
            // 更新失败计数
            metadata.failCount = (metadata.failCount || 0) + 1;
            if (metadata.failCount >= 3) {
              metadata.status = 'failed';
              logger.warn(`配置文件更新失败3次以上，标记为失效: ${fileName}`);
            }
            
            // 更新元数据
            metaCache[fileName] = metadata;
            writeMetaCache(metaCache);
            
            let errorMessage = `HTTP Error: ${response.statusCode}`;
            if (response.statusCode === 404) {
              errorMessage = 'File not found on server (404)';
            } else if (response.statusCode === 403) {
              errorMessage = 'Access forbidden (403)';
            } else if (response.statusCode === 401) {
              errorMessage = 'Authentication required (401)';
            } else if (response.statusCode >= 500) {
              errorMessage = 'Server error, please try again later';
            }
            
            reject(new Error(errorMessage));
            return;
          }
          
          // 检查内容类型
          const contentType = response.headers['content-type'];
          if (contentType && contentType.includes('text/html') && !metadata.url.endsWith('.html')) {
            // 更新失败计数
            metadata.failCount = (metadata.failCount || 0) + 1;
            if (metadata.failCount >= 3) {
              metadata.status = 'failed';
            }
            
            // 更新元数据
            metaCache[fileName] = metadata;
            writeMetaCache(metaCache);
            
            reject(new Error('Server returned HTML instead of a file. This URL may be a web page, not a downloadable file.'));
            return;
          }
          
          const filePath = path.join(configDir, fileName);
          
          // 创建写入流
          const file = fs.createWriteStream(filePath);
          
          // 将响应流导向文件
          response.pipe(file);
          
          // 处理写入错误
          file.on('error', (err) => {
            file.close();
            
            // 更新失败计数
            metadata.failCount = (metadata.failCount || 0) + 1;
            if (metadata.failCount >= 3) {
              metadata.status = 'failed';
            }
            
            // 更新元数据
            metaCache[fileName] = metadata;
            writeMetaCache(metaCache);
            
            reject(new Error(`Failed to write file: ${err.message}`));
          });
          
          // 文件写入完成
          file.on('finish', () => {
            file.close();
            
            // 更新元数据
            metadata.lastUpdated = new Date().toISOString();
            metadata.updateCount = (metadata.updateCount || 0) + 1;
            metadata.failCount = 0; // 成功后重置失败计数
            metadata.status = 'active';
            
            // 更新元数据
            metaCache[fileName] = metadata;
            writeMetaCache(metaCache);
            
            // 通知前端
            const mainWindow = getMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('profile-updated', {
                success: true,
                fileName: fileName
              });
            }
            
            resolve(createResponse(true, {
              message: `配置文件已更新: ${fileName}`
            }));
          });
        });
        
        // 处理请求错误
        request.on('error', (err) => {
          logger.error(`更新请求错误: ${err.message}`);
          
          // 更新失败计数
          metadata.failCount = (metadata.failCount || 0) + 1;
          if (metadata.failCount >= 3) {
            metadata.status = 'failed';
          }
          
          // 更新元数据
          metaCache[fileName] = metadata;
          writeMetaCache(metaCache);
          
          let errorMessage = err.message;
          if (err.code === 'ENOTFOUND') {
            errorMessage = 'Host not found. Please check your URL or internet connection.';
          } else if (err.code === 'ECONNREFUSED') {
            errorMessage = 'Connection refused. The server may be down or blocking requests.';
          } else if (err.code === 'ECONNRESET') {
            errorMessage = 'Connection reset. The connection was forcibly closed by the remote server.';
          } else if (err.code === 'ETIMEDOUT') {
            errorMessage = 'Connection timed out. The server took too long to respond.';
          }
          
          reject(new Error(errorMessage));
        });
        
        // 设置请求超时
        request.setTimeout(30000, () => {
          request.abort();
          
          // 更新失败计数
          metadata.failCount = (metadata.failCount || 0) + 1;
          if (metadata.failCount >= 3) {
            metadata.status = 'failed';
          }
          
          // 更新元数据
          metaCache[fileName] = metadata;
          writeMetaCache(metaCache);
          
          reject(new Error('Download request timed out. The server is taking too long to respond.'));
        });
      });
    } catch (error) {
      logger.error(`更新配置文件失败: ${error.message}`);
      return createResponse(false, null, error);
    }
  },
  
  // 更新所有配置文件
  'updateAllProfiles': async () => {
    try {
      const configDir = getConfigDir();
      const metaCache = readMetaCache();
      
      // 如果meta.cache为空，无法更新
      if (Object.keys(metaCache).length === 0) {
        return createResponse(false, null, {
          message: '没有可更新的配置文件信息'
        });
      }
      
      // 筛选可更新的文件
      const files = Object.keys(metaCache).filter(fileName => {
        const metadata = metaCache[fileName];
        return metadata && metadata.url && fs.existsSync(path.join(configDir, fileName));
      });
      
      if (files.length === 0) {
        return createResponse(true, {
          message: '没有找到可更新的配置文件',
          updatedFiles: []
        });
      }
      
      logger.info(`开始批量更新${files.length}个配置文件`);
      
      const results = [];
      
      // 依次更新每个文件
      for (const fileName of files) {
        try {
          // 使用updateProfile处理程序更新
          const result = await handlers.updateProfile({}, fileName);
          
          if (result.success) {
            results.push({
              fileName,
              success: true
            });
          } else {
            results.push({
              fileName,
              success: false,
              error: result.error
            });
          }
        } catch (error) {
          logger.error(`更新${fileName}失败: ${error.message}`);
          results.push({
            fileName,
            success: false,
            error: error.message
          });
        }
      }
      
      return createResponse(true, {
        message: `批量更新完成, 共${results.length}个文件, ${results.filter(r => r.success).length}个成功`,
        results
      });
    } catch (error) {
      logger.error(`批量更新配置文件失败: ${error.message}`);
      return createResponse(false, null, error);
    }
  }
};

// 导出模块
module.exports = {
  handlers,
  readMetaCache,
  writeMetaCache,
  getConfigDir
}; 