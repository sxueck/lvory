const { ipcMain } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { pipeline } = require('stream');
const logger = require('../../utils/logger');
const utils = require('./utils');
const { CORE_TYPES, getCoreConfig } = require('../../constants/core-types');
const universalDownloader = require('../core-downloader-universal');

const streamPipeline = promisify(pipeline);

/**
 * 获取sing-box GitHub releases
 */
async function getSingBoxReleases() {
  return new Promise((resolve) => {
    try {
      const options = {
        hostname: 'api.github.com',
        path: '/repos/SagerNet/sing-box/releases?per_page=50',
        method: 'GET',
        headers: {
          'User-Agent': 'lvory-core-manager',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const releases = JSON.parse(data);
            if (!Array.isArray(releases)) {
              resolve({
                success: false,
                error: '无效的响应格式'
              });
              return;
            }

            // 过滤和格式化releases - 支持stable和alpha版本
            const formattedReleases = releases
              .filter(release => {
                // 排除草稿版本
                if (release.draft) return false;

                // 支持标准版本 (v1.11.9) 和 alpha 版本 (v1.12.0-alpha.1)
                const versionPattern = /^v\d+\.\d+\.\d+(-alpha\.\d+)?$/;
                return release.tag_name.match(versionPattern);
              })
              .map(release => ({
                id: release.id,
                tag_name: release.tag_name,
                name: release.name,
                published_at: release.published_at,
                prerelease: release.prerelease,
                body: release.body,
                assets: release.assets,
                // 添加版本类型标识
                version_type: release.tag_name.includes('-alpha') ? 'alpha' : 'stable'
              }))
              .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

            resolve({
              success: true,
              releases: formattedReleases
            });
          } catch (parseError) {
            logger.error('解析GitHub releases响应失败:', parseError);
            resolve({
              success: false,
              error: '解析响应失败'
            });
          }
        });
      });

      req.on('error', (error) => {
        logger.error('获取sing-box releases失败:', error);
        resolve({
          success: false,
          error: error.message
        });
      });

      req.setTimeout(30000, () => {
        req.destroy();
        resolve({
          success: false,
          error: '请求超时'
        });
      });

      req.end();
    } catch (error) {
      logger.error('获取sing-box releases异常:', error);
      resolve({
        success: false,
        error: error.message
      });
    }
  });
}

/**
 * 获取已安装的内核版本列表
 */
