// TODO: Sometimes navigating backwards from the payment intent can cause problems with the
//    Next scan QR

// LIBS //

// Copy the .env.example in the root into a .env file in this folder
require('dotenv').config({ path: './.env' });

const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
const http = require('http');
const port = process.env.PORT || 8888 // setting the port 
const server = http.createServer(app);
const socketIO = require('socket.io');
const QRCode = require('qrcode');
const io = socketIO(server)
const { resolve } = require('path');
const { emit } = require('process');

// Nodemailer
const nodemailer = require('nodemailer');
const { google } = require("googleapis");
const { Domain } = require('domain');
const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(
  process.env.OAUTH_CLIENT_ID, // ClientID
  process.env.OAUTH_CLIENT_SECRET, // Client Secret
  process.env.OAUTH_REDIRECT_EMAIL, // Redirect URL
);

oauth2Client.setCredentials({
  refresh_token: process.env.OAUTH_REFRESH_TOKEN
});

// PATHS //
const PATH_BASE = process.env.STATIC_DIR;
const PATH_ALREADY_IN_USE = resolve(PATH_BASE + '/already_in_use.html');
const PATH_INDEX = resolve(PATH_BASE + '/index.html');
const TIME_SELECTION_INDEX = resolve(PATH_BASE + '/time_selection.html');
const PATH_QR = resolve(PATH_BASE + '/qr.html');
const PATH_TIMER = resolve(PATH_BASE + '/timer.html');
const PATH_SESSION_EXPIRED = resolve(PATH_BASE + '/session_expired.html');
const PATH_ERROR = (PATH_BASE + '/error.html');
const PATH_PLEASE_SCAN = resolve(PATH_BASE + '/scan_qr.html');
const PATH_SUCCESS = PATH_BASE + '/success.html';

// ROUTES //
const ROUTE_PLEASE_SCAN = PATH_BASE + "/scan-QR";


// Append this on the end of success route to avoid users from 'hacking' into a free session
var randomNumber = generateRandomNumber();
console.log("Random: " + randomNumber);

// Stores the Stripe Payment Intent so it can be cancelled if the user navigates backwards
var paymentIntent = null

// Time duration
const TIME_DENOMINATION_IN_SECS = 1800 
const THREE_MINS_MILLIS = 180000 
var timeRemaining = null
var isTimerInProgress = false
var clientSocket
var timerInterval
var paymentIntentTimer = null

//                //
// QR Generation  //
//                //

var randomNumberQR = generateRandomNumber();

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

// Call to create the QR code with the randomly generated number
generateQR(process.env.DOMAIN +  "/time-selection/" + randomNumberQR);

console.log("Random Number QR: " + randomNumberQR);

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

// TODO: Testing
app.use(function (req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  next()
});

server.listen(port, () => console.log(`Node server listening on port ${port}!`));

// SOCKET IO //

// make a connection with the user from server side
io.on('connection', (socket) => {

  if (hasActiveSession) {
    console.log('Theres an active socket connection. Reject this connection');
  }
  else {

    clientSocket = socket

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

      // TODO: Testing this out
      // Generate a new QR code everytime the customer moves away from the Time-Selection page
      // This helps prevent a random person from logging in remote and hogging the machine even
      // generateRandomQR();
    });
  }
});

//        //
// ROUTES //
//        //

// Time-Selection must match the randomly generated number, otherwise, it will route the scan_qr.html page
app.get('/time-selection/:key', function (req, res) {
  console.log('Index hit!');

  // Cancel any existing Payment Intent's.
  // This helps handle the user navigating back to this page
  if(paymentIntent != null) {

    var status = paymentIntent.status
    var succeeded = "succeeded"
    var expired = "expired"
    console.log("Payment Intent: " + status)

    console.log(paymentIntent)

    if(status != succeeded && status != expired){
      paymentIntentTimer = null
      cancelPaymentIntent()
    }
  }

  if(req.params.key === randomNumberQR){
    console.log("Number matches QR!")
    var path = resolve(routeBasedOnMachineInUse(TIME_SELECTION_INDEX));
    res.sendFile(path);

  }else{
    console.log("Number does NOT match QR!")

    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');

    // Route the user to scan the QR Code
    res.redirect(303, ROUTE_PLEASE_SCAN);
  }
});

// TODO: This will be running on the PC and shouldn't be hosted / accesible by the customer
app.get('/QR', (req, res) => {

  // Set the Chrome window size to be in 'timer' mode
  resizeWindowForQR();

  res.sendFile(PATH_QR);
});


app.get('/timer', (req, res) => {

  // Set the Chrome window size to be in 'timer' mode
  resizeWindowForTimer();
  res.sendFile(PATH_TIMER);
});


app.get('/' + randomNumber, (req, res) => {
 
  console.log("In the random number");
  clientSocket.emit("hello", "world");


  if(paymentIntentTimer != null){
    // This stops us from cancelling the Payment Intent. 
    // We no longer need to cancel the PI since the user has successfully paid 
    clearTimeout(paymentIntentTimer)
  }

  // Creates the JWT so we can restrict access to the club selection page
  generateJWT();


  const success_url = process.env.DOMAIN + `/successful_purchase.html?session_id=` + token;

  res.redirect(success_url);
});

