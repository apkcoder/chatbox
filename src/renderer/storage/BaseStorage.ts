import platform from '@/packages/platform'

export default class BaseStorage {
    constructor() {}

    public async setItem<T>(key: string, value: T): Promise<void> {
        try {
            return platform.setStoreValue(key, value)
        } catch (error) {
            console.error(`BaseStorage.setItem error for key ${key}:`, error)
        }
    }

    public async getItem<T>(key: string, initialValue: T): Promise<T> {
        try {
            let value: any = await platform.getStoreValue(key)
            if (value === undefined || value === null) {
                value = initialValue
                this.setItem(key, value)
            }
            
            // 尝试解析 JSON 字符串，如果是的话
            if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                try {
                    value = JSON.parse(value)
                } catch (jsonError) {
                    console.error(`Failed to parse JSON for key ${key}:`, jsonError)
                    value = initialValue
                    this.setItem(key, value)
                }
            }
            
            return value
        } catch (error) {
            console.error(`BaseStorage.getItem error for key ${key}:`, error)
            return initialValue
        }
    }

    public async removeItem(key: string): Promise<void> {
        return platform.delStoreValue(key)
    }

    public async getAll(): Promise<{ [key: string]: any }> {
        return platform.getAllStoreValues()
    }

    public async setAll(data: { [key: string]: any }) {
        return platform.setAllStoreValues(data)
    }

    // subscribe(key: string, callback: any, initialValue: any): Promise<void>
}
