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
 * [socketKiosk] - Allows access to kiosk-facing 'SocketIO'
 */
const socketIO = require('socket.io');
const { emit } = require('process');
var socketCustomer
var socketKiosk
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
 * KIOSK SERVER
 * ------------------
 */
const portKiosk = process.env.PORT_KIOSK || 9999
const appKiosk = express();
const serverKiosk = http.createServer(appKiosk);
const ioKiosk = socketIO(serverKiosk)
/**
 * END: KIOSK SERVER
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
const PATH_QR = resolve(PATH_BASE + '/qr.html');
const PATH_SESSION_EXPIRED = resolve(PATH_BASE + '/session_expired.html');
const PATH_SUCCESS = PATH_BASE + '/success.html';
const PATH_TIMER = resolve(PATH_BASE + '/timer.html');
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

// TODO: Getting duplicate timers when navigating back and forth.
// I can try prevent this with an if/else check but I lose the socket so the
// Client stops getting the 'tick' event.
// Maybe I can update the socket to the new client? 
// Somehow update the interval?
// function startTimer(theSocket) {
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
 * WINDOW RESIZER: QR
 * ------------------
 * Calls powershell script -> Calls .ahk script -> Resizes the chrome Window for the QR page
 * This will make the QR page full-screen
 */
 function resizeWindowForQR() {
  var spawn = require("child_process").spawn, child;
  child = spawn("powershell.exe", ["C:\\Users\\Admin\\Trackman` `Kiosk\\checkout-one-time-payments\\server\\node\\scripts\\exec_chrome_qr.ps1"]);
}

 /**
 * WINDOW RESIZER: TIMER
 * ------------------
 * Calls powershell script -> Calls .ahk script -> Resizes the chrome Window for the Timer page
 * This will make the timer small and prevent it from blocking the Trackman UI
 */
function resizeWindowForTimer() {

  console.log('resizeWindowForTimer()')

  var spawn = require("child_process").spawn, child;
  child = spawn("powershell.exe", ["C:\\Users\\Admin\\Trackman` `Kiosk\\checkout-one-time-payments\\server\\node\\scripts\\exec_chrome_timer.ps1"]);
}
/**
 * END: WINDOW RESIZER
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
 * USER STATE MACHINE
 * ------------------
 * Different 'States' the user can be in
 * Makes enpoints unreachable if the user isn't in the correct state
 */
 const UserState = {
  QR: 'QR',
  TIME_SELECTION: 'TIME_SELECTION',
  PAYMENT: 'PAYMENT',
  ACTIVE: 'ACTIVE',
}

 /** Holds the user state. */
var currentState = UserState.QR

function checkUserState(state){
  console.log("CHECKING USER STATE:")
  console.log("CURRENT STATE: " + currentState + ": DESIRED STATE: " + state)
  return (currentState === state)
}

function updateUserState(state){
  console.log("UPDATING USER STATE FROM: " + currentState + " --> " + state)
    currentState = state
}
/** 
* END: USER STATE MACHINE 
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
  updateUserState(UserState.QR)
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
 * QR GENERATION
 * ------------------
 * [randomNumberQR] Randomly generated number that is used to 'protect' the time-selection endpoint
 * This random number will require the user to physically be at the Kiosk in order to access
 * 
 * Creates a QR Code that points to:
 * /time-selection/[randomNumberQR]
 * 
 * The Kiosk prompts the user scan this QR Code in order to select their 'time allotment'
 */
// Generates the QR Code image and saves it to the /res directory
const generateQR = async text => {

  console.log("CREATING A NEW QR");

  try {
    await QRCode.toFile('../../client/html/res/qr_code.png', text, {
      color: {
        dark: '#FFF',  // White
        light: '#0000' // Transparent background
      }
    });
  } catch (err) {
    console.log(err);
  }
}

var randomNumberQR = generateRandomNumber();
console.log("RandomNumberQR: " + randomNumberQR);


generateQR(process.env.DOMAIN + "/time-selection/" + randomNumberQR);

// Generates a QR code based on the random number
function generateRandomQR() {
  console.log("generateRandomQR");

  randomNumberQR = generateRandomNumber();
  console.log("Random QR Number: " + randomNumberQR);

  // Creates a QR Code for the time-selection route with the randomly generated number appended
  generateQR(process.env.DOMAIN + "/time-selection/" + randomNumberQR);
}

/**
 * END: QR GENERATION
 * ------------------
 */

/**
 * SESSION TRACKING | AUTHORIZATION
 * ------------------
 */
var hasActiveSession = false;
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
setUpServer(appKiosk);

