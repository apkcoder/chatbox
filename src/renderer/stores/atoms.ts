import { atom, SetStateAction } from 'jotai'
import { Session, Toast, Settings, CopilotDetail, Message, SettingWindowTab
} from '../../shared/types'
import { selectAtom, atomWithStorage } from 'jotai/utils'
import { focusAtom } from 'jotai-optics'
import * as defaults from '../../shared/defaults'
import storage, { StorageKey } from '../storage'
import platform from '../packages/platform'

const _settingsAtom = atomWithStorage<Settings>(StorageKey.Settings, defaults.settings(), storage)
export const settingsAtom = atom(
    (get) => {
        const settings = get(_settingsAtom)
        return Object.assign({}, defaults.settings(), settings)
    },
    (get, set, update: SetStateAction<Settings>) => {
        const settings = get(_settingsAtom)
        let newSettings = typeof update === 'function' ? update(settings) : update
        if (newSettings.proxy !== settings.proxy) {
            platform.ensureProxyConfig({ proxy: newSettings.proxy })
        }
        set(_settingsAtom, newSettings)
    }
)

export const languageAtom = focusAtom(settingsAtom, (optic) => optic.prop('language'))
export const showWordCountAtom = focusAtom(settingsAtom, (optic) => optic.prop('showWordCount'))
export const showTokenCountAtom = focusAtom(settingsAtom, (optic) => optic.prop('showTokenCount'))
export const showTokenUsedAtom = focusAtom(settingsAtom, (optic) => optic.prop('showTokenUsed'))
export const showModelNameAtom = focusAtom(settingsAtom, (optic) => optic.prop('showModelName'))
export const showMessageTimestampAtom = focusAtom(settingsAtom, (optic) => optic.prop('showMessageTimestamp'))
export const themeAtom = focusAtom(settingsAtom, (optic) => optic.prop('theme'))
export const fontSizeAtom = focusAtom(settingsAtom, (optic) => optic.prop('fontSize'))
export const spellCheckAtom = focusAtom(settingsAtom, (optic) => optic.prop('spellCheck'))
export const allowReportingAndTrackingAtom = focusAtom(settingsAtom, (optic) => optic.prop('allowReportingAndTracking'))
export const enableMarkdownRenderingAtom = focusAtom(settingsAtom, (optic) => optic.prop('enableMarkdownRendering'))
export const autoGenerateTitleAtom = focusAtom(settingsAtom, (optic) => optic.prop('autoGenerateTitle'))

export const licenseDetailAtom = focusAtom(settingsAtom, (optic) => optic.prop('licenseDetail'))

// myCopilots
export const myCopilotsAtom = atomWithStorage<CopilotDetail[]>(StorageKey.MyCopilots, [], storage)

// sessions

const _sessionsAtom = atomWithStorage<Session[]>(StorageKey.ChatSessions, [], storage)
export const sessionsAtom = atom(
    (get) => {
        try {
            let sessions = get(_sessionsAtom)
            // 确保 sessions 是一个数组
            if (!sessions || !Array.isArray(sessions)) {
                console.error('Sessions data is corrupted, resetting to default')
                sessions = defaults.sessions()
            }
            if (sessions.length === 0) {
                sessions = defaults.sessions()
            }
            return sessions
        } catch (error) {
            console.error('Error getting sessions:', error)
            return defaults.sessions()
        }
    },
    (get, set, update: SetStateAction<Session[]>) => {
        try {
            const sessions = get(_sessionsAtom)
            // 确保 sessions 是一个数组
            const safeCurrentSessions = Array.isArray(sessions) ? sessions : []
            let newSessions = typeof update === 'function' 
                ? update(safeCurrentSessions) 
                : update
                
            if (!newSessions || !Array.isArray(newSessions)) {
                console.error('New sessions data is invalid, using defaults')
                newSessions = defaults.sessions()
            } else if (newSessions.length === 0) {
                newSessions = defaults.sessions()
            }
            set(_sessionsAtom, newSessions)
        } catch (error) {
            console.error('Error setting sessions:', error)
            set(_sessionsAtom, defaults.sessions())
        }
    }
)
export const sortedSessionsAtom = atom((get) => {
    return sortSessions(get(sessionsAtom))
})

export function sortSessions(sessions: Session[]): Session[] {
    return [...sessions].reverse()
}

const _currentSessionIdCachedAtom = atomWithStorage<string | null>('_currentSessionIdCachedAtom', null)
export const currentSessionIdAtom = atom(
    (get) => {
        const idCached = get(_currentSessionIdCachedAtom)
        const sessions = get(sortedSessionsAtom)
        if (idCached && sessions.some((session) => session.id === idCached)) {
            return idCached
        }
        return sessions[0].id
    },
    (_get, set, update: string) => {
        set(_currentSessionIdCachedAtom, update)
    }
)

export const currentSessionAtom = atom((get) => {
    const id = get(currentSessionIdAtom)
    const sessions = get(sessionsAtom)
    let current = sessions.find((session) => session.id === id)
    if (!current) {
        return sessions[sessions.length - 1]    // fallback to the last session
    }
    return current
})

export const currentSessionNameAtom = selectAtom(currentSessionAtom, (s) => s.name)
export const currsentSessionPicUrlAtom = selectAtom(currentSessionAtom, (s) => s.picUrl)


export const currentMessageListAtom = selectAtom(currentSessionAtom, (s) => {
    let messageContext: Message[] = []
    if (s.messages) {
        messageContext = messageContext.concat(s.messages)
    }
    return messageContext
})

// toasts

export const toastsAtom = atom<Toast[]>([])

// theme

export const activeThemeAtom = atom<'light' | 'dark'>('light')

export const configVersionAtom = atomWithStorage<number>(StorageKey.ConfigVersion, 0, storage)

export const messageListRefAtom = atom<null | React.MutableRefObject<HTMLDivElement | null>>(null)

export const openSettingDialogAtom = atom<SettingWindowTab | null>(null)
export const sessionCleanDialogAtom = atom<Session | null>(null)
export const chatConfigDialogAtom = atom<Session | null>(null)
