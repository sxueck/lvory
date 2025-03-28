/**
 * 配置映射引擎
 * 用于解析和映射不同配置格式之间关系的引擎
 */
const logger = require('../../utils/logger');

/**
 * 路径解析器 - 将路径表达式分解为标记序列
 * @param {String} path 路径表达式
 * @returns {Array} 标记数组
 */
function tokenizePath(path) {
  if (!path) return [];
  
  // 使用正则表达式匹配不同类型的标记
  // 1. 条件表达式: [type=value]
  // 2. 数组索引: [0]
  // 3. 属性名: name
  const tokens = [];
  const regex = /(\[\w+=(?:[^\[\]{}]+|\{[^\{\}]+\})\])|(\[\d+\])|(\[\*\])|([^.\[\]]+)/g;
  let match;
  
  while ((match = regex.exec(path)) !== null) {
    if (match[1]) { // 条件表达式
      tokens.push(match[1]);
    } else if (match[2]) { // 数组索引
      tokens.push(match[2]);
    } else if (match[3]) { // 通配符索引
      tokens.push(match[3]);
    } else if (match[4]) { // 属性名
      tokens.push(match[4]);
    }
  }
  
  return tokens;
}

/**
 * 解析条件表达式
 * @param {String} condition 条件表达式 [field=value]
 * @returns {Object} 解析后的条件 { field, operator, value }
 */
function parseCondition(condition) {
  if (!condition || !condition.startsWith('[') || !condition.endsWith(']')) {
    return null;
  }
  
  // 去掉开头和结尾的中括号
  const content = condition.substring(1, condition.length - 1);
  
  // 查找操作符 (目前只支持 =)
  const operatorIndex = content.indexOf('=');
  if (operatorIndex === -1) {
    return null;
  }
  
  const field = content.substring(0, operatorIndex).trim();
  let value = content.substring(operatorIndex + 1).trim();
  
  // 处理引用变量 {var}
  if (value.startsWith('{') && value.endsWith('}')) {
    return {
      field,
      operator: '=',
      value,
      isVariable: true
    };
  }
  
  return {
    field,
    operator: '=',
    value,
    isVariable: false
  };
}

/**
 * 替换路径中的变量引用
 * @param {String} path 包含变量的路径
 * @param {Object} data 用于替换变量的数据
 * @returns {String} 替换后的路径
 */
function replacePathVariables(path, data) {
  if (!path || !data) return path;
  
  return path.replace(/\{([^{}]+)\}/g, (match, variable) => {
    const value = getValueByPath(data, variable);
    return value !== undefined ? value : match;
  });
}

/**
 * 根据路径表达式从配置中获取值
 * @param {Object} config 配置对象
 * @param {String} path 路径表达式
 * @returns {*} 获取到的值，如果路径无效则返回undefined
 */
function getValueByPath(config, path) {
  if (!config || !path) return undefined;
  
  const tokens = tokenizePath(path);
  let current = config;
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    if (!current) return undefined;
    
    // 处理数组索引 [0]
    if (token.match(/^\[\d+\]$/)) {
      const index = parseInt(token.substring(1, token.length - 1));
      if (!Array.isArray(current) || index >= current.length) {
        return undefined;
      }
      current = current[index];
      continue;
    }
    
    // 处理通配符索引 [*]
    if (token === '[*]') {
      if (!Array.isArray(current)) {
        return undefined;
      }
      // 如果是通配符且是最后一个标记，返回整个数组
      if (i === tokens.length - 1) {
        return current;
      }
      // 否则尝试对数组中每个元素递归处理剩余路径，并返回结果数组
      const remainingPath = tokens.slice(i + 1).join('.');
      return current.map(item => getValueByPath(item, remainingPath));
    }
    
    // 处理条件筛选 [type=value]
    if (token.startsWith('[') && token.endsWith(']') && token.includes('=')) {
      const condition = parseCondition(token);
      if (!condition) return undefined;
      
      if (!Array.isArray(current)) {
        return undefined;
      }
      
      // 处理条件中的变量
      let conditionValue = condition.value;
      if (condition.isVariable) {
        const varPath = condition.value.substring(1, condition.value.length - 1);
        conditionValue = getValueByPath(config, varPath);
        if (conditionValue === undefined) return undefined;
      }
      
      // 查找符合条件的元素
      const matchingElements = current.filter(item => {
        const itemValue = item[condition.field];
        return condition.value === '*' || itemValue === conditionValue;
      });
      
      // 如果是最后一个标记，返回所有匹配元素
      if (i === tokens.length - 1) {
        return matchingElements.length > 0 ? matchingElements : undefined;
      }
      
      // 如果只有一个匹配元素，继续处理下一个标记
      if (matchingElements.length === 1) {
        current = matchingElements[0];
        continue;
      }
      
      // 如果有多个匹配元素，递归处理剩余路径
      if (matchingElements.length > 1) {
        const remainingPath = tokens.slice(i + 1).join('.');
        return matchingElements.map(item => getValueByPath(item, remainingPath));
      }
      
      return undefined;
    }
    
    // 普通属性访问
    if (typeof current === 'object' && current !== null) {
      current = current[token];
    } else {
      return undefined;
    }
  }
  
  return current;
}

