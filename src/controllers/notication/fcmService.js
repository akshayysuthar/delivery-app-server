// // /services/fcmService.js
// import admin from "firebase-admin";
// import { google } from "googleapis";
// import path from "path";
// import { fileURLToPath } from "url";

// // Resolve __dirname
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Initialize Firebase Admin SDK
// const firebaseConfig = path.join(__dirname, "../../serviceAccountKey.json");
// admin.initializeApp({
//   credential: admin.credential.cert(firebaseConfig),
// });

// // Send a notification
// export async function sendNotification(token, title, body) {
//   const message = {
//     notification: { title, body },
//     android: { priority: "high" },
//     apns: {
//       payload: {
//         aps: {
//           alert: { title, body },
//           sound: "default",
//           contentAvailable: true,
//         },
//       },
//     },
//     token,
//   };

//   try {
//     const response = await admin.messaging().send(message);
//     console.log("Notification sent:", response);
//     const accessToken = await getAccessToken(); // returns a string like 'ya29.a0AfH6SMA...'
//     console.log("Access Token:", accessToken);

//     return response;
//   } catch (error) {
//     console.error("Notification error:", error);
//     throw error;
//   }
// }

// // Get OAuth2 access token (optional use case)
// export async function getAccessToken() {
//   const auth = new google.auth.GoogleAuth({
//     keyFile: path.join(__dirname, "../../serviceAccountKey2.json"),
//     scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
//   });

//   try {
//     const client = await auth.getClient(); // ✅ 1. Get the authorized client
//     const accessTokenResponse = await client.getAccessToken(); // ✅ 2. Get token response
//     const accessToken = accessTokenResponse.token; // ✅ 3. Extract token string

//     console.log("Access Token:", accessToken);
//     return accessToken;
//   } catch (error) {
//     console.error("Access token error:", error);
//     throw error;
//   }
// }


