
  const TEN_SECONDS = 10000

  startTimeoutHandler()

  function startTimeoutHandler() {
    timeout = setTimeout(sendUserToScanQR, TEN_SECONDS);
  }
  
  function sendUserToScanQR() {
    console.log("Go back to start!");
    window.location.href='/scan-qr';
  }