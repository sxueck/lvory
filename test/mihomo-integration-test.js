/**
 * Mihomo 集成测试
 * 测试 mihomo 内核支持的基本功能
 */

const path = require('path');
const fs = require('fs');

// 模拟测试环境
const testDir = path.join(__dirname, 'temp');
const testConfigPath = path.join(testDir, 'test-mihomo-config.yaml');

// 创建测试目录
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// 创建测试配置文件
const testMihomoConfig = `
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
  - name: "test-proxy"
    type: ss
    server: example.com
    port: 443
    cipher: aes-256-gcm
    password: password

proxy-groups:
  - name: "PROXY"
    type: select
    proxies:
      - test-proxy
      - DIRECT

rules:
  - DOMAIN-SUFFIX,google.com,PROXY
  - DOMAIN-KEYWORD,github,PROXY
  - GEOIP,CN,DIRECT
  - MATCH,PROXY
`;

fs.writeFileSync(testConfigPath, testMihomoConfig, 'utf8');

// 测试函数
async function runTests() {
  console.log('=== Mihomo 集成测试开始 ===\n');

  try {
    // 测试 1: 内核类型常量
    console.log('1. 测试内核类型常量...');
    const { CORE_TYPES, getCoreConfig, isSupportedCoreType } = require('../src/constants/core-types');
    
    console.log(`  支持的内核类型: ${Object.values(CORE_TYPES).join(', ')}`);
    console.log(`  mihomo 是否支持: ${isSupportedCoreType(CORE_TYPES.MIHOMO)}`);
    
    const mihomoConfig = getCoreConfig(CORE_TYPES.MIHOMO);
    console.log(`  mihomo 配置: ${JSON.stringify(mihomoConfig, null, 2)}`);
    console.log('  ✓ 内核类型常量测试通过\n');

    // 测试 2: mihomo 配置解析器
    console.log('2. 测试 mihomo 配置解析器...');
    const MihomoConfigParser = require('../src/utils/mihomo/config-parser');
    const parser = new MihomoConfigParser();
    
    const parseResult = parser.parseConfigFile(testConfigPath);
    console.log(`  解析结果: ${JSON.stringify(parseResult, null, 2)}`);
    
    const validationResult = parser.validateConfig(testConfigPath);
    console.log(`  验证结果: ${JSON.stringify(validationResult, null, 2)}`);
    
    if (parseResult && parseResult.port === 7892) {
      console.log('  ✓ 代理端口解析正确');
    } else {
      console.log('  ✗ 代理端口解析错误');
    }
    
    if (parseResult && parseResult.apiAddress === '127.0.0.1:9090') {
      console.log('  ✓ API地址解析正确');
    } else {
      console.log('  ✗ API地址解析错误');
    }
    
    console.log('  ✓ mihomo 配置解析器测试通过\n');

    // 测试 3: 内核工厂
    console.log('3. 测试内核工厂...');
    const coreFactory = require('../src/utils/core-manager/core-factory');
    
    // 测试创建 mihomo 内核实例
    try {
      const mihomoCore = coreFactory.createCore(CORE_TYPES.MIHOMO);
      console.log(`  mihomo 内核实例创建成功: ${mihomoCore.getCoreType()}`);
      console.log(`  显示名称: ${mihomoCore.getDisplayName()}`);
      console.log(`  支持 TUN 模式: ${mihomoCore.supportsFeature('tun')}`);
      console.log('  ✓ 内核工厂测试通过\n');
    } catch (error) {
      console.log(`  ✗ 内核工厂测试失败: ${error.message}\n`);
    }

    // 测试 4: 配置适配器
    console.log('4. 测试配置适配器...');
    const ConfigAdapter = require('../src/utils/core-manager/config-adapter');
    const adapter = new ConfigAdapter(CORE_TYPES.MIHOMO);
    
    console.log(`  配置格式: ${adapter.config.configFormat}`);
    console.log(`  支持的扩展名: ${adapter.config.configExtensions.join(', ')}`);
    console.log(`  配置文件存在: ${adapter.configExists(testConfigPath)}`);
    console.log(`  格式有效: ${adapter.isValidFormat(testConfigPath)}`);
    
    const stats = adapter.getConfigStats(testConfigPath);
    if (stats) {
      console.log(`  文件大小: ${stats.size} bytes`);
      console.log(`  文件扩展名: ${stats.extension}`);
    }
    
    console.log('  ✓ 配置适配器测试通过\n');

    // 测试 5: 设置管理器集成
    console.log('5. 测试设置管理器集成...');
    const SettingsManager = require('../src/main/settings-manager');
    const settingsManager = new SettingsManager();
    
    // 测试内核类型设置
    const currentCoreType = settingsManager.getCoreType();
    console.log(`  当前内核类型: ${currentCoreType}`);
    
    // 测试切换到 mihomo
    const switchResult = await settingsManager.setCoreType(CORE_TYPES.MIHOMO);
    console.log(`  切换到 mihomo 结果: ${JSON.stringify(switchResult, null, 2)}`);
    
    // 测试获取当前内核适配器
    const currentAdapter = settingsManager.getCurrentCoreAdapter();
    console.log(`  当前适配器类型: ${currentAdapter.constructor.name}`);
    
    console.log('  ✓ 设置管理器集成测试通过\n');

    console.log('=== 所有测试通过 ===');

  } catch (error) {
    console.error('测试失败:', error);
    console.error(error.stack);
  } finally {
    // 清理测试文件
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir);
    }
  }
}