// Launch the servers
serverCustomer.listen(portCustomer, () => console.log(`Customer Node server listening on port ${portCustomer}!`));
serverKiosk.listen(portKiosk, () => console.log(`Kiosk Node server listening on port ${portKiosk}!`));

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
    next()
  });
}
/**
 * END: STARTING SERVER
 * ------------------
 */


/**
 * SOCKET IO: KIOSK
 * ------------------
 */

// make a connection with the user from server side
ioKiosk.on('connection', (socket) => {

  console.log('socketKiosk: Connection!');

  // Saves a reference so we can communicate with this socket elsewhere
  socketKiosk = socket

});
/**
 * END: SOCKET IO: KIOSK
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

    socket.on('test', () => {
      console.log('Received a start session!');
    })

    // This is how to call the disconnect from SocketIO. 
    // When the user navigates away from the webpage, this is called
    socket.on('disconnect', function () {
      console.log('user disconnected');
      hasActiveSession = false;

      // Generate a new QR code everytime the customer moves away from the Time-Selection page
      // This helps prevent a random person from logging in remote and hogging the machine even
      generateRandomQR();

      // Talks to the QR page. Allows it to regresh the new QR Code
      socketKiosk.emit("user_disconnected")
    });
  }
});
/**
 * END: SOCKET IO: CUSTOMER
 * ------------------
 */

/**
 * ENDPOINTS: KIOSK
 * ------------------
 */
appKiosk.get('/QR', (req, res) => {

  console.log("/QR")


  // Set the Chrome window size to be in 'timer' mode
  resizeWindowForQR();
  res.sendFile(PATH_QR);
});


appKiosk.get('/timer', (req, res) => {

  console.log("/timer")
  console.log("TIME TO USE: " + timeRemaining)

  // Set the Chrome window size to be in 'timer' mode
  resizeWindowForTimer();
  res.sendFile(PATH_TIMER);
});


// Fetch the Checkout Session to display the JSON result on the success page
appKiosk.get('/get-duration', async (req, res) => {
  console.log("get-duration " + timeRemaining)

  res.status(200)
  res.send({ duration: timeRemaining });
});

/**
 * END: ENDPOINTS: KIOSK
 * ------------------
 */


/**
 * ENDPOINTS: CUSTOMER
 * ------------------
 */
appCustomer.get('/expire-token', async (req, res) => {

  console.log("/expire-token")

  // TODO: I think UserState.TIME_SELECTION is the right state
  if (checkUserState(UserState.TIME_SELECTION) || checkUserState(UserState.ACTIVE)) {
    console.log("EXPIRE THE TOKEN!")
    token = null
    res.sendStatus(200)
  }
});

// Fetch the Checkout Session to display the JSON result on the success page
appCustomer.get('/check-session', async (req, res) => {

  console.log("/check-session")

  if(checkUserState(UserState.ACTIVE)) {

    console.log("check-session");

    if (isTokenValid()) {
      console.log("Token is fine")

      res.sendStatus(200)

    } else {

      console.log("Want to send them to the beginning or session expired")
      res.status(403);
      res.send('None shall pass');
    }
    console.log("Outside");
  } else {
    sendUserToPleaseScan(res)
  }
});


// Fetch the Checkout Session to display the JSON result on the success page
appCustomer.get('/checkout-session', async (req, res) => {

  console.log("/checkout-session")

  // TODO: What state do we check... Testing with these
  if (checkUserState(UserState.TIME_SELECTION) || checkUserState(UserState.PAYMENT)) {

    hasActiveSession = true;
    res.send(hasActiveSession);
  } else {
    sendUserToPleaseScan(res)
  }
});

// TODO: The user can enter this url directly in. Do we want that? It should be hidden if possible
// Sesion Expired Endpoint
appCustomer.get('/session-expired', (req, res) => {

  console.log("/session-expired")


  if (checkUserState(UserState.ACTIVE)) {
    res.sendFile(PATH_SESSION_EXPIRED);
    resetToStartingState()

  } else {
    sendUserToPleaseScan(res)
  }
});

// TODO: I don't think I need this since it was tied to emailing
// TODO: The user can enter this url directly in. Do we want that? It should be hidden if possible
// Error sending an email
// appCustomer.get('/error', (req, res) => {
//   res.sendFile(PATH_ERROR);
// });

