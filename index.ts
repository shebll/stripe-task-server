import express, { Request, Response } from "express";
import cors from "cors";
import stripe from "stripe";
import dotenv from "dotenv";
import * as admin from "firebase-admin";
dotenv.config();

const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

// const serviceAccount = {
//   projectId: process.env.FIREBASE_PROJECT_ID,
//   privateKey: process.env.FIREBASE_PRIVATE_KEY,
//   clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
// };
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });
// const db = admin.firestore();

const app = express();

app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://curious-cranachan-ab9992.netlify.app"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: "*",
  })
);
app.options("*", cors());
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

app.post("/", (req: Request, res: Response) => {
  res.send("Hello, Express!");
});

app.post("/create-checkout", async (req: Request, res: Response) => {
  const { userId, email } = req.body;
  try {
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "HealthChat Pro Subscription",
              description: "Monthly subscription to HealthChat Pro",
            },
            unit_amount: 3000, // Amount in cents (e.g., $30)
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      customer: userId,
      customer_email: email,
      client_reference_id: userId,
      success_url: `${process.env.CLIENT_URL}/payment-success`,
      cancel_url: `${process.env.CLIENT_URL}/pro`,
      metadata: {
        userId: userId,
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/create-checkout-intent", async (req: Request, res: Response) => {
  const { userId, email } = req.body;
  if (!userId || !email) {
    res.status(400).json({ error: "User ID and email are required" });
    return;
  }
  try {
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: 3000,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: userId,
        email: email,
        subscriptionType: "pro-monthly",
      },
      // customer: userId,
    });
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({
      error: "Failed to create payment intent",
      details: error,
    });
  }
});
// app.use("/webhook", express.raw({ type: "application/json" }));
// app.post(
//   "/webhook",
//   express.raw({ type: "application/json" }), // This is crucial
//   async (req: Request, res: Response) => {
//     const sig = req.headers["stripe-signature"] as string;
//     const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;
//     const rawBody = req.body;

//     try {
//       const event = stripeClient.webhooks.constructEvent(
//         rawBody,
//         sig,
//         endpointSecret
//       );
//       switch (event.type) {
//         case "payment_intent.created":
//           const paymentIntent = event.data.object;
//           // console.log("Payment Intent created:", paymentIntent.id);
//           console.log("Payment Intent created:", paymentIntent);
//           break;

//         case "charge.succeeded": {
//           const session = event.data.object;
//           console.log("Checkout session completed:", session);
//           const userId = session.metadata.userId;
//           if (!userId) break;
//           const userRef = db.collection("users").doc(userId);
//           const userDoc = await userRef.get();
//           console.log("User document:", userDoc.data());
//           if (userDoc.exists) {
//             await userRef.update({
//               isPro: true,
//               stripeCustomerId: session.customer || null,
//               paymentIntentId: session.payment_intent,
//             });
//             console.log("User profile updated to Pro");
//           } else {
//             console.log("User not found in database");
//           }
//           break;
//         }

//         case "charge.updated": {
//           const session = event.data.object;
//           // console.log("Checkout session completed:", session.id);
//           console.log("Checkout session completed:", session);
//           // const userId = session.cu;
//           // const userRef = db.collection("users").doc(userId);
//           // const userDoc = await userRef.get();
//           // if (userDoc.exists) {
//           //   await userRef.update({
//           //     isPro: true,
//           //     stripeCustomerId: session.customer,
//           //     subscriptionId: session.subscription,
//           //   });
//           //   console.log("User profile updated to Pro");
//           // } else {
//           //   console.log("User not found in database");
//           // }
//           break;
//         }
//         default:
//           console.log(`Unhandled event type ${event.type}`);
//       }

//       res.status(200).send("Webhook handled successfully");
//     } catch (err) {
//       console.error("Webhook Error:", err);
//       res.status(400).send(`Webhook Error: ${err}`);
//     }
//   }
// );
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default (req: any, res: any) => {
  app(req, res);
};
