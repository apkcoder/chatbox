import * as atoms from './atoms'
import { getDefaultStore } from 'jotai'
import {
    Settings,
    createMessage,
    Message,
    Session,
} from '../../shared/types'
import { getModel } from '@/packages/models'
import { countWord } from '@/packages/word-count'
import { ApiError, NetworkError, AIProviderNoImplementedPaintError, BaseError } from '@/packages/models/errors'
import * as Sentry from '@sentry/react'
import * as scrollActions from './scrollActions'
import { estimateTokensFromMessages } from '@/packages/token'
import { initializeAIProvider, getCachedModel } from '@/packages/models/initialization'
import * as defaults from '../../shared/defaults'
import { v4 as uuidv4 } from 'uuid'
import platform from '../packages/platform'
import { throttle } from 'lodash'
import * as promptFormat from '../../shared/promptFormat'

// 消息生成占位符
const placeholder = '...'

/**
 * 生成会话上下文
 */
function genMessageContext(settings: Settings, msgs: Message[]) {
    const {
        openaiMaxContextMessageCount
    } = settings
    if (msgs.length === 0) {
        throw new Error('No messages to replay')
    }
    const head = msgs[0].role === 'system' ? msgs[0] : undefined
    if (head) {
        msgs = msgs.slice(1)
    }
    let totalLen = head ? estimateTokensFromMessages([head]) : 0
    let prompts: Message[] = []
    for (let i = msgs.length - 1; i >= 0; i--) {
        const msg = msgs[i]
        if (msg.error || msg.errorCode) {
            continue
        }
        const size = estimateTokensFromMessages([msg]) + 20 // 20 is a rough estimation of the overhead of the prompt
        if (settings.aiProvider === 'openai') {
        }
        if (
            openaiMaxContextMessageCount <= 20 &&
            prompts.length >= openaiMaxContextMessageCount + 1
        ) {
            break
        }
        prompts = [msg, ...prompts]
        totalLen += size
    }
    if (head) {
        prompts = [head, ...prompts]
    }
    return prompts
}

/**
 * 为会话自动生成标题
 */
export async function generateName(sessionId: string) {
    console.log(`[会话命名] 开始为会话生成标题: ${sessionId}`)
    const store = getDefaultStore()
    const settings = store.get(atoms.settingsAtom)
    const configs = await platform.getConfig()
    
    // 获取会话
    const session = getSession(sessionId)
    if (!session) {
        console.error(`[会话命名] 找不到会话: ${sessionId}`)
        return
    }
    
    if (session.messages.length < 2) {
        console.log(`[会话命名] 会话消息不足，需要至少2条消息才能生成标题`)
        return
    }
    
    try {
        // 获取模型实例
        const model = await getCachedModel(settings, configs)
        console.log(`[会话命名] 成功获取模型: ${model.name}`)
        
        // 获取用户的第一条消息作为标题生成的基础
        const userMessages = session.messages.filter(m => m.role === 'user')
        if (userMessages.length === 0) {
            console.log(`[会话命名] 找不到用户消息，无法生成标题`)
            return
        }
        
        const firstUserMessage = userMessages[0]
        
        // 创建生成标题的系统提示
        const titlePrompt = [
            {
                role: 'system' as const,
                content: '请为这个对话生成一个简短的标题，不超过15个字。只返回标题文本，不要有任何其他说明。'
            },
            {
                role: 'user' as const,
                content: firstUserMessage.content
            }
        ]
        
        let title = ''
        const updateTitle = ({ text }: { text: string }) => {
            title = text
        }
        
        // 生成标题
        await model.chat(titlePrompt, updateTitle)
        
        // 清理和格式化标题
        title = title.trim()
        if (title.length > 30) {
            title = title.substring(0, 30) + '...'
        }
        
        // 更新会话名称
        if (title) {
            console.log(`[会话命名] 成功生成标题: "${title}"`)
            modifyName(sessionId, title)
        }
    } catch (err) {
        console.error(`[会话命名] 生成标题时出错:`, err)
        // 生成标题失败不影响程序正常运行，所以不抛出错误
    }
}

