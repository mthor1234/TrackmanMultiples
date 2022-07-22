// TODO: I think we should persist and countdown the time remaining on the Heroku server.
//        Heroku server is less likely to go-offline. Can probably recover easily
//        If the kiosk loses connection / reconnects

/**
 * LIBS
 * ------------------
 * [dotenv] - Usage of enviornment variables via a '.env' file
 * [bodyParser] - Printing out / parsing http responses
 * [express] - Framework for setting up the server
 * [jwt] - JSON Web Token -> User authorization
 * [http] - http responses I think?
 * [QRCode] - Generates a QR code for the 'time-selection' page
 * [resolve] - Can serve up our .html files so the user can see
 */

// Copy the .env.example in the root into a .env file in this folder
require('dotenv').config({ path: './.env' });
var bodyParser = require('body-parser')
const express = require('express');
const jwt = require('jsonwebtoken');
const http = require('http');
const QRCode = require('qrcode');
const { resolve } = require('path');
/**
 * END: LIBS
 * ------------------
 */

/**
 * SOCKET IO
 * ------------------
 * [socketCustomer] - Allows access to customer-facing 'SocketIO'
 */
const socketIO = require('socket.io');
const { emit } = require('process');
var socketCustomer
/**
 * END: SOCKET IO
 * ------------------
 */

/**
 * CUSTOMER SERVER
 * ------------------
 */
const portCustomer = process.env.PORT_CUSTOMER || 8888
const appCustomer = express();
const serverCustomer = http.createServer(appCustomer);
const ioCustomer = socketIO(serverCustomer)
/**
 * END: CUSTOMER SERVER
 * ------------------
 */


/**
 * PATHS
 * ------------------
 */

const DOMAIN = process.env.DOMAIN;
const PATH_BASE = process.env.STATIC_DIR;

const PATH_ALREADY_IN_USE = resolve(PATH_BASE + '/already_in_use.html');
const PATH_CANCELLED = resolve(PATH_BASE + '/cancelled.html');
const PATH_ERROR = resolve(PATH_BASE + '/error.html');
const PATH_INDEX = resolve(PATH_BASE + '/index.html');
const PATH_PLEASE_SCAN = resolve(PATH_BASE + '/scan_qr.html');
const PATH_SESSION_EXPIRED = resolve(PATH_BASE + '/session_expired.html');
const PATH_SUCCESS = PATH_BASE + '/success.html';
const PATH_TIME_SELECTION = resolve(PATH_BASE + '/time_selection.html');
/**
 * END: PATHS
 * ------------------
 */


/**
 * ROUTES
 * ------------------
 */
  const ROUTE_PLEASE_SCAN = "/scan-QR";
  const ROUTE_CANCELLED = "/cancelled";
  const ROUTE_ERROR = "/error";
  const ROUTE_ALREADY_IN_USE = "/already-in-use";
/**
 * END: ROUTES
 * ------------------
 */

/**
 * TIME | TIMERS
 * ------------------
 */
const TIME_DENOMINATION_IN_SECS = 1800
const THREE_MINS_MILLIS = 3 * 60000

var timerInterval
var isTimerInProgress = false

var timeRemaining = null

// Decides when to cancel the PI Timer
var paymentIntentTimer = null


var hasActiveSession = false

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

function startTimer() {
  console.log("startTimer")

  // Timer is not active, so we start it
  if (isTimerInProgress === false) {
    console.log("Timer is not in progress... Start it up!")

    isTimerInProgress = true

    timerInterval = setInterval(function () {

      console.log("Time remaining: " + timeRemaining)

      timeRemaining--
      console.log(timeRemaining)
      socketCustomer.emit("tick", timeRemaining)

      if (timeRemaining <= 0) {
        console.log("DONE!")
        socketCustomer.emit("time expired")

        clearInterval(timerInterval);
        resetToStartingState()
      }
    }, 1000);
  } else {
    console.log("Timer is already in progress. Ignoring")

  }
}