function getInstalledVersions() {
  try {
    const appDataDir = utils.getAppDataDir();
    const coresDir = path.join(appDataDir, 'cores');
    
    if (!fs.existsSync(coresDir)) {
      return { success: true, versions: [] };
    }

    const versions = fs.readdirSync(coresDir)
      .filter(item => {
        const itemPath = path.join(coresDir, item);
        return fs.statSync(itemPath).isDirectory() && item.match(/^\d+\.\d+\.\d+$/);
      })
      .sort((a, b) => {
        // 版本号排序
        const aParts = a.split('.').map(Number);
        const bParts = b.split('.').map(Number);
        
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aPart = aParts[i] || 0;
          const bPart = bParts[i] || 0;
          if (aPart !== bPart) {
            return bPart - aPart; // 降序排列
          }
        }
        return 0;
      });

    return { success: true, versions };
  } catch (error) {
    logger.error('获取已安装版本失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 下载指定版本的sing-box内核
 */
async function downloadVersion(version) {
  try {
    const appDataDir = utils.getAppDataDir();
    const coresDir = path.join(appDataDir, 'cores');
    const versionDir = path.join(coresDir, version);
    
    // 检查版本是否已存在
    if (fs.existsSync(versionDir)) {
      return { success: false, error: '该版本已存在' };
    }

    // 确保目录存在
    if (!fs.existsSync(coresDir)) {
      fs.mkdirSync(coresDir, { recursive: true });
    }
    fs.mkdirSync(versionDir, { recursive: true });

    // 确定平台和架构
    const platform = process.platform;
    const arch = process.arch === 'x64' ? 'amd64' : process.arch;
    
    let downloadUrl;
    let binaryName;
    let archiveName;
    
    if (platform === 'win32') {
      downloadUrl = `https://github.com/SagerNet/sing-box/releases/download/v${version}/sing-box-${version}-windows-${arch}.zip`;
      binaryName = 'sing-box.exe';
      archiveName = 'sing-box.zip';
    } else if (platform === 'darwin') {
      downloadUrl = `https://github.com/SagerNet/sing-box/releases/download/v${version}/sing-box-${version}-darwin-${arch}.tar.gz`;
      binaryName = 'sing-box';
      archiveName = 'sing-box.tar.gz';
    } else if (platform === 'linux') {
      downloadUrl = `https://github.com/SagerNet/sing-box/releases/download/v${version}/sing-box-${version}-linux-${arch}.tar.gz`;
      binaryName = 'sing-box';
      archiveName = 'sing-box.tar.gz';
    } else {
      return { success: false, error: `不支持的平台: ${platform}` };
    }

    const archivePath = path.join(versionDir, archiveName);
    const binaryPath = path.join(versionDir, binaryName);

    logger.info(`开始下载sing-box ${version} from ${downloadUrl}`);

    // 下载文件
    await downloadFile(downloadUrl, archivePath);
    
    // 解压文件
    await extractArchive(archivePath, versionDir, binaryName, version, platform, arch);
    
    // 删除压缩包
    if (fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath);
    }

    // 验证二进制文件
    if (!fs.existsSync(binaryPath)) {
      throw new Error('解压后未找到二进制文件');
    }

    // 设置执行权限 (非Windows)
    if (platform !== 'win32') {
      fs.chmodSync(binaryPath, 0o755);
    }

    logger.info(`sing-box ${version} 下载完成`);
    return { success: true };

  } catch (error) {
    logger.error(`下载sing-box ${version} 失败:`, error);
    
    // 清理失败的下载
    const versionDir = path.join(utils.getAppDataDir(), 'cores', version);
    if (fs.existsSync(versionDir)) {
      try {
        fs.rmSync(versionDir, { recursive: true, force: true });
      } catch (cleanupError) {
        logger.error('清理失败下载目录时出错:', cleanupError);
      }
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * 获取系统代理设置
 */
function getSystemProxy() {
  try {
    // 从环境变量获取代理设置
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;

    if (httpProxy || httpsProxy) {
      const proxyUrl = httpsProxy || httpProxy;
      const url = new URL(proxyUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port, 10),
        auth: url.username && url.password ? `${url.username}:${url.password}` : null
      };
    }

    return null;
  } catch (error) {
    logger.error('获取系统代理失败:', error);
    return null;
  }
}

/**
 * 下载文件
 */
function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    const protocol = url.startsWith('https:') ? https : http;

    // 获取系统代理设置
    const proxy = getSystemProxy();
    const options = new URL(url);

    let requestOptions = {
      hostname: options.hostname,
      port: options.port,
      path: options.pathname + options.search,
      method: 'GET',
      headers: {
        'User-Agent': 'lvory-core-manager'
      }
    };

    // 如果有代理设置，使用代理
    if (proxy) {
      requestOptions = {
        hostname: proxy.host,
        port: proxy.port,
        path: url,
        method: 'GET',
        headers: {
          'User-Agent': 'lvory-core-manager',
          'Host': options.hostname
        }
      };

      if (proxy.auth) {
        requestOptions.headers['Proxy-Authorization'] = `Basic ${Buffer.from(proxy.auth).toString('base64')}`;
      }
    }

    const request = protocol.request(requestOptions, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // 处理重定向
        file.close();
        fs.unlinkSync(filePath);
        downloadFile(response.headers.location, filePath).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filePath);
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      streamPipeline(response, file)
        .then(() => resolve())
        .catch(reject);
    });
    
    request.on('error', (error) => {
      file.close();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      reject(error);
    });
    
    request.setTimeout(60000, () => {
      request.destroy();
      file.close();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      reject(new Error('下载超时'));
    });
  });
}

/**
 * 解压文件
 */
async function extractArchive(archivePath, extractDir, binaryName, version, platform, arch) {
  try {
    if (platform === 'win32') {
      // 使用adm-zip解压Windows zip文件
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(archivePath);
      const entries = zip.getEntries();

      // 查找二进制文件
      const binaryEntry = entries.find(entry =>
        entry.entryName.endsWith(binaryName) && !entry.isDirectory
      );

      if (!binaryEntry) {
        throw new Error('压缩包中未找到二进制文件');
      }

      // 提取二进制文件
      const binaryPath = path.join(extractDir, binaryName);
      fs.writeFileSync(binaryPath, binaryEntry.getData());

      logger.info(`Windows平台解压完成: ${binaryPath}`);
    } else {
      // Linux/macOS 使用tar
      const { execSync } = require('child_process');
      const extractedFolderName = `sing-box-${version}-${platform}-${arch}`;

      try {
        execSync(`tar -xzf "${archivePath}" -C "${extractDir}"`, { stdio: 'pipe' });
      } catch (tarError) {
        logger.error('tar解压失败:', tarError);
        throw new Error(`解压失败: ${tarError.message}`);
      }

      // 移动二进制文件到版本目录
      const extractedBinaryPath = path.join(extractDir, extractedFolderName, binaryName);
      const targetBinaryPath = path.join(extractDir, binaryName);

      if (fs.existsSync(extractedBinaryPath)) {
        fs.renameSync(extractedBinaryPath, targetBinaryPath);

        // 删除解压的文件夹
        const extractedDir = path.join(extractDir, extractedFolderName);
        if (fs.existsSync(extractedDir)) {
          fs.rmSync(extractedDir, { recursive: true, force: true });
        }

        logger.info(`Unix平台解压完成: ${targetBinaryPath}`);
      } else {
        throw new Error(`解压后未找到二进制文件: ${extractedBinaryPath}`);
      }
    }
  } catch (error) {
    logger.error('解压文件失败:', error);
    throw error;
  }
}