export function create(newSession: Session) {
    const store = getDefaultStore()
    store.set(atoms.sessionsAtom, (sessions) => [...sessions, newSession])
    switchCurrentSession(newSession.id)
}

export function modify(update: Session) {
    const store = getDefaultStore()
    store.set(atoms.sessionsAtom, (sessions) =>
        sessions.map((s) => {
            if (s.id === update.id) {
                return update
            }
            return s
        })
    )
}

export function modifyName(sessionId: string, name: string) {
    const store = getDefaultStore()
    store.set(atoms.sessionsAtom, (sessions) =>
        sessions.map((s) => {
            if (s.id === sessionId) {
                return { ...s, name, threadName: name }
            }
            return s
        })
    )
}

export function createEmpty(type: 'chat') {
    switch (type) {
        case 'chat':
            return create(initEmptyChatSession())
        default:
            throw new Error(`Unknown session type: ${type}`)
    }
}

export function switchCurrentSession(sessionId: string) {
    const store = getDefaultStore()
    
    // 获取之前的会话ID，用于日志记录
    const previousSessionId = store.get(atoms.currentSessionIdAtom);
    console.log(`[会话切换] 从会话 ${previousSessionId} 切换到 ${sessionId}`);
    
    // 设置新的会话ID
    store.set(atoms.currentSessionIdAtom, sessionId)
    
    // 确保滚动到底部
    scrollActions.scrollToBottom()
}

export function remove(session: Session) {
    const store = getDefaultStore()
    store.set(atoms.sessionsAtom, (sessions) => sessions.filter((s) => s.id !== session.id))
}

export function clear(sessionId: string) {
    const session = getSession(sessionId)
    if (!session) {
        return
    }
    modify({
        ...session,
        messages: session.messages.filter((m) => m.role === 'system'),
    })
}

export async function copy(source: Session) {
    const store = getDefaultStore()
    const newSession = { ...source }
    newSession.id = uuidv4()
    store.set(atoms.sessionsAtom, (sessions) => {
        let originIndex = sessions.findIndex((s) => s.id === source.id)
        if (originIndex < 0) {
            originIndex = 0
        }
        const newSessions = [...sessions]
        newSessions.splice(originIndex + 1, 0, newSession)
        return newSessions
    })
}

export function getSession(sessionId: string) {
    const store = getDefaultStore()
    const sessions = store.get(atoms.sessionsAtom)
    return sessions.find((s) => s.id === sessionId)
}

export function insertMessage(sessionId: string, msg: Message) {
    const store = getDefaultStore()
    msg.wordCount = countWord(msg.content)
    msg.tokenCount = estimateTokensFromMessages([msg])
    store.set(atoms.sessionsAtom, (sessions) =>
        sessions.map((s) => {
            if (s.id === sessionId) {
                const newMessages = [...s.messages]
                newMessages.push(msg)
                return {
                    ...s,
                    messages: newMessages,
                }
            }
            return s
        })
    )
}

export function modifyMessage(sessionId: string, updated: Message, refreshCounting?: boolean) {
    const store = getDefaultStore()
    if (refreshCounting) {
        updated.wordCount = countWord(updated.content)
        updated.tokenCount = estimateTokensFromMessages([updated])
    }

    updated.timestamp = new Date().getTime()

    let hasHandled = false
    const handle = (msgs: Message[]) => {
        return msgs.map((m) => {
            if (m.id === updated.id) {
                hasHandled = true
                return { ...updated }
            }
            return m
        })
    }
    store.set(atoms.sessionsAtom, (sessions) =>
        sessions.map((s) => {
            if (s.id !== sessionId) {
                return s
            }
            s.messages = handle(s.messages)
            return { ...s }
        })
    )
}

