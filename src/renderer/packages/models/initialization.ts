import { ModelProvider, Settings, Config } from '../../../shared/types'
import { getModel } from './index'
import * as Sentry from '@sentry/react'
import { ApiError, NetworkError } from './errors'

// 连接状态存储
interface ConnectionStatus {
  provider: ModelProvider
  status: 'connected' | 'error' | 'pending'
  error?: string
  lastChecked: number
}

// 存储模型实例的缓存
const modelCache: Record<ModelProvider, any> = {} as Record<ModelProvider, any>
// 存储连接状态的缓存
const connectionStatusCache: Record<ModelProvider, ConnectionStatus> = {} as Record<ModelProvider, ConnectionStatus>

/**
 * 获取对应提供商的模型名称设置
 */
function getProviderModelSetting(settings: Settings, provider: ModelProvider): string {
  switch (provider) {
    case ModelProvider.OpenAI:
      return settings.model || '';
    case ModelProvider.Claude:
      return settings.claudeModel || '';
    case ModelProvider.Ollama:
      return settings.ollamaModel || '';
    case ModelProvider.LMStudio:
      return settings.lmStudioModel || '';
    case ModelProvider.ChatboxAI:
      return settings.chatboxAIModel || '';
    case ModelProvider.SiliconFlow:
      return settings.siliconCloudModel || '';
    case ModelProvider.PPIO:
      return settings.ppioModel || '';
    default:
      return '未设置';
  }
}

/**
 * 初始化AI提供商连接
 * @param settings 设置信息
 * @param config 配置信息
 * @returns 连接状态
 */
export async function initializeAIProvider(settings: Settings, config: Config): Promise<ConnectionStatus> {
  const provider = settings.aiProvider
  
  console.log(`[AI初始化] 开始初始化 ${provider} 提供商，配置:`, 
    JSON.stringify({
      provider,
      modelSettings: getProviderModelSetting(settings, provider)
    }))
  
  // 如果30秒内检查过，直接返回缓存结果
  if (connectionStatusCache[provider] && 
      Date.now() - connectionStatusCache[provider].lastChecked < 30000) {
    console.log(`[AI初始化] 使用缓存的连接状态: ${connectionStatusCache[provider].status}，上次检查时间:`, 
      new Date(connectionStatusCache[provider].lastChecked).toISOString())
    return connectionStatusCache[provider]
  }
  
  // 创建初始状态
  const initialStatus: ConnectionStatus = {
    provider,
    status: 'pending',
    lastChecked: Date.now()
  }
  
  connectionStatusCache[provider] = initialStatus
  
  try {
    // 尝试获取模型实例
    console.log(`[AI初始化] 正在创建 ${provider} 模型实例...`)
    const model = getModel(settings, config)
    console.log(`[AI初始化] ${provider} 模型实例创建成功，开始验证连接...`)
    
    // 尝试进行简单的API调用来验证连接
    // 这里我们调用模型的一个简单方法，不同模型可能需要不同的方法
    // 对于某些模型，简单的模型列表获取可能就足够了
    const validationStart = Date.now()
    await model.validateConnection()
    const validationTime = Date.now() - validationStart
    
    // 成功连接，更新状态并缓存模型实例
    modelCache[provider] = model
    
    const successStatus: ConnectionStatus = {
      provider,
      status: 'connected',
      lastChecked: Date.now()
    }
    
    connectionStatusCache[provider] = successStatus
    console.log(`[AI初始化] ${provider} 连接成功，验证耗时: ${validationTime}ms`)
    return successStatus
    
  } catch (error) {
    console.error(`[AI初始化] ${provider} 连接失败:`, error)
    if (error instanceof Error) {
      console.error(`[AI初始化] 错误详情: ${error.message}\n${error.stack}`)
    }
    
    // 只有非预期错误才上报到Sentry
    if (!(error instanceof ApiError || error instanceof NetworkError)) {
      Sentry.captureException(error)
    }
    
    const errorStatus: ConnectionStatus = {
      provider,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      lastChecked: Date.now()
    }
    
    connectionStatusCache[provider] = errorStatus
    return errorStatus
  }
}

/**
 * 获取缓存的模型实例，如果没有则初始化
 */
export async function getCachedModel(settings: Settings, config: Config) {
  const provider = settings.aiProvider
  
  console.log(`[AI模型] 获取 ${provider} 模型实例，检查缓存...`)
  
  // 如果已经有缓存的模型，直接返回
  if (modelCache[provider]) {
    console.log(`[AI模型] 找到 ${provider} 缓存模型实例，直接返回`)
    const model = modelCache[provider]
    
    // 添加调试信息，确认模型实例是否正常
    console.log(`[AI模型] 缓存模型实例信息:`, {
      name: model.name,
      hasChat: typeof model.chat === 'function',
      hasValidateConnection: typeof model.validateConnection === 'function',
    })
    
    return model
  }
  
  // 创建新的模型实例
  console.log(`[AI模型] 未找到 ${provider} 缓存模型，创建新实例...`)
  const newModel = getModel(settings, config);
  
  // 记录模型实例信息
  console.log(`[AI模型] 新创建的模型实例:`, {
    name: newModel.name,
    provider,
    hasChat: typeof newModel.chat === 'function'
  });
  
  // 将模型实例缓存
  modelCache[provider] = newModel;
  console.log(`[AI模型] 已缓存新的模型实例: ${provider}`);
  
  return newModel; // 返回新创建的模型
}

/**
 * 清除特定提供商的缓存
 */
export function clearProviderCache(provider: ModelProvider) {
  console.log(`[AI缓存] 清除 ${provider} 提供商缓存`)
  delete modelCache[provider]
  delete connectionStatusCache[provider]
}

/**
 * 清除所有缓存
 */
export function clearAllCache() {
  console.log(`[AI缓存] 清除所有AI提供商缓存`)
  Object.keys(modelCache).forEach(key => {
    delete modelCache[key as ModelProvider]
  })
  
  Object.keys(connectionStatusCache).forEach(key => {
    delete connectionStatusCache[key as ModelProvider]
  })
} 