import dotenv from "dotenv";
import express from "express";
import { Telegraf } from "telegraf";

// Import Firebase SDK
import { initializeApp } from "firebase/app";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
} from "firebase/firestore";

// Initialize dotenv
dotenv.config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Firebase config
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};
// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

app.use(express.json());

// In-memory database (for testing purposes) => replaced with Firestore
// const users = {}; // { "ESP_CODE_123": telegram_id }
// const waitingForEspCode = {}; // { userId: true }

// Start the bot
bot.start((ctx) => {
    ctx.reply("Welcome! Please choose an option:", {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "Register ESP32", callback_data: "register" },
                    {
                        text: "Check Irrigation Status",
                        callback_data: "status",
                    },
                ],
                [{ text: "Help", callback_data: "help" }],
            ],
        },
    });
});

// Handle callback queries (button clicks)
bot.on("callback_query", async (ctx) => {
    const action = ctx.callbackQuery.data;

    // Conferma la ricezione della callback per evitare che il messaggio venga duplicato
    await ctx.answerCbQuery();

    if (action === "register") {
        // Store in Firestore to mark user as waiting for ESP code
        const userId = ctx.from.id;
        const waitingRef = doc(db, "waitingForEspCode", `${userId}`);
        await setDoc(waitingRef, { waiting: true });

        ctx.reply(
            "Please send your ESP32 code (e.g., ESP_ABC123) to register it.",
        );
    } else if (action === "status") {
        const userId = ctx.from.id;

        // Query Firestore to find ESP32 associated with this user
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("telegram_id", "==", userId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return ctx.reply(
                "You have no registered ESP32. Please register it first using /register.",
            );
        }

        const espCode = querySnapshot.docs[0].data().esp_code;
        const message = `Irrigation status for ESP32 (${espCode}): Active ✅`;
        ctx.reply(message);
    } else if (action === "help") {
        const helpMessage = `
        🤖 **Available Commands:**

        /help - Show this help message
        /register - Register your ESP32 device
        /status - Get the current irrigation status for your ESP32
        `;
        // Rispondi con il messaggio completo di help
        ctx.reply(helpMessage);
    }
});

// Command for showing help
bot.command("help", (ctx) => {
    const helpMessage = `
    🤖 **Available Commands:**

    /help - Show this help message
    /register - Register your ESP32 device
    /status - Get the current irrigation status for your ESP32
    `;
    ctx.reply(helpMessage);
});

// Command for registering ESP32
bot.command("register", (ctx) => {
    const userId = ctx.from.id;

    // Mark the user as waiting for the ESP32 code in Firestore
    const waitingRef = doc(db, "waitingForEspCode", `${userId}`);
    setDoc(waitingRef, { waiting: true });

    ctx.reply("Please send your ESP32 code (e.g., ESP_ABC123) to register it.");
});

// Listen for any message that could be the ESP32 code
bot.on("message", async (ctx) => {
    const userId = ctx.from.id;
    const message = ctx.message.text.trim();

    // Check if the user is in the process of registering (check Firestore)
    const waitingRef = doc(db, "waitingForEspCode", `${userId}`);
    const docSnap = await getDoc(waitingRef);

    if (docSnap.exists() && docSnap.data().waiting) {
        if (message.startsWith("ESP_")) {
            // Register the ESP32 code for the user in Firestore
            const usersRef = doc(db, "users", message);
            await setDoc(usersRef, { esp_code: message, telegram_id: userId });

            // Remove the waiting status from Firestore
            await deleteDoc(waitingRef);

            ctx.reply(`Your ESP32 (${message}) has been registered.`);
        } else {
            ctx.reply(
                "Invalid code. Please send a valid ESP32 code (e.g., ESP_ABC123).",
            );
        }
    }
});

// Endpoint to receive data from the ESP32
app.post("/notify", async (req, res) => {
    const {
        esp_code,
        airTemp,
        airHumidity,
        soilMoisture,
        minAirTemp,
        maxAirTemp,
        minAirHumidity,
        maxAirHumidity,
        minSoilMoisture,
        isIrrigating, // Changed to use a boolean
    } = req.body;

    // Check if the ESP32 is registered
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("esp_code", "==", esp_code));
    const querySnapshot = await getDocs(q);


    if (querySnapshot.empty) {
        return res.status(400).json({ error: "ESP32 not registered" });
    }

    // Get the Telegram ID associated with the ESP32
    const telegramId = querySnapshot.docs[0].data().telegram_id;

    // Create the message to send
    const message = `
    🌱 Irrigation Status for ESP32 (${esp_code})

    Current Values:
    - 🌡️ Air Temperature: ${airTemp}°C
    - 💧 Air Humidity: ${airHumidity}%
    - 🌿 Soil Moisture: ${soilMoisture}%

    Optimal Ranges:
    - 🌡️ Air Temperature: ${minAirTemp}°C - ${maxAirTemp}°C
    - 💧 Air Humidity: ${minAirHumidity}% - ${maxAirHumidity}%
    - 🌿 Soil Moisture: ${minSoilMoisture}%

    Irrigation Status:
    - 💧 Irrigation: ${isIrrigating ? "Active ✅" : "Inactive ❌"}
    `;

    // Send the message to Telegram
    bot.telegram
        .sendMessage(telegramId, message)
        .then(() => {
            res.json({ success: true });
        })
        .catch((error) => {
            console.error("Error sending message:", error);
            res.status(500).json({ error: "Failed to send message" });
        });
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).send("Server is up and running!");
});

// Start the server
app.listen(process.env.PORT || 3000, () => {
    console.log("Server started on port", process.env.PORT || 3000);
});

// Launch the bot
bot.launch()
    .then(() => console.log("Telegram bot started"))
    .catch((err) => console.error("Failed to start the bot:", err));
