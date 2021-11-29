// The max and min number of 30 min increments a customer can purchase
var MIN_MULTIPLES = 1;
var MAX_MULTIPLES = 4;

var quantityInput = document.getElementById('quantity-input');

quantityInput.addEventListener('change', function (e) {
  // Ensure customers only buy between 1 and 4 photos
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