export async function submitNewUserMessage(params: {
    currentSessionId: string
    newUserMsg: Message
    needGenerating: boolean
}) {
    const { currentSessionId, newUserMsg, needGenerating } = params
    
    console.log(`[消息流程] 提交新用户消息：${newUserMsg.id}，内容长度: ${newUserMsg.content.length}字符，需要生成回复: ${needGenerating}，会话ID: ${currentSessionId}`)
    
    // 插入用户消息
    insertMessage(currentSessionId, newUserMsg)
    
    // 强制UI更新，确保第一条消息显示
    setTimeout(() => {
        console.log(`[消息流程] 用户消息插入后滚动到底部: ${newUserMsg.id}`)
        scrollActions.scrollToBottom()
    }, 50)
    
    let newAssistantMsg = createMessage('assistant', '')
    console.log(`[消息流程] 创建助手消息：${newAssistantMsg.id}`)
    
    if (needGenerating) {
        newAssistantMsg.generating = true
        console.log(`[消息流程] 插入生成中的助手消息: ${newAssistantMsg.id}`)
        
        // 插入助手消息
        insertMessage(currentSessionId, newAssistantMsg)
        
        // 再次确保滚动到底部，显示正在生成的消息
        setTimeout(() => {
            console.log(`[消息流程] 助手消息插入后滚动到底部: ${newAssistantMsg.id}`)
            scrollActions.scrollToBottom()
        }, 100)
        
        // 使用setTimeout确保生成过程不会阻塞UI，并确保使用最新的会话ID
        setTimeout(() => {
            // 确保使用当前活动的会话ID
            const store = getDefaultStore();
            const activeSessionId = store.get(atoms.currentSessionIdAtom);
            
            if (activeSessionId !== currentSessionId) {
                console.log(`[消息流程] 会话ID已变更：${currentSessionId} -> ${activeSessionId}，将在新会话中继续生成`);
                // 确保消息在新会话中存在
                const copyToNewSession = () => {
                    const sessions = store.get(atoms.sessionsAtom);
                    const hasUserMsg = sessions.some(s => 
                        s.id === activeSessionId && 
                        s.messages.some(m => m.id === newUserMsg.id)
                    );
                    const hasAssistantMsg = sessions.some(s => 
                        s.id === activeSessionId && 
                        s.messages.some(m => m.id === newAssistantMsg.id)
                    );
                    
                    if (!hasUserMsg) {
                        console.log(`[消息流程] 复制用户消息到新会话: ${activeSessionId}`);
                        insertMessage(activeSessionId, newUserMsg);
                    }
                    
                    if (!hasAssistantMsg) {
                        console.log(`[消息流程] 复制助手消息到新会话: ${activeSessionId}`);
                        insertMessage(activeSessionId, newAssistantMsg);
                    }
                    
                    return activeSessionId;
                };
                
                const sessionIdToUse = copyToNewSession();
                console.log(`[消息流程] 开始为助手消息生成内容: ${newAssistantMsg.id}，使用会话ID: ${sessionIdToUse}`);
                generate(sessionIdToUse, newAssistantMsg)
                    .catch(err => console.error(`[消息流程] 生成助手消息失败: ${newAssistantMsg.id}`, err));
            } else {
                console.log(`[消息流程] 开始为助手消息生成内容: ${newAssistantMsg.id}，会话ID未变更: ${currentSessionId}`);
                generate(currentSessionId, newAssistantMsg)
                    .catch(err => console.error(`[消息流程] 生成助手消息失败: ${newAssistantMsg.id}`, err));
            }
        }, 150)
        return
    }
}

