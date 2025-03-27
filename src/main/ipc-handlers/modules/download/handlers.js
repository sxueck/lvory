/**
 * 下载相关IPC处理程序
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const logger = require('../../../../utils/logger');
const { getAppDataDir } = require('../../../../utils/paths');
const { getMainWindow, createResponse } = require('../../core/utils');

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
  const metaCachePath = path.join(getConfigDir(), 'meta.cache');
  
  if (fs.existsSync(metaCachePath)) {
    try {
      const data = fs.readFileSync(metaCachePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('读取meta.cache文件失败:', error);
      return {};
    }
  }
  
  return {};
}

// 写入元数据缓存
function writeMetaCache(cache) {
  const metaCachePath = path.join(getConfigDir(), 'meta.cache');
  
  try {
    fs.writeFileSync(metaCachePath, JSON.stringify(cache, null, 2), 'utf8');
    return true;
  } catch (error) {
    logger.error('写入meta.cache文件失败:', error);
    return false;
  }
}

// 处理程序对象
const handlers = {
  // 下载配置文件
  'download-profile': async (event, data) => {
    try {
      if (!data || typeof data !== 'object') {
        return createResponse(false, null, 'Invalid request format');
      }

      const fileUrl = data.url;
      let customFileName = data.fileName;
      const isDefaultConfig = data.isDefaultConfig === true;
      
      logger.info('开始下载:', fileUrl);
      logger.info('自定义文件名:', customFileName);
      logger.info('设置为默认配置:', isDefaultConfig);
      
      if (!fileUrl || !fileUrl.trim() || typeof fileUrl !== 'string') {
        return createResponse(false, null, 'URL不能为空且必须是字符串');
      }
      
      try {
        const parsedUrl = new URL(fileUrl);
        if (!parsedUrl.protocol || (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:')) {
          return createResponse(false, null, '仅支持HTTP和HTTPS协议');
        }
      } catch (e) {
        return createResponse(false, null, '无效的URL格式: ' + e.message);
      }
      
      // 获取配置文件目录
      const configDir = getConfigDir();
      logger.info('配置目录:', configDir);
      
      // 如果没有提供自定义文件名，从URL中提取
      if (!customFileName) {
        const parsedUrlObj = new URL(fileUrl);
        customFileName = path.basename(parsedUrlObj.pathname) || 'profile.json';
      }
      
      // 如果设置为默认配置，强制文件名为sing-box.json
      if (isDefaultConfig) {
        customFileName = 'sing-box.json';
        logger.info('设置为默认配置，重命名为:', customFileName);
      }
      
      // 确保文件名是安全的
      customFileName = customFileName.replace(/[/\\?%*:|"<>]/g, '-');
      
      // 完整的保存路径
      const filePath = path.join(configDir, customFileName);
      logger.info('文件将保存到:', filePath);
      
      // 检查文件夹是否可写
      try {
        // 检查目录是否可写
        fs.accessSync(configDir, fs.constants.W_OK);
      } catch (err) {
        return createResponse(false, null, '无法写入配置文件夹: ' + err.message);
      }
      
      // 使用适当的协议
      const parsedUrlForProtocol = new URL(fileUrl);
      const protocol = parsedUrlForProtocol.protocol === 'https:' ? https : http;
      const mainWindow = getMainWindow();
      
      return new Promise((resolve, reject) => {
        // 创建请求
        const request = protocol.get(fileUrl, (response) => {
          // 检查状态码
          if (response.statusCode !== 200) {
            let errorMessage = `HTTP错误: ${response.statusCode}`;
            if (response.statusCode === 404) {
              errorMessage = '在服务器上找不到文件 (404)';
            } else if (response.statusCode === 403) {
              errorMessage = '访问被禁止 (403)';
            } else if (response.statusCode === 401) {
              errorMessage = '需要身份验证 (401)';
            } else if (response.statusCode >= 500) {
              errorMessage = '服务器错误，请稍后重试';
            }
            
            reject(new Error(errorMessage));
            return;
          }
          
          // 检查内容类型，如果服务器返回了明确的错误页面类型，可能是被重定向了
          const contentType = response.headers['content-type'];
          if (contentType && contentType.includes('text/html') && !fileUrl.endsWith('.html')) {
            reject(new Error('服务器返回HTML而不是文件。此URL可能是网页，而不是可下载文件。'));
            return;
          }
          
          // 从响应头中获取文件名
          if (!customFileName || customFileName === path.basename(new URL(fileUrl).pathname)) {
            // 优先使用Content-Disposition头
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition) {
              const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
              if (filenameMatch && filenameMatch[1]) {
                customFileName = filenameMatch[1];
                logger.info(`从Content-Disposition头获取的文件名: ${customFileName}`);
              }
            }
          }
          
          customFileName = customFileName.replace(/[/\\?%*:|"<>]/g, '-');
          
          // 如果设置为默认配置，强制文件名为sing-box.json
          if (isDefaultConfig) {
            customFileName = 'sing-box.json';
          }
          
          const filePath = path.join(configDir, customFileName);
          logger.info('文件将保存到:', filePath);
          
          const file = fs.createWriteStream(filePath);
          response.pipe(file);
          
          file.on('error', (err) => {
            file.close();
            fs.unlink(filePath, () => {}); // 删除失败的文件
            reject(new Error(`写入文件失败: ${err.message}`));
          });
          
          // 文件写入完成
          file.on('finish', () => {
            file.close();
            
            // 创建文件元数据
            const metadata = {
              url: fileUrl,
              timestamp: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
              updateCount: 0,
              failCount: 0,
              status: 'active' // 状态：active, failed
            };
            
            try {
              let metaCache = readMetaCache();
              
              metaCache[customFileName] = metadata;
              
              writeMetaCache(metaCache);
              logger.info('配置文件元数据已更新');
            } catch (cacheErr) {
              logger.error(`更新meta.cache失败: ${cacheErr.message}`);
            }
            
            // 通知渲染进程下载完成
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('download-complete', {
                success: true,
                message: `配置文件已保存到: ${filePath}`,
                path: filePath,
                isDefaultConfig: isDefaultConfig,
                url: fileUrl
              });
              
              // 触发profiles-changed事件，通知前端刷新配置文件列表
              mainWindow.webContents.send('profiles-changed');
            }
            
            // 返回成功信息
            resolve(createResponse(true, {
              message: `配置文件已保存到: ${filePath}`,
              path: filePath,
              isDefaultConfig: isDefaultConfig,
              fileName: customFileName
            }));
          });
        });
        
        // 处理请求错误
        request.on('error', (err) => {
          reject(new Error(`下载请求错误: ${err.message}`));
        });
        
        // 设置请求超时
        request.setTimeout(30000, () => {
          request.destroy();
          reject(new Error('下载请求超时'));
        });
      });
    } catch (error) {
      logger.error('下载配置文件错误:', error);
      return createResponse(false, null, error);
    }
  }
};

// 导出所有处理程序和辅助函数（供其他模块使用）
module.exports = {
  handlers,
  getConfigDir,
  readMetaCache,
  writeMetaCache
};