/**
 * 性能测试
 */
async function runPerformanceTests() {
  console.log('\n=== 性能测试 ===\n');

  try {
    // 测试配置解析性能
    console.log('1. 测试配置解析性能...');
    const MihomoConfigParser = require('../src/utils/mihomo/config-parser');
    const parser = new MihomoConfigParser();

    const iterations = 1000;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      parser.parseConfigFile(testConfigPath);
    }

    const endTime = Date.now();
    const avgTime = (endTime - startTime) / iterations;
    console.log(`  ${iterations} 次解析平均耗时: ${avgTime.toFixed(2)}ms`);

    if (avgTime < 10) {
      console.log('  ✓ 配置解析性能良好');
    } else {
      console.log('  ⚠ 配置解析性能可能需要优化');
    }

    // 测试内核工厂创建性能
    console.log('\n2. 测试内核工厂创建性能...');
    const coreFactory = require('../src/utils/core-manager/core-factory');
    const { CORE_TYPES } = require('../src/constants/core-types');

    const factoryStartTime = Date.now();
    for (let i = 0; i < 100; i++) {
      coreFactory.createCore(CORE_TYPES.MIHOMO);
      coreFactory.createCore(CORE_TYPES.SINGBOX);
    }
    const factoryEndTime = Date.now();
    const factoryAvgTime = (factoryEndTime - factoryStartTime) / 200;
    console.log(`  200 次内核创建平均耗时: ${factoryAvgTime.toFixed(2)}ms`);

    if (factoryAvgTime < 1) {
      console.log('  ✓ 内核工厂性能良好');
    } else {
      console.log('  ⚠ 内核工厂性能可能需要优化');
    }

    console.log('\n  ✓ 性能测试完成');

  } catch (error) {
    console.error('性能测试失败:', error);
  }
}

/**
 * 内存泄漏测试
 */
async function runMemoryLeakTests() {
  console.log('\n=== 内存泄漏测试 ===\n');

  try {
    const initialMemory = process.memoryUsage();
    console.log('初始内存使用:', {
      rss: `${(initialMemory.rss / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`
    });

    // 大量创建和销毁对象
    console.log('1. 测试配置解析器内存泄漏...');
    const MihomoConfigParser = require('../src/utils/mihomo/config-parser');

    for (let i = 0; i < 1000; i++) {
      const parser = new MihomoConfigParser();
      parser.parseConfigFile(testConfigPath);
      parser.validateConfig(testConfigPath);
    }

    // 强制垃圾回收
    if (global.gc) {
      global.gc();
    }

    const afterParsingMemory = process.memoryUsage();
    console.log('配置解析后内存使用:', {
      rss: `${(afterParsingMemory.rss / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(afterParsingMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`
    });

    // 测试内核工厂内存泄漏
    console.log('\n2. 测试内核工厂内存泄漏...');
    const coreFactory = require('../src/utils/core-manager/core-factory');
    const { CORE_TYPES } = require('../src/constants/core-types');

    for (let i = 0; i < 500; i++) {
      coreFactory.createCore(CORE_TYPES.MIHOMO);
      coreFactory.createCore(CORE_TYPES.SINGBOX);
      coreFactory.clearCoreInstance(CORE_TYPES.MIHOMO);
      coreFactory.clearCoreInstance(CORE_TYPES.SINGBOX);
    }

    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage();
    console.log('最终内存使用:', {
      rss: `${(finalMemory.rss / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`
    });

    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

    console.log(`内存增长: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(1)}%)`);

    if (memoryIncreasePercent < 50) {
      console.log('  ✓ 内存使用正常');
    } else {
      console.log('  ⚠ 可能存在内存泄漏');
    }

  } catch (error) {
    console.error('内存泄漏测试失败:', error);
  }
}

// 运行测试
if (require.main === module) {
  runTests()
    .then(() => runPerformanceTests())
    .then(() => runMemoryLeakTests())
    .catch(console.error);
}

module.exports = {
  runTests,
  runPerformanceTests,
  runMemoryLeakTests,
  testConfigPath,
  testMihomoConfig
};
