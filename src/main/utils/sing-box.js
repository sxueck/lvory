/**
 * 主进程 sing-box 工具模块导出文件
 * 用于解决路径引用问题
 */

// 从项目根目录的utils模块重新导出sing-box
const path = require('path');
const singboxPath = path.join(__dirname, '..', '..', 'utils', 'sing-box');
const singbox = require(singboxPath);

module.exports = singbox; 