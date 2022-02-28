// The max and min number of 30 min increments a customer can purchase
var MIN_MULTIPLES = 1;
var MAX_MULTIPLES = 4;

var quantityInput = document.getElementById('quantity-input');

//First Connect to the Server on the Specific URL (HOST:PORT)
var socket = io.connect(SOCKET_IO_URL);

// User has a max of ONE_MINUTE_MILLIS on this page before it sends to user to the Scan QR page
setTimeout(function () {
  // Redirects to the expired page
  window.location.href = PATH_PLEASE_SCAN;
}, ONE_MINUTE_MILLIS)

  fetch('/check-qr')
  .then((response) =>response.json())
  .then((data) => {
    if (data.qr === getCode()) {
      console.log('QR Code matches!')
    } else {
      // Send the user to the scan qr page
      window.location.href = PATH_PLEASE_SCAN;
    }
  }).catch((error) => {
    // Handle the error
    console.log(error);

    // Reroute if error, just to be safe
    window.location.href = PATH_PLEASE_SCAN;
  });

  // Get the QR Code Number via the URL
  function getCode(){
    var sPageURL = window.location.href;
    var sURLVariables = sPageURL.split('time-selection/');

    sParam = sURLVariables[1]
    return sParam;
  }

// make connection with server from user side
socket.on('connect', function(){
  console.log('Connected to Server')
  getCode();
});

// when disconnected from server
socket.on('disconnect', function(){
  console.log('Disconnect from server')
});

quantityInput.addEventListener('change', function (e) {
  // Ensure customers only buy between 1 and 4 increments
  if (quantityInput.value < MIN_MULTIPLES) {
    quantityInput.value = MIN_MULTIPLES;
  }
  if (quantityInput.value > MAX_MULTIPLES) {
    quantityInput.value = MAX_MULTIPLES;
  }
});

/* Method for changing the product quantity when a customer clicks the increment / decrement buttons */
var addBtn = document.getElementById("add");
var subtractBtn = document.getElementById("subtract");

var updateQuantity = function (evt) {
  if (evt && evt.type === 'keypress' && evt.keyCode !== 13) {
    return;
  }
  var delta = evt && evt.target.id === 'add' && 1 || -1;

  addBtn.disabled = false;
  subtractBtn.disabled = false;

  // Update number input with new value.
  quantityInput.value = parseInt(quantityInput.value) + delta;

  // Disable the button if the customers hits the max or min
  if (quantityInput.value == MIN_MULTIPLES) {
    subtractBtn.disabled = true;
  }
  if (quantityInput.value == MAX_MULTIPLES
  ) {
    addBtn.disabled = true;
  }
};

addBtn.addEventListener('click', updateQuantity);
subtractBtn.addEventListener('click', updateQuantity);