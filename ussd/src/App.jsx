import './App.css'
import dexaLogo from './assets/dexa-logo.svg'

function App() {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <img src={dexaLogo} alt="DeXa USSD logo" width={120} height={120} />
        <h1>DeXa USSD</h1>
        <p style={{ maxWidth: 560, textAlign: 'center' }}>
          AI-powered USSD & SMS access to Hedera (EVM) for Africa. Secure wallet setup, PIN-protected actions,
          and natural-language queries—right from any mobile phone.
        </p>
      </div>
    </>
  )
}

export default App
