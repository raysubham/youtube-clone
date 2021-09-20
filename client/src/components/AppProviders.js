import React from 'react'
import { ThemeProvider } from 'styled-components'
import GlobalStyle from '../styles/GlobalStyle'
import { darkTheme } from '../styles/theme'
import { BrowserRouter as Router } from 'react-router-dom'

function AppProviders({ children }) {
  return (
    <Router>
      <ThemeProvider theme={darkTheme}>
        <GlobalStyle />
        {children}
      </ThemeProvider>
    </Router>
  )
}

export default AppProviders
