import React, { useRef, useState, useEffect } from 'react'
import { Typography, useTheme } from '@mui/material'
import { SessionType, createMessage } from '../../shared/types'
import { useTranslation } from 'react-i18next'
import * as atoms from '../stores/atoms'
import { useSetAtom } from 'jotai'
import * as sessionActions from '../stores/sessionActions'
import {
    SendHorizontal,
    Settings2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import icon from '../static/icon.png'
import { trackingEvent } from '@/packages/event'
import MiniButton from './MiniButton'
import _ from 'lodash'

export interface Props {
    currentSessionId: string
    currentSessionType: SessionType
}

export default function InputBox(props: Props) {
    const theme = useTheme()
    const setChatConfigDialogSession = useSetAtom(atoms.chatConfigDialogAtom)
    const { t } = useTranslation()
    const [messageInput, setMessageInput] = useState('')
    const inputRef = useRef<HTMLTextAreaElement | null>(null)
    const [easterEgg, setEasterEgg] = useState(false)

    // 记录组件挂载和会话ID变化
    useEffect(() => {
        console.log(`[输入框] 输入框组件挂载或会话ID更新: ${props.currentSessionId}`)
        return () => {
            console.log(`[输入框] 输入框组件卸载，会话ID: ${props.currentSessionId}`)
        }
    }, [props.currentSessionId])

    const handleSubmit = (needGenerating = true) => {
        if (messageInput.trim() === '') {
            console.log(`[输入框] 阻止提交空消息`)
            return
        }
        
        console.log(`[输入框] 提交新消息，会话ID: ${props.currentSessionId}, 内容长度: ${messageInput.length}, 需要生成回复: ${needGenerating}`)
        const newMessage = createMessage('user', messageInput)
        console.log(`[输入框] 创建的用户消息ID: ${newMessage.id}`)
        
        sessionActions.submitNewUserMessage({
            currentSessionId: props.currentSessionId,
            newUserMsg: newMessage,
            needGenerating,
        })
        
        console.log(`[输入框] 消息已提交，清空输入框`)
        setMessageInput('')
        trackingEvent('send_message', { event_category: 'user' })
    }

    const minTextareaHeight = 66
    const maxTextareaHeight = 96

    const onMessageInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const input = event.target.value
        // 避免频繁记录每次按键，使用长度变化较大时才记录
        if (Math.abs(input.length - messageInput.length) > 10) {
            console.log(`[输入框] 用户输入更新，当前长度: ${input.length}字符`)
        }
        setMessageInput(input)
    }

    const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (
            event.keyCode === 13 &&
            !event.shiftKey &&
            !event.ctrlKey &&
            !event.altKey &&
            !event.metaKey
        ) {
            console.log(`[输入框] 按下Enter键提交消息`)
            event.preventDefault()
            handleSubmit()
            return
        }
        if (event.keyCode === 13 && event.ctrlKey) {
            console.log(`[输入框] 按下Ctrl+Enter提交消息但不生成回复`)
            event.preventDefault()
            handleSubmit(false)
            return
        }
    }

    return (
        <div className='pl-2 pr-4'
            style={{
                borderTopWidth: '1px',
                borderTopStyle: 'solid',
                borderTopColor: theme.palette.divider,
            }}
        >
            <div className={cn('w-full mx-auto flex flex-col')}>
                <div className='flex flex-row flex-nowrap justify-between py-1'>
                    <div className='flex flex-row items-center'>
                        <MiniButton className='mr-2 hover:bg-transparent' style={{ color: theme.palette.text.primary }}
                            onClick={() => {
                                setEasterEgg(true)
                                setTimeout(() => setEasterEgg(false), 1000)
                            }}
                        >
                            <img className={cn('w-5 h-5', easterEgg ? 'animate-spin' : '')} src={icon} />
                        </MiniButton>
                        <MiniButton className='mr-2' style={{ color: theme.palette.text.primary }}
                            onClick={() => setChatConfigDialogSession(sessionActions.getCurrentSession())}
                            tooltipTitle={
                                <div className='text-center inline-block'>
                                    <span>{t('Customize settings for the current conversation')}</span>
                                </div>
                            }
                            tooltipPlacement='top'
                        >
                            <Settings2 size='22' strokeWidth={1} />
                        </MiniButton>
                    </div>
                    <div className='flex flex-row items-center'>
                        <MiniButton className='w-8 ml-2'
                            style={{
                                color: theme.palette.getContrastText(theme.palette.primary.main),
                                backgroundColor: theme.palette.primary.main,
                            }}
                            tooltipTitle={
                                <Typography variant="caption">
                                    {t('[Enter] send, [Shift+Enter] line break, [Ctrl+Enter] send without generating')}
                                </Typography>
                            }
                            tooltipPlacement='top'
                            onClick={() => handleSubmit()}
                        >
                            <SendHorizontal size='22' strokeWidth={1} />
                        </MiniButton>
                    </div>
                </div>
                <div className='w-full pl-1 pb-2'>
                    <textarea
                        className={cn(
                            `w-full max-h-[${maxTextareaHeight}px]`,
                            'overflow-y resize-none border-none outline-none',
                            'bg-transparent p-1'
                        )}
                        value={messageInput} onChange={onMessageInput}
                        onKeyDown={onKeyDown}
                        ref={inputRef}
                        style={{
                            height: 'auto',
                            minHeight: minTextareaHeight + 'px',
                            color: theme.palette.text.primary,
                            fontFamily: theme.typography.fontFamily,
                            fontSize: theme.typography.body1.fontSize,
                        }}
                        placeholder={t('Type your question here...') || ''}
                    />
                    <div className='flex flex-row items-center'>
                    </div>
                </div>
            </div>
        </div>
    )
}
