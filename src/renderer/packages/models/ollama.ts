import { Message } from 'src/shared/types'
import Base, { onResultChange } from './base'
import { ApiError } from './errors'
import { log } from 'console'

// import ollama from 'ollama/browser'

interface Options {
    ollamaHost: string
    ollamaModel: string
    temperature: number
}

export default class Ollama extends Base {
    public name = 'Ollama'

    public options: Options
    constructor(options: Options) {
        super()
        this.options = options
    }

    /**
     * 验证与Ollama服务器的连接
     * 通过尝试获取模型列表来验证
     */
    async validateConnection(): Promise<boolean> {
        try {
            console.log(`[Ollama] 验证连接到 ${this.getHost()}`)
            const models = await this.listModels()
            console.log(`[Ollama] 连接成功，可用模型: ${models.length}个`)
            
            // 如果没有设置模型名称，尝试自动设置
            if (!this.options.ollamaModel && models.length > 0) {
                // 优先选择deepseek模型
                const deepseekModels = models.filter(model => 
                    model.toLowerCase().includes('deepseek')
                )
                
                if (deepseekModels.length > 0) {
                    this.options.ollamaModel = deepseekModels[0]
                    console.log(`[Ollama] 自动选择deepseek模型: ${this.options.ollamaModel}`)
                } else {
                    this.options.ollamaModel = models[0]
                    console.log(`[Ollama] 自动选择模型: ${this.options.ollamaModel}`)
                }
            }
            
            return true
        } catch (error) {
            console.error(`[Ollama] 连接验证失败:`, error)
            return false
        }
    }

    getHost(): string {
        let host = this.options.ollamaHost.trim()
        if (host.endsWith('/')) {
            host = host.slice(0, -1)
        }
        if (!host.startsWith('http')) {
            host = 'http://' + host
        }
        if (host === 'http://localhost:11434') {
            host = 'http://127.0.0.1:11434'
        }
        return host
    }

    async callChatCompletion(rawMessages: Message[], signal?: AbortSignal, onResultChange?: onResultChange): Promise<string> {
        const messages = rawMessages.map(m => ({ role: m.role, content: m.content }))
        
        // 确保有一个有效的模型名称
        if (!this.options.ollamaModel) {
            // 如果没有设置模型，尝试获取模型列表并找到一个deepseek模型
            try {
                console.log("模型未设置，尝试获取可用模型列表...");
                const models = await this.listModels();
                const deepseekModels = models.filter(model => 
                    model.toLowerCase().includes('deepseek')
                );
                
                if (deepseekModels.length > 0) {
                    // 使用第一个deepseek模型
                    this.options.ollamaModel = deepseekModels[0];
                    console.log("已自动选择deepseek模型:", this.options.ollamaModel);
                } else if (models.length > 0) {
                    // 如果没有deepseek模型，使用列表中的第一个模型
                    this.options.ollamaModel = models[0];
                    console.log("无deepseek模型可用，使用第一个可用模型:", this.options.ollamaModel);
                } else {
                    throw new ApiError("没有可用的模型");
                }
            } catch (error) {
                console.error("自动获取模型失败:", error);
                throw new ApiError("未指定模型且无法获取可用模型列表");
            }
        }
        
        console.log("Ollama API调用使用模型:", this.options.ollamaModel);
        
        const res = await this.post(
            `${this.getHost()}/api/chat`,
            { 'Content-Type': 'application/json' },
            {
                model: this.options.ollamaModel,
                messages,
                stream: true,
                options: {
                    temperature: this.options.temperature,
                }
            },
            signal,
        )
        let result = ''
        await this.handleNdjson(res, (message) => {
            const data = JSON.parse(message)
            if (data['done']) {
                return
            }
            const word = data['message']?.['content']
            if (! word) {
                throw new ApiError(JSON.stringify(data))
            }
            result += word
            if (onResultChange) {
                onResultChange(result)
            }
        })
        return result
    }

    async listModels(): Promise<string[]> {
        const res = await this.get(`${this.getHost()}/api/tags`, {})
        const json = await res.json()
        if (! json['models']) {
            throw new ApiError(JSON.stringify(json))
        }
        return json['models'].map((m: any) => m['name'])
    }
}
