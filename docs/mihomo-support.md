# Mihomo 内核支持文档

本文档介绍如何在 lvory 中使用 MetaCubeX/mihomo 内核，包括配置方法、功能差异和注意事项。

## 目录

- [概述](#概述)
- [安装和配置](#安装和配置)
- [配置文件格式](#配置文件格式)
- [功能对比](#功能对比)
- [迁移指南](#迁移指南)
- [故障排除](#故障排除)
- [API 参考](#api-参考)

## 概述

lvory 现在支持两种代理内核：

1. **sing-box** - 默认内核，使用 JSON 配置格式
2. **mihomo** - MetaCubeX 开发的 Clash 兼容内核，使用 YAML 配置格式

两种内核都提供相似的功能，但在配置格式和某些特性上有所不同。

## 安装和配置

### 切换内核类型

1. 打开 lvory 应用
2. 进入 **设置** → **内核设置**
3. 在 **内核类型** 下拉菜单中选择 `mihomo`
4. 点击 **下载内核** 按钮下载 mihomo 二进制文件
5. 重启应用以使更改生效

### 自动下载

lvory 会自动从 GitHub releases 下载适合您系统的 mihomo 内核：

- **Windows**: `mihomo-windows-amd64-{version}.zip`
- **macOS**: `mihomo-darwin-amd64-{version}.gz`
- **Linux**: `mihomo-linux-amd64-{version}.gz`

### 手动安装

如果自动下载失败，您可以手动下载并安装：

1. 从 [MetaCubeX/mihomo releases](https://github.com/MetaCubeX/mihomo/releases) 下载对应版本
2. 解压并重命名为 `mihomo.exe`（Windows）或 `mihomo`（macOS/Linux）
3. 将文件放置到 `{AppData}/lvory/bin/` 目录下
4. 确保文件具有执行权限（macOS/Linux）

## 配置文件格式

### Mihomo 配置示例

```yaml
# 基本设置
port: 7890                    # HTTP 代理端口
socks-port: 7891              # SOCKS5 代理端口
mixed-port: 7892              # 混合代理端口（推荐）
allow-lan: false              # 是否允许局域网连接
mode: rule                    # 运行模式：rule/global/direct
log-level: info               # 日志级别

# 外部控制器（API）
external-controller: 127.0.0.1:9090
external-ui: ui               # Web UI 目录

# DNS 配置
dns:
  enable: true
  listen: 0.0.0.0:53
  default-nameserver:
    - 223.5.5.5
    - 8.8.8.8
  nameserver:
    - https://dns.alidns.com/dns-query
    - https://doh.pub/dns-query

# 代理节点
proxies:
  - name: "ss-example"
    type: ss
    server: example.com
    port: 443
    cipher: aes-256-gcm
    password: "your-password"
    
  - name: "vmess-example"
    type: vmess
    server: example.org
    port: 443
    uuid: 12345678-1234-1234-1234-123456789abc
    alterId: 0
    cipher: auto
    tls: true

# 代理组
proxy-groups:
  - name: "PROXY"
    type: select
    proxies:
      - ss-example
      - vmess-example
      - DIRECT
      
  - name: "AUTO"
    type: url-test
    proxies:
      - ss-example
      - vmess-example
    url: 'http://www.gstatic.com/generate_204'
    interval: 300

# 规则
rules:
  - DOMAIN-SUFFIX,google.com,PROXY
  - DOMAIN-KEYWORD,github,PROXY
  - GEOIP,CN,DIRECT
  - MATCH,PROXY
```

### Sing-box 配置示例（对比）

```json
{
  "log": {
    "level": "info"
  },
  "inbounds": [
    {
      "type": "mixed",
      "listen": "127.0.0.1",
      "listen_port": 7892
    }
  ],
  "outbounds": [
    {
      "type": "direct",
      "tag": "direct"
    },
    {
      "type": "shadowsocks",
      "tag": "ss-example",
      "server": "example.com",
      "server_port": 443,
      "method": "aes-256-gcm",
      "password": "your-password"
    }
  ],
  "experimental": {
    "clash_api": {
      "external_controller": "127.0.0.1:9090"
    }
  }
}
```

## 功能对比

| 功能 | Sing-box | Mihomo | 说明 |
|------|----------|--------|------|
| 配置格式 | JSON | YAML | mihomo 使用更易读的 YAML 格式 |
| TUN 模式 | ✅ | ✅ | 两者都支持 TUN 模式 |
| 系统代理 | ✅ | ✅ | 自动设置系统代理 |
| Clash API | ✅ | ✅ | 兼容 Clash API 接口 |
| 规则集 | ✅ | ✅ | 支持规则集和 GeoIP |
| 代理组 | ✅ | ✅ | 支持多种代理组类型 |
| DNS 劫持 | ✅ | ✅ | 支持 DNS 查询劫持 |
| 协议支持 | 更多 | 标准 | sing-box 支持更多协议 |

## 迁移指南

### 从 Sing-box 迁移到 Mihomo

1. **备份现有配置**
   ```bash
   # 备份当前配置文件
   cp config.json config.json.backup
   ```

2. **使用配置转换器**
   ```javascript
   // 在 lvory 中使用内置转换器
   const configConverter = require('./src/utils/config-converter');
   
   await configConverter.convertConfig(
     'config.json',           // 源文件
     'config.yaml',           // 目标文件
     'singbox',              // 源格式
     'mihomo'                // 目标格式
   );
   ```

3. **手动调整配置**
   - 检查转换后的配置文件
   - 根据需要调整代理节点配置
   - 验证规则和代理组设置

4. **测试配置**
   - 在 lvory 中切换到 mihomo 内核
   - 加载新的配置文件
   - 测试代理连接和规则匹配

### 从 Mihomo 迁移到 Sing-box

类似的过程，但转换方向相反：

```javascript
await configConverter.convertConfig(
  'config.yaml',           // mihomo 配置
  'config.json',           // sing-box 配置
  'mihomo',               // 源格式
  'singbox'               // 目标格式
);
```

## 故障排除

### 常见问题

1. **内核下载失败**
   - 检查网络连接
   - 尝试手动下载并放置到 bin 目录
   - 检查防火墙设置

2. **配置文件解析错误**
   - 验证 YAML 语法是否正确
   - 检查缩进和格式
   - 使用在线 YAML 验证器

3. **API 连接失败**
   - 确认 `external-controller` 配置正确
   - 检查端口是否被占用
   - 验证防火墙规则

4. **代理不工作**
   - 检查代理节点配置
   - 验证规则设置
   - 查看日志输出

### 日志调试

启用详细日志以便调试：

```yaml
log-level: debug
```

查看日志文件位置：
- Windows: `%APPDATA%/lvory/logs/`
- macOS: `~/Library/Application Support/lvory/logs/`
- Linux: `~/.config/lvory/logs/`

### 配置验证

使用 lvory 内置的配置验证功能：

1. 进入 **设置** → **内核设置**
2. 点击 **验证配置** 按钮
3. 查看验证结果和建议

## API 参考

Mihomo 使用 Clash 兼容的 RESTful API：

### 基础端点

- `GET /version` - 获取版本信息
- `GET /configs` - 获取当前配置
- `PATCH /configs` - 更新配置
- `GET /proxies` - 获取代理信息
- `GET /connections` - 获取连接信息
- `GET /traffic` - 获取流量统计
- `GET /logs` - 获取日志流

### 示例请求

```bash
# 获取版本信息
curl http://127.0.0.1:9090/version

# 获取代理列表
curl http://127.0.0.1:9090/proxies

# 切换代理
curl -X PUT http://127.0.0.1:9090/proxies/PROXY \
  -H "Content-Type: application/json" \
  -d '{"name": "ss-example"}'
```

### JavaScript 示例

```javascript
// 使用 lvory 的通用 API 客户端
const universalApiClient = require('./src/utils/universal-api-client');

// 设置为 mihomo 模式
universalApiClient.setCoreType('mihomo');
universalApiClient.setApiConfig({ host: '127.0.0.1', port: 9090 });

// 获取版本信息
const version = await universalApiClient.getVersion();
console.log('Mihomo 版本:', version.data);

// 获取代理信息
const proxies = await universalApiClient.getProxies();
console.log('代理列表:', proxies.data);
```

## 最佳实践

1. **配置管理**
   - 使用版本控制管理配置文件
   - 定期备份重要配置
   - 使用配置模板简化部署

2. **性能优化**
   - 合理设置 DNS 缓存
   - 优化规则顺序
   - 使用适当的代理组类型

3. **安全考虑**
   - 限制 API 访问权限
   - 使用强密码保护代理节点
   - 定期更新内核版本

4. **监控和维护**
   - 监控连接状态和流量
   - 定期检查日志
   - 及时处理异常情况

## 更多资源

- [MetaCubeX/mihomo GitHub](https://github.com/MetaCubeX/mihomo)
- [Clash 配置文档](https://wiki.metacubex.one/)
- [lvory 官方文档](https://github.com/sxueck/lvory)

---

如有问题或建议，请在 [GitHub Issues](https://github.com/sxueck/lvory/issues) 中反馈。