export async function generate(sessionId: string, targetMsg: Message) {
    console.log(`[生成流程] 开始为消息生成内容: ${targetMsg.id}，会话ID: ${sessionId}`)
    const store = getDefaultStore()
    const settings = store.get(atoms.settingsAtom)
    const configs = await platform.getConfig()
    
    // 获取会话
    let session = getSession(sessionId)
    
    // 如果找不到指定的会话，尝试使用当前会话
    if (!session) {
        console.warn(`[生成流程] 未找到指定会话: ${sessionId}，尝试使用当前会话`)
        const currentSessionId = store.get(atoms.currentSessionIdAtom)
        session = getSession(currentSessionId)
        
        if (session) {
            console.log(`[生成流程] 使用当前会话继续: ${session.id}`)
            sessionId = session.id
            
            // 确保目标消息在当前会话中
            const msgExists = session.messages.some(m => m.id === targetMsg.id)
            if (!msgExists) {
                console.log(`[生成流程] 目标消息不在当前会话中，将其添加到当前会话: ${targetMsg.id}`)
                insertMessage(sessionId, targetMsg)
                
                // 重新获取会话信息，以确保包含新消息
                session = getSession(sessionId)
            }
        } else {
            console.error(`[生成流程] 无法找到有效会话，放弃生成`)
            return
        }
    }
    
    if (!session) {
        console.error(`[生成流程] 会话仍然无效，无法继续`)
        return
    }
    
    console.log(`[生成流程] 会话信息: ID=${session.id}, 名称=${session.name}, 消息数量=${session.messages.length}`)
    
    // 使用try/catch包裹更新消息的过程，确保任何错误都被捕获
    try {
        targetMsg = {
            ...targetMsg,
            content: placeholder,
            cancel: undefined,
            aiProvider: settings.aiProvider,
            model: getModel(settings, configs).name,
            generating: true,
            errorCode: undefined,
            error: undefined,
            errorExtra: undefined,
        }
        console.log(`[生成流程] 更新消息状态为生成中: ${targetMsg.id}, 提供商=${settings.aiProvider}`)
        modifyMessage(sessionId, targetMsg)
    } catch (initError) {
        console.error(`[生成流程] 初始化消息状态时出错:`, initError)
    }

    let messages = session.messages
    let targetMsgIx = messages.findIndex((m) => m.id === targetMsg.id)
    console.log(`[生成流程] 目标消息索引: ${targetMsgIx}，总消息数: ${messages.length}`)

    try {
        console.log(`[生成流程] 开始获取缓存模型: ${settings.aiProvider}`)
        
        // 先检查必要的配置是否存在
        console.log(`[生成流程] AI提供商配置检查:`, {
            provider: settings.aiProvider,
            ollamaModel: settings.ollamaModel,
            ollamaHost: settings.ollamaHost
        })
        
        // 获取模型实例
        let model;
        try {
            model = await getCachedModel(settings, configs)
            console.log(`[生成流程] 成功获取模型: ${model.name}`)
        } catch (modelError: any) {
            console.error(`[生成流程] 获取模型失败:`, modelError)
            throw new Error(`获取AI模型失败: ${modelError?.message || '未知错误'}`)
        }
        
        switch (session.type) {
            case 'chat':
            case undefined:
                console.log(`[生成流程] 开始准备消息上下文，当前消息数: ${messages.length}`)
                const promptMsgs = genMessageContext(settings, messages.slice(0, targetMsgIx))
                console.log(`[生成流程] 生成消息上下文成功，上下文消息数: ${promptMsgs.length}`)
                
                const throttledModifyMessage = throttle(({ text, cancel }: { text: string, cancel: () => void }) => {
                    targetMsg = { ...targetMsg, content: text, cancel }
                    console.log(`[生成流程] 更新生成中的消息内容: ${targetMsg.id}, 内容长度: ${text.length}`)
                    modifyMessage(sessionId, targetMsg)
                }, 100)
                
                console.log(`[生成流程] 开始调用模型生成回复，模型: ${model.name}`)
                try {
                    await model.chat(promptMsgs, throttledModifyMessage)
                    console.log(`[生成流程] 模型生成完成: ${targetMsg.id}, 内容长度: ${targetMsg.content.length}字符`)
                } catch (chatError) {
                    console.error(`[生成流程] 模型生成过程中出错:`, chatError)
                    throw chatError
                }
                
                targetMsg = {
                    ...targetMsg,
                    generating: false,
                    cancel: undefined,
                    model: model.name,
                    wordCount: countWord(targetMsg.content),
                    tokenCount: estimateTokensFromMessages([targetMsg]),
                    timestamp: Date.now(),
                }
                console.log(`[生成流程] 完成消息生成: ${targetMsg.id}, 字数: ${targetMsg.wordCount}, Token: ${targetMsg.tokenCount}`)
                modifyMessage(sessionId, targetMsg, true)
                break
            default:
                throw new Error(`Unknown session type: ${session.type}, generate failed`)
        }
    } catch (err: any) {
        console.error(`[生成流程] 生成过程中发生错误: ${err.message}`, err)
        
        if (!(err instanceof Error)) {
            err = new Error(`${err}`)
        }
        if (!(err instanceof ApiError || err instanceof NetworkError || err instanceof AIProviderNoImplementedPaintError)) {
            Sentry.captureException(err) // unexpected error should be reported
        }
        let errorCode: number | undefined = undefined
        if (err instanceof BaseError) {
            errorCode = err.code
        }
        targetMsg = {
            ...targetMsg,
            generating: false,
            cancel: undefined,
            content: targetMsg.content === placeholder ? '' : targetMsg.content,
            errorCode,
            error: `${err.message}`,
            errorExtra: {
                aiProvider: settings.aiProvider,
                host: err['host'],
            },
        }
        console.log(`[生成流程] 更新消息状态为错误: ${targetMsg.id}, 错误码: ${errorCode}, 错误: ${err.message}`)
        modifyMessage(sessionId, targetMsg, true)
    }
}

