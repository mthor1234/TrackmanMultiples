WinGet, WinStatus, MinMax, ahk_exe chrome.exe
if (WinStatus != 0)
	WinRestore, ahk_exe chrome.exe

	; Chrome_WidgetWin_1

; Makes the Chrome window smaller and moves it to the bottom right of the screen
; X, Y, Width, Height
WinMove, ahk_exe chrome.exe,, 1600, 1800, 500, 160