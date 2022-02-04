// LIBS //

// Copy the .env.example in the root into a .env file in this folder
require('dotenv').config({ path: './.env' });

const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
const http = require('http');
const port = process.env.PORT || 4242 // setting the port 
const server = http.createServer(app);
const socketIO = require('socket.io');
const io = socketIO(server)
const { resolve } = require('path');

// PATHS //
const PATH_BASE = process.env.STATIC_DIR;
const PATH_ALREADY_IN_USE = resolve(PATH_BASE + '/already_in_use.html');
const PATH_INDEX = resolve(PATH_BASE + '/index.html');
const TIME_SELECTION_INDEX = resolve(PATH_BASE + '/time_selection.html');
const PATH_QR = resolve(PATH_BASE + '/qr.html');
const PATH_SESSION_EXPIRED = resolve(PATH_BASE + '/session_expired.html');
const PATH_ERROR = resolve(PATH_BASE + '/error.html');
const PATH_PLEASE_SCAN = resolve(PATH_BASE + '/scan_qr.html');

const PATH_SUCCESS = PATH_BASE + '/success.html';
const QRCode = require('qrcode');

// Generates the QR Code 
const generateQR = async text => {
  console.log("CREATING A NEW QR");

    try {
        await QRCode.toFile('../../client/html/res/qr_code.png', text);
    } catch (err) {
        console.log(err);
    }
}


// Append this on the end of success route to avoid users from 'hacking' into a free session
var randomNumber = (Date.now() + Math.random()).toString(36);
console.log("Random: " + randomNumber);


// TODO: Can I turn this into a lambda that just keep sgoin instead of it being in just the setInterval function
// Generates the QR Code 
var randomNumberQR = (Date.now() + Math.random()).toString(36);
generateQR("http://localhost:4242/time-selection/" + randomNumberQR);


console.log("Random Number QR: " + randomNumberQR);

var minutes = 1, the_interval = minutes * 60 * 1000;
setInterval(function() {
  console.log("I am doing my 1 minutes check");

  randomNumberQR = (Date.now() + Math.random()).toString(36);
  console.log("Random QR Number: " + randomNumberQR);

  // Creates a QR Code for the time-selection route with the randomly generated number appended
  generateQR("http://localhost:4242/time-selection/" + randomNumberQR);

  // do your stuff here
}, the_interval);


// TODO: Need to auto disconnect the socket after 5 mins if the user has not gone to checkout by then
// TODO: Should I only kick on the socket once the user has paid?
//    I think I'm a fan of this thinking since a user shouldn't
//    be able to block other users from using the machine unless they have paid
//    If I stick with preventing the user before payment, it can easily be used as a way to attack
//    Also, don't need to worry about using a timeout either

var hasActiveSession = false;
var token = null;



// Ensure environment variables are set.
checkEnv();

// Sets up the Stripe constant used throughout
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
  appInfo: { // For sample support and debugging, not required for production:
    name: "stripe-samples/checkout-one-time-payments",
    version: "0.0.1",
    url: "https://github.com/stripe-samples/checkout-one-time-payments"
  },
  maxNetworkRetries: 3
});


app.use(express.static(PATH_BASE));
app.use(express.urlencoded());
app.use(
  express.json({
    // We need the raw body to verify webhook signatures.
    // Let's compute it only when hitting the Stripe webhook endpoint.
    verify: function (req, res, buf) {
      if (req.originalUrl.startsWith('/webhook')) {
        req.rawBody = buf.toString();
      }
    },
  })
);

server.listen(port, () => console.log(`Node server listening on port ${port}!`));


// SOCKET IO //
// make a connection with the user from server side
io.on('connection', (socket) => {

  if (hasActiveSession) {
    console.log('Theres an active socket connection. Reject this connection');
  }
  else {
    console.log('New user connected... ID: ' + socket.id);
    hasActiveSession = true;

    // This is how to call the disconnect from SocketIO. 
    // When the user navigates away from the webpage, this is called
    socket.on('disconnect', function () {
      console.log('user disconnected');
      hasActiveSession = false;
    });
  }
});