app.get('/expire-token', async (req, res) => {
  console.log("EXPIRE THE TOKEN!")
  token = null
  res.sendStatus(200)
});

// Fetch the Checkout Session to display the JSON result on the success page
app.get('/check-session', async (req, res) => {

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
});

// Fetch the Checkout Session to display the JSON result on the success page
app.get('/check-qr', async (req, res) => {
  console.log("check-qr " + randomNumberQR)

  res.status(200)
  res.send({qr: randomNumberQR});
});

// Fetch the Checkout Session to display the JSON result on the success page
app.get('/checkout-session', async (req, res) => {
  hasActiveSession = true;
  res.send(hasActiveSession);
});

// Sesion Expired Endpoint
app.get('/session-expired', (req, res) => {
  res.sendFile(PATH_SESSION_EXPIRED);

  resetToStartingState()
});

// Error sending an email
app.get('/error', (req, res) => {
  res.sendFile(PATH_ERROR);
});

// Tells user to scan the QR Code
app.get('/scan-QR', function(req, res) {
  res.sendFile(PATH_PLEASE_SCAN);
});

// Catches all routes to show the QR Code route
app.get('/*', function(req, res) {
  res.sendFile(PATH_PLEASE_SCAN);
});

app.post('/create-checkout-session', async (req, res) => {

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
      cancel_url: `${domainURL}/canceled.html`,
    });

    console.log("PI:" + session.payment_intent)
    paymentIntent = session.payment_intent

    createPaymentIntentTimer()

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

// TODO: Need to handle if email doesn't send... Right now, it just loads forever

// Sends the Trackman Session to the User's email
app.post('/send', (req, res) => {
  console.log(req.body.email_address)
  sendEmail(req.body.email_address, res)
});

async function cancelPaymentIntent() {
  console.log("cancelPaymentIntent")
  session = await stripe.paymentIntents.cancel(paymentIntent);
  paymentIntent = null;
}

function checkEnv() {
  const price = process.env.PRICE_ID;
  if (price === !price) {
    console.log("You must set a Price ID in the environment variables. Please see the README.");
    process.exit(0);
  }
}

// Checks if the machine has an active session. 
// If so, routes the user to the already in use page. Otherwise, continues onwards with the supplied path
function routeBasedOnMachineInUse(happyPath){

  if(hasActiveSession){
    console.log('Sending the user to already-in-use.html');
    return PATH_ALREADY_IN_USE
  }
  return happyPath
}

// Generates a random number based on the current timestamp
function generateRandomNumber(){
  console.log("generateRandomNumber()")
  return (Date.now() + Math.random()).toString(36);
}

// Generates a QR code based on the random number
function generateRandomQR(){
  randomNumberQR = generateRandomNumber();
  console.log("Random QR Number: " + randomNumberQR);

  // Creates a QR Code for the time-selection route with the randomly generated number appended
  generateQR(process.env.DOMAIN + "/time-selection/" + randomNumberQR);
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

  }catch(error) {

    console.log(error);

    res.statusCode = 302;
    res.setHeader('Location', '/');
    return res.end();
  }
}

// Signs the JWT with an expiration time
function generateJWT(username) {

  const TOKEN_EXPIRATION_SECS = 60
  token = jwt.sign({ username,
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
      clientSocket = null
    } else {
      console.log("Token is GOOD!");
      isTokenValid = true;
    }
  });

  return isTokenValid;
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
  if(isTimerInProgress === false){
    console.log("Timer is not in progress... Start it up!")

    isTimerInProgress = true

  timerInterval = setInterval(function () {

    console.log("Time remaining: " + timeRemaining)


    timeRemaining--
      console.log(timeRemaining)
      clientSocket.emit("tick", timeRemaining)

      if (timeRemaining <= 0) {
        console.log("DONE!")
        clientSocket.emit("time expired")

        clearInterval(timerInterval);
      }
  }, 1000);
  } else {
    console.log("Timer is already in progress. Ignoring")

  }
}

// Sets all of the key vars to their beginning state
function resetToStartingState(){
    // Free up the timer
    isTimerInProgress = false

    // Lower the flag
    hasActiveSession = false;
  
    clearInterval(timerInterval)
    timeRemaining = 0
    clientSocket = null
    paymentIntent = null
}

function createPaymentIntentTimer(){
    paymentIntentTimer = setTimeout(async function(){

      console.log("Trying to expire the session!")

      cancelPaymentIntent()
      hasActiveSession = false

    }, THREE_MINS_MILLIS)
}

function resizeWindowForTimer(){
  var spawn = require("child_process").spawn,child;
  child = spawn("powershell.exe",["C:\\Users\\Admin\\Trackman` `Kiosk\\checkout-one-time-payments\\server\\node\\scripts\\exec_chrome_timer.ps1"]);
}

function resizeWindowForQR(){
  var spawn = require("child_process").spawn,child;
  child = spawn("powershell.exe",["C:\\Users\\Admin\\Trackman` `Kiosk\\checkout-one-time-payments\\server\\node\\scripts\\exec_chrome_qr.ps1"]);
}