function createPaymentIntentTimer() {
  paymentIntentTimer = setTimeout(async function () {

    console.log("Trying to expire the session!")

    cancelPaymentIntent()
    hasActiveSession = false

  }, THREE_MINS_MILLIS)
}
 /**
 * END: TIME
 * ------------------
 */

/**
 * STRIPE RELATED
 * ------------------
 * [stripe] - Sets up the Stripe constant used throughout
 * [paymentIntent] - Stores the Stripe Payment Intent so it can be cancelled if the user navigates backwards
 */
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
  appInfo: { // For sample support and debugging, not required for production:
    name: "stripe-samples/checkout-one-time-payments",
    version: "0.0.1",
    url: "https://github.com/stripe-samples/checkout-one-time-payments"
  },
  maxNetworkRetries: 3
});

var paymentIntent = null


/**
 * STRIPE: Cancel PaymentIntent
 * ------------------
 * Cancel an existing 'Stripe PaymentIntent'
 * This is always called in the beginning of the flow in order to always start the user from scratch
 * We don't want to have the hassle of tracking down existing PI's and try to handle. Easier to just cancel
 */
 async function cancelPaymentIntent() {
  console.log("cancelPaymentIntent")
  session = await stripe.paymentIntents.cancel(paymentIntent);
  paymentIntent = null;
}

/**
 * STRIPE: PRICE CHECK
 * ------------------
 * Ensures the price id's are set, that way Stripe can reference the user's selection
 */
function checkEnv() {
  const price = process.env.PRICE_ID;
  if (price === !price) {
    console.log("You must set a Price ID in the environment variables. Please see the README.");
    process.exit(0);
  }
}

/** 
* END: STRIPE RELATED
* -----------------------
*/


/**
 * RESET STATE
 * ------------------
 * Sets all of the key vars to their beginning state
 */
 function resetToStartingState() {
  // Free up the timer
  isTimerInProgress = false

  // Lower the flag
  hasActiveSession = false;

  clearInterval(timerInterval)
  timeRemaining = 0
  socketCustomer = null
  paymentIntent = null
}
/** 
* END: RESET STATE
* -----------------------
*/


// TODO: Look into using the JWT as the randomNumber instead
/**
 * RANDOM NUMBER GENERATION
 * ------------------
 * [randomNumber] Randomly generated number that used as a route
 * @ROUTE: /[randomNumber]
 * 
 * The /[randomNumber] route is used after the user has made a successful purchase
 * This route starts the Trackman Session + timer
 * 
 * Without this random number, the user could easily access free Trackman Sessions
 * 
 */
var randomNumber = generateRandomNumber();

// Generates a random number based on the current timestamp
function generateRandomNumber() {
  console.log("generateRandomNumber()")
  return (Date.now() + Math.random()).toString(36);
}
/**
 * END: RANDOM NUMBER GENERATION
 * ------------------
 */

/**
 * SESSION TRACKING | AUTHORIZATION
 * ------------------
 */
var token = null;

// Signs the JWT with an expiration time
function generateJWT(username) {

  const TOKEN_EXPIRATION_SECS = 60
  token = jwt.sign({
    username,
    exp: Math.floor(Date.now() / 1000) + (TOKEN_EXPIRATION_SECS),
    iat: Math.floor(Date.now())
  }, process.env.TOKEN_SECRET);
  console.log("Generated a JWT: " + Date(token.exp))
}

// Check if the JWT is still valid
function isTokenValid() {

  var isTokenValid = false;

  // Check if the JWT has expired / is still valid
  jwt.verify(token, process.env.TOKEN_SECRET, function (err, decoded) {
    console.log("Verify Token")
    if (err) {
      console.log("Token is EXPIRED!");

      clearInterval(timerInterval);
      timeRemaining = 0
      isTimerInProgress = false
      socketCustomer = null
    } else {
      console.log("Token is GOOD!");
      isTokenValid = true;
    }
  });

  return isTokenValid;
}
/**
 * END: SESSION TRACKING
 * ------------------
 */


