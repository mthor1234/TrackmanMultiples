// server.js
//
// Use this sample code to handle webhook events in your integration.
//
// 1) Paste this code into a new file (server.js)
//
// 2) Install dependencies
//   npm install stripe
//   npm install express
//
// 3) Run the server on http://localhost:4242
//   node server.js
const stripe = require('stripe');
const express = require('express');
const app = express();

// This is your Stripe CLI webhook secret for testing your endpoint locally.
const endpointSecret = "whsec_c0c9e1488e831b06f57766169f3376de85ea403720c6f4915817142ec9d1b266";

app.post('/webhook', express.raw({type: 'application/json'}), (request, response) => {
  const sig = request.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
  } catch (err) {
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      // Then define and call a function to handle the event payment_intent.succeeded
      break;

    case 'charge.succeeded':
        console.log(`charge.succeeded`);
    break;

    case 'checkout.session.completed':
        console.log(`checkout.session.completed`);
    break;

    
    case 'checkout.session.completed':
        console.log(`checkout.session.completed`);
    break;



    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  response.send();
});

app.listen(4242, () => console.log('Running on port 4242'));