// Tells user to scan the QR Code
appCustomer.get('/scan-QR', function(req, res) {
  console.log("/scan-QR")
  res.sendFile(PATH_PLEASE_SCAN)
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

  if (checkUserState(UserState.TIME_SELECTION)) {
    if (hasActiveSession) {

      // Update the user's state
      updateUserState(UserState.QR)
      // TODO: Consider redirecting instead of Already in use?
      res.sendFile(PATH_ALREADY_IN_USE);
    } else {

      // Update the user's state
      updateUserState(UserState.PAYMENT)

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
  } else {
    sendUserToPleaseScan(res)
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

appCustomer.get('/time-selection/:key', function (req, res) {

  console.log('/time-selection');

  if (checkUserState(UserState.QR) || checkUserState(UserState.TIME_SELECTION)) {
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

    console.log("Inputted Key: " + req.params.key)
    console.log("Random Number: " + randomNumber)
    console.log("Random Number QR: " + randomNumberQR)

    if(isGlobalsJSRequest){
      console.log("isGlobalsJSRequest!")

      updateUserState(UserState.TIME_SELECTION)

      var path = resolve(routeBasedOnMachineInUse(PATH_TIME_SELECTION));
      res.sendFile(path);
    }
    else if (req.params.key === randomNumberQR) {
      console.log("Number matches QR!")

      updateUserState(UserState.TIME_SELECTION)

      var path = resolve(routeBasedOnMachineInUse(PATH_TIME_SELECTION));
      res.sendFile(path);
    } 
    else {
      console.log("Number does NOT match QR!")

      res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.header('Expires', '-1');
      res.header('Pragma', 'no-cache');

      // Route the user to scan the QR Code
      sendUserToPleaseScan(res)
    }
  } 
  else {
    console.log("NOT IN THE QR STATE")
    sendUserToPleaseScan(res)
  }
});

appCustomer.get('/' + randomNumber, (req, res) => {

  console.log("/randomNumber -> CurrentState: " + currentState)

  if (checkUserState(UserState.PAYMENT)) {

    updateUserState(UserState.ACTIVE)

    console.log("In the random number");

    // Kicks off the timer via Socket IO.
    // Timer page should show on the Kiosk
    socketKiosk.emit("start_timer");

    if (paymentIntentTimer != null) {
      // This stops us from cancelling the Payment Intent. 
      // We no longer need to cancel the PI since the user has successfully paid 
      clearTimeout(paymentIntentTimer)
    }

    // Creates the JWT so we can restrict access to the timer page
    generateJWT();

    const success_url = process.env.DOMAIN + `/successful_purchase.html?session_id=` + token;
    res.redirect(success_url);
  } else {
    sendUserToPleaseScan(res)
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
  updateUserState(UserState.QR)
  return res.redirect(303, ROUTE_PLEASE_SCAN)
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
  updateUserState(UserState.QR)
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


/**
 * NODE MAILER
 * ------------------
 * For emailing the customer their Trackman session
 * POSSIBLE FUTURE FEATURE  
 */
 const nodemailer = require('nodemailer');
 const { google } = require("googleapis");
 const { Domain } = require('domain');
 const { time } = require('console');
 const { restart } = require('nodemon');
 const OAuth2 = google.auth.OAuth2;
 
 const oauth2Client = new OAuth2(
   process.env.OAUTH_CLIENT_ID, // ClientID
   process.env.OAUTH_CLIENT_SECRET, // Client Secret
   process.env.OAUTH_REDIRECT_EMAIL, // Redirect URL
 );
 
 oauth2Client.setCredentials({
   refresh_token: process.env.OAUTH_REFRESH_TOKEN
 });
 
 // Send the user an email
 async function sendEmail(customersEmail, res) {
   console.log(`sendEmail()`);
 
   var email = process.env.EMAIL;
   var clientID = process.env.OAUTH_CLIENT_ID;
   var clientSecret = process.env.OAUTH_CLIENT_SECRET;
   var refreshToken = process.env.OAUTH_REFRESH_TOKEN;
   var accessToken = process.env.OAUTH_ACCESS_TOKEN;
 
   try {
 
     let transporter = nodemailer.createTransport({
       host: 'smtp.gmail.com',
       port: 465,
       secure: true,
       auth: {
         type: 'OAuth2',
         user: email,
         clientId: clientID,
         clientSecret: clientSecret,
         refreshToken: refreshToken,
         accessToken: accessToken,
         expires: 1647579898000
       }
     });
 
     var mailOptions = {
       from: email,
       to: customersEmail,
       subject: 'Trackman Session',
       text: 'That was easy!'
     };
 
     const result = await transporter.sendMail(mailOptions, function (error, info) {
 
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
     // Set up the email options and delivering it
     return result;
 
   } catch (error) {
 
     console.log(error);
 
     res.statusCode = 302;
     res.setHeader('Location', '/');
     return res.end();
   }
 }

 // TODO: Need to handle if email doesn't send... Right now, it just loads forever

// Sends the Trackman Session to the User's email
// appCustomer.post('/send', (req, res) => {
//   console.log(req.body.email_address)
//   sendEmail(req.body.email_address, res)
// });

 /**
  * END: NODE MAILER
  * ------------------
  */