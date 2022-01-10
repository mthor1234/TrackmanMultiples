// TODO: Should probably keep the user's session ID on the expiration page as well.. This way, some random can't just export
let startTimeoutHandler;
const FIVE_MINUTES = 5 * 60000

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

    $('#email_submit').click(function() {
      unsaved = false;
    });

  });

  startTimeoutHandler()


function startTimeoutHandler() {
  timeout = setTimeout(goBackToStart, FIVE_MINUTES);
}

function goBackToStart() {
  console.log("Go back to start!");
  window.location.href='/index.html';
}