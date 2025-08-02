/**
 * 通用内核下载器模块
 * 支持下载和安装多种内核类型（sing-box, mihomo）
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);
const logger = require('../utils/logger');
const { getAppDataDir, getBinDir } = require('../utils/paths');
const { CORE_TYPES, getCoreConfig, getCurrentPlatformArch } = require('../constants/core-types');

let AdmZip;
try {
  AdmZip = require('adm-zip');
} catch (error) {
  logger.warn(`AdmZip库未安装，解压功能将不可用: ${error.message}`);
}

class UniversalCoreDownloader {
  constructor() {
    this.downloadInProgress = false;
    this.currentDownload = null;
  }

  /**
   * 检查URL是否可达
   * @param {string} url 要检查的URL
   * @param {number} timeout 超时时间（毫秒）
   * @returns {Promise<boolean>} 是否可达
   */
  async checkUrlAvailability(url, timeout = 5000) {
    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'HEAD',
        timeout: timeout,
        headers: {
          'User-Agent': 'lvory-downloader'
        }
      };

      const request = https.request(options, (response) => {
        resolve(response.statusCode >= 200 && response.statusCode < 400);
      });

      request.on('error', () => {
        resolve(false);
      });

      request.on('timeout', () => {
        request.destroy();
        resolve(false);
      });

      request.end();
    });
  }

  /**
   * 获取 GitHub releases 信息
   * @param {string} coreType 内核类型
   * @returns {Promise<Object>} releases 信息
   */
  async getGitHubReleases(coreType) {
    const config = getCoreConfig(coreType);
    const repoUrl = config.downloadUrl.github;
    
    // 从 GitHub URL 提取仓库信息
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error(`Invalid GitHub URL: ${repoUrl}`);
    }

    const [, owner, repo] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${owner}/${repo}/releases`,
        method: 'GET',
        headers: {
          'User-Agent': 'lvory-downloader',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const request = https.request(options, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            const releases = JSON.parse(data);
            resolve(releases);
          } catch (error) {
            reject(new Error(`Failed to parse GitHub API response: ${error.message}`));
          }
        });
      });

      request.on('error', (error) => {
        reject(new Error(`GitHub API request failed: ${error.message}`));
      });

      request.end();
    });
  }

  /**
   * 获取最新版本信息
   * @param {string} coreType 内核类型
   * @returns {Promise<Object>} 最新版本信息
   */
  async getLatestVersion(coreType) {
    try {
      const releases = await this.getGitHubReleases(coreType);
      if (!releases || releases.length === 0) {
        throw new Error('No releases found');
      }

      const latestRelease = releases[0];
      return {
        version: latestRelease.tag_name,
        name: latestRelease.name,
        publishedAt: latestRelease.published_at,
        assets: latestRelease.assets
      };
    } catch (error) {
      logger.error(`获取 ${coreType} 最新版本失败:`, error);
      throw error;
    }
  }

  /**
   * 构建下载URL
   * @param {string} coreType 内核类型
   * @param {string} version 版本号
   * @returns {Object} 下载信息
   */
  buildDownloadInfo(coreType, version) {
    const config = getCoreConfig(coreType);
    const { platform, arch } = getCurrentPlatformArch();
    
    let downloadUrl, archiveName, binaryName;

    if (coreType === CORE_TYPES.SINGBOX) {
      // sing-box 下载逻辑
      const versionWithoutV = version.replace(/^v/, '');
      archiveName = `sing-box-${versionWithoutV}-${platform}-${arch}`;
      
      if (platform === 'windows') {
        archiveName += '.zip';
      } else {
        archiveName += '.tar.gz';
      }
      
      downloadUrl = `https://github.com/SagerNet/sing-box/releases/download/${version}/${archiveName}`;
      binaryName = config.binaryName;
      
    } else if (coreType === CORE_TYPES.MIHOMO) {
      // mihomo 下载逻辑
      const versionWithoutV = version.replace(/^v/, '');
      
      if (platform === 'windows') {
        archiveName = `mihomo-windows-${arch}-${versionWithoutV}.zip`;
      } else if (platform === 'darwin') {
        archiveName = `mihomo-darwin-${arch}-${versionWithoutV}.gz`;
      } else {
        archiveName = `mihomo-linux-${arch}-${versionWithoutV}.gz`;
      }
      
      downloadUrl = `https://github.com/MetaCubeX/mihomo/releases/download/${version}/${archiveName}`;
      binaryName = config.binaryName;
    } else {
      throw new Error(`Unsupported core type: ${coreType}`);
    }

    return {
      downloadUrl,
      archiveName,
      binaryName,
      platform,
      arch
    };
  }

  /**
   * 下载文件
   * @param {string} url 下载URL
   * @param {string} outputPath 输出路径
   * @param {Function} progressCallback 进度回调
   * @returns {Promise<void>}
   */
  async downloadFile(url, outputPath, progressCallback) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);
      
      const request = https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // 处理重定向
          file.close();
          fs.unlinkSync(outputPath);
          return this.downloadFile(response.headers.location, outputPath, progressCallback)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(outputPath);
          return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        }

        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize && progressCallback) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            progressCallback(progress);
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

        file.on('error', (error) => {
          file.close();
          fs.unlinkSync(outputPath);
          reject(error);
        });
      });

      request.on('error', (error) => {
        file.close();
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        reject(error);
      });
    });
  }

  /**
   * 解压文件
   * @param {string} archivePath 压缩文件路径
   * @param {string} extractDir 解压目录
   * @param {string} binaryName 二进制文件名
   * @param {string} coreType 内核类型
   * @returns {Promise<void>}
   */
  async extractArchive(archivePath, extractDir, binaryName, coreType) {
    if (!AdmZip) {
      throw new Error('AdmZip library not available');
    }

    const ext = path.extname(archivePath).toLowerCase();
    
    if (ext === '.zip') {
      // 处理 ZIP 文件
      const zip = new AdmZip(archivePath);
      const entries = zip.getEntries();
      
      for (const entry of entries) {
        if (entry.entryName.endsWith(binaryName) || 
            (coreType === CORE_TYPES.MIHOMO && entry.entryName.includes('mihomo'))) {
          const binaryPath = path.join(extractDir, binaryName);
          fs.writeFileSync(binaryPath, entry.getData());
          
          // 设置执行权限
          if (process.platform !== 'win32') {
            fs.chmodSync(binaryPath, 0o755);
          }
          return;
        }
      }
      throw new Error('Binary file not found in archive');
      
    } else if (ext === '.gz') {
      // 处理 GZ 文件（mihomo 使用）
      const zlib = require('zlib');
      const readStream = fs.createReadStream(archivePath);
      const gunzip = zlib.createGunzip();
      const binaryPath = path.join(extractDir, binaryName);
      const writeStream = fs.createWriteStream(binaryPath);
      
      await streamPipeline(readStream, gunzip, writeStream);
      
      // 设置执行权限
      if (process.platform !== 'win32') {
        fs.chmodSync(binaryPath, 0o755);
      }
      
    } else {
      throw new Error(`Unsupported archive format: ${ext}`);
    }
  }

  /**
   * 下载内核
   * @param {string} coreType 内核类型
   * @param {string} version 版本号（可选，默认最新版本）
   * @param {Object} mainWindow 主窗口对象
   * @returns {Promise<Object>} 下载结果
   */
  async downloadCore(coreType, version = null, mainWindow = null) {
    if (this.downloadInProgress) {
      return { success: false, error: '下载正在进行中' };
    }

    this.downloadInProgress = true;
    
    try {
      // 获取版本信息
      if (!version) {
        const latestVersion = await this.getLatestVersion(coreType);
        version = latestVersion.version;
      }

      logger.info(`开始下载 ${coreType} ${version}`);

      // 构建下载信息
      const downloadInfo = this.buildDownloadInfo(coreType, version);
      const binDir = getBinDir();
      
      // 确保目录存在
      if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
      }

      const archivePath = path.join(binDir, downloadInfo.archiveName);
      const binaryPath = path.join(binDir, downloadInfo.binaryName);

      // 发送开始下载事件
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('core-download-progress', {
          progress: 0,
          message: `开始下载 ${coreType} ${version}`
        });
      }

      // 下载文件
      await this.downloadFile(downloadInfo.downloadUrl, archivePath, (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('core-download-progress', {
            progress,
            message: `下载中... ${progress}%`
          });
        }
      });

      // 解压文件
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('core-download-progress', {
          progress: 90,
          message: '正在解压...'
        });
      }

      await this.extractArchive(archivePath, binDir, downloadInfo.binaryName, coreType);

      // 删除压缩包
      if (fs.existsSync(archivePath)) {
        fs.unlinkSync(archivePath);
      }

      // 验证二进制文件
      if (!fs.existsSync(binaryPath)) {
        throw new Error('解压后未找到二进制文件');
      }

      // 发送完成事件
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('core-download-progress', {
          progress: 100,
          message: '下载完成'
        });
      }

      logger.info(`${coreType} ${version} 下载完成`);
      return { success: true, version, path: binaryPath };

    } catch (error) {
      logger.error(`下载 ${coreType} 失败:`, error);
      
      // 发送错误事件
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('core-download-progress', {
          progress: -1,
          message: error.message
        });
      }
      
      return { success: false, error: error.message };
    } finally {
      this.downloadInProgress = false;
    }
  }

  /**
   * 检查下载是否正在进行
   * @returns {boolean} 是否正在下载
   */
  isDownloading() {
    return this.downloadInProgress;
  }

  /**
   * 取消当前下载
   */
  cancelDownload() {
    if (this.currentDownload) {
      this.currentDownload.destroy();
      this.currentDownload = null;
    }
    this.downloadInProgress = false;
  }
}

// 创建单例实例
const universalCoreDownloader = new UniversalCoreDownloader();

module.exports = universalCoreDownloader;
