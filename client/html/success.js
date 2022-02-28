// TODO: Navigating back and forth to this screen resets the timer to the full amount, 
// Probably should keep the timer running separatelyneed to persist the actual amount of time left

var urlParams = new URLSearchParams(window.location.search);
var sessionId = urlParams.get('session_id');

//First Connect to the Server on the Specific URL (HOST:PORT)
var socket = io.connect('http://localhost:4242');

console.log("TEST!")

// make connection with server from user side
socket.on('connect', function(){
  console.log('Connected to Server')
}
);
// message listener from server
socket.on('newMessage', function(message){
 console.log(message);
});


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

  fetch('/check-session')
  .then((response) => {

    if (response.status >= 200 && response.status <= 299) {

      console.log('Check-session returned good')

      // Session is not defined
      var sessionJSON = JSON.stringify(session, null, 2);
      document.querySelector('pre').textContent = sessionJSON;

      return response.json();
    } else if(response.status == 403){
      console.log("403 FOUND!");

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

// TODO: Need to handle these
THIRTY_SECS = 30
THIRTY_MINS = 1800
SIXTY_MINS = 3600

const TIME_LIMIT = THIRTY_SECS;

let timePassed = 0;

// let timeLeft = TIME_LIMIT;
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

startTimer();

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

function startTimer() {
  console.log("startTimer()");
  timerInterval = setInterval(() => {
    timePassed = timePassed += 1;
    timeLeft = TIME_LIMIT - timePassed;

    localStorage.setItem('time', timeLeft);

    document.getElementById("base-timer-label").innerHTML = formatTime(
      timeLeft
    );
    setCircleDasharray();
    setRemainingPathColor(timeLeft);

    if (timeLeft === 0) {
      onTimesUp();
    }
  }, 1000);
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