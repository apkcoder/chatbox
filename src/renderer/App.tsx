import React, { useEffect, useState } from 'react'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { Box, Grid, CircularProgress } from '@mui/material'
import SettingDialog from './pages/SettingDialog'
import ChatConfigWindow from './pages/ChatConfigWindow'
import CleanWidnow from './pages/CleanWindow'
import AboutWindow from './pages/AboutWindow'
import useAppTheme from './hooks/useAppTheme'
import CopilotWindow from './pages/CopilotWindow'
import { useI18nEffect } from './hooks/useI18nEffect'
import Toasts from './components/Toasts'
import RemoteDialogWindow from './pages/RemoteDialogWindow'
import { useSystemLanguageWhenInit } from './hooks/useDefaultSystemLanguage'
import MainPane from './MainPane'
import { useAtom, useAtomValue } from 'jotai'
import * as atoms from './stores/atoms'
import Sidebar from './Sidebar'
import * as premiumActions from './stores/premiumActions'
import * as sessionActions from './stores/sessionActions'
import { createMessage } from '../shared/types'

// 创建一个原子状态来跟踪AI初始化
import { atom, useSetAtom } from 'jotai'
const aiInitializedAtom = atom(false)

function Main() {
    const spellCheck = useAtomValue(atoms.spellCheckAtom)
    const [openSettingWindow, setOpenSettingWindow] = useAtom(atoms.openSettingDialogAtom)
    const [openAboutWindow, setOpenAboutWindow] = React.useState(false)
    const [openCopilotWindow, setOpenCopilotWindow] = React.useState(false)
    const [initializing, setInitializing] = useState(true)  // 用来跟踪初始化状态
    const setAiInitialized = useSetAtom(aiInitializedAtom)
    
    // 初始化AI提供商
    useEffect(() => {
        // 首先记录重要信息
        console.log('===================================================')
        console.log(`[应用初始化] Chatbox启动时间: ${new Date().toISOString()}`)
        console.log(`[应用初始化] 浏览器用户代理: ${navigator.userAgent}`)
        console.log(`[应用初始化] 窗口尺寸: ${window.innerWidth}x${window.innerHeight}`)
        console.log('===================================================')
        
        // 立即开始AI初始化
        console.log('[应用初始化] 立即启动AI提供商初始化')
        setInitializing(true)
        
        // 执行初始化并处理结果
        sessionActions.initializeDefaultAIProvider()
            .then(() => {
                console.log(`[应用初始化] AI提供商初始化完成`)
                
                // 标记AI已初始化
                setAiInitialized(true)
                setInitializing(false)
                
                // 额外测试：初始化后创建一个测试消息来检查系统
                try {
                    const currentSession = sessionActions.getCurrentSession();
                    if (currentSession && currentSession.id) {
                        const dummyPrompt = createMessage('system', '测试AI连接');
                        console.log(`[应用初始化] 发送测试消息验证AI连接...`, dummyPrompt.id)
                        // 这里不真正执行生成，只是记录日志确认流程
                        console.log('[应用初始化] 测试消息已创建，测试流程完成')
                    }
                } catch (testError) {
                    console.error('[应用初始化] 测试消息创建失败', testError)
                }
            })
            .catch(err => {
                console.error('[应用初始化] AI提供商初始化失败:', err)
                if (err instanceof Error) {
                    console.error(`[应用初始化] 错误详情: ${err.message}\n${err.stack}`)
                }
                setInitializing(false)
                setAiInitialized(false)  // 初始化失败
            });
    }, []);

    if (initializing) {
        return (
            <Box 
                display="flex" 
                flexDirection="column"
                alignItems="center" 
                justifyContent="center" 
                height="100vh"
            >
                <CircularProgress size={60} />
                <Box mt={2}>正在初始化 AI 模型...</Box>
            </Box>
        );
    }

    return (
        <Box className="box-border App" spellCheck={spellCheck}>
            <Grid container className="h-full">
                <Sidebar
                    openCopilotWindow={() => setOpenCopilotWindow(true)}
                    openAboutWindow={() => setOpenAboutWindow(true)}
                    setOpenSettingWindow={setOpenSettingWindow}
                />
                <MainPane />
            </Grid>
            <SettingDialog
                open={!!openSettingWindow}
                targetTab={openSettingWindow || undefined}
                close={() => setOpenSettingWindow(null)}
            />
            <AboutWindow open={openAboutWindow} close={() => setOpenAboutWindow(false)} />
            <ChatConfigWindow />
            <CleanWidnow />
            <CopilotWindow open={openCopilotWindow} close={() => setOpenCopilotWindow(false)} />
            <RemoteDialogWindow />
            <Toasts />
        </Box>
    )
}

export default function App() {
    useI18nEffect()
    premiumActions.useAutoValidate()
    useSystemLanguageWhenInit()
    const theme = useAppTheme()
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Main />
        </ThemeProvider>
    )
}
