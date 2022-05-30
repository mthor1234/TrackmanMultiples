; Makes Chrome a fullscreen window
; NOTE: Chrome pop-up window needs to have AlwaysOnTop enabled for this to work

;WinRestore, ahk_class Chrome_WidgetWin_1
;Winactivate, ahk_class Chrome_WidgetWin_1
;WinMaximize, ahk_class Chrome_WidgetWin_1


;WinRestore, ahk_class Chrome_WidgetWin_1 ahk_exe chrome.exe

; This seems to be working pretty well:
Winactivate, ahk_class Chrome_WidgetWin_1 ahk_exe chrome.exe
WinMaximize, ahk_class Chrome_WidgetWin_1 ahk_exe chrome.exe