// Ensure environment variables are set.
checkEnv();


/**
 * STARTING SERVER
 * ------------------
 */
// Sets up cache-control and other goodies to handle issues with navigation
setUpServer(appCustomer);

// Launch the servers
serverCustomer.listen(portCustomer, () => console.log(`Customer Node server listening on port ${portCustomer}!`));

// Sets up cache-control and other goodies to handle issues with navigation
function setUpServer(server) {
  server.use(express.static(PATH_BASE));
  server.use(express.urlencoded());
  server.use(
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

  // Trying to prevent the user from caching the webpages so I can properly route them
  // Currently, having trouble if the user navigates backwards to my page
  server.use(function (req, res, next) {
    res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');

    // Allows CORS so Kiosk can retrieve time from this server
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next()
  });
}
/**
 * END: STARTING SERVER
 * ------------------
 */


/**
 * STARTING SERVER: CUSTOMER
 * ------------------
 */
// make a connection with the user from server side
ioCustomer.on('connection', (socket) => {

  console.log('ioCustomer: Connection!');

  if (hasActiveSession) {
    console.log('Theres an active socket connection. Reject this connection');
  }
  else {

    socketCustomer = socket

    // Client will tell the server to kick off the timer
    socket.on('time selection', () => {
      console.log('New user connected... ID: ' + socket.id);
      hasActiveSession = true;
    })

    // This is how to call the disconnect from SocketIO. 
    // When the user navigates away from the webpage, this is called
    socket.on('disconnect', function () {
      console.log('user disconnected');
    });
  }
});
/**
 * END: SOCKET IO: CUSTOMER
 * ------------------
 */

/**
 * ENDPOINTS: CUSTOMER
 * ------------------
 */

// Fetch the Checkout Session to display the JSON result on the success page
appCustomer.get('/get-duration', async (req, res) => {
  console.log("get-duration " + timeRemaining)

  res.status(200)
  res.send({ duration: timeRemaining });
});


appCustomer.get('/expire-token', async (req, res) => {

  console.log("/expire-token")
    console.log("EXPIRE THE TOKEN!")
    token = null
    res.sendStatus(200)
  
});

// Fetch the Checkout Session to display the JSON result on the success page
appCustomer.get('/check-session', async (req, res) => {

  console.log("/check-session")

    if (isTokenValid()) {
      console.log("Token is fine")

      res.sendStatus(200)

    } else {

      console.log("Want to send them to the beginning or session expired")
      res.status(403);
      res.send('None shall pass');
    }
    console.log("Outside");
});

// Sesion Expired Endpoint
appCustomer.get('/session-expired', (req, res) => {

  console.log("/session-expired")

  res.sendFile(PATH_SESSION_EXPIRED);
  resetToStartingState()
});


// Tells user to scan the QR Code
appCustomer.get('/scan-QR', function(req, res) {
  console.log("/scan-QR")
  res.sendFile(PATH_PLEASE_SCAN)
});


// Tells user to scan the QR Code
appCustomer.get('/already-in-use', function(req, res) {
  console.log("/already-in-use")
  res.sendFile(PATH_ALREADY_IN_USE)
});

// Tells user to scan the QR Code
appCustomer.get('/error', function(req, res) {
  console.log("/error")
  res.sendFile(PATH_ERROR)
});


// Takes the user to the checkout page
appCustomer.post('/create-checkout-session', async (req, res) => {

  console.log("/create-checkout-session")

  try {

    if (hasActiveSession) {
      res.sendFile(PATH_ALREADY_IN_USE);
    } else {

      const domainURL = process.env.DOMAIN;

      const { quantity } = req.body;

      timeRemaining = quantity * TIME_DENOMINATION_IN_SECS

      console.log("Time Chosen: " + timeRemaining)

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
        cancel_url: `${domainURL}/cancelled`,
      });

      console.log("PI:" + session.payment_intent)
      paymentIntent = session.payment_intent

      createPaymentIntentTimer()

      return res.redirect(303, session.url);
    }
} catch (error) {

console.log("There was error! " + error)
sendUserToErrorPage(res)
}
});

