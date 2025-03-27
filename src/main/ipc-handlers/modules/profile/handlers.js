/**
 * 配置文件相关IPC处理程序
 */
const { dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('../../../../utils/logger');
const profileManager = require('../../../profile-manager');
const mappingDefinition = require('../../../engine/mapping-definition');
const profileEngine = require('../../../engine/profiles-engine');
const { createResponse, getMainWindow } = require('../../../utils');
const { getConfigDir, readMetaCache, writeMetaCache } = require('../download/handlers');

// 配置文件相关处理程序
const handlers = {
  'get-config-path': async () => {
    try {
      const configPath = profileManager.getConfigPath();
      return createResponse(true, { path: configPath });
    } catch (error) {
      logger.error('获取配置文件路径失败:', error);
      return createResponse(false, null, error);
    }
  },
  
  'set-config-path': async (event, filePath) => {
    try {
      if (!filePath) {
        return createResponse(false, null, '文件路径不能为空');
      }
      
      const configDir = getConfigDir();
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(configDir, filePath);
      
      if (!fs.existsSync(fullPath)) {
        return createResponse(false, null, `文件不存在: ${fullPath}`);
      }
      
      const success = profileManager.setConfigPath(fullPath);
      if (success) {
        logger.info(`设置配置文件路径: ${fullPath}`);
        return createResponse(true, { configPath: fullPath });
      } else {
        return createResponse(false, null, '设置配置文件路径失败');
      }
    } catch (error) {
      logger.error('设置配置文件路径失败:', error);
      return createResponse(false, null, error);
    }
  },
  
  'get-profile-data': async () => {
    try {
      const outbounds = profileManager.scanProfileConfig();
      
      const profileData = outbounds.map(item => ({
        tag: item.tag,
        type: item.type,
        server: item.server || '',
        description: `${item.type || 'Unknown'} - ${item.server || 'N/A'}`
      }));
      
      return createResponse(true, { profiles: profileData });
    } catch (error) {
      logger.error('获取配置文件数据失败:', error);
      return createResponse(false, { profiles: [] }, error);
    }
  },
  
  'getProfileFiles': async () => {
    try {
      const configDir = getConfigDir();
      
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
        return createResponse(true, { files: [] });
      }
      
      const files = fs.readdirSync(configDir)
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ext === '.json';
        })
        .map(file => {
          const filePath = path.join(configDir, file);
          const stats = fs.statSync(filePath);
          
          let status = 'active';
          try {
            const metaCache = readMetaCache();
            if (metaCache[file] && metaCache[file].status) {
              status = metaCache[file].status;
            }
          } catch (err) {
            logger.error(`读取文件状态失败: ${err.message}`);
          }
          
          return {
            name: file,
            path: filePath,
            size: `${Math.round(stats.size / 1024)} KB`,
            createDate: new Date(stats.birthtime).toLocaleDateString(),
            modifiedDate: new Date(stats.mtime).toLocaleDateString(),
            status: status
          };
        });
      
      logger.info(`找到${files.length}个配置文件`);
      return createResponse(true, { files });
    } catch (error) {
      logger.error(`获取配置文件列表失败: ${error.message}`);
      return createResponse(false, { files: [] }, error);
    }
  },
  
  'getProfileMetadata': async (event, fileName) => {
    try {
      if (!fileName) {
        return createResponse(false, null, 'File name is required');
      }
      
      const metaCache = readMetaCache();
      if (metaCache[fileName]) {
        logger.info(`获取元数据: ${fileName}`);
        return createResponse(true, { metadata: metaCache[fileName] });
      }
      
      return createResponse(false, null, 'Metadata not found for this file');
    } catch (error) {
      logger.error(`获取配置文件元数据失败: ${error.message}`);
      return createResponse(false, null, error);
    }
  },
  
  'openConfigDir': async () => {
    try {
      const configDir = getConfigDir();
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      await shell.openPath(configDir);
      return createResponse(true);
    } catch (error) {
      logger.error(`打开配置目录失败: ${error.message}`);
      return createResponse(false, null, error);
    }
  },
  
  'get-user-config': async () => {
    try {
      const userConfig = profileManager.loadUserConfig();
      return createResponse(true, { config: userConfig });
    } catch (error) {
      logger.error('获取用户配置失败:', error);
      return createResponse(false, null, error);
    }
  },
  
  'save-user-config': async (event, config) => {
    try {
      if (!config) {
        return createResponse(false, null, '配置不能为空');
      }
      
      const success = profileManager.saveUserConfig(config);
      if (success) {
        logger.info('用户配置已保存');
        
        const mainWindow = getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send('user-config-updated');
        }
        
        return createResponse(true);
      } else {
        return createResponse(false, null, '保存用户配置失败');
      }
    } catch (error) {
      logger.error('保存用户配置失败:', error);
      return createResponse(false, null, error);
    }
  },
  
  'exportProfile': async (event, fileName) => {
    try {
      if (!fileName) {
        return createResponse(false, null, '文件名不能为空');
      }
      
      const configDir = getConfigDir();
      const filePath = path.join(configDir, fileName);
      
      if (!fs.existsSync(filePath)) {
        return createResponse(false, null, `文件不存在: ${filePath}`);
      }
      
      const result = await dialog.showSaveDialog({
        title: '导出配置文件',
        defaultPath: path.join(process.env.HOME || process.env.USERPROFILE, fileName),
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (result.canceled) {
        return createResponse(true, { exported: false, reason: 'canceled' });
      }
      
      fs.copyFileSync(filePath, result.filePath);
      logger.info(`配置文件已导出: ${result.filePath}`);
      
      return createResponse(true, { exported: true, path: result.filePath });
    } catch (error) {
      logger.error(`导出配置文件失败: ${error.message}`);
      return createResponse(false, null, error);
    }
  },
  
  'renameProfile': async (event, { oldName, newName }) => {
    try {
      if (!oldName || !newName) {
        return createResponse(false, null, '文件名不能为空');
      }
      
      const configDir = getConfigDir();
      const oldPath = path.join(configDir, oldName);
      const newPath = path.join(configDir, newName);
      
      if (!fs.existsSync(oldPath)) {
        return createResponse(false, null, `文件不存在: ${oldPath}`);
      }
      
      if (fs.existsSync(newPath)) {
        return createResponse(false, null, `文件已存在: ${newPath}`);
      }
      
      fs.renameSync(oldPath, newPath);
      logger.info(`配置文件已重命名: ${oldName} -> ${newName}`);
      
      return createResponse(true);
    } catch (error) {
      logger.error(`重命名配置文件失败: ${error.message}`);
      return createResponse(false, null, error);
    }
  },
  
  'deleteProfile': async (event, fileName) => {
    try {
      if (!fileName) {
        return createResponse(false, null, '文件名不能为空');
      }
      
      const configDir = getConfigDir();
      const filePath = path.join(configDir, fileName);
      
      if (!fs.existsSync(filePath)) {
        return createResponse(false, null, `文件不存在: ${filePath}`);
      }
      
      fs.unlinkSync(filePath);
      logger.info(`配置文件已删除: ${fileName}`);
      
      return createResponse(true);
    } catch (error) {
      logger.error(`删除配置文件失败: ${error.message}`);
      return createResponse(false, null, error);
    }
  }
};

module.exports = handlers; 