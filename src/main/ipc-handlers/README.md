# IPC处理程序模块

本目录包含Electron主进程的IPC通信处理程序，用于处理渲染进程发送的请求和事件。

## 目录结构

新的目录结构按功能模块进行分组，使代码更具有组织性和可维护性：

```
ipc-handlers/
├── core/                   # 核心功能模块
│   ├── registry.js         # 处理程序注册表和管理功能
│   ├── utils.js            # 通用工具函数
│   └── index.js            # 核心功能入口
├── modules/                # 功能模块目录
│   ├── window/             # 窗口管理模块
│   │   ├── handlers.js     # 窗口相关处理程序
│   │   └── index.js        # 模块入口
│   ├── profile/            # 配置文件模块
│   │   ├── handlers.js     # 配置相关处理程序
│   │   └── index.js        # 模块入口
│   ├── singbox/            # SingBox模块
│   │   ├── handlers.js     # SingBox相关处理程序
│   │   └── index.js        # 模块入口
│   ├── download/           # 下载模块
│   │   ├── handlers.js     # 下载相关处理程序
│   │   └── index.js        # 模块入口
│   ├── settings/           # 设置模块
│   │   ├── handlers.js     # 设置相关处理程序
│   │   └── index.js        # 模块入口
│   ├── update/             # 更新模块
│   │   ├── handlers.js     # 更新相关处理程序
│   │   └── index.js        # 模块入口
│   ├── node-history/       # 节点历史模块
│   │   ├── handlers.js     # 节点历史数据相关处理程序
│   │   └── index.js        # 模块入口
│   ├── status/             # 状态检查模块
│   │   ├── handlers.js     # 状态检查相关处理程序
│   │   └── index.js        # 模块入口
│   └── sync/               # 同步操作模块
│       ├── handlers.js     # 同步操作相关处理程序
│       └── index.js        # 模块入口
└── index.js                # 入口文件，处理程序加载和初始化
```

## 使用方法

### 创建新的处理程序模块

1. 在`modules`目录下创建新的模块目录，例如`modules/example/`
2. 在模块目录中创建`handlers.js`和`index.js`文件
3. 在主`index.js`中注册新模块

模块结构示例：

#### `modules/example/handlers.js`

```javascript
/**
 * 示例IPC处理程序
 */
const logger = require('../../../../utils/logger');

// 处理程序对象
const handlers = {
  // 处理程序示例
  'example-handler': async (event, param) => {
    try {
      // 处理逻辑
      return { success: true, data: 'Example result' };
    } catch (error) {
      logger.error('示例处理程序错误:', error);
      return { success: false, error: error.message };
    }
  }
};

// 监听器类型处理程序
const listeners = {
  // 监听器示例
  'example-listener': (event, data) => {
    // 处理逻辑
    console.log('收到事件:', data);
  }
};

module.exports = {
  handlers,
  listeners
};
```

#### `modules/example/index.js`

```javascript
/**
 * 示例模块入口
 */
const { ipcMain } = require('electron');
const logger = require('../../../../utils/logger');
const { register } = require('../../core/registry');
const { handlers, listeners } = require('./handlers');

/**
 * 设置处理程序
 */
function setup() {
  // 注册普通处理程序
  register('ExampleModule', handlers);
  
  // 注册监听器类型处理程序
  Object.entries(listeners).forEach(([channel, handler]) => {
    ipcMain.on(channel, handler);
  });
  
  logger.info('示例IPC处理程序注册完成');
}

// 导出模块
module.exports = {
  setup
};
```

### 在主入口中注册新模块

在`ipc-handlers/index.js`中的`moduleList`中添加新模块：

```javascript
// 模块列表
const moduleList = [
  // 核心模块
  'window',
  'profile', 
  'singbox',
  'sync',
  // 其他模块
  'download',
  'settings',
  'update',
  'nodeHistory',
  'status',
  'example'  // 新增模块
];
```

### 在渲染进程中使用

在渲染进程中，可以通过Electron的IPC模块调用处理程序：

```javascript
// 调用处理程序
const result = await window.electron.ipcRenderer.invoke('example-handler', { param: 'value' });

// 监听事件
window.electron.ipcRenderer.on('example-listener', (event, data) => {
  console.log('收到事件:', data);
});
```

## 处理程序注册表

`core/registry.js`提供了处理程序的注册和管理功能，包括：

- 注册处理程序
- 移除处理程序
- 检查处理程序是否已注册
- 获取所有已注册的通道
- 获取注册历史记录

使用`register`函数可以批量注册处理程序：

```javascript
const { register } = require('../../core/registry');

register('ModuleName', {
  'channel-name': handlerFunction
});
``` 