/**
 * 在对象中创建或更新指定路径的值
 * @param {Object} config 目标配置对象
 * @param {String} path 路径表达式
 * @param {*} value 要设置的值
 * @param {Object} options 选项
 * @returns {Object} 更新后的配置对象
 */
function createOrUpdatePath(config, path, value, options = {}) {
  if (!config || !path) return config;
  
  const tokens = tokenizePath(path);
  let current = config;
  let parent = null;
  let lastToken = null;
  
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i];
    parent = current;
    
    // 处理数组索引 [0]
    if (token.match(/^\[\d+\]$/)) {
      const index = parseInt(token.substring(1, token.length - 1));
      if (!Array.isArray(current)) {
        current = [];
        if (lastToken) parent[lastToken] = current;
      }
      while (current.length <= index) {
        current.push({});
      }
      current = current[index];
      continue;
    }
    
    // 处理通配符索引 [*]
    if (token === '[*]') {
      // 通配符通常用于映射操作，不应该出现在路径创建中
      logger.warn('通配符 [*] 不应该出现在路径创建中');
      return config;
    }
    
    // 处理条件筛选 [type=value]
    if (token.startsWith('[') && token.endsWith(']') && token.includes('=')) {
      const condition = parseCondition(token);
      if (!condition) return config;
      
      if (!Array.isArray(current)) {
        current = [];
        if (lastToken) parent[lastToken] = current;
      }
      
      // 查找或创建符合条件的元素
      let matchingElement = current.find(item => item[condition.field] === condition.value);
      if (!matchingElement) {
        matchingElement = { [condition.field]: condition.value };
        current.push(matchingElement);
      }
      
      current = matchingElement;
      continue;
    }
    
    // 普通属性访问
    if (current[token] === undefined || current[token] === null) {
      // 根据下一个标记决定创建对象还是数组
      const nextToken = tokens[i + 1] || '';
      if (nextToken.match(/^\[\d+\]$/) || nextToken === '[*]' || nextToken.includes('=')) {
        current[token] = [];
      } else {
        current[token] = {};
      }
    }
    
    lastToken = token;
    current = current[token];
  }
  
  // 设置最后一个属性的值
  const lastTokenValue = tokens[tokens.length - 1];
  
  // 处理数组索引 [0]
  if (lastTokenValue.match(/^\[\d+\]$/)) {
    const index = parseInt(lastTokenValue.substring(1, lastTokenValue.length - 1));
    if (!Array.isArray(current)) {
      current = [];
      if (lastToken) parent[lastToken] = current;
    }
    while (current.length <= index) {
      current.push(undefined);
    }
    current[index] = value;
    return config;
  }
  
  // 处理条件筛选 [type=value]
  if (lastTokenValue.startsWith('[') && lastTokenValue.endsWith(']') && lastTokenValue.includes('=')) {
    const condition = parseCondition(lastTokenValue);
    if (!condition) return config;
    
    if (!Array.isArray(current)) {
      current = [];
      if (lastToken) parent[lastToken] = current;
    }
    
    // 查找或创建符合条件的元素
    let matchingElement = current.find(item => item[condition.field] === condition.value);
    if (!matchingElement) {
      matchingElement = { [condition.field]: condition.value };
      current.push(matchingElement);
    }
    
    // 根据 conflict_strategy 处理冲突
    if (options.conflict_strategy === 'merge' && typeof value === 'object' && typeof matchingElement === 'object') {
      Object.assign(matchingElement, value);
    } else {
      // 默认覆盖
      Object.keys(value).forEach(key => {
        matchingElement[key] = value[key];
      });
    }
    
    return config;
  }
  
  // 普通属性设置
  current[lastTokenValue] = value;
  return config;
}

/**
 * 应用映射规则，将用户配置转换为目标配置
 * @param {Object} userConfig 用户配置
 * @param {Object} targetConfig 现有目标配置
 * @param {Array} mappings 映射规则数组
 * @returns {Object} 处理后的目标配置
 */
