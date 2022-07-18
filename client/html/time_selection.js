const SOCKET_IO_URL_CUSTOMER = "http://localhost:8888"
const ONE_MINUTE_MILLIS = 60000;

// The max and min number of 30 min increments a customer can purchase
var MIN_MULTIPLES = 1;
var MAX_MULTIPLES = 4;

var quantityInput = document.getElementById('quantity-input');

//First Connect to the Server on the Specific URL (HOST:PORT)
var socket = io.connect(SOCKET_IO_URL_CUSTOMER);

// User has a max of ONE_MINUTE_MILLIS on this page before it sends to user to the Scan QR page
setTimeout(function () {
  // Redirects to the expired page
  window.location.href = PATH_PLEASE_SCAN;
}, ONE_MINUTE_MILLIS)

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

var mins = document.getElementById("time_duration");

var updateQuantity = function (evt) {
  if (evt && evt.type === 'keypress' && evt.keyCode !== 13) {
    return;
  }

  var delta = evt && evt.target.id === 'add' && 1 || -1;

  addBtn.disabled = false;
  subtractBtn.disabled = false;

  // Update number input with new value.
  quantityInput.value = parseInt(quantityInput.value) + delta;

  var value = parseInt(quantityInput.value)

  switch(value) {
    case 1:
      mins.textContent = "30 Mins"
      break;
    case 2:
      mins.textContent = "60 Mins"
      break;
    case 3:
      mins.textContent = "90 Mins"
      break;
    case 4:
      mins.textContent = "120 Mins"
      break;
    default:
      mins.textContent = "30 Mins"
  }

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