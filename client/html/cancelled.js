const SEVEN_SECS_MILLIS = 7000

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
  timeout = setTimeout(goBackToStart, SEVEN_SECS_MILLIS);
}

// Redirect the user to the start once the time has expired
function goBackToStart() {
  console.log("Go back to start!");
  // TODO: NOT SURE IF THIS IS RIGHT
  window.location.href='/index.html';
}
