import { Alert, FormControl, InputLabel, MenuItem, Select } from '@mui/material'
import { ModelSettings } from '../../../shared/types'
import { Trans, useTranslation } from 'react-i18next'
import TextFieldReset from '@/components/TextFieldReset'
import { useEffect, useState } from 'react'
import Ollama from '@/packages/models/ollama'
import platform from '@/packages/platform'
import { useAtomValue } from 'jotai'
import { languageAtom } from '@/stores/atoms'

export function OllamaHostInput(props: {
    ollamaHost: string
    setOllamaHost: (host: string) => void
    className?: string
}) {
    const { t } = useTranslation()
    const language = useAtomValue(languageAtom)
    return (
        <>
            <TextFieldReset
                label={t('api host')}
                value={props.ollamaHost}
                defaultValue='http://localhost:11434'
                onValueChange={props.setOllamaHost}
                fullWidth
                className={props.className}
            />
            {
                props.ollamaHost
                && props.ollamaHost.length > 16
                && !props.ollamaHost.includes('localhost')
                && !props.ollamaHost.includes('127.0.0.1') && (
                    <Alert icon={false} severity='info' className='my-4'>
                        <Trans i18nKey='Please ensure that the Remote Ollama Service is able to connect remotely. For more details, refer to <a>this tutorial</a>.'
                            components={{
                                a: <a className='cursor-pointer font-bold' onClick={() => {
                                    platform.openLink(`https://chatboxai.app/redirect_app/ollama_guide/${language}`)
                                }}></a>,
                            }}
                        />
                    </Alert>
                )
            }
        </>
    )
}

export function OllamaModelSelect(props: {
    ollamaModel: ModelSettings['ollamaModel']
    setOlamaModel: (model: ModelSettings['ollamaModel']) => void
    ollamaHost: string
    className?: string
}) {
    const { t } = useTranslation()
    const [models, setModels] = useState<string[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    
    // 强制设置默认模型，防止模型未选择的情况
    useEffect(() => {
        // 不再预先设置固定的默认模型名称，而是在获取模型列表后再决定
    }, [])
    
    useEffect(() => {
        setLoading(true)
        const model = new Ollama({
            ollamaHost: props.ollamaHost,
            ollamaModel: props.ollamaModel, // 不再提供固定的默认值
            temperature: 0.5,
        })
        
        console.log("正在获取Ollama模型列表...")
        model.listModels().then((models) => {
            console.log("获取到的模型列表:", models)
            // 过滤掉不需要显示的模型
            const filteredModels = models.filter(model => model !== 'mxbai-embed-large:latest')
            console.log("过滤后的模型列表:", filteredModels)
            
            if (filteredModels.length === 0) {
                console.log("没有找到可用模型")
                setLoading(false)
                return
            }
            
            // 查找所有以deepseek开头的模型
            const deepseekModels = filteredModels.filter(model => 
                model.toLowerCase().includes('deepseek')
            )
            console.log("找到的deepseek模型:", deepseekModels)
            
            // 重新排序模型列表，将deepseek模型放在最前面
            const reorderedModels = [...filteredModels].sort((a, b) => {
                const aHasDeepseek = a.toLowerCase().includes('deepseek')
                const bHasDeepseek = b.toLowerCase().includes('deepseek')
                
                if (aHasDeepseek && !bHasDeepseek) return -1
                if (!aHasDeepseek && bHasDeepseek) return 1
                return 0
            })
            
            console.log("重新排序后的模型列表:", reorderedModels)
            setModels(reorderedModels)
            
            // 如果当前没有选中的模型或者选中的模型不在可用列表中
            if (!props.ollamaModel || !filteredModels.includes(props.ollamaModel)) {
                // 如果有deepseek模型，选择第一个deepseek模型
                if (deepseekModels.length > 0) {
                    console.log("自动选择deepseek模型:", deepseekModels[0])
                    props.setOlamaModel(deepseekModels[0])
                } else {
                    // 否则选择第一个可用模型
                    console.log("无deepseek模型可用，选择第一个模型:", reorderedModels[0])
                    props.setOlamaModel(reorderedModels[0])
                }
            } else {
                console.log("保持当前已选择的模型:", props.ollamaModel)
            }
            
            setLoading(false)
        }).catch(error => {
            console.error("获取模型列表出错:", error)
            setLoading(false)
        })
    }, [props.ollamaHost])
    
    // 如果还在加载中，显示加载中的文本
    if (loading) {
        return (
            <FormControl fullWidth variant="outlined" margin="dense" className={props.className}>
                <InputLabel htmlFor="ollama-model-select">{t('model')}</InputLabel>
                <Select
                    label={t('model')}
                    id="ollama-model-select"
                    value={props.ollamaModel || ""}
                    disabled
                >
                    <MenuItem value="">
                        正在加载模型...
                    </MenuItem>
                </Select>
            </FormControl>
        )
    }
    return (
        <FormControl fullWidth variant="outlined" margin="dense" className={props.className}>
            <InputLabel htmlFor="ollama-model-select">{t('model')}</InputLabel>
            <Select
                label={t('model')}
                id="ollama-model-select"
                value={props.ollamaModel}
                onChange={(e) =>
                    props.setOlamaModel(e.target.value)
                }
            >
                {models.map((model) => (
                    <MenuItem key={model} value={model}>
                        {model}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )
}
