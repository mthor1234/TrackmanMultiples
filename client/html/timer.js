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

  // If the count down is finished, write some text
  if (distance < 0) {
    clearInterval(x);
    document.getElementById("demo").innerHTML = "EXPIRED";


    window.resizeTo(screen.width-300,screen.height-500)

  }
}, 1000);