export function initEmptyChatSession(): Session {
    const store = getDefaultStore()
    const settings = store.get(atoms.settingsAtom)
    const systemPrompt = settings.defaultPrompt || defaults.getDefaultPrompt()
    
    // 确保系统消息有时间戳和ID，便于追踪
    const systemMessage = {
        id: uuidv4(),
        role: 'system' as const,
        content: systemPrompt,
        timestamp: new Date().getTime(),
    }
    
    return {
        id: uuidv4(),
        name: '新会话',
        type: 'chat',
        messages: [systemMessage],
    }
}

export function getCurrentSession() {
    const store = getDefaultStore()
    return store.get(atoms.currentSessionAtom)
}

export function getCurrentMessages() {
    const store = getDefaultStore()
    return store.get(atoms.currentMessageListAtom)
}

// 在应用启动时初始化默认AI提供商
export async function initializeDefaultAIProvider() {
    console.log('[初始化] 应用启动时初始化默认AI提供商')
    const store = getDefaultStore()
    const settings = store.get(atoms.settingsAtom)
    const configs = await platform.getConfig()

    try {
        // 尝试初始化默认AI提供商
        await initializeAIProvider(settings, configs)
        console.log(`[初始化] 默认AI提供商(${settings.aiProvider})初始化完成`)
        
        // 预热模型缓存，提前获取一个模型实例
        try {
            console.log(`[初始化] 预热模型缓存: ${settings.aiProvider}`)
            const model = await getCachedModel(settings, configs)
            console.log(`[初始化] 模型缓存预热成功: ${model.name}`)
            return { status: 'success', provider: settings.aiProvider }
        } catch (cacheError) {
            console.error(`[初始化] 模型缓存预热失败:`, cacheError)
            return { status: 'warning', error: '模型缓存预热失败', provider: settings.aiProvider }
        }
    } catch (error) {
        console.error('[初始化] 初始化AI提供商时出错:', error)
        return { status: 'error', error: error instanceof Error ? error.message : String(error) }
    }
}