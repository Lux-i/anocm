import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import AnocmUI from './AnocmUI'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <AnocmUI />
    </>
  )
}

export default App
