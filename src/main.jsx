import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import HubScreen from './hub/HubScreen.jsx'
import ErrorBoundary from './shared/components/ErrorBoundary.jsx'
import ProfileProvider from './shared/context/ProfileProvider.jsx'
import HelpDetailProvider from './shared/context/HelpDetailProvider.jsx'
import SoundProvider from './shared/context/SoundProvider.jsx'
import { registerServiceWorker } from './shared/services/serviceWorker.js'
import { installCrashListeners } from './shared/services/crashReport.js'

// Before the first render, so an error thrown while the arcade starts up is
// heard too. ErrorBoundary reports render crashes; this catches the rest.
installCrashListeners()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Inside the boundary, so a corrupt saved profile shows the error screen
          rather than a blank page. */}
      <ProfileProvider>
        {/* At the root rather than per screen: whether the settings cards show
            their long-form reasoning is one arcade-wide preference, so every
            game's setup screen and online lobby has to read the same copy of it. */}
        <HelpDetailProvider>
          <SoundProvider>
            <HubScreen />
          </SoundProvider>
        </HelpDetailProvider>
      </ProfileProvider>
    </ErrorBoundary>
  </StrictMode>,
)

registerServiceWorker()
