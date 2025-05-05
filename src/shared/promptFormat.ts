import { Message } from './types'

/**
 * Generate a prompt to name a conversation based on its messages
 * 
 * @param messages Messages to base the name on
 * @param language Language for the naming
 * @returns A formatted prompt for the model
 */
export function nameConversation(messages: Message[], language = 'zh-CN'): Message[] {
    const isZh = language.startsWith('zh')
    
    const instructions = isZh
        ? '请为这个对话生成一个简短的、描述性的标题，不超过10个字符。只回复标题，不要有任何额外的解释或标点符号。'
        : 'Generate a short, descriptive title for this conversation in under 10 characters. Reply with only the title, no additional explanation or punctuation.'
    
    return [
        {
            id: 'system-name-conv',
            role: 'system',
            content: instructions,
        },
        ...messages
    ]
} 