/**
 * 设置IPC处理程序
 */
function setup() {
  // 获取sing-box releases
  ipcMain.handle('core-manager-get-singbox-releases', async () => {
    return await getSingBoxReleases();
  });

  // 获取已安装版本
  ipcMain.handle('core-manager-get-installed-versions', async () => {
    return getInstalledVersions();
  });

  // 下载版本
  ipcMain.handle('core-manager-download-version', async (event, version) => {
    return await downloadVersion(version);
  });

  // 切换版本
  ipcMain.handle('core-manager-switch-version', async (event, version) => {
    try {
      const appDataDir = utils.getAppDataDir();
      const coresDir = path.join(appDataDir, 'cores');
      const versionDir = path.join(coresDir, version);
      const binDir = path.join(appDataDir, 'bin');
      
      if (!fs.existsSync(versionDir)) {
        return { success: false, error: '指定版本不存在' };
      }

      // 确保bin目录存在
      if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
      }

      const platform = process.platform;
      const binaryName = platform === 'win32' ? 'sing-box.exe' : 'sing-box';
      const sourcePath = path.join(versionDir, binaryName);
      const targetPath = path.join(binDir, binaryName);

      if (!fs.existsSync(sourcePath)) {
        return { success: false, error: '版本二进制文件不存在' };
      }

      // 备份当前版本（如果存在）
      if (fs.existsSync(targetPath)) {
        const backupPath = path.join(binDir, `${binaryName}.backup`);
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }
        fs.renameSync(targetPath, backupPath);
      }

      // 复制新版本
      fs.copyFileSync(sourcePath, targetPath);

      // 设置执行权限 (非Windows)
      if (platform !== 'win32') {
        fs.chmodSync(targetPath, 0o755);
      }

      logger.info(`成功切换到sing-box版本 ${version}`);
      return { success: true };

    } catch (error) {
      logger.error(`切换到版本 ${version} 失败:`, error);
      return { success: false, error: error.message };
    }
  });

  // 删除版本
  ipcMain.handle('core-manager-delete-version', async (event, version) => {
    try {
      const appDataDir = utils.getAppDataDir();
      const versionDir = path.join(appDataDir, 'cores', version);
      
      if (!fs.existsSync(versionDir)) {
        return { success: false, error: '指定版本不存在' };
      }

      fs.rmSync(versionDir, { recursive: true, force: true });
      
      logger.info(`成功删除sing-box版本 ${version}`);
      return { success: true };

    } catch (error) {
      logger.error(`删除版本 ${version} 失败:`, error);
      return { success: false, error: error.message };
    }
  });

  // 通用内核版本管理 - 获取 releases
  ipcMain.handle('core-manager-get-releases', async (event, coreType) => {
    try {
      if (coreType === CORE_TYPES.SINGBOX) {
        return await getSingBoxReleases();
      } else if (coreType === CORE_TYPES.MIHOMO) {
        const releases = await universalDownloader.getGitHubReleases(coreType);
        return {
          success: true,
          releases: releases.map(release => ({
            tag_name: release.tag_name,
            name: release.name,
            published_at: release.published_at,
            prerelease: release.prerelease
          }))
        };
      } else {
        return { success: false, error: `不支持的内核类型: ${coreType}` };
      }
    } catch (error) {
      logger.error(`获取 ${coreType} releases 失败:`, error);
      return { success: false, error: error.message };
    }
  });

  // 通用内核版本管理 - 下载版本
  ipcMain.handle('core-manager-download-core', async (event, coreType, version) => {
    try {
      const utils = require('./utils');
      const mainWindow = utils.getMainWindow();

      const result = await universalDownloader.downloadCore(coreType, version, mainWindow);
      return result;
    } catch (error) {
      logger.error(`下载 ${coreType} ${version} 失败:`, error);
      return { success: false, error: error.message };
    }
  });

  // 通用内核版本管理 - 获取最新版本
  ipcMain.handle('core-manager-get-latest-version', async (event, coreType) => {
    try {
      const latestVersion = await universalDownloader.getLatestVersion(coreType);
      return { success: true, version: latestVersion };
    } catch (error) {
      logger.error(`获取 ${coreType} 最新版本失败:`, error);
      return { success: false, error: error.message };
    }
  });

  // 检查内核是否已安装
  ipcMain.handle('core-manager-check-core-installed', async (event, coreType) => {
    try {
      const config = getCoreConfig(coreType);
      const appDataDir = utils.getAppDataDir();
      const binaryPath = path.join(appDataDir, 'bin', config.binaryName);

      const installed = fs.existsSync(binaryPath);
      return { success: true, installed, path: binaryPath };
    } catch (error) {
      logger.error(`检查 ${coreType} 安装状态失败:`, error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  setup
};
