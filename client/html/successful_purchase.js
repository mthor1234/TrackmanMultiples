const SOCKET_IO_URL_CLIENT = "http://localhost:8888"

const THREE_MINUTES = 3 * 60000

// Alerts the user of unsaved changes
$(document).ready(function () {

    var unsaved = false;

    $(":input").change(function () { //triggers change in all input fields including text type
      unsaved = true;
    });

    function unloadPage() {
      if (unsaved) {
        return "You have unsaved changes on this page. Do you want to leave this page and discard your changes or stay on this page?";
      }
    }
    window.onbeforeunload = unloadPage;
  });

  startTimeoutHandler()

function startTimeoutHandler() {
  timeout = setTimeout(goBackToStart, THREE_MINUTES);
}

// TODO: Only go back to the start after the time has expired
function goBackToStart() {
  console.log("Go back to start!");
  window.location.href='/index.html';
}

/**
 * SOCKET IO
 * ------------------
 */

//First Connect to the Server on the Specific URL (HOST:PORT)
var socket = io.connect(SOCKET_IO_URL_CLIENT);

// Make connection with server from user side
socket.on('connect', function(){
  console.log('Connected to Server')
});

// After the timer has expired, send the user back to the scan-qr page
socket.on('time_expired', function(){
  console.log('Time Expired!')
  goBackToStart()
});

/**
 * END: SOCKET IO
 * ------------------
 */
