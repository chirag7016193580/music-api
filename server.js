const express = require('express');
const cors = require('cors');
const axios = require('axios'); 

const app = express();

// CORS ko configure karein taaki kisi bhi frontend se request aa sake
app.use(cors());

// Root route check karne ke liye ki server chal raha hai
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Music API - Running</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
        }
        .status {
            color: #28a745;
            font-weight: bold;
        }
        code {
            background-color: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
        .endpoint {
            margin-top: 20px;
            padding: 15px;
            background-color: #f8f9fa;
            border-left: 4px solid #007bff;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎵 Music API</h1>
        <p class="status">✅ API Chal Rahi Hai!</p>
        <div class="endpoint">
            <h2>Endpoint:</h2>
            <p>Music search karne ke liye:</p>
            <code>/api/search?song=Galiyan</code>
        </div>
    </div>
    <script>
        window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
    </script>
    <script defer src="/_vercel/speed-insights/script.js"></script>
</body>
</html>
    `);
});

app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.song;
        if (!query) return res.json({ error: "Kripya 'song' query parameter dein." });

        const apiUrl = `https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=${encodeURIComponent(query)}`;
        console.log(`🔎 Gaana search ho raha hai: ${query}`);
        
        const response = await axios.get(apiUrl);
        
        let songsData = [];
        if (response.data && response.data.data && response.data.data.results) {
            songsData = response.data.data.results;
        } else if (response.data && response.data.results) {
            songsData = response.data.results;
        }

        if (songsData.length === 0) {
            console.log("❌ API ne koi result nahi diya.");
            return res.json([]);
        }
        
        const cleanSongs = songsData.map(song => {
            let audioLink = "";
            if (song.downloadUrl && Array.isArray(song.downloadUrl)) {
                audioLink = song.downloadUrl[song.downloadUrl.length - 1].link; 
            }

            let imageLink = "";
            if (song.image && Array.isArray(song.image)) {
                imageLink = song.image[song.image.length - 1].link;
            }

            return {
                title: song.name || song.title || "Unknown Song",
                artist: song.primaryArtists || song.singers || "Unknown Artist",
                image: imageLink || "https://via.placeholder.com/150",
                audioUrl: audioLink
            };
        });

        const validSongs = cleanSongs.filter(song => song.audioUrl !== "");
        res.json(validSongs.slice(0, 10)); 

    } catch (error) {
        console.error("❌ API Error:", error.message);
        res.status(500).json({ error: "Server connect nahi ho paya!" });
    }
});

// Ye local testing ke liye hai
if (process.env.NODE_ENV !== 'production') {
    const PORT = 3000;
    app.listen(PORT, () => {
        console.log(`✅ Local Server chal raha hai: http://localhost:${PORT}`);
    });
}

// Vercel ke liye app ko export karna zaruri hai
module.exports = app;