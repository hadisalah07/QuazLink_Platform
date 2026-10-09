!macro customInit
  ; Terminate any existing or zombie runner processes to ensure clean file replacement
  ExecWait 'taskkill /F /IM "QuazLink Runner.exe" /T'
!macroend

!macro customInstall
  ; Remove old deprecated desktop and start menu shortcuts
  Delete "$DESKTOP\QuazLink Desktop Runner.lnk"
  Delete "$SMPROGRAMS\QuazLink Desktop Runner.lnk"
!macroend
