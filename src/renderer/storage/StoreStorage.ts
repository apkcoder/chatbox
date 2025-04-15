import BaseStorage from './BaseStorage'
import { defaultSessionsForEN, defaultSessionsForCN } from '../packages/initial_data'
import platform from '@/packages/platform'

export enum StorageKey {
    ChatSessions = 'chat-sessions',
    Configs = 'configs',
    Settings = 'settings',
    MyCopilots = 'myCopilots',
    ConfigVersion = 'configVersion',
    RemoteConfig = 'remoteConfig',
}

export default class StoreStorage extends BaseStorage {
    constructor() {
        super()
    }
    public async getItem<T>(key: string, initialValue: T): Promise<T> {
        try {
            let value: T = await super.getItem(key, initialValue)

            // 特殊处理会话数据
            if (key === StorageKey.ChatSessions) {
                // 检查数据是否有效
                if (!value || typeof value !== 'object' || (Array.isArray(value) && value.length === 0)) {
                    const lang = await platform.getLocale().catch(e => 'en')
                    if (lang.startsWith('zh')) {
                        value = defaultSessionsForCN as T
                    } else {
                        value = defaultSessionsForEN as T
                    }
                    console.log('Using default sessions for', lang)
                    await super.setItem(key, value)
                }
            }
            
            if (key === StorageKey.Configs && value === initialValue) {
                await super.setItem(key, initialValue)
            }

            return value
        } catch (error) {
            console.error(`Error getting item ${key}:`, error)
            // 出现错误时返回初始值
            if (key === StorageKey.ChatSessions) {
                const lang = await platform.getLocale().catch(e => 'en')
                const defaultValue = lang.startsWith('zh') ? defaultSessionsForCN as T : defaultSessionsForEN as T
                await super.setItem(key, defaultValue)
                return defaultValue
            }
            return initialValue
        }
    }
}
