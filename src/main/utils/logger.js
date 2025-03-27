/**
 * 主进程日志工具模块导出文件
 * 用于解决路径引用问题
 */

// 从项目根目录的utils模块重新导出logger
const path = require('path');
const loggerPath = path.join(__dirname, '..', '..', 'utils', 'logger');
const logger = require(loggerPath);

module.exports = logger; 