import { createRoot } from 'react-dom/client';
import React, { useState } from 'react';
import MessageBox from '../components/MessageBox';

// 创建一个容器并挂载到DOM
let messageBoxRoot = null;
let messageBoxContainer = null;

// 确保只初始化一次
function ensureContainer() {
  if (!messageBoxContainer) {
    messageBoxContainer = document.createElement('div');
    messageBoxContainer.id = 'message-box-container';
    messageBoxContainer.style.position = 'absolute';
    messageBoxContainer.style.top = '0';
    messageBoxContainer.style.left = '0';
    messageBoxContainer.style.right = '0';
    messageBoxContainer.style.bottom = '0';
    messageBoxContainer.style.pointerEvents = 'none';
    messageBoxContainer.style.zIndex = '100';

    // 将容器添加到 body，但样式会让它定位到 main-content
    document.body.appendChild(messageBoxContainer);
    messageBoxRoot = createRoot(messageBoxContainer);
  }

  // 每次调用时检查是否需要重新定位到 main-content
  const mainContent = document.querySelector('.main-content');
  if (mainContent && messageBoxContainer.parentNode !== mainContent) {
    mainContent.appendChild(messageBoxContainer);
  }
}

// MessageBox状态管理组件
const MessageBoxManager = () => {
  const [state, setState] = useState({
    isOpen: false,
    message: '',
    onClose: null,
    queue: []
  });

  const showNextMessage = (currentState) => {
    const stateToUse = currentState || state;
    if (stateToUse.queue.length > 0) {
      const nextMessage = stateToUse.queue[0];
      const newQueue = stateToUse.queue.slice(1);
      setState({
        ...stateToUse,
        isOpen: true,
        message: nextMessage.message,
        onClose: () => {
          if (typeof nextMessage.onClose === 'function') {
            nextMessage.onClose();
          }
          handleClose(newQueue);
        },
        queue: newQueue
      });
    }
  };

  // 关闭当前消息
  const handleClose = (newQueue) => {
    setState(prevState => {
      const updatedState = {
        ...prevState,
        isOpen: false,
        message: '',
        onClose: null,
        queue: newQueue || prevState.queue
      };

      // 设置延迟以确保关闭动画完成后再显示下一个消息
      setTimeout(() => {
        if ((newQueue || prevState.queue).length > 0) {
          showNextMessage(updatedState);
        }
      }, 300);

      return updatedState;
    });
  };

  // 添加新消息到队列
  const addMessage = (message, onClose) => {
    const newMessage = { message, onClose };

    setState(prevState => {
      if (!prevState.isOpen) {
        return {
          ...prevState,
          isOpen: true,
          message: newMessage.message,
          onClose: () => {
            if (typeof newMessage.onClose === 'function') {
              newMessage.onClose();
            }
            handleClose();
          }
        };
      } else {
        return {
          ...prevState,
          queue: [...prevState.queue, newMessage]
        };
      }
    });
  };

  // 将函数暴露到全局
  window.showMessage = addMessage;

  return (
    <MessageBox
      isOpen={state.isOpen}
      message={state.message}
      onClose={state.onClose}
    />
  );
};

// 初始化并渲染MessageBoxManager
export function initMessageBox() {
  ensureContainer();
  messageBoxRoot.render(<MessageBoxManager />);
}

// 显示消息的全局方法
export function showMessage(message, onClose) {
  ensureContainer();
  if (window.showMessage) {
    window.showMessage(message, onClose);
  } else {
    setTimeout(() => {
      if (window.showMessage) {
        window.showMessage(message, onClose);
      } else {
        console.warn('MessageBox not initialized properly');
        alert(message);
      }
    }, 100);
  }
} 