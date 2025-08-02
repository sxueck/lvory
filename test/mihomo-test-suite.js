/**
 * Mihomo 支持功能测试套件
 * 包含单元测试和集成测试
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 测试配置
const TEST_CONFIG = {
  testDir: path.join(__dirname, 'temp'),
  mihomoConfigPath: path.join(__dirname, 'temp', 'mihomo-test.yaml'),
  singboxConfigPath: path.join(__dirname, 'temp', 'singbox-test.json'),
  timeout: 10000
};

// 测试数据
const MIHOMO_TEST_CONFIG = `
# Mihomo 测试配置
port: 7890
socks-port: 7891
mixed-port: 7892
allow-lan: false
mode: rule
log-level: info
external-controller: 127.0.0.1:9090

dns:
  enable: true
  listen: 0.0.0.0:53
  default-nameserver:
    - 223.5.5.5
    - 8.8.8.8

proxies:
  - name: "test-ss"
    type: ss
    server: example.com
    port: 443
    cipher: aes-256-gcm
    password: password123
  - name: "test-vmess"
    type: vmess
    server: example.org
    port: 443
    uuid: 12345678-1234-1234-1234-123456789abc
    alterId: 0

proxy-groups:
  - name: "PROXY"
    type: select
    proxies:
      - test-ss
      - test-vmess
      - DIRECT
  - name: "AUTO"
    type: url-test
    proxies:
      - test-ss
      - test-vmess
    url: 'http://www.gstatic.com/generate_204'
    interval: 300

rules:
  - DOMAIN-SUFFIX,google.com,PROXY
  - DOMAIN-KEYWORD,github,PROXY
  - GEOIP,CN,DIRECT
  - MATCH,PROXY
`;

const SINGBOX_TEST_CONFIG = {
  "log": {
    "level": "info"
  },
  "inbounds": [
    {
      "type": "mixed",
      "listen": "127.0.0.1",
      "listen_port": 7890
    }
  ],
  "outbounds": [
    {
      "type": "direct",
      "tag": "direct"
    },
    {
      "type": "shadowsocks",
      "tag": "test-ss",
      "server": "example.com",
      "server_port": 443,
      "method": "aes-256-gcm",
      "password": "password123"
    }
  ],
  "experimental": {
    "clash_api": {
      "external_controller": "127.0.0.1:9090"
    }
  }
};

class MihomoTestSuite {
  constructor() {
    this.testResults = [];
    this.setupComplete = false;
  }

  /**
   * 设置测试环境
   */
  async setup() {
    try {
      // 创建测试目录
      if (!fs.existsSync(TEST_CONFIG.testDir)) {
        fs.mkdirSync(TEST_CONFIG.testDir, { recursive: true });
      }

      // 创建测试配置文件
      fs.writeFileSync(TEST_CONFIG.mihomoConfigPath, MIHOMO_TEST_CONFIG, 'utf8');
      fs.writeFileSync(TEST_CONFIG.singboxConfigPath, JSON.stringify(SINGBOX_TEST_CONFIG, null, 2), 'utf8');

      this.setupComplete = true;
      console.log('✓ 测试环境设置完成');
    } catch (error) {
      console.error('✗ 测试环境设置失败:', error);
      throw error;
    }
  }

  /**
   * 清理测试环境
   */
  async cleanup() {
    try {
      if (fs.existsSync(TEST_CONFIG.mihomoConfigPath)) {
        fs.unlinkSync(TEST_CONFIG.mihomoConfigPath);
      }
      if (fs.existsSync(TEST_CONFIG.singboxConfigPath)) {
        fs.unlinkSync(TEST_CONFIG.singboxConfigPath);
      }
      if (fs.existsSync(TEST_CONFIG.testDir)) {
        fs.rmdirSync(TEST_CONFIG.testDir);
      }
      console.log('✓ 测试环境清理完成');
    } catch (error) {
      console.error('✗ 测试环境清理失败:', error);
    }
  }

  /**
   * 运行单个测试
   * @param {string} testName 测试名称
   * @param {Function} testFunction 测试函数
   */
  async runTest(testName, testFunction) {
    const startTime = Date.now();
    try {
      await testFunction();
      const duration = Date.now() - startTime;
      this.testResults.push({ name: testName, status: 'PASS', duration });
      console.log(`✓ ${testName} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({ name: testName, status: 'FAIL', duration, error: error.message });
      console.error(`✗ ${testName} (${duration}ms): ${error.message}`);
    }
  }

  /**
   * 测试内核类型常量
   */
  async testCoreTypeConstants() {
    const { CORE_TYPES, getCoreConfig, isSupportedCoreType } = require('../src/constants/core-types');
    
    // 测试内核类型枚举
    assert(CORE_TYPES.SINGBOX === 'singbox', '内核类型常量错误');
    assert(CORE_TYPES.MIHOMO === 'mihomo', '内核类型常量错误');
    
    // 测试支持检查
    assert(isSupportedCoreType(CORE_TYPES.MIHOMO), 'mihomo 应该被支持');
    assert(isSupportedCoreType(CORE_TYPES.SINGBOX), 'singbox 应该被支持');
    assert(!isSupportedCoreType('unknown'), '未知内核类型不应该被支持');
    
    // 测试配置获取
    const mihomoConfig = getCoreConfig(CORE_TYPES.MIHOMO);
    assert(mihomoConfig.name === 'mihomo', 'mihomo 配置名称错误');
    assert(mihomoConfig.configFormat === 'yaml', 'mihomo 配置格式错误');
    
    const singboxConfig = getCoreConfig(CORE_TYPES.SINGBOX);
    assert(singboxConfig.name === 'sing-box', 'singbox 配置名称错误');
    assert(singboxConfig.configFormat === 'json', 'singbox 配置格式错误');
  }

  /**
   * 测试 mihomo 配置解析器
   */
  async testMihomoConfigParser() {
    const MihomoConfigParser = require('../src/utils/mihomo/config-parser');
    const parser = new MihomoConfigParser();
    
    // 测试配置解析
    const parseResult = parser.parseConfigFile(TEST_CONFIG.mihomoConfigPath);
    assert(parseResult !== null, '配置解析失败');
    assert(parseResult.port === 7892, '代理端口解析错误');
    assert(parseResult.apiAddress === '127.0.0.1:9090', 'API地址解析错误');
    assert(parseResult.allowLan === false, 'allowLan 解析错误');
    assert(parseResult.mode === 'rule', 'mode 解析错误');
    
    // 测试配置验证
    const validationResult = parser.validateConfig(TEST_CONFIG.mihomoConfigPath);
    assert(validationResult.valid === true, '配置验证失败');
    assert(validationResult.proxiesCount === 2, '代理数量统计错误');
    assert(validationResult.proxyGroupsCount === 2, '代理组数量统计错误');
    assert(validationResult.rulesCount === 4, '规则数量统计错误');
    
    // 测试代理列表获取
    const proxies = parser.getProxies(TEST_CONFIG.mihomoConfigPath);
    assert(proxies.length === 2, '代理列表长度错误');
    assert(proxies[0].name === 'test-ss', '第一个代理名称错误');
    assert(proxies[1].name === 'test-vmess', '第二个代理名称错误');
    
    // 测试代理组列表获取
    const proxyGroups = parser.getProxyGroups(TEST_CONFIG.mihomoConfigPath);
    assert(proxyGroups.length === 2, '代理组列表长度错误');
    assert(proxyGroups[0].name === 'PROXY', '第一个代理组名称错误');
    assert(proxyGroups[1].name === 'AUTO', '第二个代理组名称错误');
  }

  /**
   * 测试内核工厂
   */
  async testCoreFactory() {
    const coreFactory = require('../src/utils/core-manager/core-factory');
    const { CORE_TYPES } = require('../src/constants/core-types');
    
    // 测试创建 mihomo 内核
    const mihomoCore = coreFactory.createCore(CORE_TYPES.MIHOMO);
    assert(mihomoCore !== null, 'mihomo 内核创建失败');
    assert(mihomoCore.getCoreType() === CORE_TYPES.MIHOMO, '内核类型错误');
    assert(mihomoCore.getDisplayName() === 'mihomo', '显示名称错误');
    assert(mihomoCore.supportsFeature('tun') === true, 'TUN 功能支持检查错误');
    
    // 测试创建 singbox 内核
    const singboxCore = coreFactory.createCore(CORE_TYPES.SINGBOX);
    assert(singboxCore !== null, 'singbox 内核创建失败');
    
    // 测试内核类型切换
    const currentType = coreFactory.getCurrentCoreType();
    assert(typeof currentType === 'string', '当前内核类型应该是字符串');
    
    // 测试不支持的内核类型
    try {
      coreFactory.createCore('unknown');
      assert(false, '应该抛出不支持的内核类型错误');
    } catch (error) {
      assert(error.message.includes('Unsupported core type'), '错误消息不正确');
    }
  }

  /**
   * 测试配置转换器
   */
  async testConfigConverter() {
    const configConverter = require('../src/utils/config-converter');
    const { CORE_TYPES } = require('../src/constants/core-types');
    
    // 测试转换支持检查
    assert(configConverter.isConversionSupported(CORE_TYPES.SINGBOX, CORE_TYPES.MIHOMO), '应该支持 singbox 到 mihomo 的转换');
    assert(configConverter.isConversionSupported(CORE_TYPES.MIHOMO, CORE_TYPES.SINGBOX), '应该支持 mihomo 到 singbox 的转换');
    assert(!configConverter.isConversionSupported('unknown', CORE_TYPES.MIHOMO), '不应该支持未知类型的转换');
    
    // 测试 mihomo 到 singbox 的转换
    const outputPath = path.join(TEST_CONFIG.testDir, 'converted-singbox.json');
    const conversionResult = await configConverter.convertConfig(
      TEST_CONFIG.mihomoConfigPath,
      outputPath,
      CORE_TYPES.MIHOMO,
      CORE_TYPES.SINGBOX
    );
    
    assert(conversionResult.success === true, '配置转换失败');
    assert(fs.existsSync(outputPath), '转换后的配置文件不存在');
    
    // 验证转换后的配置
    const convertedConfig = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    assert(convertedConfig.inbounds.length > 0, '转换后的配置缺少入站配置');
    assert(convertedConfig.outbounds.length > 0, '转换后的配置缺少出站配置');
    assert(convertedConfig.experimental && convertedConfig.experimental.clash_api, '转换后的配置缺少 API 配置');
    
    // 清理转换后的文件
    fs.unlinkSync(outputPath);
  }

  /**
   * 测试通用映射引擎
   */
  async testUniversalMappingEngine() {
    const mappingEngine = require('../src/main/engine/universal-mapping-engine');
    const { CORE_TYPES } = require('../src/constants/core-types');
    
    // 测试内核类型设置
    mappingEngine.setCoreType(CORE_TYPES.MIHOMO);
    const paths = mappingEngine.getConfigPaths();
    assert(paths.MIXED_INBOUND_PORT === 'mixed-port', 'mihomo 端口路径错误');
    assert(paths.API_CONTROLLER === 'external-controller', 'mihomo API 路径错误');
    
    mappingEngine.setCoreType(CORE_TYPES.SINGBOX);
    const singboxPaths = mappingEngine.getConfigPaths();
    assert(singboxPaths.MIXED_INBOUND_PORT.includes('listen_port'), 'singbox 端口路径错误');
    assert(singboxPaths.API_CONTROLLER.includes('external_controller'), 'singbox API 路径错误');
    
    // 测试映射定义获取
    const mihomoMapping = mappingEngine.getMappingDefinition();
    assert(mihomoMapping.mappings.length > 0, '映射定义为空');
    
    // 测试配置验证
    const testConfig = { 'mixed-port': 7890, 'external-controller': '127.0.0.1:9090' };
    mappingEngine.setCoreType(CORE_TYPES.MIHOMO);
    const validationResult = mappingEngine.validateConfig(testConfig);
    assert(validationResult.valid === true, '配置验证失败');
  }

  /**
   * 测试通用 API 客户端
   */
  async testUniversalApiClient() {
    const universalApiClient = require('../src/utils/universal-api-client');
    const { CORE_TYPES, API_ENDPOINTS } = require('../src/constants/core-types');
    
    // 测试内核类型设置
    universalApiClient.setCoreType(CORE_TYPES.MIHOMO);
    assert(universalApiClient.currentCoreType === CORE_TYPES.MIHOMO, '内核类型设置失败');
    
    // 测试端点获取
    const versionEndpoint = universalApiClient.getEndpoint('version');
    assert(versionEndpoint === API_ENDPOINTS[CORE_TYPES.MIHOMO].version, '端点获取错误');
    
    // 测试 API 配置设置
    universalApiClient.setApiConfig({ host: '127.0.0.1', port: 9090 });
    assert(universalApiClient.apiConfig.host === '127.0.0.1', 'API 主机设置失败');
    assert(universalApiClient.apiConfig.port === 9090, 'API 端口设置失败');
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('=== Mihomo 支持功能测试套件 ===\n');
    
    if (!this.setupComplete) {
      await this.setup();
    }

    // 运行所有测试
    await this.runTest('内核类型常量测试', () => this.testCoreTypeConstants());
    await this.runTest('Mihomo 配置解析器测试', () => this.testMihomoConfigParser());
    await this.runTest('内核工厂测试', () => this.testCoreFactory());
    await this.runTest('配置转换器测试', () => this.testConfigConverter());
    await this.runTest('通用映射引擎测试', () => this.testUniversalMappingEngine());
    await this.runTest('通用 API 客户端测试', () => this.testUniversalApiClient());

    // 输出测试结果
    this.printTestResults();
    
    await this.cleanup();
  }

  /**
   * 打印测试结果
   */
  printTestResults() {
    console.log('\n=== 测试结果 ===');
    
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const total = this.testResults.length;
    
    console.log(`总计: ${total} 个测试`);
    console.log(`通过: ${passed} 个测试`);
    console.log(`失败: ${failed} 个测试`);
    
    if (failed > 0) {
      console.log('\n失败的测试:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    }
    
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);
    console.log(`\n总耗时: ${totalDuration}ms`);
    
    if (failed === 0) {
      console.log('\n🎉 所有测试通过！');
    } else {
      console.log(`\n❌ ${failed} 个测试失败`);
    }
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  const testSuite = new MihomoTestSuite();
  testSuite.runAllTests().catch(console.error);
}

module.exports = MihomoTestSuite;
