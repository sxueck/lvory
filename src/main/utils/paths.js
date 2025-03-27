/**
 * 主进程路径工具模块导出文件
 * 用于解决路径引用问题
 */

// 从项目根目录的utils模块重新导出paths
const path = require('path');
const pathsPath = path.join(__dirname, '..', '..', 'utils', 'paths');
const paths = require(pathsPath);

module.exports = paths; 