function applyMappings(userConfig, targetConfig = {}, mappings = []) {
  if (!userConfig || !mappings || !mappings.length) {
    return targetConfig;
  }
  
  // 克隆目标配置以避免修改原对象
  const result = JSON.parse(JSON.stringify(targetConfig));
  
  // 应用所有映射规则
  mappings.forEach(mapping => {
    try {
      // 获取用户配置中的值
      let userValue = getValueByPath(userConfig, mapping.user_path);
      
      // 如果用户配置中没有该值，且有默认值，则使用默认值
      if (userValue === undefined) {
        if (mapping.default !== undefined) {
          // 处理目标路径中的变量
          const processedTargetPath = replacePathVariables(mapping.target_path, userConfig);
          
          // 应用默认值到目标配置
          createOrUpdatePath(result, processedTargetPath, mapping.default, {
            conflict_strategy: mapping.conflict_strategy
          });
        }
        return;
      }
      
      // 根据定义的类型转换值
      if (mapping.type) {
        switch (mapping.type) {
          case 'number':
            // 确保值是数字类型
            userValue = Number(userValue);
            if (isNaN(userValue)) {
              userValue = mapping.default || 0;
            }
            break;
          case 'boolean':
            // 确保值是布尔类型
            if (typeof userValue !== 'boolean') {
              userValue = Boolean(userValue);
            }
            break;
          case 'string':
            // 确保值是字符串类型
            userValue = String(userValue);
            break;
          // 对其他类型不做特殊处理
        }
      }
      
      // 处理不同的转换类型
      switch (mapping.transform) {
        case 'template':
          // 模板转换
          if (Array.isArray(userValue)) {
            // 处理数组中的每个元素
            userValue.forEach((item, index) => {
              const templateResult = {};
              
              // 填充模板中的每个字段
              Object.entries(mapping.template).forEach(([field, template]) => {
                // 替换模板中的变量引用
                const processedTemplate = template.replace(/\{([^{}]+)\}/g, (match, variable) => {
                  // 替换 nodes[*] 为 nodes[index]
                  const indexedVariable = variable.replace(/\[\*\]/g, `[${index}]`);
                  const value = getValueByPath(userConfig, indexedVariable);
                  return value !== undefined ? value : '';
                });
                
                templateResult[field] = processedTemplate;
              });
              
              // 构造目标路径
              const targetPath = mapping.target_path.replace(/\{([^{}]+)\}/g, (match, variable) => {
                // 替换 nodes[*] 为 nodes[index]
                const indexedVariable = variable.replace(/\[\*\]/g, `[${index}]`);
                const value = getValueByPath(userConfig, indexedVariable);
                return value !== undefined ? value : '';
              });
              
              // 应用到目标配置
              createOrUpdatePath(result, targetPath, templateResult, {
                conflict_strategy: mapping.conflict_strategy
              });
            });
          } else if (typeof userValue === 'object') {
            // 处理单个对象
            const templateResult = {};
            
            // 填充模板中的每个字段
            Object.entries(mapping.template).forEach(([field, template]) => {
              // 替换模板中的变量引用
              const processedTemplate = template.replace(/\{([^{}]+)\}/g, (match, variable) => {
                const value = getValueByPath(userConfig, variable);
                return value !== undefined ? value : '';
              });
              
              templateResult[field] = processedTemplate;
            });
            
            // 处理目标路径中的变量
            const targetPath = replacePathVariables(mapping.target_path, userConfig);
            
            // 应用到目标配置
            createOrUpdatePath(result, targetPath, templateResult, {
              conflict_strategy: mapping.conflict_strategy
            });
          }
          break;
          
        case 'function':
          // 函数转换 - 可以在这里添加自定义函数支持
          logger.warn('函数转换尚未实现');
          break;
          
        case 'direct':
        default:
          // 直接映射，无需转换
          const targetPath = replacePathVariables(mapping.target_path, userConfig);
          createOrUpdatePath(result, targetPath, userValue, {
            conflict_strategy: mapping.conflict_strategy
          });
          break;
      }
      
      // 处理依赖项
      if (mapping.dependencies && Array.isArray(mapping.dependencies)) {
        mapping.dependencies.forEach(dep => {
          // 检查是否应该覆盖已存在的值
          if (dep.override_if_exists === false) {
            const existingValue = getValueByPath(result, dep.target_path);
            if (existingValue !== undefined) {
              return;
            }
          }
          
          // 应用依赖项值
          createOrUpdatePath(result, dep.target_path, dep.value, {
            conflict_strategy: 'override'
          });
        });
      }
    } catch (error) {
      logger.error(`应用映射规则 ${mapping.user_path} -> ${mapping.target_path} 失败: ${error.message}`);
    }
  });
  
  return result;
}

/**
 * 加载映射定义
 * @param {String} path 映射定义文件路径
 * @returns {Array} 映射规则数组
 */
function loadMappingDefinition(path) {
  try {
    const fs = require('fs');
    const content = fs.readFileSync(path, 'utf8');
    const definition = JSON.parse(content);
    
    if (!definition.mappings || !Array.isArray(definition.mappings)) {
      throw new Error('无效的映射定义，缺少 mappings 数组');
    }
    
    return definition.mappings;
  } catch (error) {
    logger.error(`加载映射定义失败: ${error.message}`);
    return [];
  }
}

module.exports = {
  tokenizePath,
  parseCondition,
  replacePathVariables,
  getValueByPath,
  createOrUpdatePath,
  applyMappings,
  loadMappingDefinition
}; 