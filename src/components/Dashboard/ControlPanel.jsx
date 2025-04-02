import React, { useState, useEffect } from 'react';

const customStyles = {
  eyeIcon: {
    width: '24px',
    height: '24px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    borderRadius: '50%',
    transition: 'background-color 0.2s ease'
  }
};

const ControlPanel = ({ 
  isRunning, 
  onTogglePrivate, 
  onSpeedTest, 
  onToggleSingBox,
  privateMode, 
  isTesting,
  isStarting, 
  isStopping,
  isRestarting,
  onOpenProfileModal,
  onRestartSingBox
}) => {
  const [showRestartButton, setShowRestartButton] = useState(false);
  const [showProxyConfigModal, setShowProxyConfigModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    powershell: true,
    git: false,
    npm: false,
    curl: false,
    docker: false
  });
  const [copiedState, setCopiedState] = useState({});
  const [proxyPort, setProxyPort] = useState('7890');
  const [proxyAddress, setProxyAddress] = useState('127.0.0.1:7890');
  const [showNetworkAddresses, setShowNetworkAddresses] = useState(false);
  const [networkAddresses, setNetworkAddresses] = useState([
    { label: '本地回环', address: '127.0.0.1:7890' }
  ]);

  // 获取网络接口地址
  useEffect(() => {
    if (window.electron && window.electron.getNetworkInterfaces) {
      window.electron.getNetworkInterfaces().then(interfaces => {
        if (interfaces && interfaces.length > 0) {
          const formattedAddresses = [
            { label: '本地回环', address: `127.0.0.1:${proxyPort}` },
            ...interfaces.map(iface => ({
              label: `${iface.name || 'Unknown'} (${iface.address})`,
              address: `${iface.address}:${proxyPort}`
            }))
          ];
          setNetworkAddresses(formattedAddresses);
        }
      }).catch(err => {
        console.error('获取网络接口信息失败:', err);
      });
    }
  }, [proxyPort]);

  // 复制到剪贴板函数
  const copyToClipboard = (text, id, section) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        // 设置复制成功状态
        setCopiedState({
          ...copiedState,
          [`${id}-${section}`]: true
        });
        
        // 3秒后重置复制状态
        setTimeout(() => {
          setCopiedState(prevState => ({
            ...prevState,
            [`${id}-${section}`]: false
          }));
        }, 3000);
      })
      .catch(err => console.error('复制失败:', err));
  };

  // 切换折叠状态
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 获取代码中使用当前选择的代理地址
  const getCodeWithAddress = (codeTemplate) => {
    return codeTemplate.replace(/127\.0\.0\.1:7890/g, proxyAddress);
  };

  // 渲染终端图标
  const renderTerminalIcon = () => {
    return (
      <div 
        style={{
          ...customStyles.eyeIcon,
          backgroundColor: showProxyConfigModal ? '#f5f7f9' : 'transparent'
        }}
        onClick={() => setShowProxyConfigModal(true)}
        title="查看代理配置方式"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#505a6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
      </div>
    );
  };

  // 代理配置对话框
  const renderProxyConfigModal = () => {
    if (!showProxyConfigModal) return null;

    const proxyConfigSections = [
      {
        id: 'powershell',
        title: 'PowerShell',
        sections: [
          {
            title: '设置HTTP代理',
            code: `$env:http_proxy="http://${proxyAddress}"
$env:https_proxy="http://${proxyAddress}"`
          },
          {
            title: '查看当前代理设置',
            code: `$env:http_proxy
$env:https_proxy`
          },
          {
            title: '取消代理设置',
            code: `$env:http_proxy=""
$env:https_proxy=""`
          }
        ]
      },
      {
        id: 'git',
        title: 'Git',
        sections: [
          {
            title: '设置HTTP代理',
            code: `git config --global http.proxy http://${proxyAddress}
git config --global https.proxy http://${proxyAddress}`
          },
          {
            title: '查看当前代理设置',
            code: `git config --global --get http.proxy
git config --global --get https.proxy`
          },
          {
            title: '取消代理设置',
            code: `git config --global --unset http.proxy
git config --global --unset https.proxy`
          }
        ]
      },
      {
        id: 'npm',
        title: 'npm',
        sections: [
          {
            title: '设置HTTP代理',
            code: `npm config set proxy http://${proxyAddress}
npm config set https-proxy http://${proxyAddress}`
          },
          {
            title: '查看当前代理设置',
            code: `npm config get proxy
npm config get https-proxy`
          },
          {
            title: '取消代理设置',
            code: `npm config delete proxy
npm config delete https-proxy`
          }
        ]
      },
      {
        id: 'curl',
        title: 'curl',
        sections: [
          {
            title: '使用代理',
            code: `curl -x http://${proxyAddress} https://www.google.com`
          }
        ]
      },
      {
        id: 'docker',
        title: 'Docker',
        sections: [
          {
            title: 'Windows 修改 ~/.docker/config.json',
            code: `{
  "proxies": {
    "default": {
      "httpProxy": "http://${proxyAddress}",
      "httpsProxy": "http://${proxyAddress}",
      "noProxy": "localhost,127.0.0.1"
    }
  }
}`
          }
        ]
      }
    ];

    // 渲染地址选择下拉框
    const renderAddressSelector = () => {
      return (
        <div style={{
          marginBottom: '16px',
          border: '1px solid #eee',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '12px' 
          }}>
            <div style={{ fontWeight: '600', fontSize: '15px' }}>
              选择代理地址
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '8px', fontSize: '14px' }}>端口:</span>
              <input
                type="text"
                value={proxyPort}
                onChange={(e) => {
                  const newPort = e.target.value;
                  setProxyPort(newPort);
                  // 更新当前选中的地址，保持IP不变，只更新端口
                  const currentIp = proxyAddress.split(':')[0];
                  setProxyAddress(`${currentIp}:${newPort}`);
                }}
                style={{
                  width: '60px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
          
          <div style={{ position: 'relative' }}>
            <div 
              onClick={() => setShowNetworkAddresses(!showNetworkAddresses)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: '#fff'
              }}
            >
              <span>{proxyAddress}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
                   fill="none" stroke="#505a6b" strokeWidth="2" strokeLinecap="round" 
                   strokeLinejoin="round" style={{ 
                     transform: showNetworkAddresses ? 'rotate(180deg)' : 'rotate(0)', 
                     transition: 'transform 0.3s' 
                   }}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
            
            {showNetworkAddresses && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 10,
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                borderRadius: '6px',
                marginTop: '4px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {networkAddresses.map((address, index) => (
                  <div 
                    key={index}
                    onClick={() => {
                      setProxyAddress(address.address);
                      setShowNetworkAddresses(false);
                    }}
                    style={{
                      padding: '10px 12px',
                      borderBottom: index < networkAddresses.length - 1 ? '1px solid #eee' : 'none',
                      cursor: 'pointer',
                      backgroundColor: proxyAddress === address.address ? '#f0f4ff' : '#fff',
                      transition: 'background-color 0.2s',
                      hover: {
                        backgroundColor: '#f5f5f5'
                      }
                    }}
                  >
                    {address.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    };

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '80%',
          maxWidth: '800px',
          maxHeight: '85vh',
          overflow: 'auto',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '24px',
            borderBottom: '1px solid #eee',
            paddingBottom: '16px'
          }}>
            <h2 style={{ margin: 0, color: '#333', fontSize: '22px', fontWeight: '600' }}>Common Software Proxy Configuration Methods</h2>
            <div 
              onClick={() => setShowProxyConfigModal(false)}
              style={{ 
                cursor: 'pointer', 
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#f5f5f5',
                transition: 'background-color 0.2s',
                hover: {
                  backgroundColor: '#e0e0e0'
                }
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#505a6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>
          </div>

          {renderAddressSelector()}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {proxyConfigSections.map((config) => (
              <div key={config.id} style={{ 
                border: '1px solid #eee', 
                borderRadius: '8px',
                overflow: 'hidden',
                transition: 'all 0.3s ease'
              }}>
                <div 
                  onClick={() => toggleSection(config.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 18px',
                    backgroundColor: '#f9f9f9',
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: expandedSections[config.id] ? '1px solid #eee' : 'none'
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#444' }}>{config.title}</h3>
                  <div style={{ transform: expandedSections[config.id] ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.3s ease' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#505a6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>
                
                {expandedSections[config.id] && (
                  <div style={{ padding: '16px' }}>
                    {config.sections.map((section, idx) => (
                      <div key={idx} style={{ 
                        marginBottom: idx < config.sections.length - 1 ? '24px' : 0,
                        backgroundColor: '#fff',
                        borderRadius: '6px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '10px'
                        }}>
                          <h4 style={{ 
                            margin: 0, 
                            fontSize: '15px', 
                            fontWeight: '500', 
                            color: '#333',
                            paddingLeft: '4px'
                          }}>
                            {section.title}
                          </h4>
                          <div 
                            className="copy-button"
                            onClick={() => copyToClipboard(section.code, config.id, idx)}
                            style={{
                              padding: '5px 10px',
                              backgroundColor: copiedState[`${config.id}-${idx}`] ? '#e1f5e1' : '#f0f0f0',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '12px',
                              color: copiedState[`${config.id}-${idx}`] ? '#2e7d32' : '#505a6b',
                              transition: 'all 0.2s'
                            }}
                          >
                            {copiedState[`${config.id}-${idx}`] ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            )}
                            {copiedState[`${config.id}-${idx}`] ? 'Copied' : 'Copy'}
                          </div>
                        </div>
                        <pre style={{ 
                          margin: 0,
                          backgroundColor: '#f9f9f9', 
                          padding: '16px', 
                          borderRadius: '4px',
                          overflowX: 'auto',
                          fontSize: '14px',
                          lineHeight: '1.5'
                        }}>
                          <code>{section.code}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };
  
  // 渲染眼睛图标
  const renderEyeIcon = () => {
    return (
      <div 
        style={{
          ...customStyles.eyeIcon,
          backgroundColor: privateMode ? '#f5f7f9' : 'transparent'
        }}
        onClick={onTogglePrivate}
        title={privateMode ? "点击显示敏感信息" : "点击隐藏敏感信息"}
      >
        {privateMode ? (
          // 闭眼图标
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#505a6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
        ) : (
          // 睁眼图标
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#505a6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        )}
      </div>
    );
  };
  
  // 修改测速图标函数
  const renderSpeedTestIcon = () => {
    const isDisabled = !isRunning; // 当SingBox未运行时禁用测速按钮
    
    return (
      <div 
        style={{
          ...customStyles.eyeIcon,
          backgroundColor: isTesting ? '#f0f4ff' : 'transparent',
          opacity: isDisabled ? 0.5 : 1,
          cursor: isDisabled ? 'not-allowed' : (isTesting ? 'default' : 'pointer')
        }}
        onClick={isDisabled || isTesting ? null : onSpeedTest}
        title={isDisabled ? "请先启动内核以启用测速功能" : "测试节点速度"}
      >
        <svg 
          className={isTesting ? "lightning-spinning" : ""} 
          xmlns="http://www.w3.org/2000/svg" 
          width="18" 
          height="18" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="#505a6b" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        {isTesting && <span style={{
          position: 'absolute',
          top: '-20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '10px',
          whiteSpace: 'nowrap'
        }}>测速中...</span>}
      </div>
    );
  };
  
  // 渲染目录图标
  const renderFolderIcon = () => {
    return (
      <div 
        style={{
          ...customStyles.eyeIcon,
          backgroundColor: 'transparent'
        }}
        onClick={() => {
          if (window.electron && window.electron.openConfigDir) {
            window.electron.openConfigDir()
              .catch(err => console.error('打开配置目录失败:', err));
          }
        }}
        title="打开配置文件所在目录"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#505a6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
    );
  };

  const renderRunStopButton = () => {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center',
        padding: '5px',
        height: '100%',
        width: '100%',
        position: 'relative'
      }}>
        <button
          onClick={onToggleSingBox}
          disabled={isStarting || isStopping || isRestarting}
          onMouseEnter={() => {
            if (isRunning && !isStarting && !isStopping && !isRestarting) {
              setShowRestartButton(true);
            }
          }}
          onMouseLeave={(e) => {
            // 检查鼠标是否真的离开了整个按钮区域
            const rect = e.currentTarget.getBoundingClientRect();
            const isInRestartArea = e.clientY >= rect.top && 
                                   e.clientY <= rect.bottom + 20 &&
                                   e.clientX >= rect.left && 
                                   e.clientX <= rect.right;
            if (!isInRestartArea) {
              setShowRestartButton(false);
            }
          }}
          style={{
            backgroundColor: isRunning ? '#e74c3c' : '#2ecc71',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '5px 15px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: (isStarting || isStopping || isRestarting) ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
            position: 'relative',
            overflow: 'hidden',
            width: '85px',  
            height: '32px', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2
          }}
        >
          {isStarting ? '启动中...' : 
           isStopping ? '停止中...' : 
           isRestarting ? '重启中...' :
           isRunning ? 'STOP' : 'RUN'}
          
          {(isStarting || isStopping || isRestarting) && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              animation: 'loading-shimmer 1.5s infinite',
            }}></div>
          )}
        </button>
        
        {/* 重启按钮 */}
        {showRestartButton && isRunning && !isStarting && !isStopping && !isRestarting && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRestartSingBox();
            }}
            style={{
              backgroundColor: '#f39c12',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '5px 15px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
              width: '85px',  
              height: '32px', 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'absolute',
              top: 'calc(100% + 5px)',
              zIndex: 3,
              animation: 'fadeIn 0.2s ease-in-out'
            }}
          >
            RESTART
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="header" style={{
      background: 'transparent',
      padding: '10px 20px',
      display: 'flex',
      justifyContent: 'space-between'
    }}>
      <div className="search-bar">
        <span className="search-icon"></span>
        <input type="text" placeholder="Search settings..." />
      </div>
      <div className="header-actions" style={{ background: 'transparent', boxShadow: 'none' }}>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          {renderTerminalIcon()}
          {renderEyeIcon()}
          {renderSpeedTestIcon()}
          {renderFolderIcon()}
          <div className="action-separator" style={{ margin: '0 10px' }}></div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="add-customer-btn" onClick={onOpenProfileModal} style={{ padding: '6px 12px', height: '28px' }}>
              <span className="plus-icon"></span>
              <span>PROFILE</span>
            </button>
            <div style={{ marginLeft: '10px' }}>
              {renderRunStopButton()}
            </div>
          </div>
        </div>
      </div>

      {renderProxyConfigModal()}

      <style>{`
        @keyframes loading-shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .lightning-spinning {
          animation: lightning-flash 1.2s ease-in-out infinite;
        }
        
        @keyframes lightning-flash {
          0%, 100% { 
            opacity: 1;
            transform: scale(1);
          }
          50% { 
            opacity: 0.6;
            transform: scale(1.1);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default ControlPanel;