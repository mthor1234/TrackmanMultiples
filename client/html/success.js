// Pressing back button when timer has started then navigating back causes the timer
// To have a crazy number. Need to fix this

// Need to test further.. it worked once but failed the 2nd time
// I think it fails if there is no user interaction.. Similar to my attempts with unbeforeload
// It works when I press a club but fails if I don't press anything
// https://stackoverflow.com/questions/19926641/how-to-disable-the-back-button-in-the-browser-using-javascript
history.pushState(null, null, document.URL);
window.addEventListener('popstate', function () {
    history.pushState(null, null, document.URL);
});


// TODO: Need to limit the checkout page to 5 mins. 
//    Don't want someone on that page blocking everyone forever
const CHECK_SESSION_INTERVAL = 10000

// TODO: Back and forth ignores the expired token.... refresh works though
//  * Eventually, the token should match the time expiration... But still, we need to be able to respect the token

// TODO: Time was broken after completing a session and then going back... Says Timer is already in progress

// Constantly asking the Server if the session is good to continue
setInterval(function () {
  console.log('Interval!')
  checkSession()
}, CHECK_SESSION_INTERVAL)


history.pushState(null, null, window.location.href);
history.back();
window.onpopstate = () => history.forward();


var urlParams = new URLSearchParams(window.location.search);
var sessionId = urlParams.get('session_id');

//First Connect to the Server on the Specific URL (HOST:PORT)
var socket = io.connect(SOCKET_IO_URL);

//            //
// SOCKET IO  //
//            //

// Make connection with server from user side
socket.on('connect', function(){
  console.log('Connected to Server')

  // Start the timer
  socket.emit('start timer')
});

// Each time the Timer 'ticks', this is called
socket.on('tick', (duration) => {
  console.log('TICK! : ' + duration)

  localStorage.setItem('time', duration);

  document.getElementById("base-timer-label").innerHTML = formatTime(
    duration
  );

  setCircleDasharray();
  setRemainingPathColor(duration);

  // The user's time has expired
  if (duration === 0) {
    onTimesUp();
  }
});

socket.on('time expired', function(){
  console.log('Whoops, time expired')
});

// Could miss this if the user refreshes at the perfect time or the socket drops out and we miss this?
socket.on('redirectToExpired', expirationURL => {
  console.log('SOCKET IO: Expired Redirect');
  // redirect to new URL
  window.location.href = '/session_expired.html';
});

// when disconnected from server
socket.on('disconnect', function(){
  console.log('Disconnect from server')
});

// Check if the token is good
if (sessionId) {
  console.log("Session ID!");

  // Ask the server if the session is good
  checkSession()
}else{
  console.log("No Session ID!");
}

// TIMER Below

const FULL_DASH_ARRAY = 283;
const WARNING_THRESHOLD = 60;
const ALERT_THRESHOLD = 15;

const COLOR_CODES = {
  info: {
    color: "green"
  },
  warning: {
    color: "orange",
    threshold: WARNING_THRESHOLD
  },
  alert: {
    color: "red",
    threshold: ALERT_THRESHOLD
  }
};

THIRTY_SECS = 30
THIRTY_MINS = 1800
SIXTY_MINS = 3600

const TIME_LIMIT = THIRTY_SECS;

let timeLeft = localStorage.getItem('time') || TIME_LIMIT;

let timerInterval = null;

let remainingPathColor = COLOR_CODES.info.color;

document.getElementById("timer").innerHTML = `
<div class="base-timer">
  <svg class="base-timer__svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <g class="base-timer__circle">
      <circle class="base-timer__path-elapsed" cx="50" cy="50" r="45"></circle>
      <path
        id="base-timer-path-remaining"
        stroke-dasharray="283"
        class="base-timer__path-remaining ${remainingPathColor}"
        d="
          M 50, 50
          m -45, 0
          a 45,45 0 1,0 90,0
          a 45,45 0 1,0 -90,0
        "
      ></path>
    </g>
  </svg>
  <span id="base-timer-label" class="base-timer__label">${formatTime(
    timeLeft
  )}</span>
</div>
`;

function onTimesUp() {
  clearInterval(timerInterval);

  fetch('/expire-token')
    .then((response) => {
      console.log("HIT EXPIRE TOKEN!")
      // User can stil navigate back to the Club-Selection which is what we want to avoid

    // Redirects to the expired page
     window.location.href='/session_expired.html';
  });

  console.log("TIMES UP!")
}

function formatTime(time) {
  const minutes = Math.floor(time / 60);
  let seconds = time % 60;

  if (seconds < 10) {
    seconds = `0${seconds}`;
  }

  return `${minutes}:${seconds}`;
}

function setRemainingPathColor(timeLeft) {
  const { alert, warning, info } = COLOR_CODES;
  if (timeLeft <= alert.threshold) {
    document
      .getElementById("base-timer-path-remaining")
      .classList.remove(warning.color);
    document
      .getElementById("base-timer-path-remaining")
      .classList.add(alert.color);
  } else if (timeLeft <= warning.threshold) {
    document
      .getElementById("base-timer-path-remaining")
      .classList.remove(info.color);
    document
      .getElementById("base-timer-path-remaining")
      .classList.add(warning.color);
  }
}

function calculateTimeFraction() {
  const rawTimeFraction = timeLeft / TIME_LIMIT;
  return rawTimeFraction - (1 / TIME_LIMIT) * (1 - rawTimeFraction);
}

function setCircleDasharray() {
  const circleDasharray = `${(
    calculateTimeFraction() * FULL_DASH_ARRAY
  ).toFixed(0)} 283`;
  document
    .getElementById("base-timer-path-remaining")
    .setAttribute("stroke-dasharray", circleDasharray);
}


function checkSession(){
  fetch('/check-session')
  .then((response) => {

    if (response.status >= 200 && response.status <= 299) {

      console.log('Check-session returned good')
      return response.json();

    } else if(response.status == 403){
      console.log("403 FOUND!");

      // TODO: Testing this
      onTimesUp()

      // Send the user to the session expired page. 
      // Consider sending them to the start page
      window.location.href='/session_expired.html';
      return response.json();
    }
    else {
      throw Error(response.statusText);
    }
  })
  .then((jsonResponse) => {
    // do whatever you want with the JSON response
  }).catch((error) => {
    // Handle the error
    console.log(error);
  });
}