const TWENTY_SECS_MILLIS = 20000;
const QR_PAGE_ROUTE = '/qr';

var socket = io.connect(SOCKET_IO_URL_KIOSK);

// Takes the current time and adds the user's purchased time allotment
// TODO: Need to make it so the minute value can be passed in
var countDownDate = Date.today().setTimeToNow().addMinutes(1); 

// Update the count down every 1 second
var x = setInterval(function() {

  // Get today's time
  var now = new Date().getTime();

  // Find the distance between now and the count down date
  var distance = countDownDate - now;

  // Time calculations for days, hours, minutes and seconds
  var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  var seconds = Math.floor((distance % (1000 * 60)) / 1000);

  // Display the result in the element with id="demo"
  document.getElementById("demo").innerHTML = hours + "h "
  + minutes + "m " + seconds + "s ";

  // TIMER HAS EXPIRED!
  if (distance < 0) {
    clearInterval(x);

    // Show the user that the page has expired
    document.getElementById("demo").innerHTML = "EXPIRED";
    routeClientToQRPage();
  }
}, 1000);


// make connection with server from user side
socket.on('connect', function(){
  console.log('Connected to Server')
});

// when disconnected from server
socket.on('disconnect', function(){
  console.log('Disconnect from server')
});


// Routes the user back to the QR page after specified time
function routeClientToQRPage(){
  setTimeout(function() {
    window.location.href = QR_PAGE_ROUTE;
}, TWENTY_SECS_MILLIS);
}