io.on('disconnect', (socket) => {
  console.log('SocketIO Session Disconnected');
  hasActiveSession = false;
});


// ROUTES //

// TODO: Testing
// Catches all routes to show the QR Code route
// app.get('/*', function(req, res) {
//   const path = resolve(process.env.STATIC_DIR + '/qr.html');
//   res.sendFile(path);
// });


// TODO: Will need to remove this route eventually
app.get('/time-selection', function (req, res) {
  console.log('Index hit!');
  
  var path = resolve(routeBasedOnMachineInUse(TIME_SELECTION_INDEX));
  res.sendFile(path);
});

// Time-Selection must match the randomly generated number, otherwise, it will route the scan_qr.html page
app.get('/time-selection/:key', function (req, res) {
  console.log('Index hit!');

  if(req.params.key === randomNumberQR){
    var path = resolve(routeBasedOnMachineInUse(TIME_SELECTION_INDEX));
    res.sendFile(path);
  }else{
    // Route the user to scan the QR Code
    res.sendFile(PATH_PLEASE_SCAN);
  }
});

// TODO: This will be running on the PC and shouldn't be hosted / accesible by the customer
app.get('/QR', (req, res) => {
  res.sendFile(PATH_QR);
});

// TODO: This random number might work. Need to work on constant updating the random number to avoid user from unwanted access
app.get('/' + randomNumber, (req, res) => {
 
  console.log("In the random number");

  // Creates the JWT so we can restrict access to the club selection page
  generateJWT();

  const success_url = `http://localhost:4242/success.html?session_id=` + token;

  res.redirect(success_url);
});

// Fetch the Checkout Session to display the JSON result on the success page
app.get('/check-session', async (req, res) => {

  if (isTokenValid()) {
    console.log("Token is fine")
    res.sendStatus(200)

  } else {

    console.log("Want to send them to the beginning or session expired")
    res.status(403);
    res.send('None shall pass');

    // Session has expired. Lower the flag
    //hasActiveSession = false;
  }
});

// Fetch the Checkout Session to display the JSON result on the success page
app.get('/checkout-session', async (req, res) => {
  hasActiveSession = true;

  // Timeout counter starts as soon as the checkout is successful...
  // TODO: Need to make sure this isn't called if there's a failed checkout
  //setTimeout(sessionTimer, 60000, 'Thats TIME!');

  res.send(hasActiveSession);
});

// Sesion Expired Endpoint
app.get('/session-expired', (req, res) => {
  res.sendFile(PATH_SESSION_EXPIRED);

  // Session has expired. Lower the flag
  hasActiveSession = false;
});

// TODO: Can probably remove this
app.get('/error', (req, res) => {
  res.sendFile(PATH_ERROR);
});

// TODO: Can probably remove this
app.get('/config', async (req, res) => {
  const price = await stripe.prices.retrieve(process.env.PRICE);

  res.send({
    publicKey: process.env.STRIPE_PUBLISHABLE_KEY,
    unitAmount: price.unit_amount,
    currency: price.currency,
  });
});

app.post('/create-checkout-session', async (req, res) => {

  if (hasActiveSession) {
    res.sendFile(PATH_ALREADY_IN_USE);
  } else {

    const domainURL = process.env.DOMAIN;

    const { quantity } = req.body;

    // The list of supported payment method types. We fetch this from the
    // environment variables in this sample. In practice, users often hard code a
    // list of strings for the payment method types they plan to support.
    const pmTypes = (process.env.PAYMENT_METHOD_TYPES || 'card').split(',').map((m) => m.trim());

    // Create new Checkout Session for the order
    // Other optional params include:
    // [billing_address_collection] - to display billing address details on the page
    // [customer] - if you have an existing Stripe Customer ID
    // [customer_email] - lets you prefill the email input in the Checkout page
    // TODO: NEED TO ADD THIS! 
    // [after_expiration] - Configure actions after a Checkout Session has expired.
    // [expires_at] - The Epoch time in seconds at which the Checkout Session will expire. It can be anywhere from 1 to 24 hours after Checkout Session creation. By default, this value is 24 hours from creation.
    // For full details see https://stripe.com/docs/api/checkout/sessions/create
    const session = await stripe.checkout.sessions.create({
      payment_method_types: pmTypes,
      mode: 'payment',
      expires_at: generateTimeStampCurrentPlusOneHour(),
      line_items: [
        {
          price: process.env.PRICE,
          quantity: quantity
        },
      ],
      success_url: `${domainURL}/` + randomNumber,
      cancel_url: `${domainURL}/canceled.html`,
    });
    return res.redirect(303, session.url);
  }
});