// Webhook handler for asynchronous events.
appCustomer.post('/webhook', async (req, res) => {
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

appCustomer.get('/time-selection', function (req, res) {

  console.log('/time-selection');

  if (hasActiveSession) {

    console.log("MACHINE ALREADY IN USE")
    sendUserToAlreadyInUse(res)
  }else{
    // Cancel any existing Payment Intent's.
    // This helps handle the user navigating back to this page
    if (paymentIntent != null) {

      var status = paymentIntent.status
      var succeeded = "succeeded"
      var expired = "expired"
      console.log("Payment Intent: " + status)

      console.log(paymentIntent)

      if (status != succeeded && status != expired) {
        paymentIntentTimer = null
        cancelPaymentIntent()
      }
    }

    // We receive an extra request from globals.js for some reason. This helps us handle this request
    var isGlobalsJSRequest = req.params.key === 'globals.js'

    console.log("Random Number: " + randomNumber)

    var path = resolve(routeBasedOnMachineInUse(PATH_TIME_SELECTION));
    res.sendFile(path);
  } 
});

appCustomer.get('/' + randomNumber, (req, res) => {

  if (hasActiveSession) {
    sendUserToAlreadyInUse(res)
  }else{

    hasActiveSession = true;

    console.log("In the random number");

    // Start counting down the time remaining in the Trackman session
    startTimer()

    if (paymentIntentTimer != null) {
      // This stops us from cancelling the Payment Intent. 
      // We no longer need to cancel the PI since the user has successfully paid 
      clearTimeout(paymentIntentTimer)
    }

    // Creates the JWT so we can restrict access to the timer page
    generateJWT();

    const success_url = process.env.DOMAIN + `/successful_purchase.html?session_id=` + token;
    res.redirect(success_url);
  }
});

// Catches all routes to show the cancelled route
appCustomer.get('/cancelled', function (req, res) {
  console.log("/cancelled")
  return res.sendFile(PATH_CANCELLED)
});

// Catches all routes to show the Scan QR Code route
appCustomer.get('/*', function (req, res) {
  console.log("/*")
  sendUserToPleaseScan(res)
});
/**
 * END: ENDPOINTS: CUSTOMER
 * ------------------
 */

/**
 * ROUTE HELPER: PLEASE SCAN
 * ------------------
 * Updates state and sends the user to /scan-qr route 
 */
function sendUserToPleaseScan(res) {
  return res.redirect(303, ROUTE_PLEASE_SCAN)
}


/**
 * ROUTE HELPER: PLEASE SCAN
 * ------------------
 * Updates state and sends the user to /scan-qr route 
 */
 function sendUserToAlreadyInUse(res) {
  return res.redirect(303, ROUTE_ALREADY_IN_USE)
}

/**
 * ROUTE HELPER: ERROR PAGE
 * ------------------
 * General error handling page.
 * 1. Show user the error page
 * 2. Wait for a little
 * 3. Send user to Please Scan Page
 */
function sendUserToErrorPage(res) {
  return res.redirect(303, ROUTE_ERROR)
}

/**
 * ROUTE HELPER: MACHINE IN USE 
 * ------------------
 * Checks if the machine has an active session. 
 * If so, routes the user to the already in use page. Otherwise, continues onwards with the supplied path
 */
 function routeBasedOnMachineInUse(happyPath) {
  if (hasActiveSession) {
    console.log('Sending the user to already-in-use');
    return PATH_ALREADY_IN_USE
  }
  return happyPath
}