require('dotenv').config(); // Environment variables ke liye
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache'); // Caching ke liye
const rateLimit = require('express-rate-limit'); // Spam rokne ke liye

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// 1. Caching Setup: Results ko 1 ghante (3600 seconds) tak save rakhega
const cache = new NodeCache({ stdTTL: 3600 });

// 2. Rate Limiter: Ek IP address 1 minute mein maximum 30 requests hi kar sakta hai
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30,
    message: { error: "Aapne bahut zyada requests ki hain, kripya 1 minute baad try karein!" }
});

// API Route (Rate limiter apply kiya gaya hai)
app.get('/api/search', apiLimiter, async (req, res) => {
    try {
        // Query ko clean karna (extra spaces hatana)
        const query = req.query.song?.trim();
        if (!query) {
            return res.status(400).json({ error: "Kripya song ka naam bhejein! (e.g. ?song=tum hi ho)" });
        }

        // 3. Check in Cache First (Fast Response)
        if (cache.has(query)) {
            console.log(`⚡ Cache se result diya: ${query}`);
            return res.json(cache.get(query));
        }

        const apiUrl = `https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=${encodeURIComponent(query)}`;
        console.log(`🔎 Naya API call ho raha hai: ${query}`);
        
        // 4. Timeout Add kiya (Agar third-party API 8 second me reply na de toh error dega, server latkega nahi)
        const response = await axios.get(apiUrl, { timeout: 8000 });
        
        // 5. Modern Optional Chaining (?.) se code clean kiya
        const songsData = response.data?.data?.results || response.data?.results || [];

        if (!Array.isArray(songsData) || songsData.length === 0) {
            console.log("❌ API ne koi result nahi diya.");
            return res.status(404).json({ error: "Koi gaana nahi mila!" });
        }
        
        // Helper function (High quality link nikalne ke liye)
        const getHighQualityLink = (arr) => {
            return (Array.isArray(arr) && arr.length > 0) ? arr[arr.length - 1].link : "";
        };

        const cleanSongs = songsData.map(song => {
            return {
                id: song.id || Date.now().toString(),
                title: song.name || song.title || "Unknown Song",
                artist: song.primaryArtists || song.singers || "Unknown Artist",
                image: getHighQualityLink(song.image) || "https://via.placeholder.com/150",
                audioUrl: getHighQualityLink(song.downloadUrl)
            };
        });

        // Jin gaano ka audio link mila hai, sirf unhi ko filter karenge
        const validSongs = cleanSongs.filter(song => song.audioUrl !== "").slice(0, 10);
        
        if (validSongs.length === 0) {
            return res.status(404).json({ error: "Gaane mile par play karne layak link nahi mila!" });
        }

        // 6. Result ko cache me save karein future use ke liye
        cache.set(query, validSongs);

        // Vercel Serverless Edge Cache (Global fast response ke liye)
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        res.json(validSongs); 

    } catch (error) {
        console.error("❌ API Error:", error.message);
        
        // Error handling thodi detail mein
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ error: "Gaana dhundhne mein bahut waqt lag raha hai (Timeout)." });
        }
        res.status(500).json({ error: "Server connect nahi ho paya, thodi der baad try karein!" });
    }
});

// Vercel par 'app.listen' ki zarurat nahi hoti, isliye isko condition me rakha hai
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Next-Level Smart Server chal raha hai: http://localhost:${PORT}`);
    });
}

// Vercel Serverless Function ke liye Express app ko export karna ZAROORI hai
module.exports = app;
