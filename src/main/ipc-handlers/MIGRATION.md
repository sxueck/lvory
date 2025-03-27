# IPC处理程序模块迁移说明

本文档记录了从旧目录结构迁移到新目录结构的进度和注意事项。

## 迁移进度

| 模块名称       | 原文件               | 新文件                              | 状态   | 备注                           |
|--------------|---------------------|-----------------------------------|--------|------------------------------|
| 核心          | handlers-registry.js | core/registry.js                  | 完成   | 功能移动并简化                  |
| 核心          | utils.js            | core/utils.js                     | 完成   | 新增标准响应对象功能             |
| 核心          | -                   | core/index.js                     | 完成   | 新增统一核心模块入口             |
| 窗口          | window-handlers.js   | modules/window/handlers.js        | 完成   | 功能完全移植                    |
| 窗口          | -                   | modules/window/index.js           | 完成   | 新增                          |
| SingBox      | singbox-handlers.js  | modules/singbox/handlers.js       | 完成   | 功能完全移植                    |
| SingBox      | -                   | modules/singbox/index.js          | 完成   | 新增                          |
| 下载          | download-handlers.js | modules/download/handlers.js      | 完成   | 功能完全移植，提取工具函数         |
| 下载          | -                   | modules/download/index.js         | 完成   | 新增                          |
| 设置          | settings-handlers.js | modules/settings/handlers.js      | 完成   | 功能完全移植                    |
| 设置          | -                   | modules/settings/index.js         | 完成   | 新增                          |
| 配置文件      | profile-handlers.js  | modules/profile/handlers.js       | 完成   | 功能完全移植                    |
| 配置文件      | -                   | modules/profile/index.js          | 完成   | 新增                          |
| 更新          | update-handlers.js   | modules/update/handlers.js        | 完成   | 功能完全移植                     |
| 更新          | -                   | modules/update/index.js           | 完成   | 新增                          |
| 节点历史      | node-history-handlers.js | modules/node-history/handlers.js| 完成   | 功能完全移植                     |
| 节点历史      | -                   | modules/node-history/index.js     | 完成   | 新增                          |
| 状态检查      | status-handlers.js   | modules/status/handlers.js        | 完成   | 功能完全移植                     |
| 状态检查      | -                   | modules/status/index.js           | 完成   | 新增                          |
| 同步操作      | sync-handlers.js     | modules/sync/handlers.js          | 完成   | 功能完全移植                     |
| 同步操作      | -                   | modules/sync/index.js             | 完成   | 新增                          |

## 主入口修改

主入口文件 `index.js` 已经完成修改，实现了基于新目录结构的模块加载机制。现在新增了模块名称到模块目录的映射，确保正确加载所有模块。

## 移除的文件

以下文件已被移除，因为它们的功能未在项目中实际使用：

1. `decorator.js` - 装饰器功能未被项目使用
2. `lazy-loader.js` - 懒加载功能未被项目使用

以下文件已被移除，因为它们已完全迁移到新的模块化结构中：

1. handlers-registry.js（已迁移到core/registry.js）
2. utils.js（已迁移到core/utils.js）
3. window-handlers.js（已迁移到modules/window/handlers.js）
4. singbox-handlers.js（已迁移到modules/singbox/handlers.js）
5. download-handlers.js（已迁移到modules/download/handlers.js）
6. settings-handlers.js（已迁移到modules/settings/handlers.js）
7. profile-handlers.js（已迁移到modules/profile/handlers.js）
8. update-handlers.js（已迁移到modules/update/handlers.js）
9. node-history-handlers.js（已迁移到modules/node-history/handlers.js）
10. status-handlers.js（已迁移到modules/status/handlers.js）
11. sync-handlers.js（已迁移到modules/sync/handlers.js）

## 迁移注意事项

1. 从utils.js提取的通用工具函数被移动到core/utils.js，提供了更通用的功能
2. 模块间的依赖关系通过直接引用模块来实现，例如download/handlers.js提供的getConfigDir等函数被profile模块使用
3. 所有模块的handlers.js都使用同一种模式：定义和导出handlers对象
4. 所有模块的index.js都使用同一种模式：导出setup函数

## 后续工作

1. ~~完成剩余模块的迁移~~ (已完成)
2. ~~清理重复的旧处理程序文件~~ (已完成)
3. 确保各模块之间的依赖关系正确
4. 全面测试各功能模块
5. 更新文档 