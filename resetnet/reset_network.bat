@echo off
:: ตรวจสอบสิทธิ์ผู้ดูแลระบบ
>nul 2>&1 net session
if %errorlevel% neq 0 (
    echo กรุณารันสคริปต์นี้ด้วยสิทธิ์ Administrator.
    timeout /t 5
    exit /b
)

echo ปล่อย IP เดิม...
ipconfig /release

echo ล้าง DNS...
ipconfig /flushdns

echo ขอ IP ใหม่...
ipconfig /renew

echo รีเซ็ต TCP/IP stack...
netsh int ip reset >nul

echo รีเซ็ต Winsock...
netsh winsock reset >nul

echo.
echo === โปรดรีสตาร์ทเครื่องเพื่อให้การเปลี่ยนแปลงสมบูรณ์ ===

timeout /t 3 >nul

:: เปิดใช้งานบรรทัดด้านล่างหากต้องการให้เครื่องรีสตาร์ทอัตโนมัติ
:: shutdown /r /t 5

pause
exit /b