// Webhook handler for asynchronous events.
app.post('/webhook', async (req, res) => {
  let data;
  let eventType;
  // Check if webhook signing is configured.
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;
    let signature = req.headers['stripe-signature'];

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`);
      return res.sendStatus(400);
    }
    // Extract the object from the event.
    data = event.data;
    eventType = event.type;
  } else {
    // Webhook signing is recommended, but if the secret is not configured in `config.js`,
    // retrieve the event data directly from the request body.
    data = req.body.data;
    eventType = req.body.type;
  }

  if (eventType === 'checkout.session.completed') {
    console.log(`🔔  Payment received!`);
  }

  res.sendStatus(200);
});

app.post('/send', (req, res) => {
  console.log(req.body.email_address)
  sendEmail(req.body.email_address, res)
});

function checkEnv() {
  const price = process.env.PRICE_ID;
  if (price === !price) {
    console.log("You must set a Price ID in the environment variables. Please see the README.");
    process.exit(0);
  }
}

async function sessionTimer(arg) {
  console.log(`TimedOut => ${arg}`);
}

// TODO: Is there an easy way to have this called this as a middleware instead of needed to add it to each route?
//    I tried 
//      * emiting a redirect on Socket.IO connect -> Error "Not allowed to load local resource" 
//      * app.use(...) -> Didn't work / timing wasn't working with SocketIO
function routeBasedOnMachineInUse(happyPath){

  if(hasActiveSession){
    console.log('Sending the user to already-in-use.html');
    return PATH_ALREADY_IN_USE
  }
  return happyPath
}

/**
 * Generates the timestamp for Stripe to timeout the Checkout Session
 * @returns The Current Time In Seconds + One Hour (3600 Seconds)
 */
function generateTimeStampCurrentPlusOneHour() {
  const EPOCH_SECONDS_ONE_HOUR = 3600;

  var currentTime = new Date().getTime();
  var currentTimeSeconds = Math.floor(currentTime / 1000);
  var currentTimeSecondsPlusOneHour = currentTimeSeconds + EPOCH_SECONDS_ONE_HOUR;

  console.log("Seconds: " + currentTimeSecondsPlusOneHour);

  return currentTimeSecondsPlusOneHour;
}

function sendEmail(customersEmail, res) {
  console.log(`sendEmail()`);
  var nodemailer = require('nodemailer');
  var email = process.env.EMAIL;
  var password = process.env.EMAIL_PASSWORD;

  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: email,
      pass: password
    }
  });

  var mailOptions = {
    from: email,
    to: customersEmail,
    subject: 'Trackman Session',
    text: 'That was easy!'
  };

  transporter.sendMail(mailOptions, function (error, info) {

    // Machine is no longer in use. Lower the flag
    hasActiveSession = false;

    if (error) {

      console.log(error);

      //redirect to error screen
      res.statusCode = 302;
      res.setHeader('Location', '/error');

    } else {
      console.log('Email sent: ' + info.response);
      //Email sent, send the user back to the home screen
      res.statusCode = 302;
      res.setHeader('Location', '/');
      return res.end();
    }
  });
}

// Signs the JWT with an expiration time
function generateJWT(username) {
  token = jwt.sign({ username }, process.env.TOKEN_SECRET, { expiresIn: '10s', });
}

// Check if the JWT is still valid
function isTokenValid() {

  var isTokenValid = false;

  // Check if the JWT has expired / is still valid
  jwt.verify(token, process.env.TOKEN_SECRET, function (err, decoded) {
    if (err) {
      console.log("Token is EXPIRED!");
    } else {
      console.log("Token is GOOD!");
      isTokenValid = true;
    }
  });

  return isTokenValid;
}

