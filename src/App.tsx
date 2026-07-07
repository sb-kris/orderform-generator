import { AppShell } from './components/AppShell'
import { StoreProvider } from './state/store'

export function App() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  )
}
