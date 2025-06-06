import { FormGroup, FormControlLabel, Switch, Box } from '@mui/material'
import { Settings, Theme } from '../../../shared/types'
import { useTranslation } from 'react-i18next'
import { languageNameMap, languages } from '../../i18n/locales'
import TranslateIcon from '@mui/icons-material/Translate'
import SimpleSelect from '@/components/SimpleSelect'

export default function DisplaySettingTab(props: {
    settingsEdit: Settings
    setSettingsEdit: (settings: Settings) => void
    changeModeWithPreview: (newMode: Theme) => void
}) {
    const { settingsEdit, setSettingsEdit, changeModeWithPreview } = props
    const { t } = useTranslation()
    return (
        <Box>
            <SimpleSelect
                label={(
                    <span className="inline-flex items-center justify-center">
                        <TranslateIcon fontSize="small" />
                        {t('language')}
                    </span>
                )}
                value={settingsEdit.language}
                onChange={(language) => setSettingsEdit({ ...settingsEdit, language: language })}
                options={languages.map((language) => ({ value: language, label: languageNameMap[language] }))}
            />
            <SimpleSelect
                label={t('Font Size')}
                value={settingsEdit.fontSize}
                onChange={(fontSize) => setSettingsEdit({ ...settingsEdit, fontSize: fontSize })}
                options={[10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map((size) => ({ value: size, label: size }))}
            />
            <SimpleSelect
                label={t('theme')}
                value={settingsEdit.theme}
                onChange={(theme) => changeModeWithPreview(theme)}
                options={[
                    { value: Theme.FollowSystem, label: t('Follow System') },
                    { value: Theme.LightMode, label: t('Light Mode') },
                    { value: Theme.DarkMode, label: t('Dark Mode') },
                ]}
            />
        </Box>
    )
}
